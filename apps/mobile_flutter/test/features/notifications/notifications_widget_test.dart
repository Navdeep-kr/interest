import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';
import 'package:mobile/features/notifications/data/notifications_api_client.dart';
import 'package:mobile/features/notifications/data/notifications_repository.dart';
import 'package:mobile/features/notifications/domain/models/notification_models.dart';
import 'package:mobile/features/notifications/presentation/notifications_notifier.dart';
import 'package:mobile/features/notifications/presentation/screens/notification_settings_screen.dart';
import 'package:mobile/features/notifications/presentation/screens/notifications_screen.dart';

class WidgetTestMockApiClient extends NotificationsApiClient {
  int markAllCalls = 0;
  int markReadCalls = 0;
  bool returnEmpty = false;

  final List<NotificationModel> defaultItems = const [
    NotificationModel(
      id: 'notif-widget-1',
      userId: 'user-1',
      type: NotificationType.like,
      title: 'Alice liked your video',
      body: 'Your reel "Tokyo Sunset" received a new like',
      actorId: 'alice-id',
      actorIds: ['alice-id'],
      actorCount: 1,
      actors: [
        NotificationActorModel(id: 'alice-id', username: 'alice', displayName: 'Alice Creator')
      ],
      entityId: 'reel-101',
      channel: NotificationChannel.inApp,
      priority: NotificationPriority.normal,
      isRead: false,
      deepLinkUrl: 'interest://reels/reel-101',
      createdAt: '2026-10-16T10:00:00Z',
    ),
    NotificationModel(
      id: 'notif-widget-2',
      userId: 'user-1',
      type: NotificationType.mention,
      title: 'Bob mentioned you',
      body: 'Check out @myusername in the comments',
      actorId: 'bob-id',
      actorIds: ['bob-id'],
      actorCount: 1,
      actors: [
        NotificationActorModel(id: 'bob-id', username: 'bob', displayName: 'Bob Dev')
      ],
      entityId: 'reel-102',
      channel: NotificationChannel.inApp,
      priority: NotificationPriority.high,
      isRead: true,
      deepLinkUrl: 'interest://reels/reel-102',
      createdAt: '2026-10-16T09:00:00Z',
    ),
  ];

  NotificationPreferencesModel prefs = const NotificationPreferencesModel(
    userId: 'user-1',
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
    clientTimezoneOffsetMinutes: 0,
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
    if (returnEmpty) {
      return {'items': <NotificationModel>[], 'total': 0, 'unreadCount': 0, 'limit': limit, 'offset': offset};
    }
    var items = List<NotificationModel>.from(defaultItems);
    if (type != null && type != 'ALL') {
      items = items.where((n) {
        if (type == 'LIKE') return n.type == NotificationType.like;
        if (type == 'MENTION') return n.type == NotificationType.mention;
        return true;
      }).toList();
    }
    return {
      'items': items,
      'total': items.length,
      'unreadCount': items.where((n) => !n.isRead).length,
      'limit': limit,
      'offset': offset,
    };
  }

  @override
  Future<void> markAsRead({required String notificationId, String? token}) async {
    markReadCalls++;
  }

  @override
  Future<void> markAllAsRead({String? token}) async {
    markAllCalls++;
  }

  @override
  Future<NotificationPreferencesModel> getPreferences({String? token}) async {
    return prefs;
  }

  @override
  Future<NotificationPreferencesModel> updatePreferences({
    required NotificationPreferencesModel preferences,
    String? token,
  }) async {
    prefs = preferences;
    return prefs;
  }

  @override
  Future<DeepLinkResolutionModel> resolveDeepLink({
    required String url,
    String? token,
  }) async {
    return const DeepLinkResolutionModel(
      url: 'interest://reels/reel-101',
      targetScreen: DeepLinkTargetScreen.reel,
      params: {'id': 'reel-101'},
      isValid: true,
      accessGranted: true,
      title: 'Tokyo Sunset',
    );
  }
}

void main() {
  late WidgetTestMockApiClient mockApiClient;
  late PlatformSecureStorageService secureStorage;
  late NotificationsRepository repository;
  late NotificationsNotifier notifier;

  setUp(() async {
    mockApiClient = WidgetTestMockApiClient();
    secureStorage = PlatformSecureStorageService();
    await secureStorage.saveAccessToken('widget_test_token');
    repository = NotificationsRepository(apiClient: mockApiClient, secureStorage: secureStorage);
    notifier = NotificationsNotifier(repository: repository);
  });

  Widget createTestWidget(Widget child) {
    return MaterialApp(
      home: child,
    );
  }

  group('NotificationsScreen Widget Tests', () {
    testWidgets('renders notifications screen with items, unread badge, and filter tabs', (tester) async {
      await tester.pumpWidget(createTestWidget(NotificationsScreen(notifier: notifier)));
      await tester.pumpAndSettle();

      // Verify AppBar title
      expect(find.text('Notifications'), findsOneWidget);

      // Verify Filter chips exist
      expect(find.text('All'), findsOneWidget);
      expect(find.text('Mentions'), findsOneWidget);
      expect(find.text('Comments'), findsOneWidget);
      expect(find.text('Follows'), findsOneWidget);
      expect(find.text('Messages'), findsOneWidget);
      expect(find.text('Milestones'), findsOneWidget);

      // Verify Notification items rendered
      expect(find.text('Alice liked your video'), findsOneWidget);
      expect(find.text('Your reel "Tokyo Sunset" received a new like'), findsOneWidget);
      expect(find.text('Bob mentioned you'), findsOneWidget);

      // Verify unread count badge in AppBar (1 unread item)
      expect(find.text('1'), findsOneWidget);
    });

    testWidgets('switches filter tab and queries filtered list', (tester) async {
      await tester.pumpWidget(createTestWidget(NotificationsScreen(notifier: notifier)));
      await tester.pumpAndSettle();

      // Tap on 'Mentions' filter chip
      await tester.tap(find.text('Mentions'));
      await tester.pumpAndSettle();

      // Mentions item should still be shown
      expect(find.text('Bob mentioned you'), findsOneWidget);
    });

    testWidgets('tap on notification card marks as read and executes deep link resolution', (tester) async {
      await tester.pumpWidget(createTestWidget(NotificationsScreen(notifier: notifier)));
      await tester.pumpAndSettle();

      // Tap unread notification card
      await tester.tap(find.text('Alice liked your video'));
      await tester.pumpAndSettle();

      expect(mockApiClient.markReadCalls, 1);
      // Verify safe routing navigation snackbar appears
      expect(find.textContaining('Navigating to Tokyo Sunset...'), findsOneWidget);
    });

    testWidgets('tap on mark all as read icon marks all notifications read', (tester) async {
      await tester.pumpWidget(createTestWidget(NotificationsScreen(notifier: notifier)));
      await tester.pumpAndSettle();

      // Find and tap the double check / mark all read icon
      final markAllBtn = find.byTooltip('Mark all as read');
      expect(markAllBtn, findsOneWidget);
      await tester.tap(markAllBtn);
      await tester.pumpAndSettle();

      expect(mockApiClient.markAllCalls, 1);
    });

    testWidgets('displays empty state when there are no notifications', (tester) async {
      mockApiClient.returnEmpty = true;
      notifier = NotificationsNotifier(repository: repository);

      await tester.pumpWidget(createTestWidget(NotificationsScreen(notifier: notifier)));
      await tester.pumpAndSettle();

      expect(find.text('No Notifications'), findsOneWidget);
      expect(find.textContaining('You are all caught up!'), findsOneWidget);
    });
  });

  group('NotificationSettingsScreen Widget Tests', () {
    testWidgets('renders settings categories, preview privacy toggle, and quiet hours', (tester) async {
      await tester.pumpWidget(createTestWidget(NotificationSettingsScreen(notifier: notifier)));
      await tester.pumpAndSettle();

      expect(find.text('Notification Settings'), findsOneWidget);
      expect(find.text('Preview Privacy'), findsOneWidget);
      expect(find.text('Hide notification previews'), findsOneWidget);
      expect(find.text('Quiet Hours Schedule'), findsOneWidget);
      expect(find.text('Enable Quiet Hours'), findsOneWidget);
      expect(find.text('Push Notifications'), findsOneWidget);
      expect(find.text('Save'), findsOneWidget);

      // Scroll to verify lower section
      await tester.scrollUntilVisible(find.text('In-App Notification Center'), 200);
      expect(find.text('In-App Notification Center'), findsOneWidget);
    });

    testWidgets('toggling preview privacy updates preferences on save', (tester) async {
      await tester.pumpWidget(createTestWidget(NotificationSettingsScreen(notifier: notifier)));
      await tester.pumpAndSettle();

      // Find preview privacy switch
      final previewSwitch = find.widgetWithText(SwitchListTile, 'Hide notification previews');
      expect(previewSwitch, findsOneWidget);

      await tester.tap(previewSwitch);
      await tester.pumpAndSettle();

      // Tap Save button in AppBar
      final saveBtn = find.text('Save');
      expect(saveBtn, findsOneWidget);
      await tester.tap(saveBtn);
      await tester.pumpAndSettle();

      expect(mockApiClient.prefs.hideNotificationPreviews, true);
    });
  });
}
