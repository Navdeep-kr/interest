import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import { PushNotificationService } from '../../src/modules/notifications/push-notification.service';
import { EmailNotificationService } from '../../src/modules/notifications/email-notification.service';
import { DeepLinkService } from '../../src/modules/notifications/deep-link.service';
import { DatabaseService } from '../../src/database/database.service';
import {
  NotificationType,
  NotificationChannel,
  NotificationPriority,
  DevicePlatform,
} from '@shared/types';

describe('Prompt 13 — Notifications, Deep Links, Account Switching & Privacy Gate', () => {
  let notificationsService: NotificationsService;
  let deepLinkService: DeepLinkService;
  let pushService: PushNotificationService;
  let mockDatabaseService: any;
  let mockPushService: any;
  let mockEmailService: any;

  beforeEach(async () => {
    mockDatabaseService = {
      query: jest.fn(),
    };

    mockPushService = {
      sendToUser: jest.fn().mockResolvedValue({
        totalTokens: 1,
        successCount: 1,
        failureCount: 0,
        invalidTokens: [],
      }),
    };

    mockEmailService = {
      sendEmailToUser: jest.fn().mockResolvedValue(true),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ REDIS_URL: 'redis://localhost:6379' })],
        }),
      ],
      providers: [
        NotificationsService,
        DeepLinkService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: PushNotificationService, useValue: mockPushService },
        { provide: EmailNotificationService, useValue: mockEmailService },
      ],
    }).compile();

    notificationsService = moduleRef.get<NotificationsService>(NotificationsService);
    deepLinkService = moduleRef.get<DeepLinkService>(DeepLinkService);
    pushService = moduleRef.get<PushNotificationService>(PushNotificationService);
  });

  describe('1. Device Token Registration & Account Switching Cleanup', () => {
    it('deactivates token for previous user when a new user registers on the same device', async () => {
      mockDatabaseService.query.mockResolvedValue({
        rows: [{ id: 'dt-1', token: 'token-pixel-8', platform: 'FCM', is_active: true }],
      });

      const res = await notificationsService.registerDeviceToken('user-B', {
        token: 'token-pixel-8',
        platform: DevicePlatform.FCM,
        deviceId: 'device-unique-123',
        deviceName: 'Pixel 8 Pro',
      });

      // Verify that token was deactivated for any user OTHER than user-B
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_device_tokens\n       SET is_active = FALSE'),
        ['token-pixel-8', 'user-B'],
      );
      expect(res.success).toBe(true);
      expect(res.device.token).toBe('token-pixel-8');
    });

    it('unregisters device token explicitly on logout', async () => {
      mockDatabaseService.query.mockResolvedValue({ rowCount: 1 });

      const res = await notificationsService.unregisterDeviceToken('user-A', 'token-pixel-8');
      expect(res.success).toBe(true);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_device_tokens\n       SET is_active = FALSE'),
        ['user-A', 'token-pixel-8'],
      );
    });
  });

  describe('2. In-App Notification Center, Unread State & Pagination', () => {
    it('retrieves notifications with unread count and canonical deep link URLs', async () => {
      mockDatabaseService.query
        // 1. Notifications query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'notif-1',
              user_id: 'user-1',
              type: 'LIKE',
              title: 'New Like',
              body: 'Alice liked your reel',
              actor_id: 'actor-1',
              actor_ids: ['actor-1'],
              actor_count: 1,
              actor_username: 'alice',
              actor_display_name: 'Alice',
              channel: 'IN_APP',
              priority: 'NORMAL',
              is_read: false,
              is_batched: false,
              deep_link_url: 'interest://reels/reel-42',
              created_at: new Date('2026-10-16T12:00:00Z'),
            },
          ],
        })
        // 2. Unread count query
        .mockResolvedValueOnce({
          rows: [{ count: '3' }],
        });

      const result = await notificationsService.getNotifications('user-1', {
        limit: 10,
        offset: 0,
      });

      expect(result.items.length).toBe(1);
      expect(result.unreadCount).toBe(3);
      expect(result.items[0].deepLinkUrl).toBe('interest://reels/reel-42');
      expect(result.items[0].actors?.[0].username).toBe('alice');
    });

    it('marks individual notification as read', async () => {
      mockDatabaseService.query.mockResolvedValue({ rowCount: 1 });
      const res = await notificationsService.markAsRead('user-1', 'notif-1');
      expect(res.success).toBe(true);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2'),
        ['notif-1', 'user-1'],
      );
    });

    it('marks all notifications as read', async () => {
      mockDatabaseService.query.mockResolvedValue({ rowCount: 3 });
      const res = await notificationsService.markAllAsRead('user-1');
      expect(res.success).toBe(true);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE'),
        ['user-1'],
      );
    });
  });

  describe('3. Deduplication Key & Re-delivery Prevention', () => {
    it('prevents duplicate notification rows and push alerts when dedupKey matches existing record', async () => {
      // Return existing notification for this dedupKey
      mockDatabaseService.query
        // 1. getPreferences
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: 'user-1',
              in_app_likes: true,
              push_likes: true,
              quiet_hours_enabled: false,
              max_pushes_per_hour: 10,
              batching_window_seconds: 300,
            },
          ],
        })
        // 2. Deduplication check query -> found existing
        .mockResolvedValueOnce({
          rows: [{ id: 'existing-notif-99' }],
        });

      const res = await notificationsService.dispatchNotification({
        userId: 'user-1',
        type: NotificationType.LIKE,
        title: 'New Like',
        body: 'Alice liked your reel',
        dedupKey: 'dedup_like_user1_reel10',
      });

      expect(res.delivered).toBe(true);
      expect((res as any).deduplicated).toBe(true);
      expect(res.notificationId).toBe('existing-notif-99');
      // Push should NOT be dispatched again
      expect(mockPushService.sendToUser).not.toHaveBeenCalled();
    });
  });

  describe('4. User Category Preferences & Quiet Hours Evaluation', () => {
    it('suppresses push notification when user has disabled that specific category', async () => {
      mockDatabaseService.query
        // 1. getPreferences -> push_likes is FALSE
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: 'user-1',
              in_app_likes: true,
              push_likes: false,
              quiet_hours_enabled: false,
              max_pushes_per_hour: 10,
              batching_window_seconds: 300,
            },
          ],
        })
        // 2. insert in-app notification
        .mockResolvedValueOnce({
          rows: [{ id: 'notif-in-app-only' }],
        });

      const res = await notificationsService.dispatchNotification({
        userId: 'user-1',
        type: NotificationType.LIKE,
        title: 'New Like',
        body: 'Someone liked your reel',
      });

      expect(res.delivered).toBe(true);
      expect(res.pushSent).toBe(false);
      expect(mockPushService.sendToUser).not.toHaveBeenCalled();
    });

    it('silences normal push notification during quiet hours but allows URGENT security alerts', async () => {
      // Case A: Normal priority like during quiet hours -> push silenced
      const quietPrefs = {
        userId: 'user-1',
        inAppLikes: true,
        pushLikes: true,
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        clientTimezoneOffsetMinutes: 0,
        maxPushesPerHour: 10,
        batchingWindowSeconds: 300,
        hideNotificationPreviews: false,
      };

      jest.spyOn(notificationsService, 'getPreferences').mockResolvedValue(quietPrefs as any);
      jest.spyOn(notificationsService, 'isQuietHours').mockReturnValue(true);

      mockDatabaseService.query.mockResolvedValue({
        rows: [{ id: 'notif-during-quiet' }],
      });

      const normalRes = await notificationsService.dispatchNotification({
        userId: 'user-1',
        type: NotificationType.LIKE,
        title: 'New Like',
        body: 'Quiet hours test',
        priority: NotificationPriority.NORMAL,
      });

      expect(normalRes.silencedByQuietHours).toBe(true);
      expect(normalRes.pushSent).toBe(false);
      expect(mockPushService.sendToUser).not.toHaveBeenCalled();

      // Case B: URGENT priority security alert during quiet hours -> bypasses quiet hours!
      const urgentRes = await notificationsService.dispatchNotification({
        userId: 'user-1',
        type: NotificationType.SECURITY_ALERT,
        title: 'New sign-in detected',
        body: 'Your account was accessed from a new device',
        priority: NotificationPriority.URGENT,
      });

      expect(urgentRes.silencedByQuietHours).toBe(false);
      expect(urgentRes.pushSent).toBe(true);
      expect(mockPushService.sendToUser).toHaveBeenCalled();
    });
  });

  describe('5. Privacy-Preserving Previews & Zero Sensitive Logging', () => {
    it('masks push title and body when user has hideNotificationPreviews enabled', async () => {
      const privacyPrefs = {
        userId: 'user-1',
        inAppDms: true,
        pushDms: true,
        quietHoursEnabled: false,
        maxPushesPerHour: 10,
        batchingWindowSeconds: 300,
        hideNotificationPreviews: true,
      };

      jest.spyOn(notificationsService, 'getPreferences').mockResolvedValue(privacyPrefs as any);
      jest.spyOn(notificationsService, 'isQuietHours').mockReturnValue(false);

      mockDatabaseService.query.mockResolvedValue({
        rows: [{ id: 'notif-priv-1' }],
      });

      const res = await notificationsService.dispatchNotification({
        userId: 'user-1',
        type: NotificationType.DM,
        title: 'Alice sent a message',
        body: 'Secret rendezvous at 9 PM tonight',
        entityId: 'conv-private-123',
      });

      expect(res.delivered).toBe(true);
      expect(res.previewHidden).toBe(true);
      expect(mockPushService.sendToUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          title: 'Interest',
          body: 'New direct message received',
          data: expect.objectContaining({
            deepLinkUrl: 'interest://chat/conversations/conv-private-123',
          }),
        }),
      );
    });
  });

  describe('6. Safe Deep Links & Authorization Checks', () => {
    it('rejects unsafe schemes and path traversal attempts', async () => {
      const dangerous1 = await deepLinkService.resolveDeepLink('viewer-1', 'javascript:alert(1)');
      expect(dangerous1.isValid).toBe(false);
      expect(dangerous1.targetScreen).toBe('not_found');
      expect(dangerous1.fallbackReason).toBe('INVALID_SCHEME');

      const dangerous2 = await deepLinkService.resolveDeepLink('viewer-1', 'interest://reels/../../etc/passwd');
      expect(dangerous2.isValid).toBe(false);
      expect(dangerous2.targetScreen).toBe('not_found');
      expect(dangerous2.fallbackReason).toBe('PATH_TRAVERSAL_DETECTED');
    });

    it('resolves active public reel link to reel screen', async () => {
      mockDatabaseService.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'reel-101',
              user_id: 'creator-1',
              caption: 'Learning Rust programming',
              deleted_at: null,
              username: 'rustacean',
              is_private: false,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // No block found

      const res = await deepLinkService.resolveDeepLink('viewer-1', 'interest://reels/reel-101');
      expect(res.isValid).toBe(true);
      expect(res.accessGranted).toBe(true);
      expect(res.targetScreen).toBe('reel');
      expect(res.params.reelId).toBe('reel-101');
    });

    it('handles deleted reel gracefully with not_found state', async () => {
      // Reel was deleted (deleted_at is set)
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'reel-deleted-1',
            user_id: 'creator-1',
            deleted_at: new Date('2026-10-15T00:00:00Z'),
            username: 'rustacean',
          },
        ],
      });

      const res = await deepLinkService.resolveDeepLink('viewer-1', 'interest://reels/reel-deleted-1');
      expect(res.isValid).toBe(true);
      expect(res.accessGranted).toBe(false);
      expect(res.targetScreen).toBe('not_found');
      expect(res.fallbackReason).toBe('CONTENT_DELETED_OR_NOT_FOUND');
    });

    it('blocks access to reel from a blocked creator', async () => {
      mockDatabaseService.query
        // 1. Reel found
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'reel-blocked-1',
              user_id: 'blocked-creator-1',
              deleted_at: null,
              username: 'blocked_user',
              is_private: false,
            },
          ],
        })
        // 2. Block check -> found block
        .mockResolvedValueOnce({
          rows: [{ 1: 1 }],
        });

      const res = await deepLinkService.resolveDeepLink('viewer-1', 'interest://reels/reel-blocked-1');
      expect(res.accessGranted).toBe(false);
      expect(res.targetScreen).toBe('access_denied');
      expect(res.fallbackReason).toBe('CREATOR_BLOCKED');
    });

    it('blocks access to chat conversation if viewer is not an accepted participant', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [], // Not a participant
      });

      const res = await deepLinkService.resolveDeepLink('viewer-1', 'interest://chat/conversations/conv-secret-999');
      expect(res.accessGranted).toBe(false);
      expect(res.targetScreen).toBe('access_denied');
      expect(res.fallbackReason).toBe('NOT_A_CONVERSATION_PARTICIPANT');
    });

    it('allows authorized chat participant to open conversation', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ id: 'conv-auth-1', title: 'Rust Team Chat', status: 'ACCEPTED' }],
      });

      const res = await deepLinkService.resolveDeepLink('viewer-1', 'interest://chat/conversations/conv-auth-1');
      expect(res.accessGranted).toBe(true);
      expect(res.targetScreen).toBe('chat_thread');
      expect(res.params.conversationId).toBe('conv-auth-1');
    });
  });
});
