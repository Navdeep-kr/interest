import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  SearchType,
  UnifiedSearchResults,
  ReelSearchResult,
  UserSearchResult,
  HashtagSearchResult,
  InterestSearchResult,
  AudioSearchResult,
  CommunitySearchResult,
  RecentSearchItem,
  SafeAutocompleteResult,
  SafeAutocompleteSuggestion,
  TransparentTrendingWindow,
  TrendingInterest,
  ExplorePayload,
  InterestTaxonomyNode,
} from '@interest/shared';
import { SearchQueryDto } from './dto/search.dto';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly prohibitedTerms = new Set<string>([
    'csam',
    'illicit_drugs',
    'credit card dumps',
    'stolen accounts',
    'malware distribution',
    'child exploitation',
  ]);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Unified search across reels, users, hashtags, interests, audio, and communities.
   * Ranked strictly by relevance and interest match. Zero location weighting.
   */
  async search(
    userId: string | null,
    dto: SearchQueryDto,
  ): Promise<UnifiedSearchResults | any> {
    const rawQuery = dto.q.trim();
    const type = dto.type || SearchType.ALL;
    const limit = dto.limit || 20;
    const offset = dto.offset || 0;

    if (!rawQuery) {
      return {
        query: '',
        reels: [],
        users: [],
        hashtags: [],
        interests: [],
        audio: [],
        communities: [],
        totalCount: 0,
      };
    }

    // Prohibited & spam term moderation check (instant in-memory)
    const isProhibited = await this.checkProhibitedQuery(rawQuery);
    if (isProhibited) {
      return {
        query: rawQuery,
        reels: [],
        users: [],
        hashtags: [],
        interests: [],
        audio: [],
        communities: [],
        totalCount: 0,
        isProhibited: true,
        moderationMessage: 'This search query contains terms prohibited by community guidelines.',
        emptySuggestions: this.getEmptySuggestions(),
      };
    }

    if (type === SearchType.REELS) {
      const reels = await this.searchReels(userId, rawQuery, limit, offset);
      return { query: rawQuery, type, reels, totalCount: reels.length };
    }

    if (type === SearchType.USERS) {
      const users = await this.searchUsers(userId, rawQuery, limit, offset);
      return { query: rawQuery, type, users, totalCount: users.length };
    }

    if (type === SearchType.HASHTAGS) {
      const hashtags = await this.searchHashtags(rawQuery, limit, offset);
      return { query: rawQuery, type, hashtags, totalCount: hashtags.length };
    }

    if (type === SearchType.INTERESTS) {
      const interests = await this.searchInterests(userId, rawQuery, limit, offset);
      return { query: rawQuery, type, interests, totalCount: interests.length };
    }

    if (type === SearchType.AUDIO) {
      const audio = await this.searchAudio(rawQuery, limit, offset);
      return { query: rawQuery, type, audio, totalCount: audio.length };
    }

    if (type === SearchType.COMMUNITIES) {
      const communities = await this.searchCommunities(rawQuery, limit, offset, userId);
      return { query: rawQuery, type, communities, totalCount: communities.length };
    }

    // Default: SearchType.ALL - run 5 parallel searches across core entities
    const [reels, users, hashtags, interests, audio] = await Promise.all([
      this.searchReels(userId, rawQuery, Math.min(limit, 10), 0),
      this.searchUsers(userId, rawQuery, Math.min(limit, 8), 0),
      this.searchHashtags(rawQuery, Math.min(limit, 6), 0),
      this.searchInterests(userId, rawQuery, Math.min(limit, 8), 0),
      this.searchAudio(rawQuery, Math.min(limit, 6), 0),
    ]);

    const communities: CommunitySearchResult[] = [];
    const totalCount =
      reels.length + users.length + hashtags.length + interests.length + audio.length;

    const emptySuggestions = totalCount === 0 ? this.getEmptySuggestions() : undefined;

    return {
      query: rawQuery,
      reels,
      users,
      hashtags,
      interests,
      audio,
      communities,
      totalCount,
      emptySuggestions,
    };
  }

  /**
   * Full-Text Search inside Reels:
   * - Titles, captions, hashtags, and auto-generated transcripts.
   * - Ranking: 45% Text Relevance + 35% Viewer Interest Match + 15% Engagement + 5% Freshness.
   * - Zero Location weighting (0.0%).
   */
  async searchReels(
    userId: string | null,
    queryText: string,
    limit = 20,
    offset = 0,
  ): Promise<ReelSearchResult[]> {
    const cleanTerm = queryText.replace(/['"&|!<>():*]/g, ' ').trim();
    const ilikeParam = `%${queryText}%`;

    // Safe tsquery generation
    const tsqueryParam = cleanTerm
      .split(/\s+/)
      .filter(Boolean)
      .map((term) => `${term}:*`)
      .join(' & ');

    const sql = `
      WITH matching_reels AS (
        SELECT
          r.id,
          r.creator_id,
          r.title,
          r.caption,
          r.transcript_text,
          r.thumbnail_url,
          r.hls_master_url,
          r.hashtags,
          r.view_count,
          r.like_count,
          r.comment_count,
          r.created_at,
          p.username AS creator_username,
          p.display_name AS creator_display_name,
          p.avatar_url AS creator_avatar_url,
          pri.id AS primary_interest_id,
          pri.title AS primary_interest_title,
          -- Text relevance score via ts_rank_cd with ILIKE boosting and typo tolerance
          GREATEST(
            CASE 
              WHEN $2 <> '' AND to_tsvector('english', coalesce(r.title,'') || ' ' || coalesce(r.caption,'') || ' ' || coalesce(r.transcript_text,'') || ' ' || array_to_string(coalesce(r.hashtags, '{}'::text[]), ' ')) @@ to_tsquery('english', $2)
              THEN ts_rank_cd(to_tsvector('english', coalesce(r.title,'') || ' ' || coalesce(r.caption,'') || ' ' || coalesce(r.transcript_text,'') || ' ' || array_to_string(coalesce(r.hashtags, '{}'::text[]), ' ')), to_tsquery('english', $2))
              ELSE 0.1
            END,
            CASE WHEN r.title ILIKE $1 THEN 0.9 ELSE 0.0 END,
            CASE WHEN r.caption ILIKE $1 THEN 0.7 ELSE 0.0 END,
            CASE WHEN r.transcript_text ILIKE $1 THEN 0.8 ELSE 0.0 END,
            CASE WHEN similarity(r.title, $6) > 0.25 THEN similarity(r.title, $6) ELSE 0.0 END,
            0.15
          ) AS raw_text_relevance,
          -- Viewer interest match score (defaults to 0.2 if viewer has no affinity)
          COALESCE(ui.affinity_weight, 0.2) AS viewer_interest_match,
          -- Engagement score log-scale
          LEAST(1.0, LOG(GREATEST(r.view_count + (r.like_count * 2) + 1, 1)) / 10.0) AS engagement_score,
          -- Freshness score decay
          GREATEST(0.1, 1.0 - (EXTRACT(EPOCH FROM (NOW() - r.created_at)) / (86400.0 * 30.0))) AS freshness_score
        FROM reels r
        LEFT JOIN profiles p ON p.user_id = r.creator_id
        LEFT JOIN reel_interests rim ON rim.reel_id = r.id AND rim.is_primary = TRUE
        LEFT JOIN interests pri ON pri.id = rim.interest_id
        LEFT JOIN user_interests ui ON ui.user_id = $3::uuid AND ui.interest_id = pri.id
        WHERE r.status = 'PUBLISHED'
          AND (
            ($2 <> '' AND to_tsvector('english', coalesce(r.title,'') || ' ' || coalesce(r.caption,'') || ' ' || coalesce(r.transcript_text,'') || ' ' || array_to_string(coalesce(r.hashtags, '{}'::text[]), ' ')) @@ to_tsquery('english', $2))
            OR r.title ILIKE $1
            OR r.caption ILIKE $1
            OR r.transcript_text ILIKE $1
            OR array_to_string(coalesce(r.hashtags, '{}'::text[]), ' ') ILIKE $1
            OR similarity(r.title, $6) > 0.25
          )
          AND ($3::uuid = '00000000-0000-0000-0000-000000000000'::uuid OR r.creator_id NOT IN (
            SELECT blocked_id FROM blocks WHERE blocker_id = $3::uuid
            UNION
            SELECT blocker_id FROM blocks WHERE blocked_id = $3::uuid
          ))
          AND (
            r.visibility = 'PUBLIC'
            OR ($3::uuid <> '00000000-0000-0000-0000-000000000000'::uuid AND (
              r.creator_id = $3::uuid
              OR (r.visibility = 'FOLLOWERS_ONLY' AND EXISTS (
                SELECT 1 FROM follows f WHERE f.follower_id = $3::uuid AND f.following_id = r.creator_id AND f.status = 'ACCEPTED'
              ))
            ))
          )
      )
      SELECT
        id,
        title,
        caption,
        transcript_text,
        thumbnail_url,
        hls_master_url,
        hashtags,
        view_count,
        like_count,
        comment_count,
        creator_id,
        creator_username,
        creator_display_name,
        creator_avatar_url,
        primary_interest_id,
        primary_interest_title,
        raw_text_relevance,
        viewer_interest_match,
        (
          (0.45 * LEAST(1.0, raw_text_relevance)) +
          (0.35 * LEAST(1.0, viewer_interest_match)) +
          (0.15 * engagement_score) +
          (0.05 * freshness_score)
        ) AS final_rank_score
      FROM matching_reels
      ORDER BY final_rank_score DESC, view_count DESC
      LIMIT $4 OFFSET $5;
    `;

    try {
      const result = await this.databaseService.query(sql, [
        ilikeParam,
        tsqueryParam,
        userId || '00000000-0000-0000-0000-000000000000',
        limit,
        offset,
        cleanTerm,
      ]);

      return result.rows.map((r) => {
        const { snippet, source } = this.extractMatchSnippet(
          queryText,
          r.title,
          r.caption,
          r.transcript_text,
          r.hashtags,
        );

        return {
          id: r.id,
          title: r.title,
          caption: r.caption || undefined,
          transcriptText: r.transcript_text || undefined,
          thumbnailUrl: r.thumbnail_url || 'https://cdn.interest.app/placeholders/thumb.jpg',
          hlsMasterUrl: r.hls_master_url || 'https://cdn.interest.app/placeholders/stream.m3u8',
          creator: {
            id: r.creator_id,
            username: r.creator_username || 'creator',
            displayName: r.creator_display_name || 'Creator',
            avatarUrl: r.creator_avatar_url || undefined,
          },
          primaryInterest: {
            id: r.primary_interest_id || '00000000-0000-0000-0000-000000000000',
            title: r.primary_interest_title || 'General',
          },
          hashtags: r.hashtags || [],
          viewCount: Number(r.view_count || 0),
          likeCount: Number(r.like_count || 0),
          commentCount: Number(r.comment_count || 0),
          matchSnippet: snippet,
          matchSource: source,
          textRelevanceScore: parseFloat(Number(r.raw_text_relevance || 0).toFixed(3)),
          interestMatchScore: parseFloat(Number(r.viewer_interest_match || 0).toFixed(3)),
          finalRankScore: parseFloat(Number(r.final_rank_score || 0).toFixed(3)),
        };
      });
    } catch (err: any) {
      this.logger.warn(`Search reels error (${err.message}). Falling back to simple query.`, err.stack);
      return this.searchReelsFallback(userId, queryText, limit, offset);
    }
  }

  /**
   * Resilient fallback query for Reels when Postgres full-text parser throws syntax exception.
   */
  private async searchReelsFallback(
    userId: string | null,
    queryText: string,
    limit: number,
    offset: number,
  ): Promise<ReelSearchResult[]> {
    const ilikeParam = `%${queryText}%`;
    const sql = `
      SELECT
        r.id, r.creator_id, r.title, r.caption, r.transcript_text,
        r.thumbnail_url, r.hls_master_url, r.hashtags, r.view_count, r.like_count, r.comment_count,
        p.username AS creator_username, p.display_name AS creator_display_name, p.avatar_url AS creator_avatar_url,
        pri.id AS primary_interest_id, pri.title AS primary_interest_title,
        COALESCE(ui.affinity_weight, 0.2) AS viewer_interest_match
      FROM reels r
      LEFT JOIN profiles p ON p.user_id = r.creator_id
      LEFT JOIN reel_interests rim ON rim.reel_id = r.id AND rim.is_primary = TRUE
      LEFT JOIN interests pri ON pri.id = rim.interest_id
      LEFT JOIN user_interests ui ON ui.user_id = $2::uuid AND ui.interest_id = pri.id
      WHERE r.status = 'PUBLISHED'
        AND (r.title ILIKE $1 OR r.caption ILIKE $1 OR r.transcript_text ILIKE $1)
      ORDER BY viewer_interest_match DESC, r.view_count DESC
      LIMIT $3 OFFSET $4;
    `;
    const result = await this.databaseService.query(sql, [
      ilikeParam,
      userId || '00000000-0000-0000-0000-000000000000',
      limit,
      offset,
    ]);

    return result.rows.map((r) => {
      const { snippet, source } = this.extractMatchSnippet(
        queryText,
        r.title,
        r.caption,
        r.transcript_text,
        r.hashtags,
      );
      return {
        id: r.id,
        title: r.title,
        caption: r.caption || undefined,
        transcriptText: r.transcript_text || undefined,
        thumbnailUrl: r.thumbnail_url || 'https://cdn.interest.app/placeholders/thumb.jpg',
        hlsMasterUrl: r.hls_master_url || 'https://cdn.interest.app/placeholders/stream.m3u8',
        creator: {
          id: r.creator_id,
          username: r.creator_username || 'creator',
          displayName: r.creator_display_name || 'Creator',
          avatarUrl: r.creator_avatar_url || undefined,
        },
        primaryInterest: {
          id: r.primary_interest_id || '00000000-0000-0000-0000-000000000000',
          title: r.primary_interest_title || 'General',
        },
        hashtags: r.hashtags || [],
        viewCount: Number(r.view_count || 0),
        likeCount: Number(r.like_count || 0),
        commentCount: Number(r.comment_count || 0),
        matchSnippet: snippet,
        matchSource: source,
        textRelevanceScore: 0.5,
        interestMatchScore: parseFloat(Number(r.viewer_interest_match || 0.2).toFixed(3)),
        finalRankScore: 0.65,
      };
    });
  }

  /**
   * Search Users:
   * Matches username, display_name, or bio. Boosted by shared interest taxonomy topics.
   */
  async searchUsers(
    viewerId: string | null,
    queryText: string,
    limit = 20,
    offset = 0,
  ): Promise<UserSearchResult[]> {
    const ilikeParam = `%${queryText}%`;
    const prefixParam = `${queryText}%`;

    const sql = `
      SELECT
        p.user_id,
        p.username,
        p.display_name,
        p.bio,
        p.avatar_url,
        p.followers_count,
        p.reels_count,
        u.is_verified,
        COUNT(DISTINCT mutual.interest_id) AS shared_interests_count,
        (
          CASE
            WHEN p.username ILIKE $2 THEN 1.0
            WHEN p.display_name ILIKE $2 THEN 0.85
            WHEN p.username ILIKE $1 THEN 0.7
            WHEN p.display_name ILIKE $1 THEN 0.6
            ELSE 0.4
          END +
          LEAST(0.3, COUNT(DISTINCT mutual.interest_id) * 0.05) +
          LEAST(0.2, LOG(GREATEST(p.followers_count + 1, 1)) / 10.0)
        ) AS relevance_score
      FROM profiles p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN user_interests target_ui ON target_ui.user_id = p.user_id
      LEFT JOIN user_interests viewer_ui ON viewer_ui.user_id = $3::uuid AND viewer_ui.interest_id = target_ui.interest_id
      LEFT JOIN user_interests mutual ON mutual.user_id = p.user_id AND mutual.interest_id = viewer_ui.interest_id
      WHERE u.is_active = TRUE
        AND ($3::uuid = '00000000-0000-0000-0000-000000000000'::uuid OR p.user_id NOT IN (
          SELECT blocked_id FROM blocks WHERE blocker_id = $3::uuid
          UNION
          SELECT blocker_id FROM blocks WHERE blocked_id = $3::uuid
        ))
        AND (
          p.username ILIKE $1
          OR p.display_name ILIKE $1
          OR p.bio ILIKE $1
          OR similarity(p.username, $6) > 0.25
          OR similarity(p.display_name, $6) > 0.25
        )
      GROUP BY p.user_id, p.username, p.display_name, p.bio, p.avatar_url, p.followers_count, p.reels_count, u.is_verified
      ORDER BY relevance_score DESC, p.followers_count DESC
      LIMIT $4 OFFSET $5;
    `;

    const result = await this.databaseService.query(sql, [
      ilikeParam,
      prefixParam,
      viewerId || '00000000-0000-0000-0000-000000000000',
      limit,
      offset,
      queryText.trim(),
    ]);

    return result.rows.map((r) => ({
      id: r.user_id,
      username: r.username,
      displayName: r.display_name,
      bio: r.bio || undefined,
      avatarUrl: r.avatar_url || undefined,
      followersCount: Number(r.followers_count || 0),
      reelsCount: Number(r.reels_count || 0),
      isVerified: Boolean(r.is_verified),
      sharedInterestsCount: Number(r.shared_interests_count || 0),
      relevanceScore: parseFloat(Number(r.relevance_score || 0).toFixed(3)),
    }));
  }

  /**
   * Search Hashtags:
   * Prefix and substring matches on hashtag vocabulary.
   */
  async searchHashtags(queryText: string, limit = 20, offset = 0): Promise<HashtagSearchResult[]> {
    const cleanTag = queryText.replace(/^#/, '').toLowerCase();
    const ilikeParam = `%${cleanTag}%`;
    const prefixParam = `${cleanTag}%`;

    const sql = `
      SELECT
        id,
        tag,
        reels_count,
        (
          CASE
            WHEN tag = $1 THEN 1.0
            WHEN tag ILIKE $2 THEN 0.85
            ELSE 0.5
          END +
          LEAST(0.3, LOG(GREATEST(reels_count + 1, 1)) / 10.0)
        ) AS relevance_score
      FROM hashtags
      WHERE tag ILIKE $3 OR similarity(tag, $1) > 0.25
      ORDER BY relevance_score DESC, reels_count DESC
      LIMIT $4 OFFSET $5;
    `;

    const result = await this.databaseService.query(sql, [
      cleanTag,
      prefixParam,
      ilikeParam,
      limit,
      offset,
    ]);

    return result.rows.map((r) => ({
      id: r.id,
      tag: r.tag,
      reelsCount: Number(r.reels_count || 0),
      isTrending: Number(r.reels_count || 0) > 25,
      relevanceScore: parseFloat(Number(r.relevance_score || 0).toFixed(3)),
    }));
  }

  /**
   * Search Interests Taxonomy:
   * Matches across Categories, Topics, and Niches with Category path resolution.
   */
  async searchInterests(
    userId: string | null,
    queryText: string,
    limit = 20,
    offset = 0,
  ): Promise<InterestSearchResult[]> {
    const ilikeParam = `%${queryText}%`;
    const prefixParam = `${queryText}%`;
    const cleanTerm = queryText.trim();

    const sql = `
      SELECT
        i.id,
        i.slug,
        i.title,
        i.description,
        i.level,
        i.icon,
        i.reels_count,
        parent.title AS category_title,
        COALESCE(ui.affinity_weight, 0.0) AS viewer_affinity_weight,
        (
          CASE
            WHEN i.title ILIKE $2 THEN 1.0
            WHEN i.slug ILIKE $2 THEN 0.9
            WHEN i.title ILIKE $1 THEN 0.75
            WHEN similarity(i.title, $6) > 0.25 THEN similarity(i.title, $6) * 0.8
            ELSE 0.5
          END +
          COALESCE(ui.affinity_weight, 0.0) * 0.2 +
          LEAST(0.2, LOG(GREATEST(i.reels_count + 1, 1)) / 8.0)
        ) AS relevance_score
      FROM interests i
      LEFT JOIN interests parent ON parent.id = i.parent_id
      LEFT JOIN user_interests ui ON ui.user_id = $3::uuid AND ui.interest_id = i.id
      WHERE (i.title ILIKE $1 OR i.description ILIKE $1 OR i.slug ILIKE $1
         OR similarity(i.title, $6) > 0.25 OR similarity(i.slug, $6) > 0.25)
      ORDER BY relevance_score DESC, i.reels_count DESC
      LIMIT $4 OFFSET $5;
    `;

    const result = await this.databaseService.query(sql, [
      ilikeParam,
      prefixParam,
      userId || '00000000-0000-0000-0000-000000000000',
      limit,
      offset,
      cleanTerm,
    ]);

    return result.rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      description: r.description || '',
      categoryTitle: r.category_title || undefined,
      level: Number(r.level || 0),
      icon: r.icon || undefined,
      reelsCount: Number(r.reels_count || 0),
      viewerAffinityWeight: parseFloat(Number(r.viewer_affinity_weight || 0).toFixed(2)),
      relevanceScore: parseFloat(Number(r.relevance_score || 0).toFixed(3)),
    }));
  }

  /**
   * Search Audio Tracks:
   * Title, artist, and genre matching for background music & sound library.
   */
  async searchAudio(queryText: string, limit = 20, offset = 0): Promise<AudioSearchResult[]> {
    const ilikeParam = `%${queryText}%`;
    const prefixParam = `${queryText}%`;

    const sql = `
      SELECT
        id,
        title,
        artist,
        genre,
        audio_url,
        duration_seconds,
        cover_url,
        reels_count,
        (
          CASE
            WHEN title ILIKE $2 THEN 1.0
            WHEN artist ILIKE $2 THEN 0.85
            WHEN title ILIKE $1 THEN 0.7
            WHEN genre ILIKE $1 THEN 0.6
            ELSE 0.4
          END +
          LEAST(0.3, LOG(GREATEST(reels_count + 1, 1)) / 8.0)
        ) AS relevance_score
      FROM audio_tracks
      WHERE title ILIKE $1 OR artist ILIKE $1 OR genre ILIKE $1
      ORDER BY relevance_score DESC, reels_count DESC
      LIMIT $3 OFFSET $4;
    `;

    const result = await this.databaseService.query(sql, [
      ilikeParam,
      prefixParam,
      limit,
      offset,
    ]);

    return result.rows.map((r) => ({
      id: r.id,
      title: r.title,
      artist: r.artist,
      genre: r.genre || undefined,
      audioUrl: r.audio_url,
      durationSeconds: Number(r.duration_seconds || 30),
      coverUrl: r.cover_url || undefined,
      reelsCount: Number(r.reels_count || 0),
      relevanceScore: parseFloat(Number(r.relevance_score || 0).toFixed(3)),
    }));
  }

  /**
   * Trending Interests Query:
   * Ranks interests by recent activity and velocity.
   */
  async getTrendingInterests(limit = 10): Promise<TrendingInterest[]> {
    const sql = `
      SELECT
        i.id,
        i.slug,
        i.title,
        parent.title AS category_title,
        i.icon,
        i.reels_count AS total_reels_count,
        COUNT(ri.reel_id) AS recent_reels_count
      FROM interests i
      LEFT JOIN interests parent ON parent.id = i.parent_id
      LEFT JOIN reel_interests ri ON ri.interest_id = i.id
      LEFT JOIN reels r ON r.id = ri.reel_id AND r.status = 'PUBLISHED' AND r.created_at >= NOW() - INTERVAL '7 days'
      WHERE i.level >= 1
      GROUP BY i.id, i.slug, i.title, parent.title, i.icon, i.reels_count
      ORDER BY recent_reels_count DESC, i.reels_count DESC
      LIMIT $1;
    `;

    const result = await this.databaseService.query(sql, [limit]);

    return result.rows.map((r, idx) => {
      const recent = Number(r.recent_reels_count || 0);
      const total = Number(r.total_reels_count || 0);
      const growthPercent = Math.min(250, Math.max(15, Math.round((recent * 12) + (10 - idx) * 8)));

      return {
        id: r.id,
        slug: r.slug,
        title: r.title,
        categoryTitle: r.category_title || 'General',
        icon: r.icon || '🔥',
        recentReelsCount: recent,
        growthPercent,
        totalReelsCount: total,
        trendingRank: idx + 1,
      };
    });
  }

  /**
   * Aggregates the complete "Explore Interests" payload:
   * - Trending interests
   * - Personalized / recommended topic taxonomy nodes
   * - Featured interest creators
   * - Viral audio tracks
   * - Category cluster summaries
   */
  async getExplorePayload(userId: string | null): Promise<ExplorePayload> {
    const [trendingInterests, recommendedTopics, featuredCreators, trendingAudio, categoryClusters] =
      await Promise.all([
        this.getTrendingInterests(10),
        this.getRecommendedTopics(userId),
        this.getFeaturedCreators(userId),
        this.getTrendingAudio(6),
        this.getCategoryClusters(),
      ]);

    return {
      trendingInterests,
      recommendedTopics,
      featuredCreators,
      trendingAudio,
      categoryClusters,
    };
  }

  /**
   * Returns reels using a specific audio track.
   */
  async getAudioReels(audioId: string, limit = 20, offset = 0): Promise<ReelSearchResult[]> {
    const sql = `
      SELECT
        r.id, r.creator_id, r.title, r.caption, r.transcript_text,
        r.thumbnail_url, r.hls_master_url, r.hashtags, r.view_count, r.like_count, r.comment_count,
        p.username AS creator_username, p.display_name AS creator_display_name, p.avatar_url AS creator_avatar_url,
        pri.id AS primary_interest_id, pri.title AS primary_interest_title
      FROM reels r
      LEFT JOIN profiles p ON p.user_id = r.creator_id
      LEFT JOIN reel_interests rim ON rim.reel_id = r.id AND rim.is_primary = TRUE
      LEFT JOIN interests pri ON pri.id = rim.interest_id
      WHERE r.status = 'PUBLISHED' AND r.audio_id = $1::uuid
      ORDER BY r.view_count DESC, r.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await this.databaseService.query(sql, [audioId, limit, offset]);

    return result.rows.map((r) => ({
      id: r.id,
      title: r.title,
      caption: r.caption || undefined,
      transcriptText: r.transcript_text || undefined,
      thumbnailUrl: r.thumbnail_url || 'https://cdn.interest.app/placeholders/thumb.jpg',
      hlsMasterUrl: r.hls_master_url || 'https://cdn.interest.app/placeholders/stream.m3u8',
      creator: {
        id: r.creator_id,
        username: r.creator_username || 'creator',
        displayName: r.creator_display_name || 'Creator',
        avatarUrl: r.creator_avatar_url || undefined,
      },
      primaryInterest: {
        id: r.primary_interest_id || '00000000-0000-0000-0000-000000000000',
        title: r.primary_interest_title || 'General',
      },
      hashtags: r.hashtags || [],
      viewCount: Number(r.view_count || 0),
      likeCount: Number(r.like_count || 0),
      commentCount: Number(r.comment_count || 0),
      textRelevanceScore: 1.0,
      interestMatchScore: 0.5,
      finalRankScore: 1.0,
    }));
  }

  // --------------------------------------------------------------------------
  // Private Helper Methods
  // --------------------------------------------------------------------------

  private extractMatchSnippet(
    queryText: string,
    title: string,
    caption?: string,
    transcriptText?: string,
    hashtags?: string[],
  ): { snippet: string; source: 'title' | 'caption' | 'transcript' | 'hashtag' } {
    const qLower = queryText.toLowerCase();
    const queryWords = qLower.split(/\s+/).filter((w) => w.length >= 3);

    // 1. Check transcript for exact or word matches
    if (transcriptText) {
      const tLower = transcriptText.toLowerCase();
      let matchIdx = tLower.indexOf(qLower);
      if (matchIdx === -1 && queryWords.length > 0) {
        const foundWord = queryWords.find((w) => tLower.includes(w));
        if (foundWord) matchIdx = tLower.indexOf(foundWord);
      }

      if (matchIdx !== -1) {
        const start = Math.max(0, matchIdx - 25);
        const end = Math.min(transcriptText.length, matchIdx + queryText.length + 35);
        const snippet = `"${start > 0 ? '...' : ''}${transcriptText.slice(start, end)}${end < transcriptText.length ? '...' : ''}"`;
        return { snippet, source: 'transcript' };
      }
    }

    // 2. Check caption for exact or word matches
    if (caption) {
      const cLower = caption.toLowerCase();
      let matchIdx = cLower.indexOf(qLower);
      if (matchIdx === -1 && queryWords.length > 0) {
        const foundWord = queryWords.find((w) => cLower.includes(w));
        if (foundWord) matchIdx = cLower.indexOf(foundWord);
      }

      if (matchIdx !== -1) {
        const start = Math.max(0, matchIdx - 20);
        const end = Math.min(caption.length, matchIdx + queryText.length + 30);
        const snippet = `${start > 0 ? '...' : ''}${caption.slice(start, end)}${end < caption.length ? '...' : ''}`;
        return { snippet, source: 'caption' };
      }
    }

    // 3. Check hashtags
    if (hashtags && hashtags.length > 0) {
      const matched = hashtags.find(
        (h) => h.toLowerCase().includes(qLower) || queryWords.some((w) => h.toLowerCase().includes(w)),
      );
      if (matched) {
        return { snippet: `#${matched}`, source: 'hashtag' };
      }
    }

    // 4. Fall back to title
    return { snippet: title, source: 'title' };
  }

  private async getRecommendedTopics(userId: string | null): Promise<InterestTaxonomyNode[]> {
    if (userId) {
      const sql = `
        SELECT i.id, i.slug, i.title, i.description, i.parent_id, i.level, i.icon, i.vector::text, i.reels_count
        FROM user_interests ui
        JOIN interests i ON i.id = ui.interest_id
        WHERE ui.user_id = $1::uuid AND ui.is_muted = FALSE
        ORDER BY ui.affinity_weight DESC
        LIMIT 6;
      `;
      const res = await this.databaseService.query(sql, [userId]);
      if (res && res.rows && res.rows.length > 0) {
        return res.rows.map((r) => ({
          id: r.id,
          slug: r.slug,
          title: r.title,
          description: r.description || '',
          parentId: r.parent_id || null,
          level: r.level,
          icon: r.icon || undefined,
          vector: [],
          reelsCount: Number(r.reels_count || 0),
        }));
      }
    }

    // Cold-start fallback: Top root categories and popular topics
    const fallbackSql = `
      SELECT id, slug, title, description, parent_id, level, icon, reels_count
      FROM interests
      WHERE level = 1
      ORDER BY reels_count DESC, title ASC
      LIMIT 6;
    `;
    const fallbackRes = await this.databaseService.query(fallbackSql);
    if (!fallbackRes || !fallbackRes.rows) return [];
    return fallbackRes.rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      description: r.description || '',
      parentId: r.parent_id || null,
      level: r.level,
      icon: r.icon || undefined,
      vector: [],
      reelsCount: Number(r.reels_count || 0),
    }));
  }

  private async getFeaturedCreators(userId: string | null): Promise<UserSearchResult[]> {
    const sql = `
      SELECT
        p.user_id, p.username, p.display_name, p.bio, p.avatar_url,
        p.followers_count, p.reels_count, u.is_verified
      FROM profiles p
      JOIN users u ON u.id = p.user_id
      WHERE u.is_active = TRUE AND p.reels_count > 0
      ORDER BY p.followers_count DESC, p.reels_count DESC
      LIMIT 6;
    `;
    const res = await this.databaseService.query(sql);
    return res.rows.map((r) => ({
      id: r.user_id,
      username: r.username,
      displayName: r.display_name,
      bio: r.bio || undefined,
      avatarUrl: r.avatar_url || undefined,
      followersCount: Number(r.followers_count || 0),
      reelsCount: Number(r.reels_count || 0),
      isVerified: Boolean(r.is_verified),
      sharedInterestsCount: 0,
      relevanceScore: 1.0,
    }));
  }

  private async getTrendingAudio(limit = 6): Promise<AudioSearchResult[]> {
    const sql = `
      SELECT id, title, artist, genre, audio_url, duration_seconds, cover_url, reels_count
      FROM audio_tracks
      ORDER BY reels_count DESC
      LIMIT $1;
    `;
    const res = await this.databaseService.query(sql, [limit]);
    return res.rows.map((r) => ({
      id: r.id,
      title: r.title,
      artist: r.artist,
      genre: r.genre || undefined,
      audioUrl: r.audio_url,
      durationSeconds: Number(r.duration_seconds || 30),
      coverUrl: r.cover_url || undefined,
      reelsCount: Number(r.reels_count || 0),
      relevanceScore: 1.0,
    }));
  }

  private async getCategoryClusters(): Promise<ExplorePayload['categoryClusters']> {
    const sql = `
      SELECT
        c.id AS category_id,
        c.title AS category_title,
        c.icon,
        COUNT(DISTINCT t.id) AS topics_count,
        ARRAY_AGG(DISTINCT n.title) FILTER (WHERE n.title IS NOT NULL) AS sample_niches
      FROM interests c
      LEFT JOIN interests t ON t.parent_id = c.id
      LEFT JOIN interests n ON n.parent_id = t.id
      WHERE c.level = 0
      GROUP BY c.id, c.title, c.icon
      ORDER BY c.title ASC;
    `;
    const res = await this.databaseService.query(sql);
    return res.rows.map((r) => ({
      categoryId: r.category_id,
      categoryTitle: r.category_title,
      icon: r.icon || '📌',
      topicsCount: Number(r.topics_count || 0),
      sampleNiches: (r.sample_niches || []).slice(0, 4),
    }));
  }

  /**
   * Search Communities:
   * Typo-tolerant and keyword search across paid interest communities and hubs.
   */
  async searchCommunities(
    queryText: string,
    limit = 20,
    offset = 0,
    viewerId?: string | null,
  ): Promise<CommunitySearchResult[]> {
    const cleanQuery = queryText.trim();
    const ilikeParam = `%${cleanQuery}%`;

    const sql = `
      SELECT
        c.id, c.name, c.description, c.banner_url, c.creator_id,
        c.interest_id, c.members_count, c.price_cents, c.currency, c.pricing_type,
        p.username AS creator_username,
        i.title AS interest_title,
        (
          CASE
            WHEN c.name ILIKE $1 THEN 1.0
            WHEN similarity(c.name, $2) > 0.3 THEN 0.8
            WHEN c.description ILIKE $1 THEN 0.6
            ELSE 0.4
          END +
          LEAST(0.2, LOG(GREATEST(c.members_count + 1, 1)) / 10.0)
        ) AS relevance_score
      FROM paid_interest_communities c
      LEFT JOIN profiles p ON p.user_id = c.creator_id
      LEFT JOIN interests i ON i.id = c.interest_id
      WHERE c.is_active = TRUE
        AND ($3::uuid IS NULL OR c.creator_id NOT IN (
          SELECT blocked_id FROM blocks WHERE blocker_id = $3::uuid
          UNION
          SELECT blocker_id FROM blocks WHERE blocked_id = $3::uuid
        ))
        AND (
          c.name ILIKE $1
          OR c.description ILIKE $1
          OR similarity(c.name, $2) > 0.25
        )
      ORDER BY relevance_score DESC, c.members_count DESC
      LIMIT $4 OFFSET $5;
    `;

    try {
      const result = await this.databaseService.query(sql, [
        ilikeParam,
        cleanQuery,
        viewerId || null,
        limit,
        offset,
      ]);

      return result.rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description || undefined,
        bannerUrl: r.banner_url || undefined,
        creatorId: r.creator_id,
        creatorUsername: r.creator_username || 'creator',
        interestId: r.interest_id,
        interestTitle: r.interest_title || 'General',
        membersCount: Number(r.members_count || 0),
        priceCents: Number(r.price_cents || 0),
        currency: r.currency || 'usd',
        pricingType: r.pricing_type || 'recurring',
        relevanceScore: parseFloat(Number(r.relevance_score || 0).toFixed(3)),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Safe Autocomplete API:
   * Returns suggestions across topics, creators, and hashtags while filtering prohibited terms.
   */
  async getSafeAutocomplete(queryText: string, limit = 8): Promise<SafeAutocompleteResult> {
    const cleanQuery = queryText.trim();
    if (!cleanQuery) {
      return { query: '', suggestions: [] };
    }

    if (await this.checkProhibitedQuery(cleanQuery)) {
      return { query: cleanQuery, suggestions: [], isProhibited: true };
    }

    const ilikeParam = `${cleanQuery}%`;
    const trigramParam = cleanQuery;
    const suggestions: SafeAutocompleteSuggestion[] = [];

    // 1. Topics / Interests
    try {
      const topicsRes = await this.databaseService.query(
        `SELECT id, slug, title, icon, level
         FROM interests
         WHERE title ILIKE $1 OR slug ILIKE $1 OR similarity(title, $2) > 0.3
         ORDER BY level DESC, reels_count DESC
         LIMIT 4`,
        [ilikeParam, trigramParam],
      );
      for (const r of topicsRes.rows) {
        suggestions.push({
          text: r.title,
          type: 'topic',
          id: r.id,
          icon: r.icon || '📌',
          subtitle: `Topic #${r.slug}`,
        });
      }
    } catch (_) {}

    // 2. Creators
    try {
      const creatorsRes = await this.databaseService.query(
        `SELECT user_id, username, display_name, avatar_url
         FROM profiles
         WHERE username ILIKE $1 OR display_name ILIKE $1 OR similarity(username, $2) > 0.3
         ORDER BY followers_count DESC
         LIMIT 3`,
        [ilikeParam, trigramParam],
      );
      for (const r of creatorsRes.rows) {
        suggestions.push({
          text: `@${r.username}`,
          type: 'creator',
          id: r.user_id,
          subtitle: r.display_name,
        });
      }
    } catch (_) {}

    // 3. Hashtags
    try {
      const cleanTag = cleanQuery.replace(/^#/, '');
      const hashRes = await this.databaseService.query(
        `SELECT tag, reels_count
         FROM hashtags
         WHERE tag ILIKE $1 OR similarity(tag, $2) > 0.3
         ORDER BY reels_count DESC
         LIMIT 3`,
        [`${cleanTag}%`, cleanTag],
      );
      for (const r of hashRes.rows) {
        suggestions.push({
          text: `#${r.tag}`,
          type: 'hashtag',
          subtitle: `${r.reels_count || 0} posts`,
        });
      }
    } catch (_) {}

    return {
      query: cleanQuery,
      suggestions: suggestions.slice(0, limit),
      isProhibited: false,
    };
  }

  /**
   * Transparent Trending Windows API:
   * Returns velocity-ranked topics and hashtags with explicit calculation time windows (24h, 72h, 7d).
   */
  async getTransparentTrending(
    window: '24h' | '72h' | '7d' = '24h',
    limit = 10,
  ): Promise<TransparentTrendingWindow> {
    const intervalStr = window === '7d' ? '7 days' : window === '72h' ? '72 hours' : '24 hours';

    // Transparent Topics Velocity
    const topicsSql = `
      SELECT
        i.id, i.slug, i.title, i.icon,
        parent.title AS category_title,
        COUNT(ri.reel_id) AS window_posts,
        ROUND((COUNT(ri.reel_id) * 1.5 + COALESCE(SUM(r.like_count), 0) * 0.2)::numeric, 1) AS velocity_score
      FROM interests i
      LEFT JOIN interests parent ON parent.id = i.parent_id
      LEFT JOIN reel_interests ri ON ri.interest_id = i.id
      LEFT JOIN reels r ON r.id = ri.reel_id AND r.status = 'PUBLISHED' AND r.created_at >= NOW() - INTERVAL '${intervalStr}'
      WHERE i.level >= 1
      GROUP BY i.id, i.slug, i.title, i.icon, parent.title
      ORDER BY window_posts DESC, velocity_score DESC
      LIMIT $1;
    `;

    // Transparent Hashtags Velocity
    const hashtagsSql = `
      SELECT
        h.tag,
        COUNT(r.id) AS post_count
      FROM hashtags h
      LEFT JOIN reels r ON r.status = 'PUBLISHED' AND h.tag = ANY(r.hashtags) AND r.created_at >= NOW() - INTERVAL '${intervalStr}'
      GROUP BY h.tag
      ORDER BY post_count DESC
      LIMIT $1;
    `;

    try {
      const [topicsRes, hashRes] = await Promise.all([
        this.databaseService.query(topicsSql, [limit]),
        this.databaseService.query(hashtagsSql, [limit]),
      ]);

      return {
        window,
        calculatedAt: new Date().toISOString(),
        topics: topicsRes.rows.map((r, idx) => ({
          id: r.id,
          slug: r.slug,
          title: r.title,
          categoryTitle: r.category_title || 'General',
          icon: r.icon || '🔥',
          velocityScore: parseFloat(r.velocity_score || 0),
          postCount: Number(r.window_posts || 0),
          rank: idx + 1,
        })),
        hashtags: hashRes.rows.map((r, idx) => ({
          tag: `#${r.tag}`,
          postCount: Number(r.post_count || 0),
          rank: idx + 1,
        })),
      };
    } catch {
      return {
        window,
        calculatedAt: new Date().toISOString(),
        topics: [],
        hashtags: [],
      };
    }
  }

  /**
   * Recent Searches Persistence & Management
   */
  async getRecentSearches(userId: string, limit = 10): Promise<RecentSearchItem[]> {
    try {
      const res = await this.databaseService.query(
        `SELECT id, user_id, query_text, search_type, created_at
         FROM search_recent_queries
         WHERE user_id = $1::uuid
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit],
      );

      return res.rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        queryText: r.query_text,
        searchType: r.search_type,
        createdAt: r.created_at,
      }));
    } catch {
      return [];
    }
  }

  async recordRecentSearch(userId: string, queryText: string, searchType = 'all'): Promise<void> {
    if (!queryText || !queryText.trim()) return;
    try {
      await this.databaseService.query(
        `INSERT INTO search_recent_queries (user_id, query_text, search_type, created_at)
         VALUES ($1::uuid, $2, $3, NOW())
         ON CONFLICT (user_id, query_text, search_type)
         DO UPDATE SET created_at = NOW()`,
        [userId, queryText.trim(), searchType],
      );
    } catch (_) {}
  }

  async deleteRecentSearch(userId: string, searchId: string): Promise<void> {
    await this.databaseService.query(
      `DELETE FROM search_recent_queries WHERE user_id = $1::uuid AND id = $2::uuid`,
      [userId, searchId],
    );
  }

  async clearRecentSearches(userId: string): Promise<void> {
    await this.databaseService.query(
      `DELETE FROM search_recent_queries WHERE user_id = $1::uuid`,
      [userId],
    );
  }

  /**
   * Prohibited terms moderation check
   */
  async checkProhibitedQuery(query: string): Promise<boolean> {
    const lower = query.toLowerCase().trim();
    for (const term of this.prohibitedTerms) {
      if (lower.includes(term)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Helper: Provides rich non-empty suggestions when 0 search matches occur.
   */
  private getEmptySuggestions(): { trendingTopics: string[]; popularHashtags: string[] } {
    return {
      trendingTopics: ['Calisthenics', 'Distributed Systems', 'Generative AI', 'Cybersecurity'],
      popularHashtags: ['#paxos', '#microservices', '#workout', '#ai'],
    };
  }
}
