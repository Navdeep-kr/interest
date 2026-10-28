import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../database/database.service';
import { StorageService } from '../storage/storage.service';
import { AiInterestSuggesterService } from './ai-interest-suggester.service';
import { RedisCounterService } from '../interactions/redis-counter.service';
import { MentionsService } from '../interactions/mentions.service';
import { stripGeoEntities } from '@shared/geo-sanitizer';
import {
  CreatePresignedUrlDto,
  InitiateMultipartUploadDto,
  GetMultipartPartUrlsDto,
  CompleteMultipartUploadDto,
  AbortMultipartUploadDto,
  FinalizeReelDto,
  SuggestInterestsDto,
  CreateImagePostDto,
  UpdateReelDto,
} from './dto/reels.dto';
import {
  CreateReelPresignedUrlResponse,
  InitiateMultipartUploadResponse,
  MultipartPartUrl,
  ReelStatusResponse,
  SuggestedInterestItem,
  ReelStatus,
  ReelVisibility,
  WhyAmISeeingThisResponse,
  ReelItem,
} from '@shared/types';
import { cosineSimilarity } from '@shared/vector-math';

const S3_PART_SIZE = 5 * 1024 * 1024; // 5 MB minimum AWS S3 part size

@Injectable()
export class ReelsService {
  private readonly logger = new Logger(ReelsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
    private readonly aiInterestSuggesterService: AiInterestSuggesterService,
    @InjectQueue('video-transcode') private readonly transcodeQueue: Queue,
    @Optional() private readonly redisCounterService?: RedisCounterService,
    @Optional() private readonly mentionsService?: MentionsService,
  ) {}


  /**
   * Generates a single pre-signed PUT URL for smaller uploads.
   */
  async createPresignedUploadUrl(
    userId: string,
    dto: CreatePresignedUrlDto,
  ): Promise<CreateReelPresignedUrlResponse> {
    const reelId = uuidv4();
    const sanitizedFilename = dto.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const s3Key = `uploads/raw/${reelId}_${sanitizedFilename}`;

    const uploadUrl = await this.storageService.getPresignedUploadUrl(s3Key, dto.contentType, 900);

    await this.databaseService.query(
      `INSERT INTO reels (id, creator_id, title, raw_s3_key, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [reelId, userId, sanitizedFilename, s3Key, ReelStatus.PENDING_UPLOAD],
    );

    return {
      reelId,
      uploadUrl,
      s3Key,
      expiresInSeconds: 900,
    };
  }

  /**
   * Initiates an S3 multipart upload for robust, resumable large video uploads.
   */
  async initiateMultipartUpload(
    userId: string,
    dto: InitiateMultipartUploadDto,
  ): Promise<InitiateMultipartUploadResponse> {
    const reelId = uuidv4();
    const sanitizedFilename = dto.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const s3Key = `uploads/raw/${reelId}_${sanitizedFilename}`;

    const uploadId = await this.storageService.initiateMultipartUpload(s3Key, dto.contentType);
    const expectedParts = Math.max(1, Math.ceil(dto.fileSizeBytes / S3_PART_SIZE));

    await this.databaseService.query(
      `INSERT INTO reels (id, creator_id, title, raw_s3_key, upload_id, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [reelId, userId, sanitizedFilename, s3Key, uploadId, ReelStatus.PENDING_UPLOAD],
    );

    return {
      reelId,
      uploadId,
      s3Key,
      partSize: S3_PART_SIZE,
      expectedParts,
    };
  }

  /**
   * Generates presigned URLs for a batch of parts in an active multipart upload.
   */
  async getMultipartPartUrls(
    userId: string,
    dto: GetMultipartPartUrlsDto,
  ): Promise<MultipartPartUrl[]> {
    const reel = await this.findReelAndVerifyOwner(dto.reelId, userId);

    const urls: MultipartPartUrl[] = [];
    for (const partNumber of dto.partNumbers) {
      const url = await this.storageService.getPresignedPartUrl(
        dto.s3Key,
        dto.uploadId,
        partNumber,
      );
      urls.push({ partNumber, url });
    }

    // Mark status as UPLOADING
    await this.databaseService.query(
      `UPDATE reels SET status = $1, updated_at = NOW() WHERE id = $2`,
      [ReelStatus.UPLOADING, reel.id],
    );

    return urls;
  }

  /**
   * Completes the S3 multipart upload once all chunks have been transferred.
   * Includes duplicate/idempotency protection and part validation.
   */
  async completeMultipartUpload(userId: string, dto: CompleteMultipartUploadDto) {
    const reel = await this.findReelAndVerifyOwner(dto.reelId, userId);

    // Idempotency: If already processing or published, return success without re-assembling S3 parts
    if (reel.status === ReelStatus.PROCESSING || reel.status === ReelStatus.PUBLISHED) {
      return {
        success: true,
        s3Key: dto.s3Key,
        idempotent: true,
      };
    }

    if (!dto.parts || dto.parts.length === 0) {
      throw new BadRequestException('At least 1 completed part is required.');
    }

    for (const part of dto.parts) {
      if (part.partNumber < 1 || !part.etag || part.etag.trim().length === 0) {
        throw new BadRequestException(`Invalid part: number=${part.partNumber}, etag=${part.etag}`);
      }
    }

    const s3Parts = dto.parts.map((p) => ({
      PartNumber: p.partNumber,
      ETag: p.etag,
    }));

    await this.storageService.completeMultipartUpload(dto.s3Key, dto.uploadId, s3Parts);

    await this.databaseService.query(
      `UPDATE reels SET status = $1, updated_at = NOW() WHERE id = $2`,
      [ReelStatus.UPLOADING, reel.id],
    );

    return {
      success: true,
      s3Key: dto.s3Key,
    };
  }

  /**
   * Aborts an incomplete multipart upload and cleans up resources.
   */
  async abortMultipartUpload(userId: string, dto: AbortMultipartUploadDto) {
    const reel = await this.findReelAndVerifyOwner(dto.reelId, userId);

    try {
      await this.storageService.abortMultipartUpload(dto.s3Key, dto.uploadId);
    } catch (e: any) {
      this.logger.warn(`Storage abort multipart warning for Reel ${dto.reelId}: ${e.message}`);
    }

    await this.databaseService.query(
      `UPDATE reels SET status = $1, error_reason = $2, updated_at = NOW() WHERE id = $3`,
      [ReelStatus.FAILED, 'Upload aborted by client', reel.id],
    );

    return {
      success: true,
      reelId: reel.id,
      aborted: true,
    };
  }

  /**
   * Finalizes reel metadata (caption, hashtags, 1-5 interest tags, visibility)
   * and pushes adaptive HLS transcode job to BullMQ with retries.
   */
  async finalizeReel(userId: string, dto: FinalizeReelDto) {
    const reel = await this.findReelAndVerifyOwner(dto.reelId, userId);

    // Validate interest tags: 1-5 tags required
    const allTagIds = Array.from(
      new Set([dto.primaryInterestId, ...(dto.interestTagIds || [])]),
    );
    if (allTagIds.length < 1 || allTagIds.length > 5) {
      throw new BadRequestException('Reels require between 1 and 5 interest taxonomy tags.');
    }

    const sanitizedCaption = dto.caption ? stripGeoEntities(dto.caption.trim()) : null;

    const client = await this.databaseService.getClient();
    try {
      await client.query('BEGIN');

      // Update reel metadata and set status to PROCESSING (TRANSCODING)
      await client.query(
        `UPDATE reels
         SET title = $1,
             caption = $2,
             hashtags = $3,
             visibility = $4,
             cover_timestamp_seconds = $5,
             audio_id = $6,
             transcript_text = $7,
             status = $8,
             updated_at = NOW()
         WHERE id = $9`,
        [
          dto.title,
          sanitizedCaption,
          dto.hashtags || [],
          dto.visibility || ReelVisibility.PUBLIC,
          dto.coverTimestampSeconds || 1.0,
          dto.audioId || null,
          dto.transcriptText || null,
          ReelStatus.PROCESSING,
          dto.reelId,
        ],
      );

      // Associate primary interest
      await client.query(
        `INSERT INTO reel_interests (reel_id, interest_id, is_primary)
         VALUES ($1, $2, TRUE)
         ON CONFLICT (reel_id, interest_id) DO UPDATE SET is_primary = TRUE`,
        [dto.reelId, dto.primaryInterestId],
      );

      // Associate secondary interest tags
      for (const tagId of dto.interestTagIds || []) {
        if (tagId !== dto.primaryInterestId) {
          await client.query(
            `INSERT INTO reel_interests (reel_id, interest_id, is_primary)
             VALUES ($1, $2, FALSE)
             ON CONFLICT (reel_id, interest_id) DO NOTHING`,
            [dto.reelId, tagId],
          );
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Queue BullMQ adaptive transcode job with automatic retries and exponential backoff
    const s3RawKey = reel.raw_s3_key || `uploads/raw/${dto.reelId}_`;
    await this.transcodeQueue.add(
      'transcode',
      {
        reelId: dto.reelId,
        s3RawKey,
        primaryInterestId: dto.primaryInterestId,
        interestTagIds: dto.interestTagIds || [],
        coverTimestampSeconds: dto.coverTimestampSeconds || 1.0,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        removeOnComplete: true,
      },
    );

    // Process mentions if caption contains @mentions
    if (sanitizedCaption && this.mentionsService) {
      await this.mentionsService.processMentions(userId, sanitizedCaption, dto.reelId);
    }

    this.logger.log(`Dispatched transcode job with 3-attempt retry policy for Reel: ${dto.reelId}`);
    return {
      reelId: dto.reelId,
      status: ReelStatus.PROCESSING,
      message: 'Video finalized and queued for metadata-stripped adaptive HLS transcoding.',
    };
  }

  /**
   * Tracks real-time upload and transcoding processing status.
   */
  async getReelStatus(userId: string, reelId: string): Promise<ReelStatusResponse> {
    const result = await this.databaseService.query(
      `SELECT id, status, hls_master_url, thumbnail_url, error_reason, updated_at
       FROM reels
       WHERE id = $1 AND creator_id = $2`,
      [reelId, userId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Reel not found.');
    }

    const row = result.rows[0];
    let progressPercent = 10;
    if (row.status === ReelStatus.UPLOADING) progressPercent = 40;
    else if (row.status === ReelStatus.PROCESSING || row.status === ReelStatus.TRANSCODING)
      progressPercent = 75;
    else if (row.status === ReelStatus.PUBLISHED) progressPercent = 100;
    else if (row.status === ReelStatus.FAILED) progressPercent = 0;

    return {
      reelId: row.id,
      status: row.status as ReelStatus,
      progressPercent,
      hlsMasterUrl: row.hls_master_url || null,
      thumbnailUrl: row.thumbnail_url || null,
      errorReason: row.error_reason || null,
      updatedAt: row.updated_at,
    };
  }

  /**
   * AI-powered interest tagging suggestion from video title, caption, and hashtags.
   */
  async suggestInterests(dto: SuggestInterestsDto): Promise<SuggestedInterestItem[]> {
    return this.aiInterestSuggesterService.suggestInterests(dto);
  }

  /**
   * Retrieves a single reel with creator, interest taxonomy details, and viewer engagement flags.
   */
  async getReelById(reelId: string, currentUserId?: string): Promise<ReelItem> {
    const result = await this.databaseService.query(
      `SELECT r.id, r.creator_id, r.title, r.caption, r.hls_master_url,
              r.thumbnail_url, r.duration_seconds, r.view_count, r.like_count,
              r.comment_count, r.save_count, r.share_count, r.status, r.created_at,
              r.visibility, r.is_pinned, r.media_type, r.image_urls, r.hashtags,
              u.username, u.display_name, u.avatar_url,
              COALESCE(
                json_agg(
                  json_build_object('id', i.id, 'slug', i.slug, 'title', i.title, 'is_primary', ri.is_primary)
                ) FILTER (WHERE i.id IS NOT NULL), '[]'
              ) as interests
       FROM reels r
       JOIN users u ON r.creator_id = u.id
       LEFT JOIN reel_interests ri ON r.id = ri.reel_id
       LEFT JOIN interests i ON ri.interest_id = i.id
       WHERE r.id = $1
       GROUP BY r.id, u.id`,
      [reelId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Reel not found.');
    }

    const row = result.rows[0];

    // 1. Block check if current user is viewing another creator's reel
    if (currentUserId && currentUserId !== row.creator_id) {
      const blockRes = await this.databaseService.query(
        `SELECT 1 FROM blocks 
         WHERE (blocker_id = $1 AND blocked_id = $2) 
            OR (blocker_id = $2 AND blocked_id = $1)`,
        [currentUserId, row.creator_id],
      );
      if (blockRes.rows.length > 0) {
        throw new NotFoundException('Reel not found.');
      }
    }

    // 2. Visibility controls enforcement
    const isCreator = currentUserId === row.creator_id;
    if (!isCreator) {
      if (row.visibility === ReelVisibility.PRIVATE) {
        throw new ForbiddenException('This reel is private.');
      }
      if (row.visibility === ReelVisibility.FOLLOWERS_ONLY) {
        if (!currentUserId) {
          throw new ForbiddenException('This reel is visible to followers only.');
        }
        const followRes = await this.databaseService.query(
          `SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2`,
          [currentUserId, row.creator_id],
        );
        if (followRes.rows.length === 0) {
          throw new ForbiddenException('This reel is visible to followers only.');
        }
      }
    }

    // 3. User engagement flags
    let isLiked = false;
    let isSaved = false;
    let isFollowing = false;

    if (currentUserId) {
      const [likeRes, saveRes, followRes] = await Promise.all([
        this.databaseService.query(
          `SELECT 1 FROM likes WHERE user_id = $1 AND reel_id = $2`,
          [currentUserId, reelId],
        ),
        this.databaseService.query(
          `SELECT 1 FROM saves WHERE user_id = $1 AND reel_id = $2`,
          [currentUserId, reelId],
        ),
        this.databaseService.query(
          `SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2`,
          [currentUserId, row.creator_id],
        ),
      ]);
      isLiked = (likeRes?.rows?.length ?? 0) > 0;
      isSaved = (saveRes?.rows?.length ?? 0) > 0;
      isFollowing = (followRes?.rows?.length ?? 0) > 0;
    }

    // 4. Live counter synchronization
    let liveLikes = parseInt(row.like_count || '0', 10);
    let liveComments = parseInt(row.comment_count || '0', 10);
    let liveSaves = parseInt(row.save_count || '0', 10);
    let liveShares = parseInt(row.share_count || '0', 10);

    if (this.redisCounterService) {
      try {
        const counters = await this.redisCounterService.getReelCounters(reelId, {
          likes: liveLikes,
          comments: liveComments,
          saves: liveSaves,
          shares: liveShares,
        });
        if (counters) {
          liveLikes = counters.likes ?? liveLikes;
          liveComments = counters.comments ?? liveComments;
          liveSaves = counters.saves ?? liveSaves;
          liveShares = counters.shares ?? liveShares;
        }
      } catch (_) {}
    }

    const interestTags = (row.interests || []).map((i: any) => i.id || i.slug);
    const primaryInterestId = (row.interests || []).find((i: any) => i.is_primary)?.id || interestTags[0] || '';

    return {
      id: row.id,
      creatorId: row.creator_id,
      creator: {
        id: row.creator_id,
        username: row.username,
        displayName: row.display_name,
        avatarUrl: row.avatar_url || undefined,
      },
      title: row.title,
      caption: row.caption || undefined,
      hlsMasterUrl: row.hls_master_url || '',
      thumbnailUrl: row.thumbnail_url || '',
      durationSeconds: parseFloat(row.duration_seconds || '0'),
      primaryInterestId,
      interestTags,
      viewCount: parseInt(row.view_count || '0', 10),
      likeCount: liveLikes,
      commentCount: liveComments,
      saveCount: liveSaves,
      shareCount: liveShares,
      isLiked,
      isSaved,
      isFollowing,
      isPinned: row.is_pinned ?? false,
      mediaType: row.media_type || 'VIDEO',
      imageUrls: row.image_urls || [],
      visibility: row.visibility || ReelVisibility.PUBLIC,
      hashtags: row.hashtags || [],
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    };
  }

  /**
   * Creates an image/photo post directly with 1-5 interest tags and Zero-Location sanitization.
   */
  async createImagePost(userId: string, dto: CreateImagePostDto): Promise<ReelItem> {
    if (!dto.imageUrls || dto.imageUrls.length === 0) {
      throw new BadRequestException('Image post requires at least 1 image URL.');
    }
    if (dto.imageUrls.length > 10) {
      throw new BadRequestException('A maximum of 10 images is allowed per post.');
    }

    // 1. Strict Zero-Location Sanitization on caption
    const sanitizedCaption = dto.caption ? stripGeoEntities(dto.caption.trim()) : undefined;

    const reelId = uuidv4();
    const primaryUrl = dto.imageUrls[0];

    const client = await this.databaseService.getClient();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO reels (
          id, creator_id, title, caption, hls_master_url, thumbnail_url,
          duration_seconds, status, visibility, media_type, image_urls, hashtags, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          0.0, $7, $8, 'IMAGE', $9, $10, NOW(), NOW()
        )`,
        [
          reelId,
          userId,
          dto.title.trim(),
          sanitizedCaption || null,
          primaryUrl,
          primaryUrl,
          ReelStatus.PUBLISHED,
          dto.visibility || ReelVisibility.PUBLIC,
          dto.imageUrls,
          dto.hashtags || [],
        ],
      );

      // Associate primary interest
      await client.query(
        `INSERT INTO reel_interests (reel_id, interest_id, is_primary)
         VALUES ($1, $2, TRUE)
         ON CONFLICT (reel_id, interest_id) DO UPDATE SET is_primary = TRUE`,
        [reelId, dto.primaryInterestId],
      );

      // Associate secondary interest tags
      for (const tagId of dto.interestTagIds || []) {
        if (tagId !== dto.primaryInterestId) {
          await client.query(
            `INSERT INTO reel_interests (reel_id, interest_id, is_primary)
             VALUES ($1, $2, FALSE)
             ON CONFLICT (reel_id, interest_id) DO NOTHING`,
            [reelId, tagId],
          );
        }
      }

      // Increment creator's reels_count
      await client.query(
        `UPDATE profiles SET reels_count = reels_count + 1, updated_at = NOW() WHERE user_id = $1`,
        [userId],
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Process mentions if caption contains @mentions
    if (sanitizedCaption && this.mentionsService) {
      await this.mentionsService.processMentions(userId, sanitizedCaption, reelId);
    }

    return this.getReelById(reelId, userId);
  }

  /**
   * Updates reel metadata, visibility, caption, hashtags, and pinned status.
   */
  async updateReel(userId: string, reelId: string, dto: UpdateReelDto): Promise<ReelItem> {
    await this.findReelAndVerifyOwner(reelId, userId);

    const updates: string[] = [];
    const values: any[] = [];
    let pIdx = 1;

    if (dto.title !== undefined) {
      updates.push(`title = $${pIdx++}`);
      values.push(dto.title.trim());
    }

    if (dto.caption !== undefined) {
      const sanitized = stripGeoEntities(dto.caption.trim());
      updates.push(`caption = $${pIdx++}`);
      values.push(sanitized);
    }

    if (dto.hashtags !== undefined) {
      updates.push(`hashtags = $${pIdx++}`);
      values.push(dto.hashtags);
    }

    if (dto.visibility !== undefined) {
      updates.push(`visibility = $${pIdx++}`);
      values.push(dto.visibility);
    }

    if (dto.isPinned !== undefined) {
      if (dto.isPinned) {
        // Enforce max 3 pinned posts
        const pinnedCountRes = await this.databaseService.query(
          `SELECT COUNT(*) as count FROM reels WHERE creator_id = $1 AND is_pinned = TRUE AND id != $2`,
          [userId, reelId],
        );
        const count = parseInt(pinnedCountRes.rows[0]?.count || '0', 10);
        if (count >= 3) {
          throw new BadRequestException('You can pin up to 3 posts on your profile.');
        }
      }
      updates.push(`is_pinned = $${pIdx++}`);
      values.push(dto.isPinned);
    }

    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);
      values.push(reelId);
      await this.databaseService.query(
        `UPDATE reels SET ${updates.join(', ')} WHERE id = $${pIdx}`,
        values,
      );
    }

    return this.getReelById(reelId, userId);
  }

  /**
   * Deletes a reel and decrements creator's reels_count in profiles.
   */
  async deleteReel(userId: string, reelId: string, isAdmin: boolean = false) {
    const reelRes = await this.databaseService.query(
      `SELECT id, creator_id FROM reels WHERE id = $1`,
      [reelId],
    );
    if (reelRes.rows.length === 0) {
      throw new NotFoundException('Reel not found.');
    }
    const reel = reelRes.rows[0];
    if (reel.creator_id !== userId && !isAdmin) {
      throw new ForbiddenException('You do not have permission to delete this reel.');
    }

    const client = await this.databaseService.getClient();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM reels WHERE id = $1`, [reelId]);
      await client.query(
        `UPDATE profiles SET reels_count = GREATEST(0, reels_count - 1), updated_at = NOW() WHERE user_id = $1`,
        [reel.creator_id],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return { deleted: true, reelId };
  }

  /**
   * Pins a reel on creator's profile (max 3).
   */
  async pinReel(userId: string, reelId: string) {
    return this.updateReel(userId, reelId, { isPinned: true });
  }

  /**
   * Unpins a reel on creator's profile.
   */
  async unpinReel(userId: string, reelId: string) {
    return this.updateReel(userId, reelId, { isPinned: false });
  }

  /**
   * Hides a reel from caller's feed and discovery.
   */
  async hideReel(userId: string, reelId: string) {
    const reelRes = await this.databaseService.query(
      `SELECT id FROM reels WHERE id = $1`,
      [reelId],
    );
    if (reelRes.rows.length === 0) {
      throw new NotFoundException('Reel not found.');
    }

    await this.databaseService.query(
      `INSERT INTO user_hidden_reels (user_id, reel_id, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, reel_id) DO NOTHING`,
      [userId, reelId],
    );
    return { hidden: true, reelId };
  }

  /**
   * Unhides a previously hidden reel.
   */
  async unhideReel(userId: string, reelId: string) {
    await this.databaseService.query(
      `DELETE FROM user_hidden_reels WHERE user_id = $1 AND reel_id = $2`,
      [userId, reelId],
    );
    return { hidden: false, reelId };
  }

  /**
   * Retrieves creator reels with pinned content on top and visibility enforcement.
   */
  async getCreatorReels(
    creatorId: string,
    viewerId?: string,
    limit: number = 20,
    cursor?: string,
  ): Promise<{ items: ReelItem[]; hasMore: boolean; nextCursor: string | null }> {
    const isCreator = viewerId === creatorId;

    if (viewerId && !isCreator) {
      const blockRes = await this.databaseService.query(
        `SELECT 1 FROM blocks 
         WHERE (blocker_id = $1 AND blocked_id = $2) 
            OR (blocker_id = $2 AND blocked_id = $1)`,
        [viewerId, creatorId],
      );
      if (blockRes.rows.length > 0) {
        throw new NotFoundException('Creator not found.');
      }
    }

    let isFollower = false;
    if (viewerId && !isCreator) {
      const followRes = await this.databaseService.query(
        `SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2`,
        [viewerId, creatorId],
      );
      isFollower = followRes.rows.length > 0;
    }

    let visibilityClause = '';
    if (!isCreator) {
      if (isFollower) {
        visibilityClause = `AND r.visibility IN ('PUBLIC', 'FOLLOWERS_ONLY')`;
      } else {
        visibilityClause = `AND r.visibility = 'PUBLIC'`;
      }
    }

    const values: any[] = [creatorId, limit];
    let cursorClause = '';
    if (cursor) {
      values.push(new Date(cursor));
      cursorClause = `AND r.created_at < $3`;
    }

    const hiddenFilter = viewerId
      ? `AND NOT EXISTS (SELECT 1 FROM user_hidden_reels uhr WHERE uhr.user_id = '${viewerId}' AND uhr.reel_id = r.id)`
      : '';

    const res = await this.databaseService.query(
      `SELECT r.id
       FROM reels r
       WHERE r.creator_id = $1
         AND r.status = 'PUBLISHED'
         ${visibilityClause}
         ${hiddenFilter}
         ${cursorClause}
       ORDER BY r.is_pinned DESC, r.created_at DESC
       LIMIT $2`,
      values,
    );

    const items: ReelItem[] = await Promise.all(
      res.rows.map((row: any) => this.getReelById(row.id, viewerId)),
    );

    const hasMore = items.length === limit;
    const nextCursor = hasMore ? items[items.length - 1].createdAt : null;

    return { items, hasMore, nextCursor };
  }


  /**
   * "Why am I seeing this?" API:
   * Explains reel recommendation strictly via interest vector match, explicit follows,
   * and behavioral affinity. NEVER references GPS, IP, or country.
   */
  async explainReel(userId: string, reelId: string): Promise<WhyAmISeeingThisResponse> {
    const reelResult = await this.databaseService.query(
      `SELECT r.id, r.title, r.embedding::text,
              pi.id as primary_interest_id, pi.slug as primary_interest_slug, pi.title as primary_interest_title
       FROM reels r
       LEFT JOIN reel_interests pri ON r.id = pri.reel_id AND pri.is_primary = TRUE
       LEFT JOIN interests pi ON pri.interest_id = pi.id
       WHERE r.id = $1`,
      [reelId],
    );

    if (reelResult.rows.length === 0) {
      throw new NotFoundException('Reel not found.');
    }

    const reel = reelResult.rows[0];

    const tagsResult = await this.databaseService.query(
      `SELECT i.id, i.slug, i.title, ri.is_primary,
              ui.affinity_weight, ui.interaction_count,
              (ui.user_id IS NOT NULL) as user_follows
       FROM reel_interests ri
       JOIN interests i ON ri.interest_id = i.id
       LEFT JOIN user_interests ui ON ui.interest_id = i.id AND ui.user_id = $2
       WHERE ri.reel_id = $1
       ORDER BY ri.is_primary DESC, i.title ASC`,
      [reelId, userId],
    );

    const userResult = await this.databaseService.query(
      'SELECT interest_vector::text FROM users WHERE id = $1',
      [userId],
    );

    let similarityPercent = 85;
    if (userResult.rows[0]?.interest_vector && reel.embedding) {
      const userVec = DatabaseService.pgToVector(userResult.rows[0].interest_vector);
      const reelVec = DatabaseService.pgToVector(reel.embedding);
      const sim = cosineSimilarity(userVec, reelVec);
      similarityPercent = Math.min(100, Math.max(0, Math.round(sim * 100)));
    }

    const matchedInterests = tagsResult.rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      isPrimary: Boolean(row.is_primary),
      userFollows: Boolean(row.user_follows),
      userAffinityWeight: row.affinity_weight ? parseFloat(row.affinity_weight) : undefined,
    }));

    const followedInterests = matchedInterests.filter((m) => m.userFollows);
    const primaryInterest = {
      id: reel.primary_interest_id || '',
      slug: reel.primary_interest_slug || '',
      title: reel.primary_interest_title || 'General Interest',
    };

    const primaryFollowed = matchedInterests.find(
      (m) => m.id === primaryInterest.id && m.userFollows,
    );
    const userAffinityWeight = primaryFollowed?.userAffinityWeight;
    const isExplorationSlot = similarityPercent < 65 && followedInterests.length === 0;

    let rationale: string;
    if (primaryFollowed) {
      rationale = `You follow "${primaryInterest.title}" with an active affinity multiplier of ${(userAffinityWeight || 1.0).toFixed(1)}x based on your watch and loop history.`;
    } else if (followedInterests.length > 0) {
      const related = followedInterests[0];
      rationale = `Connected to your followed interest "${related.title}" (${(related.userAffinityWeight || 1.0).toFixed(1)}x affinity) and aligns ${similarityPercent}% with your vector profile.`;
    } else if (isExplorationSlot) {
      rationale = `Serendipity Discovery: This reel explores the adjacent niche "${primaryInterest.title}" to expand your interest universe beyond your core topics.`;
    } else {
      rationale = `High mathematical affinity: This reel's content embedding matches your composite interest vector at ${similarityPercent}%.`;
    }

    const zeroLocationGuarantee =
      'Zero-Location Guarantee: Interest never tracks, stores, or utilizes GPS coordinates, IP location, city, country, or proximity for recommendations. Feed selection is governed 100% by your interest graph and behavioral watch patterns.';

    return {
      reelId: reel.id,
      reelTitle: reel.title,
      primaryInterest,
      matchedInterests,
      vectorSimilarityPercent: similarityPercent,
      userAffinityWeight,
      isExplorationSlot,
      rationale,
      zeroLocationGuarantee,
    };
  }

  private async findReelAndVerifyOwner(reelId: string, userId: string) {
    const res = await this.databaseService.query(
      'SELECT id, creator_id, raw_s3_key, upload_id, status FROM reels WHERE id = $1',
      [reelId],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException('Reel not found.');
    }

    const reel = res.rows[0];
    if (reel.creator_id !== userId) {
      throw new ForbiddenException('You do not have permission to modify this reel.');
    }

    return reel;
  }
}
