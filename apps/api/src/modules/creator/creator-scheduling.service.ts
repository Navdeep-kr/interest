import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ScheduleReelInputDto } from './dto/creator.dto';
import { ScheduledReelItem, ReelStatus } from '@shared/types';

@Injectable()
export class CreatorSchedulingService {
  private readonly logger = new Logger(CreatorSchedulingService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Schedules a processed reel for future automated publishing.
   */
  async scheduleReel(
    userId: string,
    dto: ScheduleReelInputDto,
  ): Promise<{ scheduled: boolean; scheduledAt: string; reelId: string }> {
    const scheduledDate = new Date(dto.scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      throw new BadRequestException('Invalid scheduled date/time format');
    }

    if (scheduledDate.getTime() <= Date.now()) {
      throw new BadRequestException('Scheduled publish time must be in the future');
    }

    // Verify reel ownership and readiness
    const reelRes = await this.databaseService.query(
      `SELECT id, creator_id, status FROM reels WHERE id = $1 AND creator_id = $2`,
      [dto.reelId, userId],
    );

    if (reelRes.rows.length === 0) {
      throw new NotFoundException(`Reel ${dto.reelId} not found or access denied`);
    }

    await this.databaseService.query(
      `UPDATE reels
       SET status = 'SCHEDULED', scheduled_at = $1, updated_at = NOW()
       WHERE id = $2`,
      [scheduledDate, dto.reelId],
    );

    this.logger.log(`Reel ${dto.reelId} scheduled for publish at ${scheduledDate.toISOString()}`);

    return {
      scheduled: true,
      scheduledAt: scheduledDate.toISOString(),
      reelId: dto.reelId,
    };
  }

  /**
   * Retrieves all scheduled reels for a creator.
   */
  async getScheduledReels(userId: string): Promise<ScheduledReelItem[]> {
    const res = await this.databaseService.query(
      `SELECT 
        r.id, r.creator_id, r.title, r.caption, r.thumbnail_url, r.scheduled_at, r.status, r.created_at,
        (SELECT ri.interest_id FROM reel_interests ri WHERE ri.reel_id = r.id AND ri.is_primary = TRUE LIMIT 1) as primary_interest_id
       FROM reels r
       WHERE r.creator_id = $1 AND r.status = 'SCHEDULED'
       ORDER BY r.scheduled_at ASC`,
      [userId],
    );

    return res.rows.map((row) => ({
      id: row.id,
      creatorId: row.creator_id,
      title: row.title,
      caption: row.caption || undefined,
      thumbnailUrl: row.thumbnail_url || undefined,
      scheduledAt: row.scheduled_at.toISOString(),
      primaryInterestId: row.primary_interest_id || '',
      status: ReelStatus.SCHEDULED,
      createdAt: row.created_at.toISOString(),
    }));
  }

  /**
   * Cancels a scheduled publication.
   */
  async cancelSchedule(
    userId: string,
    reelId: string,
  ): Promise<{ cancelled: boolean; reelId: string }> {
    const res = await this.databaseService.query(
      `UPDATE reels
       SET status = 'PENDING_UPLOAD', scheduled_at = NULL, updated_at = NOW()
       WHERE id = $1 AND creator_id = $2 AND status = 'SCHEDULED'
       RETURNING id`,
      [reelId, userId],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException(`Scheduled reel ${reelId} not found`);
    }

    return { cancelled: true, reelId };
  }

  /**
   * Cron/Daemon task: publishes all scheduled reels whose scheduled_at has arrived.
   */
  async publishDueScheduledReels(): Promise<{ publishedCount: number; publishedIds: string[] }> {
    const dueRes = await this.databaseService.query(
      `SELECT id, creator_id, title FROM reels
       WHERE status = 'SCHEDULED' AND scheduled_at <= NOW()
       FOR UPDATE SKIP LOCKED`,
    );

    if (dueRes.rows.length === 0) {
      return { publishedCount: 0, publishedIds: [] };
    }

    const dueIds = dueRes.rows.map((r) => r.id);

    await this.databaseService.query(
      `UPDATE reels
       SET status = 'PUBLISHED', scheduled_at = NULL, updated_at = NOW()
       WHERE id = ANY($1)`,
      [dueIds],
    );

    this.logger.log(`Published ${dueIds.length} due scheduled reels: [${dueIds.join(', ')}]`);

    return {
      publishedCount: dueIds.length,
      publishedIds: dueIds,
    };
  }
}
