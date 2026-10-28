import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PublishReelInputDto, UpdatePublishedReelDto } from './dto/creator.dto';
import {
  LicensedSoundItem,
  PublishingSessionResponse,
  PublishingSessionStatus,
  ReelStatus,
} from '@shared/types';

@Injectable()
export class CreatorStudioService {
  private readonly logger = new Logger(CreatorStudioService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Retrieves licensed / authorized sounds for creators.
   * Enforces licensing: unapproved or copyright-restricted tracks are excluded.
   */
  async getLicensedSounds(
    query?: string,
    limit = 20,
    offset = 0,
  ): Promise<{ sounds: LicensedSoundItem[]; total: number }> {
    let sql = `
      SELECT id, title, artist, duration_seconds, audio_url, genre, cover_url,
             COALESCE(is_licensed, TRUE) as is_licensed,
             COALESCE(license_type, 'CREATIVE_COMMONS') as license_type,
             attribution_text,
             reels_count
      FROM audio_tracks
      WHERE COALESCE(is_licensed, TRUE) = TRUE
    `;
    const params: any[] = [];

    if (query && query.trim().length > 0) {
      params.push(`%${query.trim()}%`);
      sql += ` AND (title ILIKE $${params.length} OR artist ILIKE $${params.length} OR genre ILIKE $${params.length})`;
    }

    sql += ` ORDER BY reels_count DESC, created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const res = await this.databaseService.query(sql, params);

    const countRes = await this.databaseService.query(
      `SELECT COUNT(*)::int as total FROM audio_tracks WHERE COALESCE(is_licensed, TRUE) = TRUE`,
    );
    const total = countRes.rows[0]?.total ?? res.rows.length;

    const sounds: LicensedSoundItem[] = res.rows.map((row) => ({
      id: row.id,
      title: row.title,
      artist: row.artist,
      durationSeconds: parseFloat(row.duration_seconds || '30.0'),
      audioUrl: row.audio_url,
      genre: row.genre || undefined,
      coverUrl: row.cover_url || undefined,
      isLicensed: row.is_licensed,
      licenseType: row.license_type,
      attributionText: row.attribution_text || undefined,
      reelsCount: parseInt(row.reels_count || '0', 10),
    }));

    return { sounds, total };
  }

  /**
   * Publishes or schedules a reel with the full creator studio editing recipe.
   * IDEMPOTENCY: Re-submitting the same clientPublicationId returns the existing
   * publication session without creating duplicate reels or triggering duplicate encodes.
   */
  async publishOrSchedule(
    userId: string,
    dto: PublishReelInputDto,
  ): Promise<PublishingSessionResponse> {
    // 1. Idempotency Check: check if already published/initiated with clientPublicationId
    const existingPub = await this.databaseService.query(
      `SELECT * FROM creator_publishing_sessions
       WHERE user_id = $1 AND client_publication_id = $2`,
      [userId, dto.clientPublicationId],
    );

    if (existingPub.rows.length > 0) {
      this.logger.log(
        `Idempotent duplicate publication skipped for clientPublicationId: ${dto.clientPublicationId}`,
      );
      return this.mapSessionRow(existingPub.rows[0]);
    }

    // 2. Sound Authorization & Licensing Validation
    if (dto.soundId) {
      const soundCheck = await this.databaseService.query(
        `SELECT id, is_licensed FROM audio_tracks WHERE id = $1`,
        [dto.soundId],
      );
      if (soundCheck.rows.length === 0) {
        throw new BadRequestException('Selected audio track does not exist');
      }
      if (soundCheck.rows[0].is_licensed === false) {
        throw new BadRequestException('Selected audio track is not licensed for public distribution');
      }
    }

    // 3. Timezone-Safe Scheduling Validation
    let scheduledDate: Date | null = null;
    let initialStatus: ReelStatus = ReelStatus.PROCESSING;

    if (dto.scheduledAt) {
      scheduledDate = new Date(dto.scheduledAt);
      if (isNaN(scheduledDate.getTime())) {
        throw new BadRequestException('Invalid scheduled date/time format');
      }
      // Must be at least 1 minute in the future
      if (scheduledDate.getTime() <= Date.now() + 60000) {
        throw new BadRequestException('Scheduled publish time must be at least 1 minute in the future');
      }
      initialStatus = ReelStatus.SCHEDULED;
    }

    // 4. Create or Update Reel Entity
    let targetReelId = dto.reelId;

    if (targetReelId) {
      // Verify ownership
      const reelCheck = await this.databaseService.query(
        `SELECT id, creator_id FROM reels WHERE id = $1 AND creator_id = $2`,
        [targetReelId, userId],
      );
      if (reelCheck.rows.length === 0) {
        throw new NotFoundException(`Reel ${targetReelId} not found or access denied`);
      }

      await this.databaseService.query(
        `UPDATE reels
         SET client_publication_id = $1,
             title = $2,
             caption = $3,
             hashtags = $4,
             aspect_ratio = $5,
             trim_start_ms = $6,
             trim_end_ms = $7,
             cover_timestamp_seconds = $8,
             subtitles = $9,
             text_overlays = $10,
             audio_controls = $11,
             audio_id = $12,
             visibility = $13,
             allow_comments = $14,
             allow_remix = $15,
             is_commercial = $16,
             brand_name = $17,
             status = $18,
             scheduled_at = $19,
             updated_at = NOW()
         WHERE id = $20`,
        [
          dto.clientPublicationId,
          dto.title,
          dto.caption || '',
          dto.hashtags || [],
          dto.aspectRatio || '9:16',
          dto.trimStartMs ?? 0,
          dto.trimEndMs ?? null,
          dto.coverFrameTimestampMs ? dto.coverFrameTimestampMs / 1000.0 : 1.0,
          JSON.stringify(dto.subtitles || []),
          JSON.stringify(dto.textOverlays || []),
          JSON.stringify(dto.audioControls || { originalVolume: 1.0, soundVolume: 1.0, isMuted: false }),
          dto.soundId || null,
          dto.visibility || 'PUBLIC',
          dto.allowComments ?? true,
          dto.allowRemix ?? true,
          dto.isCommercial ?? false,
          dto.brandName || null,
          initialStatus,
          scheduledDate,
          targetReelId,
        ],
      );
    } else {
      // Create new reel entity
      const newReelRes = await this.databaseService.query(
        `INSERT INTO reels
         (creator_id, client_publication_id, title, caption, hashtags, aspect_ratio, trim_start_ms,
          trim_end_ms, cover_timestamp_seconds, subtitles, text_overlays, audio_controls, audio_id,
          visibility, allow_comments, allow_remix, is_commercial, brand_name, status, scheduled_at,
          created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW())
         RETURNING id`,
        [
          userId,
          dto.clientPublicationId,
          dto.title,
          dto.caption || '',
          dto.hashtags || [],
          dto.aspectRatio || '9:16',
          dto.trimStartMs ?? 0,
          dto.trimEndMs ?? null,
          dto.coverFrameTimestampMs ? dto.coverFrameTimestampMs / 1000.0 : 1.0,
          JSON.stringify(dto.subtitles || []),
          JSON.stringify(dto.textOverlays || []),
          JSON.stringify(dto.audioControls || { originalVolume: 1.0, soundVolume: 1.0, isMuted: false }),
          dto.soundId || null,
          dto.visibility || 'PUBLIC',
          dto.allowComments ?? true,
          dto.allowRemix ?? true,
          dto.isCommercial ?? false,
          dto.brandName || null,
          initialStatus,
          scheduledDate,
        ],
      );
      targetReelId = newReelRes.rows[0].id;
    }

    // 5. Link primary interest if supplied
    if (dto.primaryInterestId && targetReelId) {
      await this.databaseService.query(
        `INSERT INTO reel_interests (reel_id, interest_id, is_primary)
         VALUES ($1, $2, TRUE)
         ON CONFLICT (reel_id, interest_id) DO UPDATE SET is_primary = TRUE`,
        [targetReelId, dto.primaryInterestId],
      );
    }

    // 6. Record or update Publishing Session for Mobile Recovery
    const sessionStatus: PublishingSessionStatus = scheduledDate
      ? 'SCHEDULED'
      : 'PROCESSING';
    const stage = scheduledDate ? 'SCHEDULED_READY' : 'FINALIZING';
    const progress = scheduledDate ? 100.0 : 75.0;

    const sessionRes = await this.databaseService.query(
      `INSERT INTO creator_publishing_sessions
       (user_id, reel_id, client_publication_id, status, stage, progress_percent, manifest, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (user_id, client_publication_id)
       DO UPDATE SET
         reel_id = EXCLUDED.reel_id,
         status = EXCLUDED.status,
         stage = EXCLUDED.stage,
         progress_percent = EXCLUDED.progress_percent,
         manifest = EXCLUDED.manifest,
         updated_at = NOW()
       RETURNING *`,
      [
        userId,
        targetReelId,
        dto.clientPublicationId,
        sessionStatus,
        stage,
        progress,
        JSON.stringify(dto),
      ],
    );

    this.logger.log(
      `Creator publication created for reel ${targetReelId}: status=${sessionStatus}, scheduled=${scheduledDate?.toISOString()}`,
    );

    return this.mapSessionRow(sessionRes.rows[0]);
  }

  /**
   * Status Recovery: Retrieves publishing session status by clientPublicationId or sessionId.
   * Allows the mobile client to recover upload/publication state after being backgrounded or killed.
   */
  async getPublishingStatus(
    userId: string,
    identifier: string,
  ): Promise<PublishingSessionResponse> {
    const res = await this.databaseService.query(
      `SELECT s.*, r.hls_master_url, r.thumbnail_url, r.scheduled_at, r.created_at as published_at
       FROM creator_publishing_sessions s
       LEFT JOIN reels r ON s.reel_id = r.id
       WHERE s.user_id = $1 AND (s.client_publication_id = $2 OR s.id::text = $2 OR s.reel_id::text = $2)
       LIMIT 1`,
      [userId, identifier],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException(`Publishing session ${identifier} not found`);
    }

    return this.mapSessionRow(res.rows[0]);
  }

  /**
   * Updates an existing published or scheduled reel (captions, visibility, permissions).
   */
  async updatePublishedReel(
    userId: string,
    reelId: string,
    dto: UpdatePublishedReelDto,
  ): Promise<{ updated: boolean; reelId: string }> {
    const check = await this.databaseService.query(
      `SELECT id, creator_id FROM reels WHERE id = $1 AND creator_id = $2`,
      [reelId, userId],
    );
    if (check.rows.length === 0) {
      throw new NotFoundException(`Reel ${reelId} not found or access denied`);
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (dto.title !== undefined) {
      params.push(dto.title);
      updates.push(`title = $${params.length}`);
    }
    if (dto.caption !== undefined) {
      params.push(dto.caption);
      updates.push(`caption = $${params.length}`);
    }
    if (dto.hashtags !== undefined) {
      params.push(dto.hashtags);
      updates.push(`hashtags = $${params.length}`);
    }
    if (dto.visibility !== undefined) {
      params.push(dto.visibility);
      updates.push(`visibility = $${params.length}`);
    }
    if (dto.allowComments !== undefined) {
      params.push(dto.allowComments);
      updates.push(`allow_comments = $${params.length}`);
    }
    if (dto.allowRemix !== undefined) {
      params.push(dto.allowRemix);
      updates.push(`allow_remix = $${params.length}`);
    }

    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);
      params.push(reelId, userId);
      await this.databaseService.query(
        `UPDATE reels SET ${updates.join(', ')} WHERE id = $${params.length - 1} AND creator_id = $${params.length}`,
        params,
      );
    }

    return { updated: true, reelId };
  }

  /**
   * Deletes a published or scheduled reel safely.
   */
  async deleteReel(userId: string, reelId: string): Promise<{ deleted: boolean; reelId: string }> {
    const res = await this.databaseService.query(
      `DELETE FROM reels WHERE id = $1 AND creator_id = $2 RETURNING id`,
      [reelId, userId],
    );
    if (res.rows.length === 0) {
      throw new NotFoundException(`Reel ${reelId} not found or access denied`);
    }
    return { deleted: true, reelId };
  }

  private mapSessionRow(row: any): PublishingSessionResponse {
    let status: PublishingSessionStatus = 'PROCESSING';
    const rawStatus = (row.status || '').toUpperCase();
    if (rawStatus === 'UPLOADING') status = 'UPLOADING';
    if (rawStatus === 'PROCESSING') status = 'PROCESSING';
    if (rawStatus === 'SCHEDULED') status = 'SCHEDULED';
    if (rawStatus === 'PUBLISHED') status = 'PUBLISHED';
    if (rawStatus === 'FAILED') status = 'FAILED';
    if (rawStatus === 'CANCELLED') status = 'CANCELLED';

    return {
      sessionId: row.id,
      reelId: row.reel_id || undefined,
      clientPublicationId: row.client_publication_id,
      status,
      stage: row.stage || 'PROCESSING',
      progressPercent: parseFloat(row.progress_percent || '0.0'),
      errorMessage: row.error_message || null,
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : null,
      publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
      hlsMasterUrl: row.hls_master_url || null,
      thumbnailUrl: row.thumbnail_url || null,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    };
  }
}
