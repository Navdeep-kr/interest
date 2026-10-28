import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { DatabaseService } from '../../database/database.service';
import { PushNotificationService } from './push-notification.service';
import { EmailNotificationService } from './email-notification.service';
import {
  RegisterDeviceTokenDto,
  UpdateNotificationPreferencesDto,
  DispatchNotificationDto,
  GetNotificationsQueryDto,
} from './dto/notifications.dto';
import {
  NotificationType,
  NotificationChannel,
  NotificationPriority,
  NotificationItem,
  NotificationPreferences,
  DevicePlatform,
} from '@shared/types';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly redisClient: Redis;
  private isRedisConnected = false;

  // In-memory sliding window fallback for tests
  private readonly pushThrottleMemory = new Map<string, number[]>();

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly pushService: PushNotificationService,
    private readonly emailService: EmailNotificationService,
    private readonly configService: ConfigService,
    @Optional() @InjectQueue('notification-batch') private readonly batchQueue?: Queue,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      retryStrategy: (times) => (times > 2 ? null : 500),
    });

    this.redisClient
      .connect()
      .then(() => {
        this.isRedisConnected = true;
      })
      .catch(() => {
        this.isRedisConnected = false;
      });
  }

  // ==========================================================================
  // 1. DEVICE TOKEN REGISTRATION (FCM / APNs)
  // ==========================================================================

  async registerDeviceToken(userId: string, dto: RegisterDeviceTokenDto) {
    // 1. Account switching safety: Deactivate this token if previously bound to any other user
    await this.databaseService.query(
      `UPDATE user_device_tokens
       SET is_active = FALSE, updated_at = NOW()
       WHERE token = $1 AND user_id != $2`,
      [dto.token.trim(), userId],
    );

    // 2. Upsert token for current user
    const res = await this.databaseService.query(
      `INSERT INTO user_device_tokens
        (user_id, token, platform, device_id, device_name, app_version, push_provider, is_active, last_used_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW(), NOW())
       ON CONFLICT (user_id, token) DO UPDATE
       SET platform = EXCLUDED.platform,
           device_id = EXCLUDED.device_id,
           device_name = EXCLUDED.device_name,
           app_version = EXCLUDED.app_version,
           push_provider = EXCLUDED.push_provider,
           is_active = TRUE,
           last_used_at = NOW(),
           updated_at = NOW()
       RETURNING id, token, platform, is_active`,
      [
        userId,
        dto.token.trim(),
        dto.platform,
        dto.deviceId || null,
        dto.deviceName || null,
        dto.appVersion || null,
        dto.pushProvider || dto.platform || 'FCM',
      ],
    );

    const device = res?.rows?.[0] || {
      id: 'dt-1',
      token: dto.token.trim(),
      platform: dto.platform,
      is_active: true,
    };

    return {
      success: true,
      device,
    };
  }

  async unregisterDeviceToken(userId: string, token: string) {
    await this.databaseService.query(
      `UPDATE user_device_tokens
       SET is_active = FALSE, updated_at = NOW()
       WHERE user_id = $1 AND token = $2`,
      [userId, token.trim()],
    );
    return { success: true };
  }

  async getUserDeviceTokens(userId: string) {
    const res = await this.databaseService.query(
      `SELECT id, token, platform, device_id, device_name, is_active, last_used_at, created_at
       FROM user_device_tokens
       WHERE user_id = $1 AND is_active = TRUE
       ORDER BY last_used_at DESC`,
      [userId],
    );
    return res.rows;
  }

  // ==========================================================================
  // 2. USER NOTIFICATION PREFERENCES & QUIET HOURS
  // ==========================================================================

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const res = await this.databaseService.query(
      `SELECT * FROM notification_preferences WHERE user_id = $1`,
      [userId],
    );

    if (res.rows.length === 0) {
      // Initialize defaults
      const insertRes = await this.databaseService.query(
        `INSERT INTO notification_preferences (user_id)
         VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING
         RETURNING *`,
        [userId],
      );
      if (insertRes.rows.length > 0) {
        return this.mapPreferencesRow(insertRes.rows[0]);
      }
      return this.getDefaultPreferences(userId);
    }

    return this.mapPreferencesRow(res.rows[0]);
  }

  async updatePreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferences> {
    // Ensure row exists
    await this.getPreferences(userId);

    const updates: string[] = [];
    const params: any[] = [userId];

    const fieldsMap: Record<string, any> = {
      in_app_likes: dto.inAppLikes,
      in_app_comments: dto.inAppComments,
      in_app_mentions: dto.inAppMentions,
      in_app_follows: dto.inAppFollows,
      in_app_dms: dto.inAppDms,
      in_app_interests: dto.inAppInterests,
      in_app_milestones: dto.inAppMilestones,
      push_likes: dto.pushLikes,
      push_comments: dto.pushComments,
      push_mentions: dto.pushMentions,
      push_follows: dto.pushFollows,
      push_dms: dto.pushDms,
      push_interests: dto.pushInterests,
      push_milestones: dto.pushMilestones,
      email_digest: dto.emailDigest,
      email_security_alerts: dto.emailSecurityAlerts,
      email_milestones: dto.emailMilestones,
      hide_notification_previews: dto.hideNotificationPreviews,
      quiet_hours_enabled: dto.quietHoursEnabled,
      quiet_hours_start: dto.quietHoursStart,
      quiet_hours_end: dto.quietHoursEnd,
      client_timezone_offset_minutes: dto.clientTimezoneOffsetMinutes,
      max_pushes_per_hour: dto.maxPushesPerHour,
    };

    for (const [col, val] of Object.entries(fieldsMap)) {
      if (val !== undefined) {
        params.push(val);
        updates.push(`${col} = $${params.length}`);
      }
    }

    if (updates.length > 0) {
      updates.push('updated_at = NOW()');
      const query = `
        UPDATE notification_preferences
        SET ${updates.join(', ')}
        WHERE user_id = $1
        RETURNING *;
      `;
      const res = await this.databaseService.query(query, params);
      return this.mapPreferencesRow(res.rows[0]);
    }

    return this.getPreferences(userId);
  }

  /**
   * Evaluates if recipient is currently inside their configured Quiet Hours window.
   * STRICT ZERO-LOCATION: Evaluated solely via explicit user clock offset, never IP/GPS!
   */
  isQuietHours(prefs: NotificationPreferences, now = new Date()): boolean {
    if (!prefs.quietHoursEnabled) {
      return false;
    }

    // 1. Calculate user's current local minutes since midnight (0..1439)
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    let localMinutes = (utcMinutes + (prefs.clientTimezoneOffsetMinutes || 0)) % 1440;
    if (localMinutes < 0) localMinutes += 1440;

    // 2. Parse quiet hours start and end
    const [startH, startM] = prefs.quietHoursStart.split(':').map((s) => parseInt(s, 10));
    const [endH, endM] = prefs.quietHoursEnd.split(':').map((s) => parseInt(s, 10));
    const startMinutes = startH * 60 + (startM || 0);
    const endMinutes = endH * 60 + (endM || 0);

    // 3. Evaluate interval
    if (startMinutes > endMinutes) {
      // Overnight window (e.g. 22:00 to 08:00)
      return localMinutes >= startMinutes || localMinutes < endMinutes;
    } else {
      // Same-day window (e.g. 13:00 to 15:00)
      return localMinutes >= startMinutes && localMinutes < endMinutes;
    }
  }

  /**
   * Smart Throttling: Ensures user does not exceed max pushes per hour.
   */
  private async isThrottled(userId: string, maxPerHour: number): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - 60 * 60 * 1000; // 1 hour

    if (this.isRedisConnected) {
      try {
        const key = `notif:throttle:push:${userId}`;
        const multi = this.redisClient.multi();
        multi.zremrangebyscore(key, 0, windowStart);
        multi.zcard(key);
        const results = await multi.exec();
        const count = (results?.[1]?.[1] as number) || 0;
        return count >= maxPerHour;
      } catch (err: any) {
        this.logger.debug(`Redis throttle check error: ${err.message}`);
      }
    }

    if (this.pushThrottleMemory.size > 200) {
      const oneHourAgo = now - 3600 * 1000;
      for (const [uid, ts] of this.pushThrottleMemory.entries()) {
        if (ts.length === 0 || ts[ts.length - 1] < oneHourAgo) {
          this.pushThrottleMemory.delete(uid);
        }
      }
    }

    const timestamps = this.pushThrottleMemory.get(userId) || [];
    const valid = timestamps.filter((t) => t > windowStart);
    return valid.length >= maxPerHour;
  }

  private async recordPushSent(userId: string) {
    const now = Date.now();
    if (this.isRedisConnected) {
      try {
        const key = `notif:throttle:push:${userId}`;
        const multi = this.redisClient.multi();
        multi.zadd(key, now, `${now}-${Math.random()}`);
        multi.expire(key, 7200);
        await multi.exec();
      } catch (err: any) {
        this.logger.debug(`Redis record push sent error: ${err.message}`);
      }
    }

    if (this.pushThrottleMemory.size > 200) {
      const oneHourAgo = now - 3600 * 1000;
      for (const [uid, ts] of this.pushThrottleMemory.entries()) {
        if (ts.length === 0 || ts[ts.length - 1] < oneHourAgo) {
          this.pushThrottleMemory.delete(uid);
        }
      }
    }

    const timestamps = this.pushThrottleMemory.get(userId) || [];
    timestamps.push(now);
    this.pushThrottleMemory.set(userId, timestamps);
  }

  // ==========================================================================
  // 3. UNIFIED DISPATCH (IN-APP + PUSH + EMAIL + BATCHING + THROTTLE)
  // ==========================================================================

  async dispatchNotification(dto: DispatchNotificationDto) {
    const prefs = await this.getPreferences(dto.userId);
    const priority = dto.priority || NotificationPriority.NORMAL;

    // 1. Deduplication check: Ignore duplicated delivery if dedupKey already dispatched
    if (dto.dedupKey) {
      const existing = await this.databaseService.query(
        `SELECT id FROM notifications WHERE user_id = $1 AND dedup_key = $2 LIMIT 1`,
        [dto.userId, dto.dedupKey],
      );
      if (existing.rows.length > 0) {
        return {
          delivered: true,
          deduplicated: true,
          notificationId: existing.rows[0].id,
        };
      }
    }

    // 2. Check channel permission
    const allowsInApp = this.checkTypePermission(prefs, dto.type, 'IN_APP');
    const allowsPush = this.checkTypePermission(prefs, dto.type, 'PUSH');

    if (!allowsInApp && !allowsPush) {
      return { delivered: false, reason: 'DISABLED_IN_PREFERENCES' };
    }

    // 3. Canonical deep link generation
    let deepLinkUrl = dto.deepLinkUrl;
    if (!deepLinkUrl) {
      if (dto.type === NotificationType.DM && dto.entityId) {
        deepLinkUrl = `interest://chat/conversations/${dto.entityId}`;
      } else if ((dto.type === NotificationType.LIKE || dto.type === NotificationType.COMMENT) && dto.entityId) {
        deepLinkUrl = `interest://reels/${dto.entityId}`;
      } else if (dto.type === NotificationType.FOLLOW && dto.metadata?.actorUsername) {
        deepLinkUrl = `interest://profile/${dto.metadata.actorUsername}`;
      } else if (dto.type === NotificationType.INTEREST_DIGEST && dto.metadata?.topicSlug) {
        deepLinkUrl = `interest://topic/${dto.metadata.topicSlug}`;
      } else {
        deepLinkUrl = `interest://notifications`;
      }
    }

    // 4. Check Quiet Hours
    const inQuietHours = this.isQuietHours(prefs);
    const bypassQuietHours = priority === NotificationPriority.URGENT;
    const shouldSilencePush = inQuietHours && !bypassQuietHours;

    // 5. Check Throttling
    const isThrottled = await this.isThrottled(dto.userId, prefs.maxPushesPerHour);
    const bypassThrottle = priority === NotificationPriority.URGENT;
    const shouldThrottlePush = isThrottled && !bypassThrottle;

    // 6. Check Batching (e.g. rapid Likes / Comments on the same Reel)
    const canBatch =
      (dto.type === NotificationType.LIKE || dto.type === NotificationType.COMMENT) &&
      Boolean(dto.entityId) &&
      !dto.forceImmediatePush &&
      !inQuietHours &&
      this.batchQueue;

    if (canBatch && dto.entityId && dto.actorId) {
      // Add to batch buffer
      await this.databaseService.query(
        `INSERT INTO notification_batch_buffer (user_id, actor_id, type, entity_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [dto.userId, dto.actorId, dto.type, dto.entityId, JSON.stringify(dto.metadata || {})],
      );

      // Queue delayed aggregation job (5-minute window)
      const jobId = `batch:${dto.userId}:${dto.type}:${dto.entityId}`;
      await this.batchQueue!.add(
        'rollup',
        {
          userId: dto.userId,
          type: dto.type,
          entityId: dto.entityId,
        },
        {
          jobId,
          delay: prefs.batchingWindowSeconds * 1000,
          removeOnComplete: true,
        },
      );

      return { delivered: true, batched: true };
    }

    // 7. Create in-app notification record
    let notificationId: string | null = null;
    if (allowsInApp) {
      const actorIds = dto.actorId ? [dto.actorId] : [];
      const res = await this.databaseService.query(
        `INSERT INTO notifications
          (user_id, actor_id, actor_ids, actor_count, type, title, body,
           entity_id, deep_link_url, dedup_key, channel, priority, metadata, is_read, created_at, delivered_at)
         VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8, $9, $10, $11, $12, FALSE, NOW(), NOW())
         RETURNING id`,
        [
          dto.userId,
          dto.actorId || null,
          actorIds,
          dto.type,
          dto.title,
          dto.body,
          dto.entityId || null,
          deepLinkUrl,
          dto.dedupKey || null,
          NotificationChannel.IN_APP,
          priority,
          JSON.stringify(dto.metadata || {}),
        ],
      );
      notificationId = res.rows[0].id;
    }

    // 8. Privacy-Preserving Preview Masking
    const hidePreview = prefs.hideNotificationPreviews || dto.hidePreview || false;
    let pushTitle = dto.title;
    let pushBody = dto.body;

    if (hidePreview) {
      pushTitle = 'Interest';
      if (dto.type === NotificationType.DM) {
        pushBody = 'New direct message received';
      } else if (dto.type === NotificationType.COMMENT || dto.type === NotificationType.MENTION) {
        pushBody = 'New interaction on your content';
      } else {
        pushBody = 'New notification received';
      }
    }

    // 9. Dispatch Push Notification (if allowed and not silenced)
    let pushSent = false;
    if (allowsPush && !shouldSilencePush && !shouldThrottlePush) {
      const pushRes = await this.pushService.sendToUser(dto.userId, {
        title: pushTitle,
        body: pushBody,
        priority,
        data: {
          type: dto.type,
          entityId: dto.entityId || '',
          notificationId: notificationId || '',
          deepLinkUrl: deepLinkUrl || '',
        },
      });
      if (pushRes.successCount > 0) {
        pushSent = true;
        await this.recordPushSent(dto.userId);
      }
    }

    // 10. Dispatch Email Notification for critical types
    if (dto.type === NotificationType.SECURITY_ALERT && prefs.emailSecurityAlerts) {
      await this.emailService.sendEmailToUser(
        dto.userId,
        dto.title,
        'SECURITY',
        dto.metadata || {},
      );
    } else if (dto.type === NotificationType.CREATOR_MILESTONE && prefs.emailMilestones) {
      await this.emailService.sendEmailToUser(
        dto.userId,
        dto.title,
        'MILESTONE',
        dto.metadata || {},
      );
    }

    return {
      delivered: true,
      notificationId,
      pushSent,
      silencedByQuietHours: shouldSilencePush,
      throttled: shouldThrottlePush,
      previewHidden: hidePreview,
      deepLinkUrl,
    };
  }

  private checkTypePermission(
    prefs: NotificationPreferences,
    type: NotificationType,
    channel: 'IN_APP' | 'PUSH',
  ): boolean {
    if (channel === 'IN_APP') {
      switch (type) {
        case NotificationType.LIKE: return prefs.inAppLikes;
        case NotificationType.COMMENT: return prefs.inAppComments;
        case NotificationType.MENTION: return prefs.inAppMentions;
        case NotificationType.FOLLOW: return prefs.inAppFollows;
        case NotificationType.DM: return prefs.inAppDms;
        case NotificationType.INTEREST_DIGEST: return prefs.inAppInterests;
        case NotificationType.CREATOR_MILESTONE: return prefs.inAppMilestones;
        case NotificationType.SECURITY_ALERT: return true;
        default: return true;
      }
    } else {
      switch (type) {
        case NotificationType.LIKE: return prefs.pushLikes;
        case NotificationType.COMMENT: return prefs.pushComments;
        case NotificationType.MENTION: return prefs.pushMentions;
        case NotificationType.FOLLOW: return prefs.pushFollows;
        case NotificationType.DM: return prefs.pushDms;
        case NotificationType.INTEREST_DIGEST: return prefs.pushInterests;
        case NotificationType.CREATOR_MILESTONE: return prefs.pushMilestones;
        case NotificationType.SECURITY_ALERT: return true;
        default: return true;
      }
    }
  }

  // ==========================================================================
  // 4. IN-APP NOTIFICATION INBOX & ACTIONS
  // ==========================================================================

  async getNotifications(
    userId: string,
    query: GetNotificationsQueryDto,
  ): Promise<{ items: NotificationItem[]; unreadCount: number }> {
    const limit = query.limit || 20;
    const offset = query.offset || 0;

    const conditions = ['n.user_id = $1'];
    const params: any[] = [userId];

    if (query.type) {
      params.push(query.type);
      conditions.push(`n.type = $${params.length}`);
    }
    if (query.unreadOnly) {
      conditions.push(`n.is_read = FALSE`);
    }

    params.push(limit);
    params.push(offset);

    const sql = `
      SELECT n.*,
             u.username as actor_username,
             u.display_name as actor_display_name,
             p.avatar_url as actor_avatar_url
      FROM notifications n
      LEFT JOIN users u ON u.id = n.actor_id
      LEFT JOIN profiles p ON p.user_id = n.actor_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY n.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length};
    `;

    const res = await this.databaseService.query(sql, params);
    const unreadCount = await this.getUnreadCount(userId);

    const items: NotificationItem[] = res.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      type: row.type as NotificationType,
      title: row.title || 'Notification',
      body: row.body || '',
      actorId: row.actor_id || undefined,
      actorIds: row.actor_ids || [],
      actorCount: row.actor_count || 1,
      actors: row.actor_id
        ? [
            {
              id: row.actor_id,
              username: row.actor_username || 'user',
              displayName: row.actor_display_name || 'User',
              avatarUrl: row.actor_avatar_url || undefined,
            },
          ]
        : undefined,
      entityId: row.entity_id || undefined,
      deepLinkUrl: row.deep_link_url || undefined,
      dedupKey: row.dedup_key || undefined,
      channel: row.channel as NotificationChannel,
      priority: row.priority as NotificationPriority,
      isRead: row.is_read,
      isBatched: row.is_batched || false,
      metadata: row.metadata || undefined,
      createdAt: row.created_at.toISOString(),
    }));

    return { items, unreadCount };
  }

  async markAsRead(userId: string, notificationId: string) {
    await this.databaseService.query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
      [notificationId, userId],
    );
    return { success: true };
  }

  async markAllAsRead(userId: string) {
    await this.databaseService.query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`,
      [userId],
    );
    return { success: true };
  }

  async getUnreadCount(userId: string): Promise<number> {
    const res = await this.databaseService.query(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
      [userId],
    );
    return parseInt(res.rows[0]?.count || '0', 10);
  }

  // ==========================================================================
  // MAPPERS
  // ==========================================================================

  private mapPreferencesRow(row: any): NotificationPreferences {
    return {
      userId: row.user_id,
      inAppLikes: row.in_app_likes,
      inAppComments: row.in_app_comments,
      inAppMentions: row.in_app_mentions,
      inAppFollows: row.in_app_follows,
      inAppDms: row.in_app_dms,
      inAppInterests: row.in_app_interests,
      inAppMilestones: row.in_app_milestones,
      pushLikes: row.push_likes,
      pushComments: row.push_comments,
      pushMentions: row.push_mentions,
      pushFollows: row.push_follows,
      pushDms: row.push_dms,
      pushInterests: row.push_interests,
      pushMilestones: row.push_milestones,
      emailDigest: row.email_digest,
      emailSecurityAlerts: row.email_security_alerts,
      emailMilestones: row.email_milestones,
      hideNotificationPreviews: row.hide_notification_previews ?? false,
      quietHoursEnabled: row.quiet_hours_enabled,
      quietHoursStart: row.quiet_hours_start || '22:00',
      quietHoursEnd: row.quiet_hours_end || '08:00',
      clientTimezoneOffsetMinutes: row.client_timezone_offset_minutes || 0,
      maxPushesPerHour: row.max_pushes_per_hour || 10,
      batchingWindowSeconds: row.batching_window_seconds || 300,
    };
  }

  private getDefaultPreferences(userId: string): NotificationPreferences {
    return {
      userId,
      inAppLikes: true,
      inAppComments: true,
      inAppMentions: true,
      inAppFollows: true,
      inAppDms: true,
      inAppInterests: true,
      inAppMilestones: true,
      pushLikes: true,
      pushComments: true,
      pushMentions: true,
      pushFollows: true,
      pushDms: true,
      pushInterests: true,
      pushMilestones: true,
      emailDigest: true,
      emailSecurityAlerts: true,
      emailMilestones: true,
      hideNotificationPreviews: false,
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      clientTimezoneOffsetMinutes: 0,
      maxPushesPerHour: 10,
      batchingWindowSeconds: 300,
    };
  }
}
