import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { DeepLinkService } from './deep-link.service';
import { NotificationType, NotificationChannel, NotificationPriority, DevicePlatform } from '@shared/types';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let mockNotificationsService: Partial<Record<keyof NotificationsService, jest.Mock>>;
  let mockDeepLinkService: Partial<Record<keyof DeepLinkService, jest.Mock>>;

  const mockUserReq = {
    user: { id: 'user-123' },
  };

  beforeEach(() => {
    mockNotificationsService = {
      getNotifications: jest.fn(),
      getUnreadCount: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      getPreferences: jest.fn(),
      updatePreferences: jest.fn(),
      registerDeviceToken: jest.fn(),
      unregisterDeviceToken: jest.fn(),
      getUserDeviceTokens: jest.fn(),
      dispatchNotification: jest.fn(),
    };

    mockDeepLinkService = {
      resolveDeepLink: jest.fn(),
    };

    controller = new NotificationsController(
      mockNotificationsService as any,
      mockDeepLinkService as any,
    );
  });

  describe('Inbox & Actions', () => {
    it('getNotifications should call notificationsService.getNotifications with user id and query', async () => {
      const query = { limit: 20, cursor: 'notif-1' };
      const expectedResult = { items: [], nextCursor: null, hasMore: false };
      mockNotificationsService.getNotifications!.mockResolvedValue(expectedResult);

      const res = await controller.getNotifications(mockUserReq, query);
      expect(mockNotificationsService.getNotifications).toHaveBeenCalledWith('user-123', query);
      expect(res).toEqual(expectedResult);
    });

    it('getUnreadCount should return formatted unreadCount', async () => {
      mockNotificationsService.getUnreadCount!.mockResolvedValue(5);

      const res = await controller.getUnreadCount(mockUserReq);
      expect(mockNotificationsService.getUnreadCount).toHaveBeenCalledWith('user-123');
      expect(res).toEqual({ unreadCount: 5 });
    });

    it('markAsRead should call notificationsService.markAsRead', async () => {
      const updatedNotif = { id: 'notif-1', isRead: true };
      mockNotificationsService.markAsRead!.mockResolvedValue(updatedNotif);

      const res = await controller.markAsRead(mockUserReq, 'notif-1');
      expect(mockNotificationsService.markAsRead).toHaveBeenCalledWith('user-123', 'notif-1');
      expect(res).toEqual(updatedNotif);
    });

    it('markAllAsRead should call notificationsService.markAllAsRead', async () => {
      mockNotificationsService.markAllAsRead!.mockResolvedValue({ updatedCount: 4 });

      const res = await controller.markAllAsRead(mockUserReq);
      expect(mockNotificationsService.markAllAsRead).toHaveBeenCalledWith('user-123');
      expect(res).toEqual({ updatedCount: 4 });
    });
  });

  describe('Preferences', () => {
    it('getPreferences should call notificationsService.getPreferences', async () => {
      const mockPrefs = { userId: 'user-123', pushLikes: true };
      mockNotificationsService.getPreferences!.mockResolvedValue(mockPrefs);

      const res = await controller.getPreferences(mockUserReq);
      expect(mockNotificationsService.getPreferences).toHaveBeenCalledWith('user-123');
      expect(res).toEqual(mockPrefs);
    });

    it('updatePreferences should call notificationsService.updatePreferences', async () => {
      const dto = { quietHoursEnabled: true, quietHoursStart: '23:00', quietHoursEnd: '07:00' };
      const updatedPrefs = { userId: 'user-123', ...dto };
      mockNotificationsService.updatePreferences!.mockResolvedValue(updatedPrefs);

      const res = await controller.updatePreferences(mockUserReq, dto);
      expect(mockNotificationsService.updatePreferences).toHaveBeenCalledWith('user-123', dto);
      expect(res).toEqual(updatedPrefs);
    });
  });

  describe('Device Tokens', () => {
    it('registerDevice should call notificationsService.registerDeviceToken', async () => {
      const dto = {
        token: 'fcm-token-123',
        platform: DevicePlatform.FCM,
        deviceName: 'Pixel 8',
      };
      const tokenRecord = { id: 'token-rec-1', ...dto };
      mockNotificationsService.registerDeviceToken!.mockResolvedValue(tokenRecord);

      const res = await controller.registerDevice(mockUserReq, dto);
      expect(mockNotificationsService.registerDeviceToken).toHaveBeenCalledWith('user-123', dto);
      expect(res).toEqual(tokenRecord);
    });

    it('unregisterDevice should call notificationsService.unregisterDeviceToken', async () => {
      mockNotificationsService.unregisterDeviceToken!.mockResolvedValue(true);

      const res = await controller.unregisterDevice(mockUserReq, { token: 'fcm-token-123' });
      expect(mockNotificationsService.unregisterDeviceToken).toHaveBeenCalledWith('user-123', 'fcm-token-123');
      expect(res).toBe(true);
    });

    it('getDevices should call notificationsService.getUserDeviceTokens', async () => {
      const devices = [{ id: 'dev-1', token: 'token-1' }];
      mockNotificationsService.getUserDeviceTokens!.mockResolvedValue(devices);

      const res = await controller.getDevices(mockUserReq);
      expect(mockNotificationsService.getUserDeviceTokens).toHaveBeenCalledWith('user-123');
      expect(res).toEqual(devices);
    });
  });

  describe('Test Dispatch', () => {
    it('testDispatch should call notificationsService.dispatchNotification with userId', async () => {
      const dto = {
        type: NotificationType.LIKE,
        priority: NotificationPriority.NORMAL,
        channel: NotificationChannel.PUSH,
        title: 'New Like',
        body: 'Someone liked your reel',
      };
      const dispatchResult = { success: true, deliveredInApp: true };
      mockNotificationsService.dispatchNotification!.mockResolvedValue(dispatchResult);

      const res = await controller.testDispatch(mockUserReq, dto as any);
      expect(mockNotificationsService.dispatchNotification).toHaveBeenCalledWith({
        ...dto,
        userId: 'user-123',
      });
      expect(res).toEqual(dispatchResult);
    });
  });

  describe('Deep Link Resolution', () => {
    it('resolveDeepLink should invoke deepLinkService.resolveDeepLink with user id and url', async () => {
      const url = 'interest://reels/reel-456';
      const expectedResolution = {
        url,
        targetScreen: 'reel',
        params: { reelId: 'reel-456' },
        isValid: true,
        accessGranted: true,
      };
      mockDeepLinkService.resolveDeepLink!.mockResolvedValue(expectedResolution);

      const res = await controller.resolveDeepLink(mockUserReq, { url });
      expect(mockDeepLinkService.resolveDeepLink).toHaveBeenCalledWith('user-123', url);
      expect(res).toEqual(expectedResolution);
    });
  });
});
