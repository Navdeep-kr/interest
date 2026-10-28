import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { stripGeoEntities } from '@shared/geo-sanitizer';
import {
  UserProfile,
  FollowRequestItem,
  TaggingPrivacy,
  MentionPrivacy,
  FollowProfileItem,
} from '@shared/types';
import { UpdateProfileDto } from './dto/profile.dto';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  // ==========================================================================
  // 1. PROFILE RETRIEVAL & INSPECTION
  // ==========================================================================

  /**
   * Retrieves user profile by UUID or username with relationship flags and privacy controls.
   */
  async getProfile(
    requesterId: string | undefined,
    identifier: string,
  ): Promise<UserProfile> {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        identifier,
      );

    const userRes = await this.databaseService.query(
      `SELECT 
        u.id, u.email, u.phone_number, u.is_active, u.is_verified, u.created_at as user_created_at,
        p.username, p.display_name, p.bio, p.avatar_url, p.banner_url,
        p.preferred_languages, p.reels_count, p.followers_count, p.following_count,
        p.is_private, p.links, p.hide_follower_count, p.hide_following_count,
        p.allow_tagging, p.allow_mentions, p.updated_at as profile_updated_at
       FROM users u
       JOIN profiles p ON u.id = p.user_id
       WHERE ${isUuid ? 'u.id = $1' : 'LOWER(p.username) = LOWER($1)'}`,
      [identifier],
    );

    if (userRes.rows.length === 0 || !userRes.rows[0].is_active) {
      throw new NotFoundException('User profile not found');
    }

    const row = userRes.rows[0];
    const targetUserId = row.id;

    // Check bidirectional block if requester is authenticated and not viewing own profile
    let isFollowing = false;
    let isFollower = false;
    let isMutual = false;
    let hasPendingRequest = false;
    let isBlocked = false;
    let isMuted = false;
    let isRestricted = false;

    if (requesterId && requesterId !== targetUserId) {
      // 1. Block check
      const blockRes = await this.databaseService.query(
        `SELECT blocker_id FROM blocks 
         WHERE (blocker_id = $1 AND blocked_id = $2) 
            OR (blocker_id = $2 AND blocked_id = $1)`,
        [requesterId, targetUserId],
      );

      if (blockRes.rows.length > 0) {
        // Strict privacy invariant: Return 404 to avoid disclosing account existence to blocked parties
        throw new NotFoundException('User profile not found');
      }

      // 2. Following & Follower relationship
      const followsRes = await this.databaseService.query(
        `SELECT 
          EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2) as is_following,
          EXISTS(SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = $1) as is_follower,
          EXISTS(SELECT 1 FROM follow_requests WHERE requester_id = $1 AND target_id = $2 AND status = 'PENDING') as has_pending_request,
          EXISTS(SELECT 1 FROM user_mutes WHERE muter_id = $1 AND muted_id = $2) as is_muted,
          EXISTS(SELECT 1 FROM user_restricts WHERE user_id = $1 AND restricted_user_id = $2) as is_restricted`,
        [requesterId, targetUserId],
      );

      const rel = followsRes.rows[0];
      isFollowing = rel.is_following;
      isFollower = rel.is_follower;
      isMutual = isFollowing && isFollower;
      hasPendingRequest = rel.has_pending_request;
      isMuted = rel.is_muted;
      isRestricted = rel.is_restricted;
    }

    const isOwner = requesterId === targetUserId;

    // Privacy mask for followers/following count
    const followersCount =
      !isOwner && row.hide_follower_count ? -1 : parseInt(row.followers_count || '0', 10);
    const followingCount =
      !isOwner && row.hide_following_count ? -1 : parseInt(row.following_count || '0', 10);

    return {
      id: row.id,
      email: isOwner ? row.email : undefined,
      phoneNumber: isOwner ? row.phone_number : undefined,
      username: row.username,
      displayName: row.display_name,
      bio: row.bio || undefined,
      avatarUrl: row.avatar_url || undefined,
      bannerUrl: row.banner_url || undefined,
      preferredLanguages: row.preferred_languages || ['en'],
      reelsCount: parseInt(row.reels_count || '0', 10),
      followersCount,
      followingCount,
      isPrivate: row.is_private,
      links: typeof row.links === 'string' ? JSON.parse(row.links) : (row.links || []),
      hideFollowerCount: row.hide_follower_count,
      hideFollowingCount: row.hide_following_count,
      allowTagging: row.allow_tagging as TaggingPrivacy,
      allowMentions: row.allow_mentions as MentionPrivacy,
      isFollowing,
      isFollower,
      isMutual,
      hasPendingRequest,
      isBlocked,
      isMuted,
      isRestricted,
      createdAt: row.user_created_at.toISOString(),
      updatedAt: row.profile_updated_at.toISOString(),
    };
  }

  // ==========================================================================
  // 2. PROFILE UPDATE
  // ==========================================================================

  /**
   * Updates profile information with validation and Zero-Location sanitization.
   */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfile> {
    // 1. Check unique username if changing
    if (dto.username) {
      const trimmed = dto.username.trim();
      const conflictRes = await this.databaseService.query(
        `SELECT user_id FROM profiles WHERE LOWER(username) = LOWER($1) AND user_id != $2`,
        [trimmed, userId],
      );
      if (conflictRes.rows.length > 0) {
        throw new ConflictException(`Username @${trimmed} is already taken`);
      }
    }

    // 2. Enforce strict Zero-Location sanitization on bio
    let sanitizedBio: string | undefined = undefined;
    if (dto.bio !== undefined) {
      sanitizedBio = stripGeoEntities(dto.bio.trim());
    }

    // 3. Clean and validate links
    let sanitizedLinks: any = undefined;
    if (dto.links !== undefined) {
      if (dto.links.length > 5) {
        throw new BadRequestException('A maximum of 5 social links is allowed');
      }
      sanitizedLinks = JSON.stringify(
        dto.links.map((link) => ({
          title: link.title.trim().slice(0, 50),
          url: link.url.trim(),
        })),
      );
    }

    // 4. Update profiles table dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (dto.displayName !== undefined) {
      updates.push(`display_name = $${paramIndex++}`);
      values.push(dto.displayName.trim());
    }
    if (dto.username !== undefined) {
      updates.push(`username = $${paramIndex++}`);
      values.push(dto.username.trim());
    }
    if (sanitizedBio !== undefined) {
      updates.push(`bio = $${paramIndex++}`);
      values.push(sanitizedBio);
    }
    if (dto.avatarUrl !== undefined) {
      updates.push(`avatar_url = $${paramIndex++}`);
      values.push(dto.avatarUrl);
    }
    if (dto.bannerUrl !== undefined) {
      updates.push(`banner_url = $${paramIndex++}`);
      values.push(dto.bannerUrl);
    }
    if (sanitizedLinks !== undefined) {
      updates.push(`links = $${paramIndex++}::jsonb`);
      values.push(sanitizedLinks);
    }
    if (dto.isPrivate !== undefined) {
      updates.push(`is_private = $${paramIndex++}`);
      values.push(dto.isPrivate);
    }
    if (dto.hideFollowerCount !== undefined) {
      updates.push(`hide_follower_count = $${paramIndex++}`);
      values.push(dto.hideFollowerCount);
    }
    if (dto.hideFollowingCount !== undefined) {
      updates.push(`hide_following_count = $${paramIndex++}`);
      values.push(dto.hideFollowingCount);
    }
    if (dto.allowTagging !== undefined) {
      updates.push(`allow_tagging = $${paramIndex++}`);
      values.push(dto.allowTagging);
    }
    if (dto.allowMentions !== undefined) {
      updates.push(`allow_mentions = $${paramIndex++}`);
      values.push(dto.allowMentions);
    }
    if (dto.preferredLanguages !== undefined) {
      updates.push(`preferred_languages = $${paramIndex++}`);
      values.push(dto.preferredLanguages);
    }

    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);
      values.push(userId);
      await this.databaseService.query(
        `UPDATE profiles SET ${updates.join(', ')} WHERE user_id = $${paramIndex}`,
        values,
      );
    }

    return this.getProfile(userId, userId);
  }

  // ==========================================================================
  // 3. PROFILE CONTENT TABS (Reels, Collections, Liked)
  // ==========================================================================

  /**
   * Retrieves reels published by a user, respecting private account visibility.
   */
  async getProfileReels(
    requesterId: string | undefined,
    targetUserId: string,
    limit: number = 20,
    cursor?: string,
  ) {
    await this.assertAccessToProfileContent(requesterId, targetUserId);

    const values: any[] = [targetUserId, limit];
    let cursorClause = '';
    if (cursor) {
      values.push(new Date(cursor));
      cursorClause = `AND r.created_at < $3`;
    }

    const res = await this.databaseService.query(
      `SELECT 
        r.id, r.creator_id, r.title, r.caption, r.hls_master_url, r.thumbnail_url,
        r.duration_seconds, r.view_count, r.like_count, r.comment_count, r.save_count, r.share_count,
        r.created_at,
        p.username, p.display_name, p.avatar_url
       FROM reels r
       JOIN profiles p ON r.creator_id = p.user_id
       WHERE r.creator_id = $1 
         AND r.status = 'PUBLISHED'
         ${cursorClause}
       ORDER BY r.created_at DESC
       LIMIT $2`,
      values,
    );

    const items = res.rows.map((r) => ({
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
      viewCount: parseInt(r.view_count || '0', 10),
      likeCount: parseInt(r.like_count || '0', 10),
      commentCount: parseInt(r.comment_count || '0', 10),
      saveCount: parseInt(r.save_count || '0', 10),
      shareCount: parseInt(r.share_count || '0', 10),
      createdAt: r.created_at.toISOString(),
    }));

    const hasMore = items.length === limit;
    const nextCursor = hasMore ? items[items.length - 1].createdAt : null;

    return { items, hasMore, nextCursor };
  }

  /**
   * Retrieves profile collections.
   * If caller is profile owner, returns all collections (public + private).
   * If caller is visitor, returns only public collections (is_private = FALSE).
   */
  async getProfileCollections(
    requesterId: string,
    targetUserId: string,
    limit: number = 20,
    offset: number = 0,
  ) {
    await this.assertAccessToProfileContent(requesterId, targetUserId);

    const isOwner = requesterId === targetUserId;

    const res = await this.databaseService.query(
      `SELECT id, user_id, name, is_private, reels_count, created_at, updated_at
       FROM collections
       WHERE user_id = $1 ${isOwner ? '' : 'AND is_private = FALSE'}
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [targetUserId, limit, offset],
    );

    return res.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      isPrivate: row.is_private,
      reelsCount: parseInt(row.reels_count || '0', 10),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }));
  }

  /**
   * Retrieves liked reels. Strictly private to account owner.
   */
  async getProfileLikedReels(
    requesterId: string,
    targetUserId: string,
    limit: number = 20,
    cursor?: string,
  ) {
    if (requesterId !== targetUserId) {
      throw new ForbiddenException('Liked reels are private and only visible to the profile owner');
    }

    const values: any[] = [targetUserId, limit];
    let cursorClause = '';
    if (cursor) {
      values.push(new Date(cursor));
      cursorClause = `AND l.created_at < $3`;
    }

    const res = await this.databaseService.query(
      `SELECT 
        r.id, r.creator_id, r.title, r.caption, r.hls_master_url, r.thumbnail_url,
        r.duration_seconds, r.view_count, r.like_count, r.comment_count, r.save_count, r.share_count,
        l.created_at as liked_at,
        p.username, p.display_name, p.avatar_url
       FROM likes l
       JOIN reels r ON l.reel_id = r.id
       JOIN profiles p ON r.creator_id = p.user_id
       WHERE l.user_id = $1
         AND r.status = 'PUBLISHED'
         ${cursorClause}
       ORDER BY l.created_at DESC
       LIMIT $2`,
      values,
    );

    const items = res.rows.map((r) => ({
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
      viewCount: parseInt(r.view_count || '0', 10),
      likeCount: parseInt(r.like_count || '0', 10),
      commentCount: parseInt(r.comment_count || '0', 10),
      saveCount: parseInt(r.save_count || '0', 10),
      shareCount: parseInt(r.share_count || '0', 10),
      createdAt: r.liked_at.toISOString(),
    }));

    const hasMore = items.length === limit;
    const nextCursor = hasMore ? items[items.length - 1].createdAt : null;

    return { items, hasMore, nextCursor };
  }

  // ==========================================================================
  // 4. SOCIAL GRAPH (Follow, Unfollow, Private Follow Requests)
  // ==========================================================================

  /**
   * Follows a user or submits a follow request if the target account is private.
   */
  async followUser(requesterId: string, targetId: string) {
    if (requesterId === targetId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    // 1. Verify target exists and active
    const targetRes = await this.databaseService.query(
      `SELECT u.id, u.is_active, p.is_private 
       FROM users u 
       JOIN profiles p ON u.id = p.user_id 
       WHERE u.id = $1`,
      [targetId],
    );

    if (targetRes.rows.length === 0 || !targetRes.rows[0].is_active) {
      throw new NotFoundException('User not found');
    }

    // 2. Block check in both directions
    const blockRes = await this.databaseService.query(
      `SELECT 1 FROM blocks 
       WHERE (blocker_id = $1 AND blocked_id = $2) 
          OR (blocker_id = $2 AND blocked_id = $1)`,
      [requesterId, targetId],
    );
    if (blockRes.rows.length > 0) {
      throw new BadRequestException('Cannot follow this user');
    }

    // 3. Check existing follow
    const existingFollow = await this.databaseService.query(
      `SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2`,
      [requesterId, targetId],
    );
    if (existingFollow.rows.length > 0) {
      return { following: true, requested: false, status: 'FOLLOWING' };
    }

    const isPrivate = targetRes.rows[0].is_private;

    if (isPrivate) {
      // 4. Handle Private Account: Follow Request Flow
      const existingReq = await this.databaseService.query(
        `SELECT id, status FROM follow_requests WHERE requester_id = $1 AND target_id = $2`,
        [requesterId, targetId],
      );

      if (existingReq.rows.length > 0) {
        const reqRow = existingReq.rows[0];
        if (reqRow.status === 'PENDING') {
          return { following: false, requested: true, status: 'REQUESTED' };
        }
        // If previous request was rejected, reset to pending
        await this.databaseService.query(
          `UPDATE follow_requests SET status = 'PENDING', updated_at = NOW() WHERE id = $1`,
          [reqRow.id],
        );
      } else {
        await this.databaseService.query(
          `INSERT INTO follow_requests (requester_id, target_id, status, created_at, updated_at)
           VALUES ($1, $2, 'PENDING', NOW(), NOW())`,
          [requesterId, targetId],
        );
      }

      // Notify target of incoming follow request
      await this.databaseService.query(
        `INSERT INTO notifications (user_id, actor_id, type, entity_id, is_read, created_at)
         VALUES ($1, $2, 'FOLLOW_REQUEST', $3, FALSE, NOW())`,
        [targetId, requesterId, requesterId],
      );

      return { following: false, requested: true, status: 'REQUESTED' };
    } else {
      // 5. Public Account: Direct Follow Insertion
      await this.databaseService.withTransaction(async (client) => {
        await client.query(
          `INSERT INTO follows (follower_id, following_id, created_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT DO NOTHING`,
          [requesterId, targetId],
        );

        await client.query(
          `UPDATE profiles SET following_count = following_count + 1, updated_at = NOW() WHERE user_id = $1`,
          [requesterId],
        );

        await client.query(
          `UPDATE profiles SET followers_count = followers_count + 1, updated_at = NOW() WHERE user_id = $1`,
          [targetId],
        );

        await client.query(
          `INSERT INTO notifications (user_id, actor_id, type, entity_id, is_read, created_at)
           VALUES ($1, $2, 'FOLLOW', $3, FALSE, NOW())`,
          [targetId, requesterId, requesterId],
        );
      });

      // Check mutual
      const mutualRes = await this.databaseService.query(
        `SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2`,
        [targetId, requesterId],
      );

      return {
        following: true,
        requested: false,
        status: 'FOLLOWING',
        isMutual: mutualRes.rows.length > 0,
      };
    }
  }

  /**
   * Unfollows a user or removes a pending follow request.
   */
  async unfollowUser(requesterId: string, targetId: string) {
    if (requesterId === targetId) {
      throw new BadRequestException('You cannot unfollow yourself');
    }

    await this.databaseService.withTransaction(async (client) => {
      const delFollow = await client.query(
        `DELETE FROM follows WHERE follower_id = $1 AND following_id = $2`,
        [requesterId, targetId],
      );

      if ((delFollow.rowCount ?? 0) > 0) {
        await client.query(
          `UPDATE profiles SET following_count = GREATEST(0, following_count - 1), updated_at = NOW() WHERE user_id = $1`,
          [requesterId],
        );
        await client.query(
          `UPDATE profiles SET followers_count = GREATEST(0, followers_count - 1), updated_at = NOW() WHERE user_id = $1`,
          [targetId],
        );
      }

      await client.query(
        `DELETE FROM follow_requests WHERE requester_id = $1 AND target_id = $2`,
        [requesterId, targetId],
      );
    });

    return { following: false, requested: false, status: 'NOT_FOLLOWING' };
  }

  /**
   * Cancels a pending follow request to a private account.
   */
  async cancelFollowRequest(requesterId: string, targetId: string) {
    await this.databaseService.query(
      `DELETE FROM follow_requests 
       WHERE requester_id = $1 AND target_id = $2 AND status = 'PENDING'`,
      [requesterId, targetId],
    );
    return { cancelled: true };
  }

  /**
   * Retrieves pending incoming follow requests for the target user.
   */
  async getPendingFollowRequests(
    targetUserId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<FollowRequestItem[]> {
    const res = await this.databaseService.query(
      `SELECT 
        fr.id, fr.requester_id, fr.target_id, fr.status, fr.created_at,
        p.username, p.display_name, p.avatar_url
       FROM follow_requests fr
       JOIN profiles p ON fr.requester_id = p.user_id
       WHERE fr.target_id = $1 AND fr.status = 'PENDING'
       ORDER BY fr.created_at DESC
       LIMIT $2 OFFSET $3`,
      [targetUserId, limit, offset],
    );

    return res.rows.map((row) => ({
      id: row.id,
      requesterId: row.requester_id,
      requester: {
        id: row.requester_id,
        username: row.username,
        displayName: row.display_name,
        avatarUrl: row.avatar_url || undefined,
      },
      targetId: row.target_id,
      status: row.status,
      createdAt: row.created_at.toISOString(),
    }));
  }

  /**
   * Responds to an incoming follow request (ACCEPT or REJECT).
   */
  async respondFollowRequest(
    targetUserId: string,
    requestId: string,
    action: 'ACCEPT' | 'REJECT',
  ) {
    const reqRes = await this.databaseService.query(
      `SELECT id, requester_id, target_id, status 
       FROM follow_requests 
       WHERE id = $1 AND target_id = $2 AND status = 'PENDING'`,
      [requestId, targetUserId],
    );

    if (reqRes.rows.length === 0) {
      throw new NotFoundException('Follow request not found or already processed');
    }

    const { requester_id } = reqRes.rows[0];

    if (action === 'ACCEPT') {
      await this.databaseService.withTransaction(async (client) => {
        await client.query(
          `UPDATE follow_requests SET status = 'ACCEPTED', updated_at = NOW() WHERE id = $1`,
          [requestId],
        );

        await client.query(
          `INSERT INTO follows (follower_id, following_id, created_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT DO NOTHING`,
          [requester_id, targetUserId],
        );

        await client.query(
          `UPDATE profiles SET following_count = following_count + 1, updated_at = NOW() WHERE user_id = $1`,
          [requester_id],
        );

        await client.query(
          `UPDATE profiles SET followers_count = followers_count + 1, updated_at = NOW() WHERE user_id = $1`,
          [targetUserId],
        );

        await client.query(
          `INSERT INTO notifications (user_id, actor_id, type, entity_id, is_read, created_at)
           VALUES ($1, $2, 'FOLLOW_ACCEPTED', $3, FALSE, NOW())`,
          [requester_id, targetUserId, targetUserId],
        );
      });

      return { success: true, action: 'ACCEPTED', requestId };
    } else {
      await this.databaseService.query(
        `UPDATE follow_requests SET status = 'REJECTED', updated_at = NOW() WHERE id = $1`,
        [requestId],
      );

      return { success: true, action: 'REJECTED', requestId };
    }
  }

  // ==========================================================================
  // 5. RESTRICTIONS & SAFETY CONTROLS
  // ==========================================================================

  /**
   * Restricts a user (shadow limitation on interactions).
   */
  async restrictUser(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new BadRequestException('You cannot restrict yourself');
    }

    await this.databaseService.query(
      `INSERT INTO user_restricts (user_id, restricted_user_id, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, restricted_user_id) DO NOTHING`,
      [userId, targetUserId],
    );

    return { success: true, restricted: true, userId: targetUserId };
  }

  /**
   * Unrestricts a previously restricted user.
   */
  async unrestrictUser(userId: string, targetUserId: string) {
    await this.databaseService.query(
      `DELETE FROM user_restricts WHERE user_id = $1 AND restricted_user_id = $2`,
      [userId, targetUserId],
    );
    return { success: true, restricted: false, userId: targetUserId };
  }

  /**
   * Lists users restricted by the caller.
   */
  async getRestrictedUsers(userId: string): Promise<FollowProfileItem[]> {
    const res = await this.databaseService.query(
      `SELECT 
        u.id, p.username, p.display_name, p.avatar_url, p.bio
       FROM user_restricts ur
       JOIN users u ON ur.restricted_user_id = u.id
       JOIN profiles p ON u.id = p.user_id
       WHERE ur.user_id = $1
       ORDER BY ur.created_at DESC`,
      [userId],
    );

    return res.rows.map((r) => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      avatarUrl: r.avatar_url || undefined,
      bio: r.bio || undefined,
      isFollowing: false,
      isMutual: false,
    }));
  }

  // ==========================================================================
  // 6. MENTIONS / TAGGING CANDIDATE AUTOCOMPLETION
  // ==========================================================================

  /**
   * Searches user candidates for @mentions or tagging autocompletion.
   * Enforces block exclusion and respect for `allow_mentions` privacy controls.
   */
  async searchMentionCandidates(
    requesterId: string,
    query: string,
    limit: number = 20,
  ): Promise<FollowProfileItem[]> {
    const cleaned = query.trim().replace(/^@/, '');
    if (!cleaned) return [];

    const searchPattern = `%${cleaned}%`;

    const res = await this.databaseService.query(
      `SELECT 
        u.id, p.username, p.display_name, p.avatar_url, p.bio, p.allow_mentions,
        EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.following_id = u.id) as is_following,
        EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = u.id AND f.following_id = $1) as is_follower
       FROM users u
       JOIN profiles p ON u.id = p.user_id
       WHERE u.id != $1
         AND u.is_active = TRUE
         AND (p.username ILIKE $2 OR p.display_name ILIKE $2)
         -- Bidirectional block exclusion
         AND NOT EXISTS (
           SELECT 1 FROM blocks b 
           WHERE (b.blocker_id = $1 AND b.blocked_id = u.id)
              OR (b.blocker_id = u.id AND b.blocked_id = $1)
         )
         -- Privacy setting check: allow_mentions
         AND (
           p.allow_mentions = 'EVERYONE'
           OR (p.allow_mentions = 'FOLLOWING' AND EXISTS (
             SELECT 1 FROM follows f WHERE f.follower_id = u.id AND f.following_id = $1
           ))
         )
       ORDER BY 
         (CASE WHEN p.username ILIKE $3 THEN 0 ELSE 1 END),
         p.followers_count DESC
       LIMIT $4`,
      [requesterId, searchPattern, `${cleaned}%`, limit],
    );

    return res.rows.map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url || undefined,
      bio: row.bio || undefined,
      isFollowing: row.is_following,
      isMutual: row.is_following && row.is_follower,
    }));
  }

  // ==========================================================================
  // 7. ZERO-LOCATION PROFILE RECOMMENDATIONS
  // ==========================================================================

  /**
   * Generates profile recommendations strictly using 512-dim interest affinity vectors.
   * Zero GPS, Zero IP, Zero Proximity.
   */
  async getProfileRecommendations(
    userId: string,
    limit: number = 15,
  ): Promise<FollowProfileItem[]> {
    // 1. Fetch user's interest centroid vector
    const userRes = await this.databaseService.query(
      `SELECT interest_vector FROM users WHERE id = $1`,
      [userId],
    );

    const hasVector = userRes.rows[0]?.interest_vector != null;

    let res;
    if (hasVector) {
      // Vector-based interest affinity matching via pgvector cosine distance (<=>)
      res = await this.databaseService.query(
        `SELECT 
          u.id, p.username, p.display_name, p.avatar_url, p.bio, p.reels_count, p.followers_count,
          1 - (u.interest_vector <=> (SELECT interest_vector FROM users WHERE id = $1)) as interest_similarity
         FROM users u
         JOIN profiles p ON u.id = p.user_id
         WHERE u.id != $1
           AND u.is_active = TRUE
           AND u.interest_vector IS NOT NULL
           -- Exclude accounts already followed
           AND NOT EXISTS (
             SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.following_id = u.id
           )
           -- Exclude accounts with pending requests
           AND NOT EXISTS (
             SELECT 1 FROM follow_requests fr WHERE fr.requester_id = $1 AND fr.target_id = u.id AND fr.status = 'PENDING'
           )
           -- Exclude blocked accounts in either direction
           AND NOT EXISTS (
             SELECT 1 FROM blocks b 
             WHERE (b.blocker_id = $1 AND b.blocked_id = u.id)
                OR (b.blocker_id = u.id AND b.blocked_id = $1)
           )
         ORDER BY interest_similarity DESC, p.followers_count DESC
         LIMIT $2`,
        [userId, limit],
      );
    } else {
      // Fallback: Creators with high engagement and published reels
      res = await this.databaseService.query(
        `SELECT 
          u.id, p.username, p.display_name, p.avatar_url, p.bio, p.reels_count, p.followers_count
         FROM users u
         JOIN profiles p ON u.id = p.user_id
         WHERE u.id != $1
           AND u.is_active = TRUE
           AND p.reels_count > 0
           AND NOT EXISTS (
             SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.following_id = u.id
           )
           AND NOT EXISTS (
             SELECT 1 FROM blocks b 
             WHERE (b.blocker_id = $1 AND b.blocked_id = u.id)
                OR (b.blocker_id = u.id AND b.blocked_id = $1)
           )
         ORDER BY p.followers_count DESC, p.reels_count DESC
         LIMIT $2`,
        [userId, limit],
      );
    }

    return res.rows.map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url || undefined,
      bio: row.bio || undefined,
      isFollowing: false,
      isMutual: false,
    }));
  }

  // ==========================================================================
  // HELPER PRIVACY GATES
  // ==========================================================================

  /**
   * Asserts that requester is permitted to view the target user's content tabs.
   * Enforces block exclusion and private account gating.
   */
  private async assertAccessToProfileContent(
    requesterId: string | undefined,
    targetUserId: string,
  ): Promise<void> {
    const userRes = await this.databaseService.query(
      `SELECT u.id, u.is_active, p.is_private 
       FROM users u 
       JOIN profiles p ON u.id = p.user_id 
       WHERE u.id = $1`,
      [targetUserId],
    );

    if (userRes.rows.length === 0 || !userRes.rows[0].is_active) {
      throw new NotFoundException('User profile not found');
    }

    // Self-access is always permitted
    if (requesterId === targetUserId) {
      return;
    }

    // Bidirectional block check
    if (requesterId) {
      const blockRes = await this.databaseService.query(
        `SELECT 1 FROM blocks 
         WHERE (blocker_id = $1 AND blocked_id = $2) 
            OR (blocker_id = $2 AND blocked_id = $1)`,
        [requesterId, targetUserId],
      );
      if (blockRes.rows.length > 0) {
        throw new NotFoundException('User profile not found');
      }
    }

    // Private account check
    const isPrivate = userRes.rows[0].is_private;
    if (isPrivate) {
      if (!requesterId) {
        throw new ForbiddenException('This account is private');
      }

      const followRes = await this.databaseService.query(
        `SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2`,
        [requesterId, targetUserId],
      );

      if (followRes.rows.length === 0) {
        throw new ForbiddenException('This account is private. Follow this user to see their content.');
      }
    }
  }
}
