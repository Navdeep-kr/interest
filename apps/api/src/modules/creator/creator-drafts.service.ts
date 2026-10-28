import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { SaveDraftInputDto } from './dto/creator.dto';
import { ReelDraftItem, EditorState, LicensedSoundItem } from '@shared/types';

@Injectable()
export class CreatorDraftsService {
  private readonly logger = new Logger(CreatorDraftsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Saves a new draft or updates an existing draft with editor state and studio recipe.
   * Supports clientDraftId to prevent losing work and avoid duplicates across app backgrounding.
   */
  async saveDraft(
    userId: string,
    dto: SaveDraftInputDto,
    draftId?: string,
  ): Promise<ReelDraftItem> {
    const defaultEditorState: EditorState = {
      clips: [],
      textOverlays: dto.textOverlays || [],
      stickers: [],
      filter: 'none',
      autoCaptions: (dto.subtitles && dto.subtitles.length > 0) || false,
      playbackSpeed: 1.0,
      aspectRatio: dto.aspectRatio || '9:16',
      cropRect: dto.cropRect,
      subtitles: dto.subtitles || [],
      audioControls: dto.audioControls || { originalVolume: 1.0, soundVolume: 1.0, isMuted: false },
      trimStartMs: dto.trimStartMs ?? 0,
      trimEndMs: dto.trimEndMs,
      coverFrameTimestampMs: dto.coverFrameTimestampMs ?? 1000,
    };

    const finalEditorState = dto.editorState || defaultEditorState;

    // Check if updating by ID or clientDraftId
    let targetDraftId = draftId;
    if (!targetDraftId && dto.clientDraftId) {
      const match = await this.databaseService.query(
        `SELECT id FROM reel_drafts WHERE user_id = $1 AND client_draft_id = $2 LIMIT 1`,
        [userId, dto.clientDraftId],
      );
      if (match.rows.length > 0) {
        targetDraftId = match.rows[0].id;
      }
    }

    if (targetDraftId) {
      const existing = await this.databaseService.query(
        `SELECT id FROM reel_drafts WHERE id = $1 AND user_id = $2`,
        [targetDraftId, userId],
      );
      if (existing.rows.length === 0) {
        throw new NotFoundException(`Draft ${targetDraftId} not found`);
      }

      const res = await this.databaseService.query(
        `UPDATE reel_drafts
         SET title = $1,
             caption = $2,
             primary_interest_id = $3,
             secondary_tag_ids = $4,
             hashtags = $5,
             cover_timestamp = $6,
             cover_frame_timestamp_ms = $7,
             video_uri = $8,
             aspect_ratio = $9,
             trim_start_ms = $10,
             trim_end_ms = $11,
             crop_rect = $12,
             subtitles = $13,
             text_overlays = $14,
             audio_controls = $15,
             sound_id = $16,
             visibility = $17,
             allow_comments = $18,
             allow_remix = $19,
             is_commercial = $20,
             brand_name = $21,
             scheduled_at = $22,
             client_draft_id = COALESCE($23, client_draft_id),
             editor_state = $24,
             updated_at = NOW()
         WHERE id = $25 AND user_id = $26
         RETURNING *`,
        [
          dto.title || '',
          dto.caption || '',
          dto.primaryInterestId || null,
          dto.secondaryTagIds || [],
          dto.hashtags || [],
          dto.coverTimestamp ?? (dto.coverFrameTimestampMs ? dto.coverFrameTimestampMs / 1000.0 : 1.0),
          dto.coverFrameTimestampMs ?? 1000,
          dto.videoUri || null,
          dto.aspectRatio || '9:16',
          dto.trimStartMs ?? 0,
          dto.trimEndMs ?? null,
          dto.cropRect ? JSON.stringify(dto.cropRect) : null,
          JSON.stringify(dto.subtitles || []),
          JSON.stringify(dto.textOverlays || []),
          JSON.stringify(dto.audioControls || { originalVolume: 1.0, soundVolume: 1.0, isMuted: false }),
          dto.soundId || null,
          dto.visibility || 'PUBLIC',
          dto.allowComments ?? true,
          dto.allowRemix ?? true,
          dto.isCommercial ?? false,
          dto.brandName || null,
          dto.scheduledAt ? new Date(dto.scheduledAt) : null,
          dto.clientDraftId || null,
          JSON.stringify(finalEditorState),
          targetDraftId,
          userId,
        ],
      );
      return this.mapDraftRow(res.rows[0]);
    } else {
      const res = await this.databaseService.query(
        `INSERT INTO reel_drafts
         (user_id, client_draft_id, title, caption, primary_interest_id, secondary_tag_ids, hashtags,
          cover_timestamp, cover_frame_timestamp_ms, video_uri, aspect_ratio, trim_start_ms, trim_end_ms,
          crop_rect, subtitles, text_overlays, audio_controls, sound_id, visibility, allow_comments,
          allow_remix, is_commercial, brand_name, scheduled_at, editor_state, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, NOW(), NOW())
         RETURNING *`,
        [
          userId,
          dto.clientDraftId || null,
          dto.title || '',
          dto.caption || '',
          dto.primaryInterestId || null,
          dto.secondaryTagIds || [],
          dto.hashtags || [],
          dto.coverTimestamp ?? (dto.coverFrameTimestampMs ? dto.coverFrameTimestampMs / 1000.0 : 1.0),
          dto.coverFrameTimestampMs ?? 1000,
          dto.videoUri || null,
          dto.aspectRatio || '9:16',
          dto.trimStartMs ?? 0,
          dto.trimEndMs ?? null,
          dto.cropRect ? JSON.stringify(dto.cropRect) : null,
          JSON.stringify(dto.subtitles || []),
          JSON.stringify(dto.textOverlays || []),
          JSON.stringify(dto.audioControls || { originalVolume: 1.0, soundVolume: 1.0, isMuted: false }),
          dto.soundId || null,
          dto.visibility || 'PUBLIC',
          dto.allowComments ?? true,
          dto.allowRemix ?? true,
          dto.isCommercial ?? false,
          dto.brandName || null,
          dto.scheduledAt ? new Date(dto.scheduledAt) : null,
          JSON.stringify(finalEditorState),
        ],
      );
      return this.mapDraftRow(res.rows[0]);
    }
  }

  /**
   * Lists all drafts for a creator ordered by most recently edited.
   */
  async getDrafts(userId: string): Promise<ReelDraftItem[]> {
    const res = await this.databaseService.query(
      `SELECT d.*,
              s.id as sound_track_id, s.title as sound_title, s.artist as sound_artist,
              s.duration_seconds as sound_duration, s.audio_url as sound_audio_url,
              s.genre as sound_genre, s.cover_url as sound_cover_url
       FROM reel_drafts d
       LEFT JOIN audio_tracks s ON d.sound_id = s.id
       WHERE d.user_id = $1
       ORDER BY d.updated_at DESC`,
      [userId],
    );
    return res.rows.map((r) => this.mapDraftRow(r));
  }

  /**
   * Retrieves a single draft by ID.
   */
  async getDraftById(userId: string, draftId: string): Promise<ReelDraftItem> {
    const res = await this.databaseService.query(
      `SELECT d.*,
              s.id as sound_track_id, s.title as sound_title, s.artist as sound_artist,
              s.duration_seconds as sound_duration, s.audio_url as sound_audio_url,
              s.genre as sound_genre, s.cover_url as sound_cover_url
       FROM reel_drafts d
       LEFT JOIN audio_tracks s ON d.sound_id = s.id
       WHERE d.id = $1 AND d.user_id = $2`,
      [draftId, userId],
    );
    if (res.rows.length === 0) {
      throw new NotFoundException(`Draft ${draftId} not found`);
    }
    return this.mapDraftRow(res.rows[0]);
  }

  /**
   * Deletes a saved draft.
   */
  async deleteDraft(userId: string, draftId: string): Promise<{ deleted: boolean; draftId: string }> {
    const res = await this.databaseService.query(
      `DELETE FROM reel_drafts WHERE id = $1 AND user_id = $2 RETURNING id`,
      [draftId, userId],
    );
    if (res.rows.length === 0) {
      throw new NotFoundException(`Draft ${draftId} not found`);
    }
    return { deleted: true, draftId };
  }

  private mapDraftRow(row: any): ReelDraftItem {
    let sound: LicensedSoundItem | undefined;
    if (row.sound_track_id || row.sound_id) {
      sound = {
        id: row.sound_track_id || row.sound_id,
        title: row.sound_title || 'Audio Track',
        artist: row.sound_artist || 'Artist',
        durationSeconds: parseFloat(row.sound_duration || '30.0'),
        audioUrl: row.sound_audio_url || '',
        genre: row.sound_genre || undefined,
        coverUrl: row.sound_cover_url || undefined,
        isLicensed: true,
      };
    }

    const subtitles = typeof row.subtitles === 'string' ? JSON.parse(row.subtitles) : row.subtitles || [];
    const textOverlays = typeof row.text_overlays === 'string' ? JSON.parse(row.text_overlays) : row.text_overlays || [];
    const audioControls = typeof row.audio_controls === 'string' ? JSON.parse(row.audio_controls) : row.audio_controls;
    const cropRect = typeof row.crop_rect === 'string' ? JSON.parse(row.crop_rect) : row.crop_rect;
    const editorState = typeof row.editor_state === 'string' ? JSON.parse(row.editor_state) : row.editor_state || {};

    return {
      id: row.id,
      userId: row.user_id,
      clientDraftId: row.client_draft_id || undefined,
      title: row.title || '',
      caption: row.caption || undefined,
      primaryInterestId: row.primary_interest_id || undefined,
      secondaryTagIds: row.secondary_tag_ids || [],
      hashtags: row.hashtags || [],
      coverTimestamp: parseFloat(row.cover_timestamp || '1.0'),
      coverFrameTimestampMs: row.cover_frame_timestamp_ms ?? (row.cover_timestamp ? Math.round(row.cover_timestamp * 1000) : 1000),
      videoUri: row.video_uri || undefined,
      aspectRatio: row.aspect_ratio || '9:16',
      trimStartMs: row.trim_start_ms ?? 0,
      trimEndMs: row.trim_end_ms ?? undefined,
      cropRect: cropRect || undefined,
      subtitles,
      textOverlays,
      audioControls,
      soundId: row.sound_id || undefined,
      sound,
      visibility: row.visibility || 'PUBLIC',
      allowComments: row.allow_comments ?? true,
      allowRemix: row.allow_remix ?? true,
      isCommercial: row.is_commercial ?? false,
      brandName: row.brand_name || undefined,
      scheduledAt: row.scheduled_at ? row.scheduled_at.toISOString() : undefined,
      editorState,
      createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? row.updated_at.toISOString() : new Date().toISOString(),
    };
  }
}
