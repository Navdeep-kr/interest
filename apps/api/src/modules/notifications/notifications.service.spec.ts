import { NotificationsService } from './notifications.service';
import {
  NotificationType,
  NotificationPriority,
  NotificationPreferences,
  DevicePlatform,
} from '@shared/types';

describe('NotificationsService (Preferences, Quiet Hours, Throttling & Dispatch)', () => {
  let service: NotificationsService;
  let mockDatabaseService: any;
  let mockPushService: any;
  let mockEmailService: any;
  let mockConfigService: any;
  let mockBatchQueue: any;

  beforeEach(() => {
    mockDatabaseService = {
      query: jest.fn(),
    };
    mockPushService = {
      sendToUser: jest.fn().mockResolvedValue({ successCount: 1 }),
    };
    mockEmailService = {
      sendEmailToUser: jest.fn().mockResolvedValue(true),
    };
    mockConfigService = {
      get: jest.fn().mockReturnValue('redis://localhost:6379'),
    };
    mockBatchQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    service = new NotificationsService(
      mockDatabaseService as any,
      mockPushService as any,
      mockEmailService as any,
      mockConfigService as any,
      mockBatchQueue as any,
    );
  });

  describe('Quiet Hours (Strict Zero-Location)', () => {
    it('should correctly evaluate overnight quiet hours (22:00 to 08:00)', () => {
      const prefs: NotificationPreferences = {
        userId: 'u-1',
        inAppLikes: true, inAppComments: true, inAppMentions: true, inAppFollows: true, inAppDms: true, inAppInterests: true, inAppMilestones: true,
        pushLikes: true, pushComments: true, pushMentions: true, pushFollows: true, pushDms: true, pushInterests: true, pushMilestones: true,
        emailDigest: true, emailSecurityAlerts: true, emailMilestones: true,
        hideNotificationPreviews: false,
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        clientTimezoneOffsetMinutes: 0, // UTC
        maxPushesPerHour: 10,
        batchingWindowSeconds: 300,
      };

      // 23:30 UTC -> inside quiet hours
      const midnightDate = new Date('2026-10-12T23:30:00Z');
      expect(service.isQuietHours(prefs, midnightDate)).toBe(true);

      // 03:00 UTC -> inside quiet hours
      const nightDate = new Date('2026-10-12T03:00:00Z');
      expect(service.isQuietHours(prefs, nightDate)).toBe(true);

      // 14:00 UTC -> outside quiet hours
      const dayDate = new Date('2026-10-12T14:00:00Z');
      expect(service.isQuietHours(prefs, dayDate)).toBe(false);
    });

    it('should respect clientTimezoneOffsetMinutes without location services', () => {
      const prefs: NotificationPreferences = {
        userId: 'u-1',
        inAppLikes: true, inAppComments: true, inAppMentions: true, inAppFollows: true, inAppDms: true, inAppInterests: true, inAppMilestones: true,
        pushLikes: true, pushComments: true, pushMentions: true, pushFollows: true, pushDms: true, pushInterests: true, pushMilestones: true,
        emailDigest: true, emailSecurityAlerts: true, emailMilestones: true,
        hideNotificationPreviews: false,
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        clientTimezoneOffsetMinutes: 330, // +05:30 (e.g. IST)
        maxPushesPerHour: 10,
        batchingWindowSeconds: 300,
      };

      // 17:00 UTC + 5:30 = 22:30 local -> inside quiet hours
      const date = new Date('2026-10-12T17:00:00Z');
      expect(service.isQuietHours(prefs, date)).toBe(true);
    });
  });

  describe('Dispatch Logic', () => {
    it('should deliver in-app and silence push during quiet hours for NORMAL priority', async () => {
      // 1. Get preferences (quiet hours enabled, overnight active)
      mockDatabaseService.query
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: 'u-1',
              in_app_likes: true,
              push_likes: true,
              quiet_hours_enabled: true,
              quiet_hours_start: '00:00',
              quiet_hours_end: '23:59', // All day quiet hours for test
              client_timezone_offset_minutes: 0,
              max_pushes_per_hour: 10,
              batching_window_seconds: 300,
            },
          ],
        })
        // 2. Insert in-app notification
        .mockResolvedValueOnce({
          rows: [{ id: 'notif-1' }],
        });

      const res = await service.dispatchNotification({
        userId: 'u-1',
        type: NotificationType.LIKE,
        title: 'New Like',
        body: 'Someone liked your video',
        priority: NotificationPriority.NORMAL,
        forceImmediatePush: true,
      });

      expect(res.delivered).toBe(true);
      expect(res.silencedByQuietHours).toBe(true);
      expect(mockPushService.sendToUser).not.toHaveBeenCalled();
    });

    it('should bypass quiet hours for URGENT priority (1:1 DMs)', async () => {
      mockDatabaseService.query
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: 'u-1',
              in_app_dms: true,
              push_dms: true,
              quiet_hours_enabled: true,
              quiet_hours_start: '00:00',
              quiet_hours_end: '23:59', // All day quiet hours
              client_timezone_offset_minutes: 0,
              max_pushes_per_hour: 10,
              batching_window_seconds: 300,
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'notif-urgent-1' }],
        });

      const res = await service.dispatchNotification({
        userId: 'u-1',
        type: NotificationType.DM,
        title: 'New Direct Message',
        body: 'Can we collaborate on the reel?',
        priority: NotificationPriority.URGENT,
      });

      expect(res.delivered).toBe(true);
      expect(res.pushSent).toBe(true);
      expect(mockPushService.sendToUser).toHaveBeenCalledTimes(1);
    });

    it('should route batchable like bursts to BullMQ batch queue', async () => {
      mockDatabaseService.query
        // 1. Get preferences
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: 'u-1',
              in_app_likes: true,
              push_likes: true,
              quiet_hours_enabled: false,
              client_timezone_offset_minutes: 0,
              max_pushes_per_hour: 10,
              batching_window_seconds: 300,
            },
          ],
        })
        // 2. Insert into batch buffer
        .mockResolvedValueOnce({ rows: [] });

      const res = await service.dispatchNotification({
        userId: 'u-1',
        actorId: 'u-actor-1',
        type: NotificationType.LIKE,
        title: 'New Like',
        body: 'Alice liked your reel',
        entityId: 'reel-viral-100',
      });

      expect(res.delivered).toBe(true);
      expect(res.batched).toBe(true);
      expect(mockBatchQueue.add).toHaveBeenCalledWith(
        'rollup',
        expect.objectContaining({
          userId: 'u-1',
          type: NotificationType.LIKE,
          entityId: 'reel-viral-100',
        }),
        expect.any(Object),
      );
    });
  });

  describe('Device Tokens & Inbox', () => {
    it('should register device token', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ id: 'dt-1', token: 'fcm-123', platform: DevicePlatform.FCM, is_active: true }],
      });

      const res = await service.registerDeviceToken('u-1', {
        token: 'fcm-123',
        platform: DevicePlatform.FCM,
        deviceName: 'Pixel 8',
      });

      expect(res.success).toBe(true);
      expect(res.device.token).toBe('fcm-123');
    });

    it('should mark all notifications as read', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({ rowCount: 5 });

      const res = await service.markAllAsRead('u-1');
      expect(res.success).toBe(true);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE notifications SET is_read = TRUE'),
        ['u-1'],
      );
    });
  });
});
