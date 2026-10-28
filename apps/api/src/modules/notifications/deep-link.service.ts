import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { DeepLinkResolutionResult, DeepLinkTargetScreen } from '@shared/types';

@Injectable()
export class DeepLinkService {
  private readonly logger = new Logger(DeepLinkService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Safely parses, validates, authorizes, and resolves deep link URLs for mobile clients.
   * STRICT ZERO-LOCATION: Never logs or stores geolocation data.
   */
  async resolveDeepLink(viewerUserId: string, rawUrl: string): Promise<DeepLinkResolutionResult> {
    const trimmed = (rawUrl || '').trim();

    // 1. Security Sanitization: Reject dangerous protocols and traversal
    if (!this.isValidScheme(trimmed)) {
      return this.recordAndReturn(viewerUserId, trimmed, 'not_found', {}, false, false, 'INVALID_SCHEME');
    }

    if (trimmed.includes('..') || trimmed.includes('%2e%2e') || trimmed.includes('\0')) {
      return this.recordAndReturn(viewerUserId, trimmed, 'not_found', {}, false, false, 'PATH_TRAVERSAL_DETECTED');
    }

    // 2. Normalize URI
    const parsed = this.parseUri(trimmed);
    if (!parsed) {
      return this.recordAndReturn(viewerUserId, trimmed, 'not_found', {}, false, false, 'MALFORMED_URL');
    }

    const { path, segments, queryParams } = parsed;

    // 3. Match Route Patterns & Validate Authorization
    // 3.1 Reel Deep Link: interest://reels/:id or https://interest.app/reels/:id
    if (segments.length >= 2 && (segments[0] === 'reels' || segments[0] === 'reel')) {
      const reelId = segments[1];
      return this.resolveReelLink(viewerUserId, trimmed, reelId);
    }

    // 3.2 Profile Deep Link: interest://profile/:username or https://interest.app/@:username
    if (segments.length >= 1 && (segments[0] === 'profile' || segments[0].startsWith('@'))) {
      const username = segments[0].startsWith('@') ? segments[0].substring(1) : segments[1];
      if (!username) {
        return this.recordAndReturn(viewerUserId, trimmed, 'not_found', {}, false, false, 'MISSING_USERNAME');
      }
      return this.resolveProfileLink(viewerUserId, trimmed, username);
    }

    // 3.3 Chat Deep Link: interest://chat/conversations/:id or https://interest.app/chat/:id
    if (segments.length >= 2 && segments[0] === 'chat') {
      const convId = segments[1] === 'conversations' && segments.length >= 3 ? segments[2] : segments[1];
      return this.resolveChatLink(viewerUserId, trimmed, convId);
    }

    // 3.4 Topic Deep Link: interest://topic/:slug or https://interest.app/topic/:slug
    if (segments.length >= 2 && (segments[0] === 'topic' || segments[0] === 'interests')) {
      const slug = segments[1];
      return this.resolveTopicLink(viewerUserId, trimmed, slug);
    }

    // 3.5 In-App Notification Center: interest://notifications
    if (segments.length === 1 && segments[0] === 'notifications') {
      return this.recordAndReturn(viewerUserId, trimmed, 'notification_center', {}, true, true, undefined, 'Notifications');
    }

    // 3.6 Notification Settings: interest://settings/notifications
    if (segments.length >= 2 && segments[0] === 'settings' && segments[1] === 'notifications') {
      return this.recordAndReturn(viewerUserId, trimmed, 'settings_notifications', {}, true, true, undefined, 'Notification Settings');
    }

    return this.recordAndReturn(viewerUserId, trimmed, 'not_found', {}, false, false, 'UNKNOWN_ROUTE');
  }

  // ============================================================================
  // AUTHORIZATION HANDLERS FOR DELETED / PRIVATE CONTENT
  // ============================================================================

  private async resolveReelLink(viewerUserId: string, url: string, reelId: string): Promise<DeepLinkResolutionResult> {
    try {
      // Check reel exists and is not soft-deleted
      const res = await this.databaseService.query(
        `SELECT r.id, r.user_id, r.caption, r.is_archived, r.deleted_at,
                u.username, u.is_private
         FROM reels r
         JOIN users u ON u.id = r.user_id
         WHERE r.id = $1`,
        [reelId],
      );

      if (res.rows.length === 0 || res.rows[0].deleted_at !== null) {
        return this.recordAndReturn(viewerUserId, url, 'not_found', { reelId }, true, false, 'CONTENT_DELETED_OR_NOT_FOUND');
      }

      const row = res.rows[0];
      const creatorId = row.user_id;

      // Check block status
      if (viewerUserId && creatorId !== viewerUserId) {
        const blockCheck = await this.databaseService.query(
          `SELECT 1 FROM blocks
           WHERE (blocker_id = $1 AND blocked_id = $2)
              OR (blocker_id = $2 AND blocked_id = $1)
           LIMIT 1`,
          [viewerUserId, creatorId],
        );
        if (blockCheck?.rows && blockCheck.rows.length > 0) {
          return this.recordAndReturn(viewerUserId, url, 'access_denied', { reelId }, true, false, 'CREATOR_BLOCKED');
        }

        // Check private profile follow status
        if (row.is_private) {
          const followCheck = await this.databaseService.query(
            `SELECT status FROM user_relationships
             WHERE follower_id = $1 AND target_id = $2 AND status = 'ACCEPTED'`,
            [viewerUserId, creatorId],
          );
          if (!followCheck?.rows || followCheck.rows.length === 0) {
            return this.recordAndReturn(viewerUserId, url, 'access_denied', { reelId }, true, false, 'PRIVATE_ACCOUNT_NOT_FOLLOWING');
          }
        }
      }

      return this.recordAndReturn(
        viewerUserId,
        url,
        'reel',
        { reelId, creatorUsername: row.username },
        true,
        true,
        undefined,
        row.caption ? (row.caption.length > 30 ? `${row.caption.substring(0, 30)}...` : row.caption) : 'Watch Reel',
      );
    } catch (_) {
      return this.recordAndReturn(viewerUserId, url, 'not_found', { reelId }, true, false, 'DATABASE_ERROR');
    }
  }

  private async resolveProfileLink(viewerUserId: string, url: string, username: string): Promise<DeepLinkResolutionResult> {
    try {
      const res = await this.databaseService.query(
        `SELECT id, username, is_private, is_active FROM users WHERE LOWER(username) = LOWER($1)`,
        [username],
      );

      if (res.rows.length === 0 || !res.rows[0].is_active) {
        return this.recordAndReturn(viewerUserId, url, 'not_found', { username }, true, false, 'USER_NOT_FOUND_OR_DEACTIVATED');
      }

      const targetUser = res.rows[0];

      // Check block status
      if (viewerUserId && targetUser.id !== viewerUserId) {
        const blockCheck = await this.databaseService.query(
          `SELECT 1 FROM blocks
           WHERE (blocker_id = $1 AND blocked_id = $2)
              OR (blocker_id = $2 AND blocked_id = $1)
           LIMIT 1`,
          [viewerUserId, targetUser.id],
        );
        if (blockCheck?.rows && blockCheck.rows.length > 0) {
          return this.recordAndReturn(viewerUserId, url, 'access_denied', { username }, true, false, 'USER_BLOCKED');
        }
      }

      return this.recordAndReturn(
        viewerUserId,
        url,
        'profile',
        { username: targetUser.username, targetUserId: targetUser.id },
        true,
        true,
        undefined,
        `@${targetUser.username}`,
      );
    } catch (_) {
      return this.recordAndReturn(viewerUserId, url, 'not_found', { username }, true, false, 'DATABASE_ERROR');
    }
  }

  private async resolveChatLink(viewerUserId: string, url: string, conversationId: string): Promise<DeepLinkResolutionResult> {
    try {
      // Must be an accepted participant (BOLA prevention)
      const res = await this.databaseService.query(
        `SELECT c.id, c.title, c.type, cp.status
         FROM conversations c
         JOIN conversation_participants cp ON cp.conversation_id = c.id
         WHERE c.id = $1 AND cp.user_id = $2`,
        [conversationId, viewerUserId],
      );

      if (res.rows.length === 0 || res.rows[0].status === 'REJECTED') {
        return this.recordAndReturn(
          viewerUserId,
          url,
          'access_denied',
          { conversationId },
          true,
          false,
          'NOT_A_CONVERSATION_PARTICIPANT',
        );
      }

      return this.recordAndReturn(
        viewerUserId,
        url,
        'chat_thread',
        { conversationId },
        true,
        true,
        undefined,
        res.rows[0].title || 'Chat',
      );
    } catch (_) {
      return this.recordAndReturn(viewerUserId, url, 'not_found', { conversationId }, true, false, 'DATABASE_ERROR');
    }
  }

  private async resolveTopicLink(viewerUserId: string, url: string, slug: string): Promise<DeepLinkResolutionResult> {
    try {
      const res = await this.databaseService.query(
        `SELECT id, slug, title FROM interests WHERE LOWER(slug) = LOWER($1) AND is_active = TRUE`,
        [slug],
      );

      if (res.rows.length === 0) {
        return this.recordAndReturn(viewerUserId, url, 'not_found', { slug }, true, false, 'TOPIC_NOT_FOUND');
      }

      return this.recordAndReturn(
        viewerUserId,
        url,
        'topic',
        { slug: res.rows[0].slug, topicId: res.rows[0].id },
        true,
        true,
        undefined,
        res.rows[0].title,
      );
    } catch (_) {
      return this.recordAndReturn(viewerUserId, url, 'not_found', { slug }, true, false, 'DATABASE_ERROR');
    }
  }

  // ============================================================================
  // URL PARSING & VALIDATION
  // ============================================================================

  private isValidScheme(url: string): boolean {
    const lower = url.toLowerCase();
    return (
      lower.startsWith('interest://') ||
      lower.startsWith('https://interest.app/') ||
      lower.startsWith('https://www.interest.app/')
    );
  }

  private parseUri(url: string): { path: string; segments: string[]; queryParams: Record<string, string> } | null {
    try {
      let rawPath = '';
      if (url.startsWith('interest://')) {
        rawPath = url.substring('interest://'.length);
      } else if (url.startsWith('https://interest.app/')) {
        rawPath = url.substring('https://interest.app/'.length);
      } else if (url.startsWith('https://www.interest.app/')) {
        rawPath = url.substring('https://www.interest.app/'.length);
      }

      const [pathOnly, queryString] = rawPath.split('?');
      const segments = pathOnly
        .split('/')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const queryParams: Record<string, string> = {};
      if (queryString) {
        const pairs = queryString.split('&');
        for (const p of pairs) {
          const [k, v] = p.split('=');
          if (k) queryParams[decodeURIComponent(k)] = decodeURIComponent(v || '');
        }
      }

      return { path: pathOnly, segments, queryParams };
    } catch (_) {
      return null;
    }
  }

  private async recordAndReturn(
    userId: string,
    url: string,
    targetScreen: DeepLinkTargetScreen,
    params: Record<string, string>,
    isValid: boolean,
    accessGranted: boolean,
    fallbackReason?: string,
    title?: string,
  ): Promise<DeepLinkResolutionResult> {
    // Non-blocking resolution audit log
    try {
      const q = this.databaseService?.query(
        `INSERT INTO deep_link_resolutions
          (user_id, url, target_screen, entity_id, is_valid, access_granted, fallback_reason, resolved_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          userId || null,
          url.length > 500 ? url.substring(0, 500) : url,
          targetScreen,
          params.reelId || params.conversationId || params.topicId || params.targetUserId || null,
          isValid,
          accessGranted,
          fallbackReason || null,
        ],
      );
      if (q && typeof (q as any).catch === 'function') {
        (q as any).catch(() => {});
      }
    } catch (_) {}

    return {
      url,
      targetScreen,
      params,
      isValid,
      accessGranted,
      title,
      fallbackReason,
    };
  }
}
