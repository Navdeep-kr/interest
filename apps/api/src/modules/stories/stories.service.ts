import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  CreateStoryInputDto,
  RecordStoryViewInputDto,
  ReactToStoryInputDto,
  ReplyToStoryInputDto,
  ReportStoryInputDto,
} from './dto/stories.dto';
import {
  StoryItem,
  CreatorStoryTrayItem,
  StoryAudience,
  StoryMediaType,
  StoryReplySetting,
} from '@shared/types';

@Injectable()
export class StoriesService {
  private readonly logger = new Logger(StoriesService.name);

  // Spam & harmful moderation triggers
  private readonly prohibitedTerms = [
    'crypto giveaway',
    'free followers',
    'get rich quick',
    'hate speech',
    'illegal drugs',
  ];

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Creates a new temporary story post with 24-hour server-authoritative expiry.
   */
  async createStory(userId: string, dto: CreateStoryInputDto): Promise<StoryItem> {
    // 1. Content Moderation Pre-check
    if (dto.caption) {
      const lowerCaption = dto.caption.toLowerCase();
      for (const term of this.prohibitedTerms) {
        if (lowerCaption.includes(term)) {
          throw new BadRequestException(
            `Story caption contains prohibited content or violates community guidelines: "${term}"`,
          );
        }
      }
    }

    const duration = dto.durationSeconds ?? (dto.mediaType === 'VIDEO' ? 15.0 : 5.0);
    const audience = dto.audience ?? 'PUBLIC';
    const allowReplies = dto.allowReplies ?? 'ALL';

    // 2. Insert into stories table with server-authoritative expiry (NOW() + 24 hours)
    const res = await this.databaseService.query(
      `INSERT INTO stories
       (creator_id, media_type, media_url, thumbnail_url, duration_seconds, caption, text_overlays,
        audience, allow_replies, created_at, expires_at, deleted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW() + INTERVAL '24 hours', NULL)
       RETURNING *`,
      [
        userId,
        dto.mediaType,
        dto.mediaUrl,
        dto.thumbnailUrl || null,
        duration,
        dto.caption || '',
        JSON.stringify(dto.textOverlays || []),
        audience,
        allowReplies,
      ],
    );

    const storyRow = res.rows[0];

    // Fetch creator profile details
    const creatorRes = await this.databaseService.query(
      `SELECT id, username, display_name, avatar_url, is_verified FROM users WHERE id = $1`,
      [userId],
    );
    const creator = creatorRes.rows[0];

    this.logger.log(`Created story ${storyRow.id} for user ${userId}, expires at ${storyRow.expires_at.toISOString()}`);

    return this.mapStoryRow(storyRow, creator, false, 0.0);
  }

  /**
   * Retrieves active stories tray grouped by creator.
   * STRICT SERVER EXPIRY: Excludes any story where expires_at <= NOW().
   * PRIVACY: Excludes blocked accounts, reports, and unauthorized audience scopes.
   */
  async getStoriesTray(userId: string): Promise<CreatorStoryTrayItem[]> {
    // Query active, non-deleted, non-blocked, authorized stories
    const res = await this.databaseService.query(
      `SELECT s.*,
              u.username as creator_username,
              u.display_name as creator_display_name,
              u.avatar_url as creator_avatar_url,
              u.is_verified as creator_is_verified,
              sv.progress_percent as viewer_progress,
              sv.completed as viewer_completed,
              (SELECT COUNT(*)::int FROM story_views WHERE story_id = s.id) as views_count,
              (SELECT COUNT(*)::int FROM story_reactions WHERE story_id = s.id) as reactions_count
       FROM stories s
       JOIN users u ON s.creator_id = u.id
       LEFT JOIN story_views sv ON s.id = sv.story_id AND sv.viewer_id = $1
       WHERE s.expires_at > NOW()
         AND s.deleted_at IS NULL
         AND u.is_active = TRUE
         -- Mutual block filter: neither user has blocked the other
         AND NOT EXISTS (
           SELECT 1 FROM user_blocks ub
           WHERE (ub.blocker_id = $1 AND ub.blocked_id = s.creator_id)
              OR (ub.blocker_id = s.creator_id AND ub.blocked_id = $1)
         )
         -- Reporter filter: viewer has not reported this story
         AND NOT EXISTS (
           SELECT 1 FROM story_reports sr
           WHERE sr.story_id = s.id AND sr.reporter_id = $1
         )
         -- Audience Authorization Filter:
         AND (
           s.creator_id = $1 -- Creator can always view own stories
           OR s.audience = 'PUBLIC'
           OR (s.audience = 'FOLLOWERS_ONLY' AND EXISTS (
             SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.following_id = s.creator_id AND f.status = 'ACCEPTED'
           ))
           OR (s.audience = 'CLOSE_FRIENDS' AND EXISTS (
             SELECT 1 FROM close_friends cf WHERE cf.user_id = s.creator_id AND cf.friend_id = $1
           ))
         )
       ORDER BY s.creator_id, s.created_at ASC`,
      [userId],
    );

    // Group stories by creator
    const creatorMap = new Map<string, { creator: any; stories: StoryItem[] }>();

    for (const row of res.rows) {
      const creatorId = row.creator_id;
      if (!creatorMap.has(creatorId)) {
        creatorMap.set(creatorId, {
          creator: {
            id: creatorId,
            username: row.creator_username,
            displayName: row.creator_display_name,
            avatarUrl: row.creator_avatar_url,
            isVerified: row.creator_is_verified,
          },
          stories: [],
        });
      }

      const isViewed = row.viewer_completed === true;
      const progress = row.viewer_progress ? parseFloat(row.viewer_progress) : 0.0;
      const storyItem = this.mapStoryRow(row, creatorMap.get(creatorId)!.creator, isViewed, progress);
      creatorMap.get(creatorId)!.stories.push(storyItem);
    }

    // Convert map to tray list
    const trayItems: CreatorStoryTrayItem[] = [];

    for (const [creatorId, group] of creatorMap.entries()) {
      const hasUnviewed = group.stories.some((s) => !s.isViewed);
      const latestStory = group.stories[group.stories.length - 1];

      trayItems.push({
        creatorId,
        username: group.creator.username,
        displayName: group.creator.displayName,
        avatarUrl: group.creator.avatarUrl,
        isVerified: group.creator.isVerified,
        hasUnviewedStories: hasUnviewed,
        latestStoryAt: latestStory.createdAt,
        stories: group.stories,
      });
    }

    // Sort: user's own stories first (if any), then creators with unviewed stories, then by latestStoryAt DESC
    trayItems.sort((a, b) => {
      if (a.creatorId === userId) return -1;
      if (b.creatorId === userId) return 1;
      if (a.hasUnviewedStories && !b.hasUnviewedStories) return -1;
      if (!a.hasUnviewedStories && b.hasUnviewedStories) return 1;
      return new Date(b.latestStoryAt).getTime() - new Date(a.latestStoryAt).getTime();
    });

    return trayItems;
  }

  /**
   * Retrieves all active, authorized stories for a single creator.
   */
  async getCreatorStories(userId: string, creatorId: string): Promise<StoryItem[]> {
    const tray = await this.getStoriesTray(userId);
    const creatorTray = tray.find((t) => t.creatorId === creatorId);
    return creatorTray ? creatorTray.stories : [];
  }

  /**
   * Retrieves a specific story by ID with strict server-authoritative expiry & privacy checks.
   */
  async getStoryById(userId: string, storyId: string): Promise<StoryItem> {
    const res = await this.databaseService.query(
      `SELECT s.*,
              u.username as creator_username,
              u.display_name as creator_display_name,
              u.avatar_url as creator_avatar_url,
              u.is_verified as creator_is_verified,
              sv.progress_percent as viewer_progress,
              sv.completed as viewer_completed,
              (SELECT COUNT(*)::int FROM story_views WHERE story_id = s.id) as views_count,
              (SELECT COUNT(*)::int FROM story_reactions WHERE story_id = s.id) as reactions_count
       FROM stories s
       JOIN users u ON s.creator_id = u.id
       LEFT JOIN story_views sv ON s.id = sv.story_id AND sv.viewer_id = $1
       WHERE s.id = $2`,
      [userId, storyId],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException('Story not found');
    }

    const row = res.rows[0];

    // Check soft-delete
    if (row.deleted_at !== null) {
      throw new NotFoundException('Story has been deleted');
    }

    // Check Server-Authoritative Expiry
    const now = new Date();
    if (new Date(row.expires_at) <= now) {
      throw new NotFoundException('Story has expired');
    }

    // Check Block Status
    const blockCheck = await this.databaseService.query(
      `SELECT 1 FROM user_blocks
       WHERE (blocker_id = $1 AND blocked_id = $2)
          OR (blocker_id = $2 AND blocked_id = $1)`,
      [userId, row.creator_id],
    );
    if (blockCheck.rows.length > 0) {
      throw new ForbiddenException('Access denied to this story');
    }

    // Check Audience Authorization
    if (row.creator_id !== userId) {
      if (row.audience === 'FOLLOWERS_ONLY') {
        const followCheck = await this.databaseService.query(
          `SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2 AND status = 'ACCEPTED'`,
          [userId, row.creator_id],
        );
        if (followCheck.rows.length === 0) {
          throw new ForbiddenException('This story is restricted to followers only');
        }
      } else if (row.audience === 'CLOSE_FRIENDS') {
        const friendCheck = await this.databaseService.query(
          `SELECT 1 FROM close_friends WHERE user_id = $1 AND friend_id = $2`,
          [row.creator_id, userId],
        );
        if (friendCheck.rows.length === 0) {
          throw new ForbiddenException('This story is restricted to close friends only');
        }
      }
    }

    const creator = {
      id: row.creator_id,
      username: row.creator_username,
      displayName: row.creator_display_name,
      avatarUrl: row.creator_avatar_url,
      isVerified: row.creator_is_verified,
    };

    return this.mapStoryRow(
      row,
      creator,
      row.viewer_completed === true,
      row.viewer_progress ? parseFloat(row.viewer_progress) : 0.0,
    );
  }

  /**
   * Records a user's viewing progress on a story.
   */
  async recordView(
    userId: string,
    storyId: string,
    dto: RecordStoryViewInputDto,
  ): Promise<{ recorded: boolean; storyId: string }> {
    // Authorize viewer and check expiry first
    await this.getStoryById(userId, storyId);

    const progress = Math.min(Math.max(dto.progressPercent ?? 1.0, 0.0), 1.0);
    const completed = dto.completed ?? (progress >= 0.9);

    await this.databaseService.query(
      `INSERT INTO story_views (story_id, viewer_id, viewed_at, progress_percent, completed)
       VALUES ($1, $2, NOW(), $3, $4)
       ON CONFLICT (story_id, viewer_id)
       DO UPDATE SET
         viewed_at = NOW(),
         progress_percent = GREATEST(story_views.progress_percent, EXCLUDED.progress_percent),
         completed = (story_views.completed OR EXCLUDED.completed)`,
      [storyId, userId, progress, completed],
    );

    return { recorded: true, storyId };
  }

  /**
   * Records a quick emoji reaction to a story.
   */
  async reactToStory(
    userId: string,
    storyId: string,
    dto: ReactToStoryInputDto,
  ): Promise<{ reacted: boolean; reaction: string; storyId: string }> {
    await this.getStoryById(userId, storyId);

    await this.databaseService.query(
      `INSERT INTO story_reactions (story_id, user_id, reaction, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (story_id, user_id, reaction) DO NOTHING`,
      [storyId, userId, dto.reaction],
    );

    return { reacted: true, reaction: dto.reaction, storyId };
  }

  /**
   * Replies to a story. Respects creator's allowReplies setting.
   */
  async replyToStory(
    userId: string,
    storyId: string,
    dto: ReplyToStoryInputDto,
  ): Promise<{ sent: boolean; storyId: string; replyText: string }> {
    const story = await this.getStoryById(userId, storyId);

    if (story.allowReplies === 'OFF') {
      throw new BadRequestException('Replies are turned off for this story');
    }

    if (story.allowReplies === 'FOLLOWERS') {
      const followCheck = await this.databaseService.query(
        `SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2 AND status = 'ACCEPTED'`,
        [userId, story.creatorId],
      );
      if (followCheck.rows.length === 0) {
        throw new ForbiddenException('Only followers can reply to this story');
      }
    }

    this.logger.log(`Story reply from ${userId} to creator ${story.creatorId} on story ${storyId}`);

    return { sent: true, storyId, replyText: dto.text };
  }

  /**
   * Reports a story for moderation review. Hides the story for the reporting user.
   */
  async reportStory(
    userId: string,
    storyId: string,
    dto: ReportStoryInputDto,
  ): Promise<{ reported: boolean; storyId: string }> {
    await this.databaseService.query(
      `INSERT INTO story_reports (story_id, reporter_id, reason, details, status, created_at)
       VALUES ($1, $2, $3, $4, 'PENDING', NOW())
       ON CONFLICT (story_id, reporter_id) DO NOTHING`,
      [storyId, userId, dto.reason, dto.details || null],
    );

    this.logger.warn(`Story ${storyId} reported by ${userId} for reason: ${dto.reason}`);

    return { reported: true, storyId };
  }

  /**
   * Soft-deletes a story. Authorizes that only the creator can delete it.
   */
  async deleteStory(userId: string, storyId: string): Promise<{ deleted: boolean; storyId: string }> {
    const res = await this.databaseService.query(
      `UPDATE stories SET deleted_at = NOW() WHERE id = $1 AND creator_id = $2 RETURNING id`,
      [storyId, userId],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException(`Story ${storyId} not found or access denied`);
    }

    this.logger.log(`Story ${storyId} soft-deleted by creator ${userId}`);

    return { deleted: true, storyId };
  }

  /**
   * Adds a user to the creator's close friends list.
   */
  async addCloseFriend(userId: string, friendId: string): Promise<{ added: boolean; friendId: string }> {
    await this.databaseService.query(
      `INSERT INTO close_friends (user_id, friend_id, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, friend_id) DO NOTHING`,
      [userId, friendId],
    );
    return { added: true, friendId };
  }

  /**
   * Removes a user from the creator's close friends list.
   */
  async removeCloseFriend(userId: string, friendId: string): Promise<{ removed: boolean; friendId: string }> {
    await this.databaseService.query(
      `DELETE FROM close_friends WHERE user_id = $1 AND friend_id = $2`,
      [userId, friendId],
    );
    return { removed: true, friendId };
  }

  private mapStoryRow(
    row: any,
    creator: any,
    isViewed: boolean,
    progress: number,
  ): StoryItem {
    const overlays = typeof row.text_overlays === 'string'
      ? JSON.parse(row.text_overlays)
      : row.text_overlays || [];

    const expiresAt = new Date(row.expires_at);
    const isExpired = expiresAt.getTime() <= Date.now();

    return {
      id: row.id,
      creatorId: row.creator_id,
      creator: {
        id: creator.id,
        username: creator.username,
        displayName: creator.displayName ?? creator.display_name,
        avatarUrl: creator.avatarUrl ?? creator.avatar_url ?? null,
        isVerified: creator.isVerified ?? creator.is_verified ?? false,
      },
      mediaType: (row.media_type as string).toUpperCase() as StoryMediaType,
      mediaUrl: row.media_url,
      thumbnailUrl: row.thumbnail_url || null,
      durationSeconds: parseFloat(row.duration_seconds || '5.0'),
      caption: row.caption || '',
      textOverlays: overlays,
      audience: (row.audience as string).toUpperCase() as StoryAudience,
      allowReplies: (row.allow_replies as string).toUpperCase() as StoryReplySetting,
      createdAt: new Date(row.created_at).toISOString(),
      expiresAt: expiresAt.toISOString(),
      isExpired,
      isViewed,
      viewProgressPercent: progress,
      viewsCount: row.views_count ? parseInt(row.views_count, 10) : 0,
      reactionsCount: row.reactions_count ? parseInt(row.reactions_count, 10) : 0,
    };
  }
}
