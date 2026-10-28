import 'package:mobile/core/storage/secure_storage_service.dart';
import 'package:mobile/features/notifications/data/notifications_api_client.dart';
import 'package:mobile/features/notifications/domain/models/notification_models.dart';

class NotificationsRepository {
  final NotificationsApiClient apiClient;
  final SecureStorageService secureStorage;

  NotificationsRepository({
    required this.apiClient,
    required this.secureStorage,
  });

  Future<String?> _getToken() async {
    return secureStorage.getAccessToken();
  }

  Future<Map<String, dynamic>> getNotifications({
    String? type,
    bool unreadOnly = false,
    int limit = 20,
    int offset = 0,
  }) async {
    final token = await _getToken();
    return apiClient.getNotifications(
      type: type,
      unreadOnly: unreadOnly,
      limit: limit,
      offset: offset,
      token: token,
    );
  }

  Future<int> getUnreadCount() async {
    final token = await _getToken();
    return apiClient.getUnreadCount(token: token);
  }

  Future<void> markAsRead(String notificationId) async {
    final token = await _getToken();
    return apiClient.markAsRead(notificationId: notificationId, token: token);
  }

  Future<void> markAllAsRead() async {
    final token = await _getToken();
    return apiClient.markAllAsRead(token: token);
  }

  Future<NotificationPreferencesModel> getPreferences() async {
    final token = await _getToken();
    return apiClient.getPreferences(token: token);
  }

  Future<NotificationPreferencesModel> updatePreferences(
    NotificationPreferencesModel preferences,
  ) async {
    final token = await _getToken();
    return apiClient.updatePreferences(preferences: preferences, token: token);
  }

  Future<void> registerDeviceToken({
    required String token,
    required String platform,
    String? deviceId,
    String? deviceName,
    String? appVersion,
    String? pushProvider,
  }) async {
    final userToken = await _getToken();
    return apiClient.registerDeviceToken(
      token: token,
      platform: platform,
      deviceId: deviceId,
      deviceName: deviceName,
      appVersion: appVersion,
      pushProvider: pushProvider,
      userToken: userToken,
    );
  }

  Future<void> unregisterDeviceToken(String token) async {
    final userToken = await _getToken();
    return apiClient.unregisterDeviceToken(token: token, userToken: userToken);
  }

  Future<DeepLinkResolutionModel> resolveDeepLink(String url) async {
    final token = await _getToken();
    return apiClient.resolveDeepLink(url: url, token: token);
  }
}
