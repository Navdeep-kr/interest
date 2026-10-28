import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';
import 'package:mobile/features/creator/data/creator_api_client.dart';
import 'package:mobile/features/creator/data/creator_repository.dart';
import 'package:mobile/features/creator/domain/models/analytics_models.dart';
import 'package:mobile/features/creator/presentation/screens/creator_analytics_dashboard_screen.dart';

class MockSecureStorageService implements SecureStorageService {
  @override
  dynamic noSuchMethod(Invocation invocation) => null;

  @override
  Future<String?> getAccessToken() async => 'mock-access-token';
}

class MockAnalyticsApiClient extends CreatorApiClient {
  bool getAnalyticsCalled = false;
  bool getScheduledCalled = false;
  bool cancelScheduledCalled = false;
  bool recordEngagementCalled = false;

  VerifiedCreatorAnalyticsModel mockAnalytics = const VerifiedCreatorAnalyticsModel(
    timeframe: AnalyticsTimeframeModel(
      startDate: '2026-09-16T00:00:00Z',
      endDate: '2026-10-16T00:00:00Z',
      timezone: 'UTC',
      processingDelayMinutes: 15,
      lastAggregatedAt: '2026-10-16T10:00:00Z',
    ),
    countingRules: ViewCountingRulesModel(
      minWatchSecondsForView: 1.5,
      completionRatioThreshold: 0.90,
      deduplicationWindowMinutes: 30,
      rapidSkipDurationLimitSeconds: 1.5,
      botFilteringEnabled: true,
    ),
    totalViews: 3450,
    totalWatchHours: 28.5,
    avgWatchRatio: 0.72,
    completionRate: 68.4,
    engagementRate: 14.2,
    totalLikes: 420,
    totalComments: 55,
    totalSaves: 110,
    totalShares: 35,
    totalFollowers: 1200,
    followerGrowthPercent: 8.5,
    followerGrowth: [
      FollowerGrowthPointModel(date: '2026-10-14', newFollowers: 12, netFollowers: 12),
      FollowerGrowthPointModel(date: '2026-10-15', newFollowers: 15, netFollowers: 27),
    ],
    retentionCurve: [
      RetentionPointModel(bucketPercent: 0, retentionPercent: 100),
      RetentionPointModel(bucketPercent: 50, retentionPercent: 75),
      RetentionPointModel(bucketPercent: 100, retentionPercent: 40),
    ],
    discoverySources: [
      DiscoverySourceBreakdownModel(source: 'FOR_YOU', count: 2400, percentage: 69.5),
      DiscoverySourceBreakdownModel(source: 'TOPIC_PAGE', count: 650, percentage: 18.8),
    ],
    topicPerformance: [
      TopicPerformanceItemModel(
        topicId: 'topic-ai',
        topicTitle: 'Machine Learning',
        reelsCount: 4,
        viewsCount: 2200,
        watchTimeSeconds: 65000,
        avgWatchRatio: 0.76,
        engagementRate: 16.5,
      ),
    ],
    earnings: CreatorEarningsModel(
      grossRevenueCents: 15000,
      platformFeeCents: 1500,
      netEarningsCents: 13500,
      tipsCount: 30,
      activeSubscriptionsCount: 18,
      currency: 'usd',
      isFinancialAuthoritative: true,
    ),
    topReels: [
      CreatorTopReelModel(
        id: 'reel-1',
        title: 'Neural Networks Visualized',
        thumbnailUrl: 'https://cdn.interest.app/thumb1.jpg',
        viewCount: 2200,
        likeCount: 310,
        commentCount: 40,
        saveCount: 90,
        shareCount: 25,
        avgCompletionRate: 0.78,
        primaryInterestTitle: 'Machine Learning',
        createdAt: '2026-10-10T12:00:00Z',
      ),
      CreatorTopReelModel(
        id: 'reel-deleted-1',
        title: '[Deleted Reel]',
        thumbnailUrl: null,
        viewCount: 1250,
        likeCount: 110,
        commentCount: 15,
        saveCount: 20,
        shareCount: 10,
        avgCompletionRate: 0.65,
        primaryInterestTitle: 'Machine Learning',
        createdAt: '2026-09-20T12:00:00Z',
      ),
    ],
    scheduledCount: 1,
    hasSufficientData: true,
    zeroLocationGuarantee: 'Strict zero-location guarantee: 0 GPS, 0 IP coordinates, zero geographic attributes.',
  );

  final List<ScheduledReelItemModel> mockScheduledReels = [
    const ScheduledReelItemModel(
      id: 'scheduled-reel-1',
      creatorId: 'creator-me',
      title: 'Upcoming Deep Learning Architecture',
      scheduledAt: '2026-10-20T14:00:00Z',
      primaryInterestId: 'topic-ai',
      status: 'SCHEDULED',
      createdAt: '2026-10-16T08:00:00Z',
    ),
  ];

  @override
  Future<VerifiedCreatorAnalyticsModel> getVerifiedAnalytics({
    String range = '30d',
    String? startDate,
    String? endDate,
    String? timezone,
    String? reelId,
    String? token,
  }) async {
    getAnalyticsCalled = true;
    return mockAnalytics;
  }

  @override
  Future<List<ScheduledReelItemModel>> getScheduledReels({String? token}) async {
    getScheduledCalled = true;
    return mockScheduledReels;
  }

  @override
  Future<void> cancelScheduledReel({required String reelId, String? token}) async {
    cancelScheduledCalled = true;
  }

  @override
  Future<Map<String, dynamic>> recordEngagementEvent({
    required Map<String, dynamic> eventData,
    String? token,
  }) async {
    recordEngagementCalled = true;
    return {'recorded': true, 'isQualifyingView': true};
  }
}

void main() {
  late MockAnalyticsApiClient apiClient;
  late MockSecureStorageService storageService;
  late CreatorRepository repository;

  setUp(() {
    apiClient = MockAnalyticsApiClient();
    storageService = MockSecureStorageService();
    repository = CreatorRepository(
      apiClient: apiClient,
      secureStorage: storageService,
    );
  });

  group('Prompt 17 — Flutter Creator Analytics Domain Models', () {
    test('authoritative financial calculations format accurately without placeholders', () {
      const earnings = CreatorEarningsModel(
        grossRevenueCents: 15450,
        platformFeeCents: 1545,
        netEarningsCents: 13905,
        tipsCount: 22,
        activeSubscriptionsCount: 15,
        currency: 'usd',
        isFinancialAuthoritative: true,
      );

      expect(earnings.grossFormatted, '\$154.50');
      expect(earnings.netFormatted, '\$139.05');
      expect(earnings.tipsCount, 22);
      expect(earnings.isFinancialAuthoritative, isTrue);
    });

    test('deleted top reel transparency marks title and masks media thumbnail', () {
      const deletedReel = CreatorTopReelModel(
        id: 'del-1',
        title: '[Deleted Reel]',
        thumbnailUrl: null,
        viewCount: 1500,
        likeCount: 200,
        commentCount: 25,
        saveCount: 30,
        shareCount: 10,
        avgCompletionRate: 0.70,
        primaryInterestTitle: 'Tech',
        createdAt: '2026-09-01T00:00:00Z',
      );

      expect(deletedReel.isDeleted, isTrue);
      expect(deletedReel.thumbnailUrl, isNull);
      expect(deletedReel.viewCount, 1500); // Historical views preserved
    });

    test('discovery source breakdown provides readable display names', () {
      const fyp = DiscoverySourceBreakdownModel(source: 'FOR_YOU', count: 100, percentage: 50.0);
      const search = DiscoverySourceBreakdownModel(source: 'SEARCH', count: 50, percentage: 25.0);
      const community = DiscoverySourceBreakdownModel(source: 'COMMUNITY', count: 50, percentage: 25.0);

      expect(fyp.displayName, 'For You Feed');
      expect(search.displayName, 'Search & Explore');
      expect(community.displayName, 'Communities');
    });

    test('repository delegates verified analytics and engagement telemetry correctly', () async {
      final res = await repository.getVerifiedAnalytics(range: '30d');
      expect(apiClient.getAnalyticsCalled, isTrue);
      expect(res.totalViews, 3450);
      expect(res.zeroLocationGuarantee, contains('0 GPS, 0 IP coordinates'));

      final recordRes = await repository.recordEngagementEvent({
        'reelId': '00000000-0000-0000-0000-000000000001',
        'durationMs': 30000,
        'watchedMs': 15000,
        'action': 'WATCH_PARTIAL',
      });
      expect(apiClient.recordEngagementCalled, isTrue);
      expect(recordRes['isQualifyingView'], isTrue);
    });
  });

  group('Prompt 17 — Flutter Creator Analytics Dashboard UI', () {
    testWidgets('renders verified metrics, authoritative ledger, and zero-location guarantee', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: CreatorAnalyticsDashboardScreen(repository: repository),
        ),
      );

      await tester.pumpAndSettle();

      // 1. Header & Title
      expect(find.text('Creator Analytics & Studio'), findsOneWidget);
      expect(find.text('Verified Analytics'), findsOneWidget);
      expect(find.text('Scheduled Content'), findsOneWidget);

      // 2. Zero Location Guarantee Badge
      expect(find.byIcon(Icons.verified_user_outlined), findsOneWidget);
      expect(find.textContaining('0 GPS, 0 IP coordinates'), findsOneWidget);

      // 3. Core Metrics Grid
      expect(find.text('Verified Views'), findsOneWidget);
      expect(find.text('3450'), findsOneWidget);
      expect(find.text('Watch Hours'), findsOneWidget);
      expect(find.text('28.5'), findsOneWidget);
      expect(find.text('Completion Rate'), findsOneWidget);
      expect(find.text('68.4%'), findsOneWidget);
      expect(find.text('Engagement Rate'), findsOneWidget);
      expect(find.text('14.2%'), findsOneWidget);

      // 4. Authoritative Financial Records Card
      expect(find.text('Authoritative Financial Records'), findsOneWidget);
      expect(find.text('Verified Ledger'), findsOneWidget);
      expect(find.text('\$135.00'), findsOneWidget); // Net
      expect(find.text('\$150.00'), findsOneWidget); // Gross
      expect(find.textContaining('Completed Tips: 30'), findsOneWidget);
      expect(find.textContaining('Active Subscriptions: 18'), findsOneWidget);

      // 5. Documented View Counting Rules
      expect(find.text('Documented View Counting Rules'), findsOneWidget);
      expect(find.textContaining('Qualifying View: Continuous watch >= 1.5s'), findsOneWidget);

      // 6. Topic & Interest Performance
      expect(find.text('Machine Learning'), findsWidgets);

      // 7. Top Reels (Active and Deleted)
      expect(find.text('Neural Networks Visualized'), findsOneWidget);
      expect(find.text('[Deleted Reel]'), findsOneWidget);
    });

    testWidgets('switches to Scheduled Content tab and displays scheduled items', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: CreatorAnalyticsDashboardScreen(repository: repository),
        ),
      );

      await tester.pumpAndSettle();

      // Tap 'Scheduled Content' tab
      await tester.tap(find.text('Scheduled Content'));
      await tester.pumpAndSettle();

      expect(apiClient.getScheduledCalled, isTrue);
      expect(find.text('Upcoming Deep Learning Architecture'), findsOneWidget);
      expect(find.byIcon(Icons.cancel_outlined), findsOneWidget);

      // Tap cancel button
      await tester.tap(find.byIcon(Icons.cancel_outlined));
      await tester.pumpAndSettle();

      expect(apiClient.cancelScheduledCalled, isTrue);
      expect(find.text('Scheduled publication cancelled.'), findsOneWidget);
    });

    testWidgets('displays honest empty state when hasSufficientData is false', (tester) async {
      apiClient.mockAnalytics = const VerifiedCreatorAnalyticsModel(
        timeframe: AnalyticsTimeframeModel(
          startDate: '2026-10-09T00:00:00Z',
          endDate: '2026-10-16T00:00:00Z',
          timezone: 'UTC',
          processingDelayMinutes: 15,
          lastAggregatedAt: '2026-10-16T10:00:00Z',
        ),
        countingRules: ViewCountingRulesModel(
          minWatchSecondsForView: 1.5,
          completionRatioThreshold: 0.90,
          deduplicationWindowMinutes: 30,
          rapidSkipDurationLimitSeconds: 1.5,
          botFilteringEnabled: true,
        ),
        totalViews: 0,
        totalWatchHours: 0.0,
        avgWatchRatio: 0.0,
        completionRate: 0.0,
        engagementRate: 0.0,
        totalLikes: 0,
        totalComments: 0,
        totalSaves: 0,
        totalShares: 0,
        totalFollowers: 0,
        followerGrowthPercent: 0.0,
        followerGrowth: [],
        retentionCurve: [],
        discoverySources: [],
        topicPerformance: [],
        earnings: CreatorEarningsModel(
          grossRevenueCents: 0,
          platformFeeCents: 0,
          netEarningsCents: 0,
          tipsCount: 0,
          activeSubscriptionsCount: 0,
          currency: 'usd',
          isFinancialAuthoritative: true,
        ),
        topReels: [],
        scheduledCount: 0,
        hasSufficientData: false,
        zeroLocationGuarantee: 'Strict zero-location guarantee: 0 GPS, 0 IP coordinates, zero geographic attributes.',
      );

      await tester.pumpWidget(
        MaterialApp(
          home: CreatorAnalyticsDashboardScreen(repository: repository),
        ),
      );

      await tester.pumpAndSettle();

      // Honest zero placeholder policy text
      expect(find.text('Zero Placeholder Guarantee'), findsOneWidget);
      expect(find.textContaining('No qualifying playback sessions recorded'), findsOneWidget);
      expect(find.text('0'), findsWidgets); // Views, Likes, etc.
    });
  });
}
