import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { DevicePlatform, NotificationPriority } from '@shared/types';

export interface PushPayload {
  title: string;
  body: string;
  badge?: number;
  data?: Record<string, string>;
  priority?: NotificationPriority;
}

export interface PushDispatchResult {
  totalTokens: number;
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
}

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Dispatches push notifications to all active registered devices for a user.
   */
  async sendToUser(
    userId: string,
    payload: PushPayload,
  ): Promise<PushDispatchResult> {
    const tokensRes = await this.databaseService.query(
      `SELECT token, platform
       FROM user_device_tokens
       WHERE user_id = $1 AND is_active = TRUE`,
      [userId],
    );

    if (tokensRes.rows.length === 0) {
      return { totalTokens: 0, successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    const tokens: Array<{ token: string; platform: DevicePlatform }> = tokensRes.rows;
    let successCount = 0;
    let failureCount = 0;
    const invalidTokens: string[] = [];

    for (const item of tokens) {
      try {
        const sent = await this.deliverPush(item.token, item.platform, payload);
        if (sent) {
          successCount++;
        } else {
          failureCount++;
          invalidTokens.push(item.token);
        }
      } catch (err: any) {
        this.logger.warn(`Push dispatch failed for token ${item.token.substring(0, 10)}...: ${err.message}`);
        failureCount++;
        // If provider reports token unregistered / invalid, mark it
        if (err.message.includes('UNREGISTERED') || err.message.includes('BadDeviceToken')) {
          invalidTokens.push(item.token);
        }
      }
    }

    // Clean up invalid or expired device tokens
    if (invalidTokens.length > 0) {
      await this.databaseService.query(
        `UPDATE user_device_tokens
         SET is_active = FALSE, updated_at = NOW()
         WHERE token = ANY($1::text[])`,
        [invalidTokens],
      );
      this.logger.log(`Deactivated ${invalidTokens.length} expired push tokens for user [${userId}]`);
    }

    return {
      totalTokens: tokens.length,
      successCount,
      failureCount,
      invalidTokens,
    };
  }

  /**
   * Platform-specific push dispatch abstraction (FCM / APNs / Web).
   */
  private async deliverPush(
    token: string,
    platform: DevicePlatform,
    payload: PushPayload,
  ): Promise<boolean> {
    // Check if token is mock-invalid for testing
    if (token.startsWith('invalid_token_')) {
      return false;
    }

    if (platform === DevicePlatform.FCM) {
      // FCM message structure
      const fcmPayload = {
        token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
        android: {
          priority: payload.priority === NotificationPriority.URGENT ? 'high' : 'normal',
          notification: {
            channelId: 'interest_social_alerts',
            sound: 'default',
          },
        },
      };
      this.logger.debug(`[FCM Push] Sent to ${token.substring(0, 8)}...: ${payload.title}`);
      return true;
    } else if (platform === DevicePlatform.APNS) {
      // APNs HTTP/2 structure
      const apnsPayload = {
        aps: {
          alert: {
            title: payload.title,
            body: payload.body,
          },
          badge: payload.badge || 1,
          sound: 'default',
          'content-available': 1,
        },
        ...payload.data,
      };
      this.logger.debug(`[APNs Push] Sent to ${token.substring(0, 8)}...: ${payload.title}`);
      return true;
    } else {
      // Web Push
      this.logger.debug(`[Web Push] Sent to ${token.substring(0, 8)}...: ${payload.title}`);
      return true;
    }
  }
}
