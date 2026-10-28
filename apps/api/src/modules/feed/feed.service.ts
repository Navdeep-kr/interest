import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { DatabaseService } from '../../database/database.service';
import { ExperimentsService } from '../experiments/experiments.service';
import { GetFeedDto, FeedControlInputDto } from './dto/feed.dto';
import {
  FeedResponseDto,
  FeedControlResponse,
  FeedMode,
  FeedControlAction,
  CandidateSource,
  ReelItem,
  ReelStatus,
  PrefetchReelItem,
} from '@shared/types';
import { FeedRankingEngine, CandidateReel, ScoredReel, RankingWeightsConfig } from './feed-ranking.engine';
import { computeVectorCentroid, applyVectorDrift } from '@shared/vector-math';

interface FeedCursorData {
  offset: number;
  timestamp: number;
  mode: FeedMode;
  interestId?: string;
}

@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);
  private readonly redisClient: Redis;

  // Exploration ratio: 10-15% of delivered slots
  private readonly EXPLORATION_RATIO = 0.15;
  // Guaranteed test audience slots for emerging creators: 1 slot per 10-item batch
  private readonly TEST_AUDIENCE_TARGET_SLOTS = 1;
  // Cache TTL: 5 minutes for candidate feed cache, 14 days for seen set
  private readonly CACHE_TTL_SECONDS = 300;
  private readonly SEEN_TTL_SECONDS = 14 * 24 * 3600;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    @Optional() private readonly experimentsService?: ExperimentsService,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    this.redisClient.connect().catch((err) => {
      this.logger.warn(`Redis connection deferred: ${err.message}`);
    });
  }

  /**
   * Generates a personalized infinite feed with multi-source candidate generation,
   * multi-objective ranking, cold-start guarantees, Redis caching, and prefetching.
   * STRICT ZERO-LOCATION GUARANTEE: Evaluated solely on interest vectors and behavioral signals.
   */
  async getPersonalizedFeed(userId: string, query: GetFeedDto): Promise<FeedResponseDto> {
    const limit = query.limit || 10;
    const mode = query.mode || FeedMode.FOR_YOU;
    const cursorData = this.decodeCursor(query.cursor, mode, query.interestId);

    // 1. Resolve Interest Context for INTEREST mode
    let targetInterest: { id: string; slug: string; title: string } | null = null;
    if (mode === FeedMode.INTEREST) {
      targetInterest = await this.resolveTargetInterest(query.interestId, query.interestSlug);
      if (!targetInterest) {
        throw new NotFoundException('Specified interest category does not exist');
      }
    }

    // 2. Fetch User Interest Vector & Affinities (Cold start fallback if onboarding just completed)
    const { userVectorStr, userAffinities, mutedInterestIds } =
      await this.getUserInterestProfile(userId);

    // 3. Fetch Blocked User IDs, Muted Creators, and Hidden Reel IDs (Safety & Negative Feedback Filters)
    const [blockedUserIds, mutedUserIds, hiddenReelIds] = await Promise.all([
      this.getBlockedUserIds(userId),
      this.getMutedUserIds(userId),
      this.getHiddenReelIds(userId),
    ]);

    // 4. Fetch Seen Reel IDs from Redis
    const seenKey = `user:${userId}:seen_reels`;
    const seenReelIds = await this.getSeenReelIds(seenKey);

    // 5. Check Redis Feed Cache (for page 1 requests without offset cursor)
    const cacheKey = `user:${userId}:feed_cache:${mode}:${targetInterest?.id || 'all'}`;
    if (!cursorData.offset && (await this.isRedisReady())) {
      try {
        const cachedPayload = await this.redisClient.get(cacheKey);
        if (cachedPayload) {
          const cachedItems: ReelItem[] = JSON.parse(cachedPayload);
          if (cachedItems.length >= limit) {
            const pageItems = cachedItems.slice(0, limit);
            const remainingCached = cachedItems.slice(limit);
            if (remainingCached.length > 0) {
              await this.redisClient.setex(
                cacheKey,
                this.CACHE_TTL_SECONDS,
                JSON.stringify(remainingCached),
              );
            } else {
              await this.redisClient.del(cacheKey);
            }

            await this.markReelsAsSeen(seenKey, pageItems);
            const prefetch = this.generatePrefetchItems(remainingCached.slice(0, 3));
            const nextCursor = this.encodeCursor({
              offset: cursorData.offset + pageItems.length,
              timestamp: cursorData.timestamp,
              mode,
              interestId: targetInterest?.id,
            });

            return {
              items: pageItems,
              prefetch,
              nextCursor,
              hasMore: remainingCached.length > 0,
              batchTimestamp: Date.now(),
              mode,
              interestFilter: targetInterest,
            };
          }
        }
      } catch (cacheErr: any) {
        this.logger.warn(`Redis feed cache read skipped: ${cacheErr.message}`);
      }
    }

    // 6. Multi-Source Candidate Generation based on Feed Mode
    let candidatePool: CandidateReel[] = [];

    if (mode === FeedMode.FOLLOWING) {
      // Mode: FOLLOWING (recent reels from followed creators, authorized for viewer)
      candidatePool = await this.generateFollowingCandidates(
        userId,
        userVectorStr,
        seenReelIds,
        blockedUserIds,
        mutedUserIds,
        hiddenReelIds,
        mutedInterestIds,
        50,
      );
    } else if (mode === FeedMode.INTEREST && targetInterest) {
      // Mode: INTEREST (strictly reels tagged with target interest or sub-niches)
      candidatePool = await this.generateInterestSpecificCandidates(
        targetInterest.id,
        userVectorStr,
        seenReelIds,
        blockedUserIds,
        mutedUserIds,
        hiddenReelIds,
        mutedInterestIds,
        userId,
        50,
      );
    } else {
      // Mode: FOR_YOU (Blended Multi-Source: Vector + Trending + Following + Test Audience + Exploration)
      candidatePool = await this.generateBlendedCandidates(
        userId,
        userVectorStr,
        userAffinities,
        seenReelIds,
        blockedUserIds,
        mutedUserIds,
        hiddenReelIds,
        mutedInterestIds,
      );
    }

    // 7. Deduplicate Candidate Pool
    const uniqueCandidates = this.deduplicateCandidates(candidatePool);

    // 8. Multi-Objective Ranking & Diversity Re-Ranking (with A/B Testing Experiment variant weights)
    let dynamicWeights: RankingWeightsConfig | undefined;
    if (this.experimentsService && userId) {
      try {
        const expConfig = await this.experimentsService.getFeedRankingConfig(userId);
        dynamicWeights = expConfig.weights;
      } catch {
        // Fallback to default weights
      }
    }

    const scoredCandidates = FeedRankingEngine.rankCandidates(
      uniqueCandidates,
      userAffinities,
      new Date(),
      dynamicWeights,
    );

    // 9. Structured Interleaving for FOR_YOU Mode (Guaranteed Test Audience & Exploration Slots)
    let finalizedScoredList: ScoredReel[] = scoredCandidates;
    if (mode === FeedMode.FOR_YOU) {
      finalizedScoredList = this.interleaveBlendedFeed(scoredCandidates, limit);
    }

    // 10. Slice Current Batch and Cache Remainder
    const pageScored = finalizedScoredList.slice(0, limit);
    const remainderScored = finalizedScoredList.slice(limit);
    const pageItems = pageScored.map((s) => FeedRankingEngine.mapToReelItem(s));
    const remainderItems = remainderScored.map((s) => FeedRankingEngine.mapToReelItem(s));

    // 11. Prefetch Generation for Next 3 Reels (0ms perceived buffering latency)
    const prefetch = this.generatePrefetchItems(remainderItems.slice(0, 3));

    // 12. Persist Cache & Update Seen Reels in Redis
    if (await this.isRedisReady()) {
      try {
        if (remainderItems.length > 0) {
          await this.redisClient.setex(
            cacheKey,
            this.CACHE_TTL_SECONDS,
            JSON.stringify(remainderItems),
          );
        }
        await this.markReelsAsSeen(seenKey, pageItems);
      } catch (writeErr: any) {
        this.logger.warn(`Redis state persistence deferred: ${writeErr.message}`);
      }
    }

    // 13. Track Test Audience Delivery for Emerging Creators
    await this.recordTestAudienceDelivery(pageItems);

    const nextCursor =
      pageItems.length >= limit
        ? this.encodeCursor({
            offset: cursorData.offset + pageItems.length,
            timestamp: cursorData.timestamp,
            mode,
            interestId: targetInterest?.id,
          })
        : null;

    return {
      items: pageItems,
      prefetch,
      nextCursor,
      hasMore: pageItems.length >= limit || remainderItems.length > 0,
      batchTimestamp: Date.now(),
      mode,
      interestFilter: targetInterest,
    };
  }

  /**
   * Applies viewer control feedback ("Show less of this", "Not interested", "Pause this interest").
   */
  async applyFeedControl(userId: string, dto: FeedControlInputDto): Promise<FeedControlResponse> {
    const reelRes = await this.databaseService.query(
      `SELECT r.id, r.creator_id, r.embedding::text,
              ri.interest_id as primary_interest_id
       FROM reels r
       LEFT JOIN reel_interests ri ON r.id = ri.reel_id AND ri.is_primary = TRUE
       WHERE r.id = $1`,
      [dto.reelId],
    );

    if (reelRes.rows.length === 0) {
      throw new NotFoundException(`Reel not found: ${dto.reelId}`);
    }

    const reel = reelRes.rows[0];
    const targetInterestId = dto.interestId || reel.primary_interest_id;

    // Immediately add to Redis seen set so reel disappears from view
    const seenKey = `user:${userId}:seen_reels`;
    if (await this.isRedisReady()) {
      await this.redisClient.sadd(seenKey, dto.reelId);
    }

    // Persist in user_hidden_reels so it is permanently excluded
    try {
      await this.databaseService.query(
        `INSERT INTO user_hidden_reels (user_id, reel_id, created_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id, reel_id) DO NOTHING`,
        [userId, dto.reelId],
      );
    } catch (err: any) {
      this.logger.warn(`Failed to persist user_hidden_reels: ${err.message}`);
    }

    if (dto.action === FeedControlAction.SHOW_LESS) {
      // Reduce affinity weight by -0.15 and apply negative vector nudge (-0.05)
      if (targetInterestId) {
        await this.databaseService.query(
          `UPDATE user_interests
           SET affinity_weight = GREATEST(0.10, affinity_weight - 0.15),
               updated_at = NOW()
           WHERE user_id = $1 AND interest_id = $2`,
          [userId, targetInterestId],
        );
      }

      await this.nudgeUserVectorNegative(userId, reel.embedding, -0.05);

      return {
        success: true,
        action: dto.action,
        message: 'Preference updated: Showing less content like this.',
        interestId: targetInterestId,
      };
    }

    if (dto.action === FeedControlAction.NOT_INTERESTED) {
      // Strongly reduce affinity weight by -0.35 and apply negative vector nudge (-0.12)
      if (targetInterestId) {
        await this.databaseService.query(
          `UPDATE user_interests
           SET affinity_weight = GREATEST(0.10, affinity_weight - 0.35),
               updated_at = NOW()
           WHERE user_id = $1 AND interest_id = $2`,
          [userId, targetInterestId],
        );
      }

      await this.nudgeUserVectorNegative(userId, reel.embedding, -0.12);

      return {
        success: true,
        action: dto.action,
        message: 'Marked not interested: Similar content will be suppressed.',
        interestId: targetInterestId,
      };
    }

    if (dto.action === FeedControlAction.PAUSE_INTEREST) {
      if (!targetInterestId) {
        throw new BadRequestException('Interest ID is required to pause an interest');
      }

      await this.databaseService.query(
        `UPDATE user_interests
         SET is_paused = TRUE,
             updated_at = NOW()
         WHERE user_id = $1 AND interest_id = $2`,
        [userId, targetInterestId],
      );

      return {
        success: true,
        action: dto.action,
        message: 'Interest topic paused: Recommendations frozen until unpaused.',
        interestId: targetInterestId,
      };
    }

    throw new BadRequestException(`Unsupported feed control action: ${dto.action}`);
  }

  /**
   * Resets user feed recommendation preferences, unpauses interest topics,
   * purges negative hidden signals, and clears seen cache.
   */
  async resetFeedPreferences(userId: string): Promise<{ success: boolean; message: string }> {
    // 1. Delete from user_hidden_reels
    try {
      await this.databaseService.query(
        `DELETE FROM user_hidden_reels WHERE user_id = $1`,
        [userId],
      );
    } catch (_) {}

    // 2. Unpause and reset user_interests affinity to default 1.0
    try {
      await this.databaseService.query(
        `UPDATE user_interests
         SET is_paused = FALSE,
             affinity_weight = 1.0,
             updated_at = NOW()
         WHERE user_id = $1`,
        [userId],
      );
    } catch (_) {}

    // 3. Clear Redis seen set and feed caches for clean restart
    if (await this.isRedisReady()) {
      try {
        const seenKey = `user:${userId}:seen_reels`;
        await this.redisClient.del(seenKey);

        const cacheKeys = await this.redisClient.keys(`user:${userId}:feed_cache:*`);
        if (cacheKeys.length > 0) {
          await this.redisClient.del(...cacheKeys);
        }
      } catch (err: any) {
        this.logger.warn(`Redis preference reset partial: ${err.message}`);
      }
    }

    return {
      success: true,
      message: 'Feed preferences and recommendation signals reset to baseline.',
    };
  }

  // ==========================================================================
  // MULTI-SOURCE CANDIDATE GENERATION PIPELINES
  // ==========================================================================

  private async generateBlendedCandidates(
    userId: string,
    userVectorStr: string,
    userAffinities: Map<string, number>,
    seenReelIds: string[],
    blockedUserIds: string[],
    mutedUserIds: string[],
    hiddenReelIds: string[],
    mutedInterestIds: string[],
  ): Promise<CandidateReel[]> {
    const topInterestIds = Array.from(userAffinities.keys()).slice(0, 3);

    const [vectorCandidates, trendingCandidates, followingCandidates, testAudienceCandidates, exploreCandidates] =
      await Promise.all([
        this.fetchVectorSimilarityCandidates(
          userVectorStr,
          seenReelIds,
          blockedUserIds,
          mutedUserIds,
          hiddenReelIds,
          mutedInterestIds,
          userId,
          35,
        ),
        this.fetchTrendingCandidates(
          topInterestIds,
          userVectorStr,
          seenReelIds,
          blockedUserIds,
          mutedUserIds,
          hiddenReelIds,
          mutedInterestIds,
          userId,
          20,
        ),
        this.fetchFollowingCandidates(
          userId,
          userVectorStr,
          seenReelIds,
          blockedUserIds,
          mutedUserIds,
          hiddenReelIds,
          mutedInterestIds,
          15,
        ),
        this.fetchTestAudienceCandidates(
          userVectorStr,
          seenReelIds,
          blockedUserIds,
          mutedUserIds,
          hiddenReelIds,
          mutedInterestIds,
          userId,
          5,
        ),
        this.fetchExplorationCandidates(
          userVectorStr,
          topInterestIds,
          seenReelIds,
          blockedUserIds,
          mutedUserIds,
          hiddenReelIds,
          mutedInterestIds,
          userId,
          15,
        ),
      ]);

    return [
      ...vectorCandidates,
      ...trendingCandidates,
      ...followingCandidates,
      ...testAudienceCandidates,
      ...exploreCandidates,
    ];
  }

  private async fetchVectorSimilarityCandidates(
    userVectorStr: string,
    seenIds: string[],
    blockedIds: string[],
    mutedUserIds: string[],
    hiddenReelIds: string[],
    mutedIds: string[],
    currentUserId: string,
    limit: number,
  ): Promise<CandidateReel[]> {
    const conditions = [
      'r.status = $2',
      'r.visibility = $3',
      'r.creator_id != $4',
    ];
    const params: any[] = [userVectorStr, ReelStatus.PUBLISHED, 'PUBLIC', currentUserId];

    this.applyExclusionFilters(conditions, params, seenIds, blockedIds, mutedUserIds, hiddenReelIds, mutedIds);
    params.push(limit);

    const query = `
      SELECT r.id, r.creator_id, r.title, r.caption, r.hls_master_url,
             r.thumbnail_url, r.duration_seconds, r.view_count, r.like_count,
             r.comment_count, r.save_count, r.share_count, r.quick_skip_count,
             r.test_audience_delivered, r.created_at,
             1 - (r.embedding <=> $1::vector) AS cosine_similarity,
             u.username, u.display_name, u.avatar_url,
             ri.interest_id as primary_interest_id,
             i.title as primary_interest_title,
             EXISTS(SELECT 1 FROM likes l WHERE l.user_id = $4 AND l.reel_id = r.id) as is_liked,
             EXISTS(SELECT 1 FROM saves s WHERE s.user_id = $4 AND s.reel_id = r.id) as is_saved,
             EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = $4 AND f.following_id = r.creator_id AND f.status = 'ACCEPTED') as is_following
      FROM reels r
      JOIN users u ON r.creator_id = u.id
      LEFT JOIN reel_interests ri ON r.id = ri.reel_id AND ri.is_primary = TRUE
      LEFT JOIN interests i ON ri.interest_id = i.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY (r.embedding <=> $1::vector) ASC
      LIMIT $${params.length};
    `;

    const res = await this.databaseService.query(query, params);
    return res.rows.map((row: any) =>
      this.mapRowToCandidate(row, CandidateSource.VECTOR_SIMILARITY, false, false),
    );
  }

  private async fetchTrendingCandidates(
    interestIds: string[],
    userVectorStr: string,
    seenIds: string[],
    blockedIds: string[],
    mutedUserIds: string[],
    hiddenReelIds: string[],
    mutedIds: string[],
    currentUserId: string,
    limit: number,
  ): Promise<CandidateReel[]> {
    if (interestIds.length === 0) return [];

    const conditions = [
      'r.status = $2',
      'r.visibility = $3',
      'r.creator_id != $4',
      'ri.interest_id = ANY($5::uuid[])',
      "r.created_at >= NOW() - INTERVAL '7 days'",
    ];
    const params: any[] = [
      userVectorStr,
      ReelStatus.PUBLISHED,
      'PUBLIC',
      currentUserId,
      interestIds,
    ];

    this.applyExclusionFilters(conditions, params, seenIds, blockedIds, mutedUserIds, hiddenReelIds, mutedIds);
    params.push(limit);

    const query = `
      SELECT r.id, r.creator_id, r.title, r.caption, r.hls_master_url,
             r.thumbnail_url, r.duration_seconds, r.view_count, r.like_count,
             r.comment_count, r.save_count, r.share_count, r.quick_skip_count,
             r.test_audience_delivered, r.created_at,
             1 - (r.embedding <=> $1::vector) AS cosine_similarity,
             u.username, u.display_name, u.avatar_url,
             ri.interest_id as primary_interest_id,
             i.title as primary_interest_title,
             EXISTS(SELECT 1 FROM likes l WHERE l.user_id = $4 AND l.reel_id = r.id) as is_liked,
             EXISTS(SELECT 1 FROM saves s WHERE s.user_id = $4 AND s.reel_id = r.id) as is_saved,
             EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = $4 AND f.following_id = r.creator_id AND f.status = 'ACCEPTED') as is_following
      FROM reels r
      JOIN users u ON r.creator_id = u.id
      JOIN reel_interests ri ON r.id = ri.reel_id
      LEFT JOIN interests i ON ri.interest_id = i.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY (r.like_count * 2.0 + r.save_count * 3.0 + r.view_count * 0.1) /
               POWER(EXTRACT(EPOCH FROM (NOW() - r.created_at))/3600.0 + 2.0, 1.3) DESC
      LIMIT $${params.length};
    `;

    const res = await this.databaseService.query(query, params);
    return res.rows.map((row: any) =>
      this.mapRowToCandidate(row, CandidateSource.TRENDING_INTEREST, false, false),
    );
  }

  private async fetchFollowingCandidates(
    userId: string,
    userVectorStr: string,
    seenIds: string[],
    blockedIds: string[],
    mutedUserIds: string[],
    hiddenReelIds: string[],
    mutedIds: string[],
    limit: number,
  ): Promise<CandidateReel[]> {
    const conditions = [
      'r.status = $2',
      'f.follower_id = $3',
      "r.visibility IN ('PUBLIC', 'FOLLOWERS_ONLY')",
      "r.created_at >= NOW() - INTERVAL '30 days'",
    ];
    const params: any[] = [userVectorStr, ReelStatus.PUBLISHED, userId];

    this.applyExclusionFilters(conditions, params, seenIds, blockedIds, mutedUserIds, hiddenReelIds, mutedIds);
    params.push(limit);

    const query = `
      SELECT r.id, r.creator_id, r.title, r.caption, r.hls_master_url,
             r.thumbnail_url, r.duration_seconds, r.view_count, r.like_count,
             r.comment_count, r.save_count, r.share_count, r.quick_skip_count,
             r.test_audience_delivered, r.created_at,
             1 - (r.embedding <=> $1::vector) AS cosine_similarity,
             u.username, u.display_name, u.avatar_url,
             ri.interest_id as primary_interest_id,
             i.title as primary_interest_title,
             EXISTS(SELECT 1 FROM likes l WHERE l.user_id = $3 AND l.reel_id = r.id) as is_liked,
             EXISTS(SELECT 1 FROM saves s WHERE s.user_id = $3 AND s.reel_id = r.id) as is_saved,
             TRUE as is_following
      FROM reels r
      JOIN follows f ON r.creator_id = f.following_id
      JOIN users u ON r.creator_id = u.id
      LEFT JOIN reel_interests ri ON r.id = ri.reel_id AND ri.is_primary = TRUE
      LEFT JOIN interests i ON ri.interest_id = i.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.created_at DESC
      LIMIT $${params.length};
    `;

    const res = await this.databaseService.query(query, params);
    return res.rows.map((row: any) =>
      this.mapRowToCandidate(row, CandidateSource.FOLLOWING, false, false),
    );
  }

  private async fetchTestAudienceCandidates(
    userVectorStr: string,
    seenIds: string[],
    blockedIds: string[],
    mutedUserIds: string[],
    hiddenReelIds: string[],
    mutedIds: string[],
    currentUserId: string,
    limit: number,
  ): Promise<CandidateReel[]> {
    const conditions = [
      'r.status = $2',
      'r.visibility = $3',
      'r.creator_id != $4',
      'r.test_audience_delivered < 500',
      'r.view_count < 300',
      '1 - (r.embedding <=> $1::vector) >= 0.55',
    ];
    const params: any[] = [userVectorStr, ReelStatus.PUBLISHED, 'PUBLIC', currentUserId];

    this.applyExclusionFilters(conditions, params, seenIds, blockedIds, mutedUserIds, hiddenReelIds, mutedIds);
    params.push(limit);

    const query = `
      SELECT r.id, r.creator_id, r.title, r.caption, r.hls_master_url,
             r.thumbnail_url, r.duration_seconds, r.view_count, r.like_count,
             r.comment_count, r.save_count, r.share_count, r.quick_skip_count,
             r.test_audience_delivered, r.created_at,
             1 - (r.embedding <=> $1::vector) AS cosine_similarity,
             u.username, u.display_name, u.avatar_url,
             ri.interest_id as primary_interest_id,
             i.title as primary_interest_title,
             EXISTS(SELECT 1 FROM likes l WHERE l.user_id = $4 AND l.reel_id = r.id) as is_liked,
             EXISTS(SELECT 1 FROM saves s WHERE s.user_id = $4 AND s.reel_id = r.id) as is_saved,
             EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = $4 AND f.following_id = r.creator_id AND f.status = 'ACCEPTED') as is_following
      FROM reels r
      JOIN users u ON r.creator_id = u.id
      LEFT JOIN reel_interests ri ON r.id = ri.reel_id AND ri.is_primary = TRUE
      LEFT JOIN interests i ON ri.interest_id = i.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.created_at DESC
      LIMIT $${params.length};
    `;

    const res = await this.databaseService.query(query, params);
    return res.rows.map((row: any) =>
      this.mapRowToCandidate(row, CandidateSource.TEST_AUDIENCE, false, true),
    );
  }

  private async fetchExplorationCandidates(
    userVectorStr: string,
    userInterestIds: string[],
    seenIds: string[],
    blockedIds: string[],
    mutedUserIds: string[],
    hiddenReelIds: string[],
    mutedIds: string[],
    currentUserId: string,
    limit: number,
  ): Promise<CandidateReel[]> {
    const conditions = [
      'r.status = $2',
      'r.visibility = $3',
      'r.creator_id != $4',
    ];
    const params: any[] = [userVectorStr, ReelStatus.PUBLISHED, 'PUBLIC', currentUserId];

    if (userInterestIds.length > 0) {
      params.push(userInterestIds);
      conditions.push(`NOT EXISTS (
        SELECT 1 FROM reel_interests rim
        WHERE rim.reel_id = r.id AND rim.interest_id = ANY($${params.length}::uuid[])
      )`);
    }

    this.applyExclusionFilters(conditions, params, seenIds, blockedIds, mutedUserIds, hiddenReelIds, mutedIds);
    params.push(limit);

    const query = `
      SELECT r.id, r.creator_id, r.title, r.caption, r.hls_master_url,
             r.thumbnail_url, r.duration_seconds, r.view_count, r.like_count,
             r.comment_count, r.save_count, r.share_count, r.quick_skip_count,
             r.test_audience_delivered, r.created_at,
             1 - (r.embedding <=> $1::vector) AS cosine_similarity,
             u.username, u.display_name, u.avatar_url,
             ri.interest_id as primary_interest_id,
             i.title as primary_interest_title,
             EXISTS(SELECT 1 FROM likes l WHERE l.user_id = $4 AND l.reel_id = r.id) as is_liked,
             EXISTS(SELECT 1 FROM saves s WHERE s.user_id = $4 AND s.reel_id = r.id) as is_saved,
             EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = $4 AND f.following_id = r.creator_id AND f.status = 'ACCEPTED') as is_following
      FROM reels r
      JOIN users u ON r.creator_id = u.id
      LEFT JOIN reel_interests ri ON r.id = ri.reel_id AND ri.is_primary = TRUE
      LEFT JOIN interests i ON ri.interest_id = i.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY RANDOM() * (1.0 + LN(1 + r.like_count * 0.1)) DESC
      LIMIT $${params.length};
    `;

    const res = await this.databaseService.query(query, params);
    return res.rows.map((row: any) =>
      this.mapRowToCandidate(row, CandidateSource.EXPLORATION, true, false),
    );
  }

  private async generateFollowingCandidates(
    userId: string,
    userVectorStr: string,
    seenIds: string[],
    blockedIds: string[],
    mutedUserIds: string[],
    hiddenReelIds: string[],
    mutedIds: string[],
    limit: number,
  ): Promise<CandidateReel[]> {
    return this.fetchFollowingCandidates(
      userId,
      userVectorStr,
      seenIds,
      blockedIds,
      mutedUserIds,
      hiddenReelIds,
      mutedIds,
      limit,
    );
  }

  private async generateInterestSpecificCandidates(
    interestId: string,
    userVectorStr: string,
    seenIds: string[],
    blockedIds: string[],
    mutedUserIds: string[],
    hiddenReelIds: string[],
    mutedIds: string[],
    currentUserId: string,
    limit: number,
  ): Promise<CandidateReel[]> {
    // Include the interest and all its descendants in the taxonomy hierarchy
    const conditions = [
      'r.status = $2',
      'r.visibility = $3',
      `(ri.interest_id = $4 OR ri.interest_id IN (
         SELECT id FROM interests WHERE parent_id = $4
       ))`,
    ];
    const params: any[] = [userVectorStr, ReelStatus.PUBLISHED, 'PUBLIC', interestId];

    this.applyExclusionFilters(conditions, params, seenIds, blockedIds, mutedUserIds, hiddenReelIds, mutedIds);
    params.push(limit);

    const query = `
      SELECT r.id, r.creator_id, r.title, r.caption, r.hls_master_url,
             r.thumbnail_url, r.duration_seconds, r.view_count, r.like_count,
             r.comment_count, r.save_count, r.share_count, r.quick_skip_count,
             r.test_audience_delivered, r.created_at,
             1 - (r.embedding <=> $1::vector) AS cosine_similarity,
             u.username, u.display_name, u.avatar_url,
             ri.interest_id as primary_interest_id,
             i.title as primary_interest_title,
             EXISTS(SELECT 1 FROM likes l WHERE l.user_id = $4 AND l.reel_id = r.id) as is_liked,
             EXISTS(SELECT 1 FROM saves s WHERE s.user_id = $4 AND s.reel_id = r.id) as is_saved,
             EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = $4 AND f.following_id = r.creator_id AND f.status = 'ACCEPTED') as is_following
      FROM reels r
      JOIN users u ON r.creator_id = u.id
      JOIN reel_interests ri ON r.id = ri.reel_id
      LEFT JOIN interests i ON ri.interest_id = i.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY (1 - (r.embedding <=> $1::vector)) * (1.0 + LN(1 + r.like_count * 0.05)) DESC
      LIMIT $${params.length};
    `;

    const res = await this.databaseService.query(query, params);
    return res.rows.map((row: any) =>
      this.mapRowToCandidate(row, CandidateSource.VECTOR_SIMILARITY, false, false),
    );
  }

  // ==========================================================================
  // MULTI-STAGE PRE- & POST-FILTERS
  // ==========================================================================

  private applyExclusionFilters(
    conditions: string[],
    params: any[],
    seenIds: string[] = [],
    blockedIds: string[] = [],
    mutedUserIds: string[] = [],
    hiddenReelIds: string[] = [],
    mutedInterestIds: string[] = [],
  ) {
    // 1. Filter out already seen reels
    if (seenIds && seenIds.length > 0) {
      params.push(seenIds);
      conditions.push(`r.id != ALL($${params.length}::uuid[])`);
    }

    // 2. Filter out blocked creators (bidirectional)
    if (blockedIds && blockedIds.length > 0) {
      params.push(blockedIds);
      conditions.push(`r.creator_id != ALL($${params.length}::uuid[])`);
    }

    // 3. Filter out muted creators (negative feedback)
    if (mutedUserIds && mutedUserIds.length > 0) {
      params.push(mutedUserIds);
      conditions.push(`r.creator_id != ALL($${params.length}::uuid[])`);
    }

    // 4. Filter out explicitly hidden reels (negative feedback)
    if (hiddenReelIds && hiddenReelIds.length > 0) {
      params.push(hiddenReelIds);
      conditions.push(`r.id != ALL($${params.length}::uuid[])`);
    }

    // 5. Filter out muted interest topics
    if (mutedInterestIds && mutedInterestIds.length > 0) {
      params.push(mutedInterestIds);
      conditions.push(`NOT EXISTS (
        SELECT 1 FROM reel_interests rim
        WHERE rim.reel_id = r.id AND rim.interest_id = ANY($${params.length}::uuid[])
      )`);
    }

    // 6. Filter out low quality content: quick skip ratio > 0.75 for reels with >= 50 views
    conditions.push(`NOT (r.view_count >= 50 AND (r.quick_skip_count::float / r.view_count::float) > 0.75)`);

    // 7. Trust & Safety: Filter out unapproved, rejected, or taken-down content
    conditions.push(`(r.moderation_status = 'APPROVED' OR r.moderation_status IS NULL)`);
  }

  private deduplicateCandidates(candidates: CandidateReel[]): CandidateReel[] {
    const seen = new Set<string>();
    const unique: CandidateReel[] = [];
    for (const c of candidates) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        unique.push(c);
      }
    }
    return unique;
  }

  /**
   * Interleaves high-relevance matches with 1 guaranteed test-audience slot
   * and 1-2 exploration serendipity slots per 10-reel feed window.
   */
  private interleaveBlendedFeed(scored: ScoredReel[], limit: number): ScoredReel[] {
    const testAudiencePool = scored.filter((s) => s.isTestAudienceSlot);
    const explorationPool = scored.filter((s) => s.isExplorationSlot);
    const primaryPool = scored.filter((s) => !s.isTestAudienceSlot && !s.isExplorationSlot);

    const result: ScoredReel[] = [];
    let pIdx = 0;
    let tIdx = 0;
    let eIdx = 0;

    while (result.length < limit && (pIdx < primaryPool.length || tIdx < testAudiencePool.length || eIdx < explorationPool.length)) {
      // 1. Push 3-4 primary high-scoring items
      for (let i = 0; i < 3 && pIdx < primaryPool.length && result.length < limit; i++) {
        result.push(primaryPool[pIdx++]);
      }

      // 2. Insert 1 test audience slot if available (guaranteed emerging creator allocation)
      if (tIdx < testAudiencePool.length && result.length < limit) {
        result.push(testAudiencePool[tIdx++]);
      }

      // 3. Push 2 more primary items
      for (let i = 0; i < 2 && pIdx < primaryPool.length && result.length < limit; i++) {
        result.push(primaryPool[pIdx++]);
      }

      // 4. Insert 1 exploration slot for serendipity
      if (eIdx < explorationPool.length && result.length < limit) {
        result.push(explorationPool[eIdx++]);
      }
    }

    // Fill remaining if needed
    while (result.length < limit && pIdx < primaryPool.length) {
      result.push(primaryPool[pIdx++]);
    }

    return result;
  }

  // ==========================================================================
  // PROFILE, COLD-START & PREFETCH HELPERS
  // ==========================================================================

  private async getUserInterestProfile(userId: string): Promise<{
    userVectorStr: string;
    userAffinities: Map<string, number>;
    mutedInterestIds: string[];
  }> {
    const userRes = await this.databaseService.query(
      'SELECT id, interest_vector::text FROM users WHERE id = $1',
      [userId],
    );

    let userVectorStr = userRes.rows[0]?.interest_vector;
    const affinitiesRes = await this.databaseService.query(
      `SELECT interest_id, affinity_weight, is_muted, is_paused
       FROM user_interests
       WHERE user_id = $1`,
      [userId],
    );

    const userAffinities = new Map<string, number>();
    const mutedInterestIds: string[] = [];

    for (const row of affinitiesRes.rows) {
      if (row.is_muted) {
        mutedInterestIds.push(row.interest_id);
      } else if (!row.is_paused) {
        userAffinities.set(row.interest_id, parseFloat(row.affinity_weight));
      }
    }

    // Cold-Start: If user does not have a vector centroid yet, compute from onboarding interests
    if (!userVectorStr) {
      userVectorStr = await this.computeColdStartUserVector(userId, affinitiesRes.rows);
    }

    return { userVectorStr, userAffinities, mutedInterestIds };
  }

  private async computeColdStartUserVector(userId: string, userInterests: any[]): Promise<string> {
    if (userInterests.length > 0) {
      const interestIds = userInterests.filter((ui) => !ui.is_muted).map((ui) => ui.interest_id);
      if (interestIds.length > 0) {
        const vectorsRes = await this.databaseService.query(
          `SELECT vector::text FROM interests WHERE id = ANY($1::uuid[])`,
          [interestIds],
        );

        if (vectorsRes.rows.length > 0) {
          const vectors = vectorsRes.rows.map((r) => DatabaseService.pgToVector(r.vector));
          const centroid = computeVectorCentroid(vectors);
          const centroidPg = DatabaseService.vectorToPg(centroid);

          // Save centroid to users table
          await this.databaseService.query(
            'UPDATE users SET interest_vector = $1::vector, updated_at = NOW() WHERE id = $2',
            [centroidPg, userId],
          );
          return centroidPg;
        }
      }
    }

    // Fallback vector from root taxonomy node
    const fallback = await this.getFallbackVector();
    return fallback;
  }

  private async getBlockedUserIds(userId: string): Promise<string[]> {
    const res = await this.databaseService.query(
      `SELECT blocked_id FROM blocks WHERE blocker_id = $1
       UNION
       SELECT blocker_id FROM blocks WHERE blocked_id = $1`,
      [userId],
    );
    return res?.rows ? res.rows.map((r: any) => r.blocked_id) : [];
  }

  private async getMutedUserIds(userId: string): Promise<string[]> {
    try {
      const res = await this.databaseService.query(
        `SELECT muted_id FROM user_mutes WHERE muter_id = $1`,
        [userId],
      );
      return res?.rows ? res.rows.map((r: any) => r.muted_id) : [];
    } catch {
      return [];
    }
  }

  private async getHiddenReelIds(userId: string): Promise<string[]> {
    try {
      const res = await this.databaseService.query(
        `SELECT reel_id FROM user_hidden_reels WHERE user_id = $1`,
        [userId],
      );
      return res?.rows ? res.rows.map((r: any) => r.reel_id) : [];
    } catch {
      return [];
    }
  }

  private async resolveTargetInterest(
    interestId?: string,
    interestSlug?: string,
  ): Promise<{ id: string; slug: string; title: string } | null> {
    if (interestId) {
      const res = await this.databaseService.query(
        'SELECT id, slug, title FROM interests WHERE id = $1',
        [interestId],
      );
      return res.rows[0] || null;
    }
    if (interestSlug) {
      const res = await this.databaseService.query(
        'SELECT id, slug, title FROM interests WHERE slug = $1',
        [interestSlug],
      );
      return res.rows[0] || null;
    }
    return null;
  }

  private async nudgeUserVectorNegative(
    userId: string,
    reelEmbeddingStr: string,
    alpha: number,
  ): Promise<void> {
    if (!reelEmbeddingStr) return;

    const userRes = await this.databaseService.query(
      'SELECT interest_vector::text FROM users WHERE id = $1',
      [userId],
    );

    if (userRes.rows[0]?.interest_vector) {
      const currentVector = DatabaseService.pgToVector(userRes.rows[0].interest_vector);
      const reelVector = DatabaseService.pgToVector(reelEmbeddingStr);
      const nudgedVector = applyVectorDrift(currentVector, reelVector, alpha);
      const nudgedPg = DatabaseService.vectorToPg(nudgedVector);

      await this.databaseService.query(
        'UPDATE users SET interest_vector = $1::vector, updated_at = NOW() WHERE id = $2',
        [nudgedPg, userId],
      );
    }
  }

  private generatePrefetchItems(nextReels: ReelItem[]): PrefetchReelItem[] {
    return nextReels.map((reel) => {
      // Generate URL to first 2-second video segment for instant playback
      const masterUrl = reel.hlsMasterUrl || '';
      const baseUrl = masterUrl.substring(0, masterUrl.lastIndexOf('/'));
      const firstSegmentUrl = `${baseUrl}/stream_720p/segment_0.ts`;

      return {
        id: reel.id,
        hlsMasterUrl: reel.hlsMasterUrl,
        thumbnailUrl: reel.thumbnailUrl,
        firstSegmentUrl,
      };
    });
  }

  private async recordTestAudienceDelivery(items: ReelItem[]): Promise<void> {
    const testAudienceIds = items.filter((i) => i.isTestAudienceSlot).map((i) => i.id);
    if (testAudienceIds.length > 0) {
      await this.databaseService.query(
        `UPDATE reels
         SET test_audience_delivered = test_audience_delivered + 1
         WHERE id = ANY($1::uuid[])`,
        [testAudienceIds],
      );
    }
  }

  private async getSeenReelIds(seenKey: string): Promise<string[]> {
    if (!(await this.isRedisReady())) return [];
    try {
      return await this.redisClient.smembers(seenKey);
    } catch {
      return [];
    }
  }

  private async markReelsAsSeen(seenKey: string, items: ReelItem[]): Promise<void> {
    if (!(await this.isRedisReady()) || items.length === 0) return;
    try {
      const ids = items.map((i) => i.id);
      await this.redisClient.sadd(seenKey, ...ids);
      await this.redisClient.expire(seenKey, this.SEEN_TTL_SECONDS);
    } catch (err: any) {
      this.logger.warn(`Could not record seen reels in Redis: ${err.message}`);
    }
  }

  private async isRedisReady(): Promise<boolean> {
    return this.redisClient && this.redisClient.status === 'ready';
  }

  private encodeCursor(data: FeedCursorData): string {
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  private decodeCursor(
    cursor?: string,
    mode: FeedMode = FeedMode.FOR_YOU,
    interestId?: string,
  ): FeedCursorData {
    if (!cursor) {
      return { offset: 0, timestamp: Date.now(), mode, interestId };
    }
    try {
      const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
      return {
        offset: typeof decoded.offset === 'number' ? decoded.offset : 0,
        timestamp: typeof decoded.timestamp === 'number' ? decoded.timestamp : Date.now(),
        mode: decoded.mode || mode,
        interestId: decoded.interestId || interestId,
      };
    } catch {
      return { offset: 0, timestamp: Date.now(), mode, interestId };
    }
  }

  private computeExplanation(
    row: any,
    source: CandidateSource,
    isExploration: boolean,
    isTestAudience: boolean,
  ): string {
    const topic = row.primary_interest_title || 'your interests';
    if (source === CandidateSource.FOLLOWING || row.is_following) {
      return `From @${row.username} whom you follow`;
    }
    if (isTestAudience) {
      return `Emerging creator in #${topic}`;
    }
    if (isExploration) {
      return `Suggested to explore #${topic}`;
    }
    if (source === CandidateSource.TRENDING_INTEREST) {
      return `Trending in #${topic}`;
    }
    return `Because you're interested in #${topic}`;
  }

  private mapRowToCandidate(
    row: any,
    source: CandidateSource,
    isExploration: boolean,
    isTestAudience: boolean,
  ): CandidateReel {
    return {
      id: row.id,
      creatorId: row.creator_id,
      creatorUsername: row.username,
      creatorDisplayName: row.display_name,
      creatorAvatarUrl: row.avatar_url,
      title: row.title,
      caption: row.caption,
      hlsMasterUrl: row.hls_master_url,
      thumbnailUrl: row.thumbnail_url,
      durationSeconds: parseFloat(row.duration_seconds || '15'),
      primaryInterestId: row.primary_interest_id,
      interestTags: row.primary_interest_title ? [row.primary_interest_title] : [],
      viewCount: parseInt(row.view_count || '0', 10),
      likeCount: parseInt(row.like_count || '0', 10),
      commentCount: parseInt(row.comment_count || '0', 10),
      saveCount: parseInt(row.save_count || '0', 10),
      shareCount: parseInt(row.share_count || '0', 10),
      quickSkipCount: parseInt(row.quick_skip_count || '0', 10),
      testAudienceDelivered: parseInt(row.test_audience_delivered || '0', 10),
      cosineSimilarity: parseFloat(row.cosine_similarity || '0'),
      createdAt: new Date(row.created_at || Date.now()),
      candidateSource: source,
      isExplorationSlot: isExploration,
      isTestAudienceSlot: isTestAudience,
      isAiGenerated: Boolean(row.is_ai_generated),
      aiLabelType: row.ai_label_type,
      isAgeRestricted: Boolean(row.is_age_restricted),
      isLiked: Boolean(row.is_liked),
      isSaved: Boolean(row.is_saved),
      isFollowing: Boolean(row.is_following),
      explanation: this.computeExplanation(row, source, isExploration, isTestAudience),
    };
  }

  private async getFallbackVector(): Promise<string> {
    const sample = await this.databaseService.query(
      'SELECT vector::text FROM interests ORDER BY level ASC LIMIT 1',
    );
    if (sample.rows.length > 0) {
      return sample.rows[0].vector;
    }
    const fallback = new Array(512).fill(0);
    fallback[0] = 1.0;
    return DatabaseService.vectorToPg(fallback);
  }
}
