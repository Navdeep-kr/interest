import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';
import 'package:mobile/features/notifications/data/notifications_api_client.dart';
import 'package:mobile/features/notifications/data/notifications_repository.dart';
import 'package:mobile/features/notifications/domain/models/notification_models.dart';
import 'package:mobile/features/notifications/presentation/notifications_notifier.dart';
import 'package:mobile/features/notifications/presentation/notifications_state.dart';

class MockNotificationsApiClient extends NotificationsApiClient {
  int markAsReadCalls = 0;
  int markAllAsReadCalls = 0;
  String? lastRegisteredToken;
  String? lastRegisteredPlatform;
  String? lastUnregisteredToken;
  bool shouldFail = false;

  final List<NotificationModel> mockNotifications = [
    NotificationModel(
      id: 'notif-1',
      userId: 'user-me-1',
      type: NotificationType.like,
      title: 'Alice liked your reel',
      body: 'Alice liked your video "Golden Hour in Tokyo"',
      actorId: 'user-alice',
      actorIds: const ['user-alice'],
      actorCount: 1,
      actors: const [
        NotificationActorModel(id: 'user-alice', username: 'alice', displayName: 'Alice Creator')
      ],
      entityId: 'reel-101',
      channel: NotificationChannel.inApp,
      priority: NotificationPriority.normal,
      isRead: false,
      deepLinkUrl: 'interest://reels/reel-101',
      dedupKey: 'like_user-alice_reel-101',
      createdAt: DateTime.now().subtract(const Duration(minutes: 5)).toIso8601String(),
    ),
    NotificationModel(
      id: 'notif-2',
      userId: 'user-me-1',
      type: NotificationType.mention,
      title: 'Bob mentioned you in a comment',
      body: '@myusername check this out!',
      actorId: 'user-bob',
      actorIds: const ['user-bob'],
      actorCount: 1,
      actors: const [
        NotificationActorModel(id: 'user-bob', username: 'bob', displayName: 'Bob Engineer')
      ],
      entityId: 'reel-102',
      channel: NotificationChannel.inApp,
      priority: NotificationPriority.high,
      isRead: false,
      deepLinkUrl: 'interest://reels/reel-102',
      dedupKey: 'mention_user-bob_reel-102',
      createdAt: DateTime.now().subtract(const Duration(minutes: 15)).toIso8601String(),
    ),
    NotificationModel(
      id: 'notif-3',
      userId: 'user-me-1',
      type: NotificationType.follow,
      title: 'Charlie started following you',
      body: 'Charlie is now following your updates.',
      actorId: 'user-charlie',
      actorIds: const ['user-charlie'],
      actorCount: 1,
      actors: const [
        NotificationActorModel(id: 'user-charlie', username: 'charlie', displayName: 'Charlie Photog')
      ],
      channel: NotificationChannel.inApp,
      priority: NotificationPriority.normal,
      isRead: true,
      deepLinkUrl: 'interest://profile/charlie',
      dedupKey: 'follow_user-charlie_user-me-1',
      createdAt: DateTime.now().subtract(const Duration(hours: 1)).toIso8601String(),
    ),
  ];

  NotificationPreferencesModel mockPreferences = const NotificationPreferencesModel(
    userId: 'user-me-1',
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
    quietHoursEnabled: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    clientTimezoneOffsetMinutes: 330,
    maxPushesPerHour: 20,
  );

  @override
  Future<Map<String, dynamic>> getNotifications({
    String? type,
    bool unreadOnly = false,
    int limit = 20,
    int offset = 0,
    String? token,
  }) async {
    if (shouldFail) {
      throw Exception('Simulated network error loading notifications');
    }

    var filtered = List<NotificationModel>.from(mockNotifications);
    if (type != null && type != 'ALL') {
      filtered = filtered.where((n) {
        if (type == 'MENTION') return n.type == NotificationType.mention;
        if (type == 'COMMENT') return n.type == NotificationType.comment;
        if (type == 'FOLLOW') return n.type == NotificationType.follow;
        if (type == 'DM') return n.type == NotificationType.dm;
        if (type == 'CREATOR_MILESTONE') return n.type == NotificationType.creatorMilestone;
        return true;
      }).toList();
    }
    if (unreadOnly) {
      filtered = filtered.where((n) => !n.isRead).toList();
    }

    final unread = mockNotifications.where((n) => !n.isRead).length;

    return {
      'items': filtered,
      'total': filtered.length,
      'unreadCount': unread,
      'limit': limit,
      'offset': offset,
    };
  }

  @override
  Future<int> getUnreadCount({String? token}) async {
    return mockNotifications.where((n) => !n.isRead).length;
  }

  @override
  Future<void> markAsRead({required String notificationId, String? token}) async {
    markAsReadCalls++;
  }

  @override
  Future<void> markAllAsRead({String? token}) async {
    markAllAsReadCalls++;
  }

  @override
  Future<NotificationPreferencesModel> getPreferences({String? token}) async {
    if (shouldFail) {
      throw Exception('Simulated network error loading preferences');
    }
    return mockPreferences;
  }

  @override
  Future<NotificationPreferencesModel> updatePreferences({
    required NotificationPreferencesModel preferences,
    String? token,
  }) async {
    if (shouldFail) {
      throw Exception('Simulated network error updating preferences');
    }
    mockPreferences = preferences;
    return mockPreferences;
  }

  @override
  Future<void> registerDeviceToken({
    required String token,
    required String platform,
    String? deviceId,
    String? deviceName,
    String? appVersion,
    String? pushProvider,
    String? userToken,
  }) async {
    lastRegisteredToken = token;
    lastRegisteredPlatform = platform;
  }

  @override
  Future<void> unregisterDeviceToken({
    required String token,
    String? userToken,
  }) async {
    lastUnregisteredToken = token;
  }

  @override
  Future<DeepLinkResolutionModel> resolveDeepLink({
    required String url,
    String? token,
  }) async {
    if (url.contains('deleted-reel') || url.contains('missing')) {
      return DeepLinkResolutionModel(
        url: url,
        targetScreen: DeepLinkTargetScreen.notFound,
        isValid: false,
        accessGranted: false,
        fallbackReason: 'CONTENT_DELETED_OR_NOT_FOUND',
      );
    }
    if (url.contains('blocked-reel') || url.contains('private-account')) {
      return DeepLinkResolutionModel(
        url: url,
        targetScreen: DeepLinkTargetScreen.accessDenied,
        isValid: true,
        accessGranted: false,
        fallbackReason: url.contains('blocked') ? 'USER_BLOCKED' : 'PRIVATE_ACCOUNT_NOT_FOLLOWING',
      );
    }
    if (url.startsWith('interest://reels/') || url.contains('/reel/')) {
      return DeepLinkResolutionModel(
        url: url,
        targetScreen: DeepLinkTargetScreen.reel,
        params: {'id': 'reel-101'},
        isValid: true,
        accessGranted: true,
        title: 'Reel: Golden Hour in Tokyo',
      );
    }
    if (url.startsWith('interest://profile/') || url.contains('/profile/')) {
      return DeepLinkResolutionModel(
        url: url,
        targetScreen: DeepLinkTargetScreen.profile,
        params: {'username': 'charlie'},
        isValid: true,
        accessGranted: true,
        title: 'Charlie Photog (@charlie)',
      );
    }
    if (url.startsWith('interest://chat/conversations/')) {
      return DeepLinkResolutionModel(
        url: url,
        targetScreen: DeepLinkTargetScreen.chatThread,
        params: {'conversationId': 'conv-1'},
        isValid: true,
        accessGranted: true,
        title: 'Chat with Alice',
      );
    }

    return DeepLinkResolutionModel(
      url: url,
      targetScreen: DeepLinkTargetScreen.notFound,
      isValid: false,
      accessGranted: false,
      fallbackReason: 'INVALID_DEEP_LINK_SCHEME',
    );
  }
}

void main() {
  late MockNotificationsApiClient mockApiClient;
  late PlatformSecureStorageService secureStorage;
  late NotificationsRepository repository;
  late NotificationsNotifier notifier;

  setUp(() async {
    mockApiClient = MockNotificationsApiClient();
    secureStorage = PlatformSecureStorageService();
    await secureStorage.saveAccessToken('test_jwt_access_token');
    await secureStorage.saveUserId('user-me-1');
    await secureStorage.saveUsername('myusername');

    repository = NotificationsRepository(
      apiClient: mockApiClient,
      secureStorage: secureStorage,
    );
    notifier = NotificationsNotifier(repository: repository);
  });

  group('Prompt 13 — NotificationsRepository & Data Contract', () {
    test('fetches notifications with auth bearer token and correct counts', () async {
      final res = await repository.getNotifications(limit: 10, offset: 0);

      expect(res['items'], isA<List<NotificationModel>>());
      final items = res['items'] as List<NotificationModel>;
      expect(items.length, 3);
      expect(res['unreadCount'], 2);
      expect(items[0].dedupKey, 'like_user-alice_reel-101');
      expect(items[0].deepLinkUrl, 'interest://reels/reel-101');
    });

    test('fetches preferences and updates preview privacy and quiet hours', () async {
      final prefs = await repository.getPreferences();
      expect(prefs.userId, 'user-me-1');
      expect(prefs.quietHoursEnabled, true);
      expect(prefs.hideNotificationPreviews, false);

      final updatedPrefs = prefs.copyWith(
        hideNotificationPreviews: true,
        pushComments: false,
      );
      final saved = await repository.updatePreferences(updatedPrefs);
      expect(saved.hideNotificationPreviews, true);
      expect(saved.pushComments, false);
    });

    test('registers and unregisters device tokens for FCM/APNs push', () async {
      await repository.registerDeviceToken(
        token: 'fcm_token_device_abc',
        platform: 'android',
        deviceId: 'device-xyz-123',
        deviceName: 'Pixel 8',
        appVersion: '1.2.0',
        pushProvider: 'fcm',
      );

      expect(mockApiClient.lastRegisteredToken, 'fcm_token_device_abc');
      expect(mockApiClient.lastRegisteredPlatform, 'android');

      await repository.unregisterDeviceToken('fcm_token_device_abc');
      expect(mockApiClient.lastUnregisteredToken, 'fcm_token_device_abc');
    });

    test('resolves canonical deep links safely', () async {
      final reelResolution = await repository.resolveDeepLink('interest://reels/reel-101');
      expect(reelResolution.isValid, true);
      expect(reelResolution.accessGranted, true);
      expect(reelResolution.targetScreen, DeepLinkTargetScreen.reel);
      expect(reelResolution.params['id'], 'reel-101');

      final deletedResolution = await repository.resolveDeepLink('interest://reels/deleted-reel-404');
      expect(deletedResolution.isValid, false);
      expect(deletedResolution.targetScreen, DeepLinkTargetScreen.notFound);
      expect(deletedResolution.fallbackReason, 'CONTENT_DELETED_OR_NOT_FOUND');

      final blockedResolution = await repository.resolveDeepLink('interest://reels/blocked-reel-999');
      expect(blockedResolution.accessGranted, false);
      expect(blockedResolution.targetScreen, DeepLinkTargetScreen.accessDenied);
      expect(blockedResolution.fallbackReason, 'USER_BLOCKED');
    });
  });

  group('Prompt 13 — NotificationsNotifier State Flow & In-App Center', () {
    test('loadNotifications transitions to NotificationsLoadedState with unread count', () async {
      await notifier.loadNotifications();

      expect(notifier.state, isA<NotificationsLoadedState>());
      final loaded = notifier.state as NotificationsLoadedState;
      expect(loaded.items.length, 3);
      expect(loaded.unreadCount, 2);
      expect(loaded.activeFilter, 'ALL');
    });

    test('filterByType filters notification list by category', () async {
      await notifier.loadNotifications();
      notifier.filterByType('MENTION');
      await Future<void>.delayed(const Duration(milliseconds: 10));

      expect(notifier.state, isA<NotificationsLoadedState>());
      final loaded = notifier.state as NotificationsLoadedState;
      expect(loaded.items.length, 1);
      expect(loaded.items.first.type, NotificationType.mention);
      expect(loaded.activeFilter, 'MENTION');
    });

    test('markAsRead performs optimistic UI update and calls backend', () async {
      await notifier.loadNotifications();
      var loaded = notifier.state as NotificationsLoadedState;
      expect(loaded.unreadCount, 2);
      expect(loaded.items.first.isRead, false);

      await notifier.markAsRead('notif-1');

      loaded = notifier.state as NotificationsLoadedState;
      expect(loaded.unreadCount, 1);
      expect(loaded.items.first.isRead, true);
      expect(mockApiClient.markAsReadCalls, 1);
    });

    test('markAllAsRead optimistically marks all read and zeroes unread count', () async {
      await notifier.loadNotifications();
      var loaded = notifier.state as NotificationsLoadedState;
      expect(loaded.unreadCount, 2);

      await notifier.markAllAsRead();

      loaded = notifier.state as NotificationsLoadedState;
      expect(loaded.unreadCount, 0);
      expect(loaded.items.every((n) => n.isRead), true);
      expect(mockApiClient.markAllAsReadCalls, 1);
    });

    test('handles failure gracefully and transitions to NotificationsErrorState', () async {
      mockApiClient.shouldFail = true;
      await notifier.loadNotifications();

      expect(notifier.state, isA<NotificationsErrorState>());
      final errorState = notifier.state as NotificationsErrorState;
      expect(errorState.message, contains('Simulated network error'));
    });

    test('loadPreferences and updatePreferences manage user privacy settings', () async {
      await notifier.loadPreferences();

      expect(notifier.state, isA<NotificationPreferencesLoadedState>());
      final state = notifier.state as NotificationPreferencesLoadedState;
      expect(state.preferences.hideNotificationPreviews, false);

      final updated = state.preferences.copyWith(
        hideNotificationPreviews: true,
        quietHoursStart: '23:00',
        quietHoursEnd: '07:00',
      );
      final ok = await notifier.updatePreferences(updated);
      expect(ok, true);

      final newState = notifier.state as NotificationPreferencesLoadedState;
      expect(newState.preferences.hideNotificationPreviews, true);
      expect(newState.preferences.quietHoursStart, '23:00');
      expect(newState.statusMessage, 'Preferences saved');
    });

    test('registers and unregisters push tokens via notifier methods', () async {
      final registered = await notifier.registerDeviceToken(
        token: 'new_token_123',
        platform: 'ios',
        pushProvider: 'apns',
      );
      expect(registered, true);
      expect(mockApiClient.lastRegisteredToken, 'new_token_123');

      final unregistered = await notifier.unregisterDeviceToken('new_token_123');
      expect(unregistered, true);
      expect(mockApiClient.lastUnregisteredToken, 'new_token_123');
    });
  });

  group('Prompt 13 — Deep Link Safety & Privacy Previews', () {
    test('deep link resolution correctly detects private content without leaking details', () async {
      final res = await repository.resolveDeepLink('https://interest.app/profile/private-account');
      expect(res.accessGranted, false);
      expect(res.targetScreen, DeepLinkTargetScreen.accessDenied);
      expect(res.fallbackReason, 'PRIVATE_ACCOUNT_NOT_FOLLOWING');
    });

    test('STRICT ZERO-LOCATION: preferences contain timezone offset but zero GPS/IP coordinates', () {
      final prefs = mockApiClient.mockPreferences;
      expect(prefs.clientTimezoneOffsetMinutes, 330);
      final json = prefs.toJson();
      expect(json.containsKey('latitude'), false);
      expect(json.containsKey('longitude'), false);
      expect(json.containsKey('ipAddress'), false);
      expect(json.containsKey('location'), false);
    });

    test('NotificationModel serializes dedupKey and deepLinkUrl correctly', () {
      final notif = mockApiClient.mockNotifications.first;
      expect(notif.dedupKey, isNotNull);
      expect(notif.deepLinkUrl, isNotNull);
      expect(notif.isBatched, false);
      expect(notif.actors.length, 1);
      expect(notif.actors.first.username, 'alice');
    });
  });
}
