import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { RedisCounterService } from './redis-counter.service';
import { AntiSpamService } from './anti-spam.service';
import { MentionsService } from './mentions.service';
import { ModerationService } from '../safety/moderation.service';
import {
  CreateCommentInputDto,
  ModerateCommentInputDto,
  CreateCollectionInputDto,
} from './dto/interactions.dto';
import {
  LikeToggleResponse,
  CommentLikeToggleResponse,
  CommentItem,
  CommentsResponseDto,
  SaveToggleResponse,
  CollectionItem,
  CollectionDetailsResponse,
  ShareResponse,
  FollowToggleResponse,
  FollowProfileItem,
  ReelRemixesResponse,
  ReelItem,
} from '@shared/types';

@Injectable()
export class InteractionsService {
  private readonly logger = new Logger(InteractionsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisCounterService: RedisCounterService,
    private readonly antiSpamService: AntiSpamService,
    private readonly mentionsService: MentionsService,
    @Optional() private readonly moderationService?: ModerationService,
  ) {}

  // ==========================================================================
  // LIKES
  // ==========================================================================

  /**
   * Toggles like state for a reel.
   * Atomic in-memory Redis counter with anti-spam check.
   */
  async toggleReelLike(userId: string, reelId: string): Promise<LikeToggleResponse> {
    // 1. Anti-spam fast-like rate limit check
    await this.antiSpamService.checkLikeRateLimit(userId);

    // 2. Verify reel exists
    const reelRes = await this.databaseService.query(
      `SELECT id, creator_id, like_count FROM reels WHERE id = $1`,
      [reelId],
    );
    if (reelRes.rows.length === 0) {
      throw new NotFoundException(`Reel ${reelId} not found`);
    }
    const reel = reelRes.rows[0];

    // 3. Check existing like
    const existing = await this.databaseService.query(
      `SELECT 1 FROM likes WHERE user_id = $1 AND reel_id = $2`,
      [userId, reelId],
    );

    let liked: boolean;
    let newLikeCount: number;

    if (existing.rows.length > 0) {
      // Unlike
      await this.databaseService.query(
        `DELETE FROM likes WHERE user_id = $1 AND reel_id = $2`,
        [userId, reelId],
      );
      liked = false;
      newLikeCount = await this.redisCounterService.incrementReelCounter(reelId, 'likes', -1);
    } else {
      // Like
      await this.databaseService.query(
        `INSERT INTO likes (user_id, reel_id, created_at) VALUES ($1, $2, NOW())`,
        [userId, reelId],
      );
      liked = true;
      newLikeCount = await this.redisCounterService.incrementReelCounter(reelId, 'likes', 1);

      // Dispatch notification if not liking own reel
      if (reel.creator_id !== userId) {
        await this.databaseService.query(
          `INSERT INTO notifications (user_id, actor_id, type, entity_id, is_read, created_at)
           VALUES ($1, $2, 'LIKE', $3, FALSE, NOW())`,
          [reel.creator_id, userId, reelId],
        );
      }
    }

    return {
      liked,
      likeCount: newLikeCount,
      reelId,
    };
  }

  /**
   * Toggles like state for a comment.
   */
  async toggleCommentLike(userId: string, commentId: string): Promise<CommentLikeToggleResponse> {
    const commentRes = await this.databaseService.query(
      `SELECT id, user_id, like_count FROM comments WHERE id = $1`,
      [commentId],
    );
    if (commentRes.rows.length === 0) {
      throw new NotFoundException(`Comment ${commentId} not found`);
    }

    const existing = await this.databaseService.query(
      `SELECT 1 FROM comment_likes WHERE user_id = $1 AND comment_id = $2`,
      [userId, commentId],
    );

    let liked: boolean;
    let newLikeCount: number;

    if (existing.rows.length > 0) {
      await this.databaseService.query(
        `DELETE FROM comment_likes WHERE user_id = $1 AND comment_id = $2`,
        [userId, commentId],
      );
      liked = false;
      newLikeCount = await this.redisCounterService.incrementCommentLikeCount(commentId, -1);
    } else {
      await this.databaseService.query(
        `INSERT INTO comment_likes (user_id, comment_id, created_at) VALUES ($1, $2, NOW())`,
        [userId, commentId],
      );
      liked = true;
      newLikeCount = await this.redisCounterService.incrementCommentLikeCount(commentId, 1);
    }

    return {
      liked,
      likeCount: newLikeCount,
      commentId,
    };
  }

  // ==========================================================================
  // THREADED COMMENTS
  // ==========================================================================

  /**
   * Adds a top-level or reply comment to a reel with mention parsing and rate limiting.
   */
  async addComment(
    userId: string,
    reelId: string,
    dto: CreateCommentInputDto,
  ): Promise<CommentItem> {
    // 1. Anti-spam checks
    await this.antiSpamService.checkCommentRateLimit(userId);
    await this.antiSpamService.checkDuplicateComment(userId, dto.text);

    // 2. Verify reel exists
    const reelRes = await this.databaseService.query(
      `SELECT id, creator_id FROM reels WHERE id = $1`,
      [reelId],
    );
    if (reelRes.rows.length === 0) {
      throw new NotFoundException(`Reel ${reelId} not found`);
    }
    const reel = reelRes.rows[0];

    // 3. If parentId provided, verify parent exists and belongs to this reel
    let parentAuthorId: string | null = null;
    if (dto.parentId) {
      const parentRes = await this.databaseService.query(
        `SELECT id, user_id, reel_id FROM comments WHERE id = $1`,
        [dto.parentId],
      );
      if (parentRes.rows.length === 0) {
        throw new NotFoundException(`Parent comment ${dto.parentId} not found`);
      }
      if (parentRes.rows[0].reel_id !== reelId) {
        throw new BadRequestException(`Parent comment belongs to a different reel`);
      }
      parentAuthorId = parentRes.rows[0].user_id;
    }

    // 4. Automated Content & Keyword Moderation Check
    let isHidden = false;
    let hiddenReason: string | null = null;
    if (this.moderationService) {
      const filterResult = await this.moderationService.filterComment(reel.creator_id, dto.text);
      if (filterResult.shouldHide) {
        isHidden = true;
        hiddenReason = filterResult.reason || 'KEYWORD_FILTER';
      }
    }

    // 5. Insert comment
    const insertRes = await this.databaseService.query(
      `INSERT INTO comments (reel_id, user_id, parent_id, text, is_pinned, is_hidden, hidden_reason, created_at, updated_at)
       VALUES ($1, $2, $3, $4, FALSE, $5, $6, NOW(), NOW())
       RETURNING id, reel_id, user_id, parent_id, text, like_count, is_pinned, is_hidden, created_at, updated_at`,
      [reelId, userId, dto.parentId || null, dto.text.trim(), isHidden, hiddenReason],
    );
    const row = insertRes.rows[0];

    // 5. Increment comment count in Redis
    await this.redisCounterService.incrementReelCounter(reelId, 'comments', 1);

    // 6. Process mentions
    const mentionResult = await this.mentionsService.processMentions(userId, dto.text, row.id);

    // 7. Dispatch notifications
    // Reel creator notification
    if (reel.creator_id !== userId) {
      await this.databaseService.query(
        `INSERT INTO notifications (user_id, actor_id, type, entity_id, is_read, created_at)
         VALUES ($1, $2, 'COMMENT', $3, FALSE, NOW())`,
        [reel.creator_id, userId, row.id],
      );
    }
    // Parent comment reply notification
    if (parentAuthorId && parentAuthorId !== userId && parentAuthorId !== reel.creator_id) {
      await this.databaseService.query(
        `INSERT INTO notifications (user_id, actor_id, type, entity_id, is_read, created_at)
         VALUES ($1, $2, 'COMMENT', $3, FALSE, NOW())`,
        [parentAuthorId, userId, row.id],
      );
    }

    // 8. Fetch user profile
    const userRes = await this.databaseService.query(
      `SELECT id, username, display_name, avatar_url FROM users WHERE id = $1`,
      [userId],
    );
    const user = userRes.rows[0] || {
      id: userId,
      username: 'user',
      displayName: 'User',
      avatarUrl: undefined,
    };

    return {
      id: row.id,
      reelId: row.reel_id,
      userId: row.user_id,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        avatarUrl: user.avatar_url || undefined,
      },
      parentId: row.parent_id,
      text: row.text,
      likeCount: 0,
      isLiked: false,
      isPinned: false,
      isHidden: false,
      repliesCount: 0,
      replies: [],
      mentions: mentionResult.extractedUsernames,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /**
   * Retrieves threaded comments for a reel with creator pinned comments on top,
   * creator moderation filtering, and live Redis like counters.
   */
  async getComments(
    reelId: string,
    currentUserId?: string,
    limit: number = 30,
    cursor?: string,
  ): Promise<CommentsResponseDto> {
    // 1. Get reel creator ID
    const reelRes = await this.databaseService.query(
      `SELECT id, creator_id FROM reels WHERE id = $1`,
      [reelId],
    );
    if (reelRes.rows.length === 0) {
      throw new NotFoundException(`Reel ${reelId} not found`);
    }
    const creatorId = reelRes.rows[0].creator_id;
    const isRequesterCreator = currentUserId === creatorId;

    // 2. Query root comments (parent_id IS NULL)
    const cursorFilter = cursor ? `AND c.created_at < $4` : '';
    const queryParams: any[] = [reelId, limit];
    if (cursor) queryParams.push(cursor);

    const rootCommentsRes = await this.databaseService.query(
      `SELECT 
        c.id, c.reel_id, c.user_id, c.parent_id, c.text, c.like_count, 
        c.is_pinned, c.is_hidden, c.created_at, c.updated_at,
        u.username, u.display_name, u.avatar_url,
        (SELECT COUNT(*) FROM comments r WHERE r.parent_id = c.id AND (r.is_hidden = FALSE OR $3 = TRUE OR r.user_id = $4)) as replies_count
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.reel_id = $1 
         AND c.parent_id IS NULL
         AND (c.is_hidden = FALSE OR $3 = TRUE OR c.user_id = $4)
         ${cursorFilter}
       ORDER BY c.is_pinned DESC, c.created_at DESC
       LIMIT $2`,
      cursor
        ? [reelId, limit, isRequesterCreator, currentUserId || null, cursor]
        : [reelId, limit, isRequesterCreator, currentUserId || null],
    );

    // 3. For each root comment, fetch child replies
    const rootCommentIds = rootCommentsRes.rows.map((r) => r.id);
    let repliesMap = new Map<string, any[]>();

    if (rootCommentIds.length > 0) {
      const repliesRes = await this.databaseService.query(
        `SELECT 
          c.id, c.reel_id, c.user_id, c.parent_id, c.text, c.like_count, 
          c.is_pinned, c.is_hidden, c.created_at, c.updated_at,
          u.username, u.display_name, u.avatar_url
         FROM comments c
         JOIN users u ON c.user_id = u.id
         WHERE c.parent_id = ANY($1)
           AND (c.is_hidden = FALSE OR $2 = TRUE OR c.user_id = $3)
         ORDER BY c.created_at ASC`,
        [rootCommentIds, isRequesterCreator, currentUserId || null],
      );

      for (const rep of repliesRes.rows) {
        const list = repliesMap.get(rep.parent_id) || [];
        list.push(rep);
        repliesMap.set(rep.parent_id, list);
      }
    }

    // 4. Fetch comment likes for current user if authenticated
    let userLikedCommentIds = new Set<string>();
    if (currentUserId) {
      const allCommentIds = [
        ...rootCommentIds,
        ...Array.from(repliesMap.values()).flatMap((list) => list.map((r) => r.id)),
      ];
      if (allCommentIds.length > 0) {
        const likesRes = await this.databaseService.query(
          `SELECT comment_id FROM comment_likes WHERE user_id = $1 AND comment_id = ANY($2)`,
          [currentUserId, allCommentIds],
        );
        for (const l of likesRes.rows) {
          userLikedCommentIds.add(l.comment_id);
        }
      }
    }

    // 5. Total count
    const totalCountRes = await this.databaseService.query(
      `SELECT COUNT(*) as total FROM comments 
       WHERE reel_id = $1 
         AND (is_hidden = FALSE OR $2 = TRUE OR user_id = $3)`,
      [reelId, isRequesterCreator, currentUserId || null],
    );
    const totalCount = parseInt(totalCountRes.rows[0]?.total || '0', 10);

    // 6. Build response tree
    const items: CommentItem[] = await Promise.all(
      rootCommentsRes.rows.map(async (row) => {
        const rawReplies = repliesMap.get(row.id) || [];
        const replies: CommentItem[] = await Promise.all(
          rawReplies.map(async (rep) => {
            const liveLikes = await this.redisCounterService.getCommentLikeCount(
              rep.id,
              rep.like_count,
            );
            return {
              id: rep.id,
              reelId: rep.reel_id,
              userId: rep.user_id,
              user: {
                id: rep.user_id,
                username: rep.username,
                displayName: rep.display_name,
                avatarUrl: rep.avatar_url || undefined,
              },
              parentId: rep.parent_id,
              text: rep.text,
              likeCount: liveLikes,
              isLiked: userLikedCommentIds.has(rep.id),
              isPinned: rep.is_pinned,
              isHidden: rep.is_hidden,
              repliesCount: 0,
              mentions: this.mentionsService.extractMentions(rep.text),
              createdAt: rep.created_at.toISOString(),
              updatedAt: rep.updated_at.toISOString(),
            };
          }),
        );

        const liveLikes = await this.redisCounterService.getCommentLikeCount(
          row.id,
          row.like_count,
        );

        return {
          id: row.id,
          reelId: row.reel_id,
          userId: row.user_id,
          user: {
            id: row.user_id,
            username: row.username,
            displayName: row.display_name,
            avatarUrl: row.avatar_url || undefined,
          },
          parentId: row.parent_id,
          text: row.text,
          likeCount: liveLikes,
          isLiked: userLikedCommentIds.has(row.id),
          isPinned: row.is_pinned,
          isHidden: row.is_hidden,
          repliesCount: parseInt(row.replies_count || '0', 10),
          replies,
          mentions: this.mentionsService.extractMentions(row.text),
          createdAt: row.created_at.toISOString(),
          updatedAt: row.updated_at.toISOString(),
        };
      }),
    );

    const hasMore = items.length === limit;
    const nextCursor = hasMore ? items[items.length - 1].createdAt : null;

    return {
      items,
      totalCount,
      hasMore,
      nextCursor,
    };
  }

  /**
   * Pins or unpins a comment. Strictly restricted to the reel creator.
   * Ensures only one pinned comment per reel at a time.
   */
  async pinComment(
    userId: string,
    commentId: string,
  ): Promise<{ pinned: boolean; commentId: string }> {
    const commentRes = await this.databaseService.query(
      `SELECT c.id, c.reel_id, c.is_pinned, r.creator_id
       FROM comments c
       JOIN reels r ON c.reel_id = r.id
       WHERE c.id = $1`,
      [commentId],
    );

    if (commentRes.rows.length === 0) {
      throw new NotFoundException(`Comment ${commentId} not found`);
    }

    const { reel_id, is_pinned, creator_id } = commentRes.rows[0];

    // Strictly enforce creator-only pinning
    if (creator_id !== userId) {
      throw new ForbiddenException('Only the reel creator can pin comments');
    }

    if (is_pinned) {
      // Unpin
      await this.databaseService.query(
        `UPDATE comments SET is_pinned = FALSE, updated_at = NOW() WHERE id = $1`,
        [commentId],
      );
      return { pinned: false, commentId };
    } else {
      // Unpin any currently pinned comment on this reel
      await this.databaseService.query(
        `UPDATE comments SET is_pinned = FALSE, updated_at = NOW() WHERE reel_id = $1 AND is_pinned = TRUE`,
        [reel_id],
      );
      // Pin this comment
      await this.databaseService.query(
        `UPDATE comments SET is_pinned = TRUE, updated_at = NOW() WHERE id = $1`,
        [commentId],
      );
      return { pinned: true, commentId };
    }
  }

  /**
   * Creator moderation or author deletion for a comment.
   * - Delete: permitted for comment author OR reel creator.
   * - Hide/Unhide: permitted ONLY for reel creator.
   */
  async moderateComment(
    userId: string,
    commentId: string,
    dto: ModerateCommentInputDto,
  ): Promise<{ success: boolean; action: string; commentId: string }> {
    const commentRes = await this.databaseService.query(
      `SELECT c.id, c.reel_id, c.user_id, c.is_hidden, r.creator_id
       FROM comments c
       JOIN reels r ON c.reel_id = r.id
       WHERE c.id = $1`,
      [commentId],
    );

    if (commentRes.rows.length === 0) {
      throw new NotFoundException(`Comment ${commentId} not found`);
    }

    const { reel_id, user_id, creator_id } = commentRes.rows[0];

    if (dto.action === 'delete') {
      const isAuthor = user_id === userId;
      const isCreator = creator_id === userId;
      if (!isAuthor && !isCreator) {
        throw new ForbiddenException('You do not have permission to delete this comment');
      }

      await this.databaseService.query(`DELETE FROM comments WHERE id = $1`, [commentId]);
      await this.redisCounterService.incrementReelCounter(reel_id, 'comments', -1);

      return { success: true, action: 'delete', commentId };
    }

    if (dto.action === 'hide' || dto.action === 'unhide') {
      if (creator_id !== userId) {
        throw new ForbiddenException('Only the reel creator can hide or unhide comments');
      }

      const isHidden = dto.action === 'hide';
      await this.databaseService.query(
        `UPDATE comments SET is_hidden = $1, updated_at = NOW() WHERE id = $2`,
        [isHidden, commentId],
      );

      return { success: true, action: dto.action, commentId };
    }

    throw new BadRequestException(`Invalid moderation action`);
  }

  // ==========================================================================
  // SAVES & COLLECTIONS
  // ==========================================================================

  /**
   * Toggles default save for a reel.
   */
  async toggleReelSave(userId: string, reelId: string): Promise<SaveToggleResponse> {
    const reelRes = await this.databaseService.query(
      `SELECT id, save_count FROM reels WHERE id = $1`,
      [reelId],
    );
    if (reelRes.rows.length === 0) {
      throw new NotFoundException(`Reel ${reelId} not found`);
    }

    const existing = await this.databaseService.query(
      `SELECT 1 FROM saves WHERE user_id = $1 AND reel_id = $2`,
      [userId, reelId],
    );

    let saved: boolean;
    let newSaveCount: number;

    if (existing.rows.length > 0) {
      await this.databaseService.query(
        `DELETE FROM saves WHERE user_id = $1 AND reel_id = $2`,
        [userId, reelId],
      );
      saved = false;
      newSaveCount = await this.redisCounterService.incrementReelCounter(reelId, 'saves', -1);
    } else {
      await this.databaseService.query(
        `INSERT INTO saves (user_id, reel_id, created_at) VALUES ($1, $2, NOW())`,
        [userId, reelId],
      );
      saved = true;
      newSaveCount = await this.redisCounterService.incrementReelCounter(reelId, 'saves', 1);
    }

    return {
      saved,
      saveCount: newSaveCount,
      reelId,
    };
  }

  /**
   * Creates a new user collection for organizing saved reels.
   */
  async createCollection(userId: string, dto: CreateCollectionInputDto): Promise<CollectionItem> {
    const res = await this.databaseService.query(
      `INSERT INTO collections (user_id, name, is_private, reels_count, created_at, updated_at)
       VALUES ($1, $2, $3, 0, NOW(), NOW())
       RETURNING id, user_id, name, is_private, reels_count, created_at, updated_at`,
      [userId, dto.name.trim(), dto.isPrivate ?? true],
    );
    const row = res.rows[0];

    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      isPrivate: row.is_private,
      reelsCount: 0,
      previewThumbnailUrl: null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /**
   * Lists all collections created by the user with preview thumbnail.
   */
  async getUserCollections(userId: string): Promise<CollectionItem[]> {
    const res = await this.databaseService.query(
      `SELECT 
        c.id, c.user_id, c.name, c.is_private, c.reels_count, c.created_at, c.updated_at,
        (
          SELECT r.thumbnail_url 
          FROM collection_reels cr
          JOIN reels r ON cr.reel_id = r.id
          WHERE cr.collection_id = c.id
          ORDER BY cr.created_at DESC
          LIMIT 1
        ) as preview_thumbnail_url
       FROM collections c
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC`,
      [userId],
    );

    return res.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      isPrivate: row.is_private,
      reelsCount: row.reels_count,
      previewThumbnailUrl: row.preview_thumbnail_url || null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }));
  }

  /**
   * Adds a reel to a specific collection (and saves it if not already saved).
   */
  async addReelToCollection(
    userId: string,
    collectionId: string,
    reelId: string,
  ): Promise<{ added: boolean; collectionId: string; reelId: string }> {
    // 1. Check collection ownership
    const colRes = await this.databaseService.query(
      `SELECT id FROM collections WHERE id = $1 AND user_id = $2`,
      [collectionId, userId],
    );
    if (colRes.rows.length === 0) {
      throw new NotFoundException(`Collection not found or access denied`);
    }

    // 2. Ensure reel is in saves
    const saveRes = await this.databaseService.query(
      `SELECT 1 FROM saves WHERE user_id = $1 AND reel_id = $2`,
      [userId, reelId],
    );
    if (saveRes.rows.length === 0) {
      await this.databaseService.query(
        `INSERT INTO saves (user_id, reel_id, created_at) VALUES ($1, $2, NOW())`,
        [userId, reelId],
      );
      await this.redisCounterService.incrementReelCounter(reelId, 'saves', 1);
    }

    // 3. Add to collection_reels
    await this.databaseService.query(
      `INSERT INTO collection_reels (collection_id, reel_id, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (collection_id, reel_id) DO NOTHING`,
      [collectionId, reelId],
    );

    // 4. Update count
    await this.databaseService.query(
      `UPDATE collections 
       SET reels_count = (SELECT COUNT(*) FROM collection_reels WHERE collection_id = $1),
           updated_at = NOW()
       WHERE id = $1`,
      [collectionId],
    );

    return { added: true, collectionId, reelId };
  }

  /**
   * Removes a reel from a specific collection.
   */
  async removeReelFromCollection(
    userId: string,
    collectionId: string,
    reelId: string,
  ): Promise<{ removed: boolean; collectionId: string; reelId: string }> {
    const colRes = await this.databaseService.query(
      `SELECT id FROM collections WHERE id = $1 AND user_id = $2`,
      [collectionId, userId],
    );
    if (colRes.rows.length === 0) {
      throw new NotFoundException(`Collection not found or access denied`);
    }

    await this.databaseService.query(
      `DELETE FROM collection_reels WHERE collection_id = $1 AND reel_id = $2`,
      [collectionId, reelId],
    );

    await this.databaseService.query(
      `UPDATE collections 
       SET reels_count = (SELECT COUNT(*) FROM collection_reels WHERE collection_id = $1),
           updated_at = NOW()
       WHERE id = $1`,
      [collectionId],
    );

    return { removed: true, collectionId, reelId };
  }

  /**
   * Gets details and reels inside a collection.
   */
  async getCollectionReels(
    userId: string,
    collectionId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<CollectionDetailsResponse> {
    const colRes = await this.databaseService.query(
      `SELECT * FROM collections WHERE id = $1`,
      [collectionId],
    );
    if (colRes.rows.length === 0) {
      throw new NotFoundException(`Collection not found`);
    }

    const col = colRes.rows[0];
    if (col.is_private && col.user_id !== userId) {
      throw new ForbiddenException(`This collection is private`);
    }

    const reelsRes = await this.databaseService.query(
      `SELECT 
        r.id, r.creator_id, r.title, r.caption, r.hls_master_url, r.thumbnail_url,
        r.duration_seconds, r.view_count, r.like_count, r.comment_count, r.save_count, r.share_count,
        r.created_at,
        u.username, u.display_name, u.avatar_url
       FROM collection_reels cr
       JOIN reels r ON cr.reel_id = r.id
       JOIN users u ON r.creator_id = u.id
       WHERE cr.collection_id = $1
       ORDER BY cr.created_at DESC
       LIMIT $2 OFFSET $3`,
      [collectionId, limit, offset],
    );

    const reels: ReelItem[] = reelsRes.rows.map((r) => ({
      id: r.id,
      creatorId: r.creator_id,
      creator: {
        id: r.creator_id,
        username: r.username,
        displayName: r.display_name,
        avatarUrl: r.avatar_url || undefined,
      },
      title: r.title,
      caption: r.caption || undefined,
      hlsMasterUrl: r.hls_master_url,
      thumbnailUrl: r.thumbnail_url,
      durationSeconds: parseFloat(r.duration_seconds || '0'),
      primaryInterestId: '',
      interestTags: [],
      viewCount: parseInt(r.view_count || '0', 10),
      likeCount: parseInt(r.like_count || '0', 10),
      commentCount: parseInt(r.comment_count || '0', 10),
      saveCount: parseInt(r.save_count || '0', 10),
      shareCount: parseInt(r.share_count || '0', 10),
      isSaved: true,
      createdAt: r.created_at.toISOString(),
    }));

    return {
      collection: {
        id: col.id,
        userId: col.user_id,
        name: col.name,
        isPrivate: col.is_private,
        reelsCount: col.reels_count,
        previewThumbnailUrl: reels[0]?.thumbnailUrl || null,
        createdAt: col.created_at.toISOString(),
        updatedAt: col.updated_at.toISOString(),
      },
      reels,
      totalCount: col.reels_count,
    };
  }

  // ==========================================================================
  // SHARES
  // ==========================================================================

  /**
   * Records a reel share event and generates canonical share URL.
   */
  async recordShare(
    userId: string,
    reelId: string,
    platform: string = 'internal',
  ): Promise<ShareResponse> {
    const reelRes = await this.databaseService.query(
      `SELECT id FROM reels WHERE id = $1`,
      [reelId],
    );
    if (reelRes.rows.length === 0) {
      throw new NotFoundException(`Reel ${reelId} not found`);
    }

    await this.databaseService.query(
      `INSERT INTO shares (reel_id, user_id, platform, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [reelId, userId, platform],
    );

    const newShareCount = await this.redisCounterService.incrementReelCounter(reelId, 'shares', 1);

    return {
      shared: true,
      shareCount: newShareCount,
      shareUrl: `https://interest.app/reel/${reelId}`,
    };
  }

  // ==========================================================================
  // FOLLOWS SOCIAL GRAPH
  // ==========================================================================

  /**
   * Toggles following relationship between users with anti-churn protection.
   */
  async toggleFollow(followerId: string, followingId: string): Promise<FollowToggleResponse> {
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    // 1. Anti-spam follow churn rate limit check
    await this.antiSpamService.checkFollowRateLimit(followerId);

    // 2. Verify target user exists
    const targetUser = await this.databaseService.query(
      `SELECT id, followers_count FROM users WHERE id = $1`,
      [followingId],
    );
    if (targetUser.rows.length === 0) {
      throw new NotFoundException(`User ${followingId} not found`);
    }

    // 3. Check existing follow
    const existing = await this.databaseService.query(
      `SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2`,
      [followerId, followingId],
    );

    let following: boolean;

    if (existing.rows.length > 0) {
      // Unfollow
      await this.databaseService.query(
        `DELETE FROM follows WHERE follower_id = $1 AND following_id = $2`,
        [followerId, followingId],
      );
      following = false;

      await this.redisCounterService.incrementUserCounter(followerId, 'following', -1);
      await this.redisCounterService.incrementUserCounter(followingId, 'followers', -1);
    } else {
      // Follow
      await this.databaseService.query(
        `INSERT INTO follows (follower_id, following_id, created_at)
         VALUES ($1, $2, NOW())`,
        [followerId, followingId],
      );
      following = true;

      await this.redisCounterService.incrementUserCounter(followerId, 'following', 1);
      await this.redisCounterService.incrementUserCounter(followingId, 'followers', 1);

      // Dispatch follow notification
      await this.databaseService.query(
        `INSERT INTO notifications (user_id, actor_id, type, entity_id, is_read, created_at)
         VALUES ($1, $2, 'FOLLOW', $3, FALSE, NOW())`,
        [followingId, followerId, followerId],
      );
    }

    // 4. Check if mutual
    const mutualRes = await this.databaseService.query(
      `SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2`,
      [followingId, followerId],
    );
    const isMutual = following && mutualRes.rows.length > 0;

    // 5. Get current follower & following counts
    const countsRes = await this.databaseService.query(
      `SELECT 
        (SELECT COUNT(*) FROM follows WHERE following_id = $1) as followers_count,
        (SELECT COUNT(*) FROM follows WHERE follower_id = $2) as following_count`,
      [followingId, followerId],
    );

    return {
      following,
      isMutual,
      followersCount: parseInt(countsRes.rows[0]?.followers_count || '0', 10),
      followingCount: parseInt(countsRes.rows[0]?.following_count || '0', 10),
    };
  }

  /**
   * Retrieves followers list with mutual status.
   */
  async getFollowers(
    userId: string,
    currentUserId?: string,
    limit: number = 30,
    offset: number = 0,
  ): Promise<FollowProfileItem[]> {
    const res = await this.databaseService.query(
      `SELECT 
        u.id, u.username, u.display_name, u.avatar_url, u.bio,
        CASE WHEN $2::UUID IS NOT NULL AND EXISTS(
          SELECT 1 FROM follows f2 WHERE f2.follower_id = $2 AND f2.following_id = u.id
        ) THEN TRUE ELSE FALSE END as is_following,
        CASE WHEN $2::UUID IS NOT NULL AND EXISTS(
          SELECT 1 FROM follows f2 WHERE f2.follower_id = $2 AND f2.following_id = u.id
        ) AND EXISTS(
          SELECT 1 FROM follows f3 WHERE f3.follower_id = u.id AND f3.following_id = $2
        ) THEN TRUE ELSE FALSE END as is_mutual
       FROM follows f
       JOIN users u ON f.follower_id = u.id
       WHERE f.following_id = $1
       ORDER BY f.created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, currentUserId || null, limit, offset],
    );

    return res.rows.map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url || undefined,
      bio: row.bio || undefined,
      isFollowing: row.is_following,
      isMutual: row.is_mutual,
    }));
  }

  /**
   * Retrieves following list with mutual status.
   */
  async getFollowing(
    userId: string,
    currentUserId?: string,
    limit: number = 30,
    offset: number = 0,
  ): Promise<FollowProfileItem[]> {
    const res = await this.databaseService.query(
      `SELECT 
        u.id, u.username, u.display_name, u.avatar_url, u.bio,
        CASE WHEN $2::UUID IS NOT NULL AND EXISTS(
          SELECT 1 FROM follows f2 WHERE f2.follower_id = $2 AND f2.following_id = u.id
        ) THEN TRUE ELSE FALSE END as is_following,
        CASE WHEN $2::UUID IS NOT NULL AND EXISTS(
          SELECT 1 FROM follows f2 WHERE f2.follower_id = $2 AND f2.following_id = u.id
        ) AND EXISTS(
          SELECT 1 FROM follows f3 WHERE f3.follower_id = u.id AND f3.following_id = $2
        ) THEN TRUE ELSE FALSE END as is_mutual
       FROM follows f
       JOIN users u ON f.following_id = u.id
       WHERE f.follower_id = $1
       ORDER BY f.created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, currentUserId || null, limit, offset],
    );

    return res.rows.map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url || undefined,
      bio: row.bio || undefined,
      isFollowing: row.is_following,
      isMutual: row.is_mutual,
    }));
  }

  // ==========================================================================
  // DUET & REMIX LINEAGE
  // ==========================================================================

  /**
   * Validates if a reel can be remixed or duetted based on creator permissions.
   */
  async validateCanRemix(
    originalReelId: string,
  ): Promise<{ canRemix: boolean; reel: any }> {
    const res = await this.databaseService.query(
      `SELECT id, creator_id, title, audio_url, allow_duet, allow_remix, status
       FROM reels WHERE id = $1`,
      [originalReelId],
    );
    if (res.rows.length === 0) {
      throw new NotFoundException(`Original reel ${originalReelId} not found`);
    }

    const reel = res.rows[0];
    if (reel.status !== 'PUBLISHED') {
      throw new BadRequestException('Cannot remix an unpublished reel');
    }

    if (!reel.allow_duet && !reel.allow_remix) {
      throw new ForbiddenException('The creator has disabled remixing and duets for this reel');
    }

    return {
      canRemix: true,
      reel,
    };
  }

  /**
   * Retrieves all derivative remixes of an original reel.
   */
  async getReelRemixes(
    reelId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<ReelRemixesResponse> {
    const countRes = await this.databaseService.query(
      `SELECT COUNT(*) as total FROM reels WHERE remix_of_reel_id = $1 AND status = 'PUBLISHED'`,
      [reelId],
    );
    const totalRemixes = parseInt(countRes.rows[0]?.total || '0', 10);

    const res = await this.databaseService.query(
      `SELECT 
        r.id, r.creator_id, r.title, r.caption, r.hls_master_url, r.thumbnail_url,
        r.duration_seconds, r.view_count, r.like_count, r.comment_count, r.save_count, r.share_count,
        r.remix_type, r.created_at,
        u.username, u.display_name, u.avatar_url
       FROM reels r
       JOIN users u ON r.creator_id = u.id
       WHERE r.remix_of_reel_id = $1 AND r.status = 'PUBLISHED'
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [reelId, limit, offset],
    );

    const remixes: ReelItem[] = res.rows.map((r) => ({
      id: r.id,
      creatorId: r.creator_id,
      creator: {
        id: r.creator_id,
        username: r.username,
        displayName: r.display_name,
        avatarUrl: r.avatar_url || undefined,
      },
      title: r.title,
      caption: r.caption || undefined,
      hlsMasterUrl: r.hls_master_url,
      thumbnailUrl: r.thumbnail_url,
      durationSeconds: parseFloat(r.duration_seconds || '0'),
      primaryInterestId: '',
      interestTags: [],
      viewCount: parseInt(r.view_count || '0', 10),
      likeCount: parseInt(r.like_count || '0', 10),
      commentCount: parseInt(r.comment_count || '0', 10),
      saveCount: parseInt(r.save_count || '0', 10),
      shareCount: parseInt(r.share_count || '0', 10),
      createdAt: r.created_at.toISOString(),
    }));

    return {
      originalReelId: reelId,
      totalRemixes,
      remixes,
    };
  }
}
