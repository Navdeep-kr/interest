import { PushNotificationService } from './push-notification.service';
import { DevicePlatform, NotificationPriority } from '@shared/types';

describe('PushNotificationService (FCM & APNs Push Dispatcher)', () => {
  let service: PushNotificationService;
  let mockDatabaseService: any;

  beforeEach(() => {
    mockDatabaseService = {
      query: jest.fn(),
    };
    service = new PushNotificationService(mockDatabaseService as any);
  });

  it('should deliver push notifications to active FCM and APNs tokens', async () => {
    mockDatabaseService.query.mockResolvedValueOnce({
      rows: [
        { token: 'fcm_token_valid_123', platform: DevicePlatform.FCM },
        { token: 'apns_token_valid_456', platform: DevicePlatform.APNS },
      ],
    });

    const result = await service.sendToUser('user-1', {
      title: 'New Like',
      body: '@alice liked your reel',
      priority: NotificationPriority.NORMAL,
      data: { reelId: 'reel-10' },
    });

    expect(result.totalTokens).toBe(2);
    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(0);
    expect(result.invalidTokens.length).toBe(0);
  });

  it('should deactivate invalid or expired tokens automatically', async () => {
    mockDatabaseService.query
      // 1. Fetch tokens
      .mockResolvedValueOnce({
        rows: [
          { token: 'valid_token_abc', platform: DevicePlatform.FCM },
          { token: 'invalid_token_expired', platform: DevicePlatform.FCM },
        ],
      })
      // 2. Deactivate query
      .mockResolvedValueOnce({ rows: [] });

    const result = await service.sendToUser('user-1', {
      title: 'New Comment',
      body: 'Check out the new comment',
    });

    expect(result.totalTokens).toBe(2);
    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);
    expect(result.invalidTokens).toContain('invalid_token_expired');

    expect(mockDatabaseService.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE user_device_tokens'),
      [['invalid_token_expired']],
    );
  });

  it('should return 0 counts when user has no registered active devices', async () => {
    mockDatabaseService.query.mockResolvedValueOnce({ rows: [] });

    const result = await service.sendToUser('user-without-devices', {
      title: 'Alert',
      body: 'No devices',
    });

    expect(result.totalTokens).toBe(0);
    expect(result.successCount).toBe(0);
  });
});
