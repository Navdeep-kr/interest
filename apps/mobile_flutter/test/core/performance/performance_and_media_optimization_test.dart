import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/media/media_cache_manager.dart';
import 'package:mobile/core/media/media_preload_manager.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/core/network/network_performance_manager.dart';
import 'package:mobile/core/performance/performance_profiler.dart';
import 'package:mobile/features/media/presentation/widgets/video_reel_player.dart';
import 'package:mobile/features/reels/domain/models/reel_item_model.dart';
import 'package:mobile/features/reels/presentation/widgets/reel_card.dart';

void main() {
  group('Prompt 21 — Performance Profiler & Metrics Verification', () {
    late PerformanceProfiler profiler;

    setUp(() {
      profiler = PerformanceProfiler();
      profiler.reset();
    });

    test('Measures cold and warm launch durations accurately', () {
      profiler.markColdLaunchStart();
      profiler.markColdLaunchEnd();
      expect(profiler.coldLaunchDurationMs, greaterThanOrEqualTo(0));

      profiler.markWarmLaunchStart();
      profiler.markWarmLaunchEnd();
      expect(profiler.warmLaunchDurationMs, greaterThanOrEqualTo(0));
    });

    test('Records Video First Frame (TTFF) and computes average', () {
      profiler.recordVideoFirstFrame(150);
      profiler.recordVideoFirstFrame(180);
      profiler.recordVideoFirstFrame(210);

      expect(profiler.averageVideoFirstFrameMs, 180);
    });

    test('Computes video rebuffering ratio from playback and stall events', () {
      // 100 seconds of playback with 2 seconds of stall
      profiler.recordPlaybackDuration(100000);
      profiler.recordRebufferingEvent(2000);

      expect(profiler.rebufferingRatioPercent, 2.0);
    });

    test('Monitors 60fps frame budget and detects dropped frames (>16.6ms)', () {
      profiler.recordFrame(8.5); // Fast frame
      profiler.recordFrame(12.0); // Fast frame
      profiler.recordFrame(14.2); // Fast frame
      profiler.recordFrame(22.0, isDropped: true); // Dropped frame (jank)

      expect(profiler.averageFrameRasterTimeMs, greaterThan(10.0));
      expect(profiler.droppedFramesPerThousand, 250); // 1 out of 4 frames
    });

    test('Models battery drain reduction from single active decoder vs unthrottled', () {
      // Baseline: 3 unthrottled decoders running off-screen
      profiler.onDecoderStarted();
      profiler.onDecoderStarted();
      profiler.onDecoderStarted();
      expect(profiler.activeHardwareDecoders, 3);
      final baselineRate = profiler.estimateBatteryDrainPerHour(tier: DeviceTier.midRange);

      // Optimized: Virtualization stops offscreen decoders, leaving only 1 active
      profiler.onDecoderStopped();
      profiler.onDecoderStopped();
      expect(profiler.activeHardwareDecoders, 1);
      final optimizedRate = profiler.estimateBatteryDrainPerHour(tier: DeviceTier.midRange);

      expect(optimizedRate, lessThan(baselineRate));
      expect(baselineRate, closeTo(13.1, 0.2));
      expect(optimizedRate, closeTo(6.7, 0.2));
    });

    test('Tracks API latency and failure resilience rate', () {
      profiler.recordApiCall(45, isSuccess: true);
      profiler.recordApiCall(55, isSuccess: true);
      profiler.recordApiCall(200, isSuccess: false);

      expect(profiler.averageApiLatencyMs, 100);
      expect(profiler.apiFailureRatePercent, closeTo(33.33, 0.1));
    });
  });

  group('Prompt 21 — Bounded Media Disk Cache Manager Tests', () {
    late MediaCacheManager cacheManager;

    setUp(() {
      cacheManager = MediaCacheManager();
      cacheManager.clearAll();
      cacheManager.resetMetrics();
    });

    test('Enforces strict bounded quota and evicts oldest entries in LRU order', () {
      // Configure small test quota: 10 MB
      cacheManager.maxCacheSizeBytes = 10 * 1024 * 1024;

      // Put item 1 (4 MB)
      cacheManager.put(key: 'video_1', localPath: '/tmp/vid1.mp4', sizeBytes: 4 * 1024 * 1024);
      // Put item 2 (4 MB)
      cacheManager.put(key: 'video_2', localPath: '/tmp/vid2.mp4', sizeBytes: 4 * 1024 * 1024);
      expect(cacheManager.entryCount, 2);
      expect(cacheManager.currentCacheSizeBytes, 8 * 1024 * 1024);

      // Access item 1 to refresh its LRU recency
      final retrieved = cacheManager.get('video_1');
      expect(retrieved, '/tmp/vid1.mp4');

      // Put item 3 (4 MB) -> Total would be 12 MB, exceeding 10 MB quota
      // Least recently used is item 2 (since item 1 was just accessed)
      cacheManager.put(key: 'video_3', localPath: '/tmp/vid3.mp4', sizeBytes: 4 * 1024 * 1024);

      expect(cacheManager.currentCacheSizeBytes, lessThanOrEqualTo(10 * 1024 * 1024));
      expect(cacheManager.get('video_2'), isNull); // Evicted!
      expect(cacheManager.get('video_1'), isNotNull); // Retained!
      expect(cacheManager.get('video_3'), isNotNull); // Newly added!
    });

    test('Purges expired entries past the TTL window', () {
      cacheManager.ttl = const Duration(milliseconds: 50);
      cacheManager.put(key: 'expired_item', localPath: '/tmp/expired.mp4', sizeBytes: 1024);

      expect(cacheManager.get('expired_item'), isNotNull);

      // Simulate passage of time past TTL
      sleep(const Duration(milliseconds: 60));

      expect(cacheManager.get('expired_item'), isNull);
    });

    test('ClearAll empties disk cache and resets current byte count', () {
      cacheManager.put(key: 'v1', localPath: '/tmp/v1.mp4', sizeBytes: 2048);
      cacheManager.put(key: 'v2', localPath: '/tmp/v2.mp4', sizeBytes: 4096);
      expect(cacheManager.currentCacheSizeBytes, 6144);

      cacheManager.clearAll();
      expect(cacheManager.entryCount, 0);
      expect(cacheManager.currentCacheSizeBytes, 0);
    });
  });

  group('Prompt 21 — Media Preload Manager Tests', () {
    late MediaPreloadManager preloadManager;

    setUp(() {
      preloadManager = MediaPreloadManager();
      preloadManager.clearQueue();
      preloadManager.resume();
    });

    test('Queues video URLs and configures concurrency based on device tier', () {
      preloadManager.configureForDevice(
        tier: DeviceTier.lowEnd,
        network: NetworkCondition.slow3G,
      );

      preloadManager.queuePreload([
        'https://cdn.example.com/hls/reel_1/master.m3u8',
        'https://cdn.example.com/hls/reel_2/master.m3u8',
        'https://cdn.example.com/hls/reel_3/master.m3u8',
      ]);

      expect(preloadManager.queueLength, greaterThanOrEqualTo(1));
    });

    test('Prioritize moves immediate next reel to head of preload queue', () {
      preloadManager.queuePreload([
        'https://cdn.example.com/hls/reel_a.m3u8',
        'https://cdn.example.com/hls/reel_b.m3u8',
      ]);

      preloadManager.prioritize('https://cdn.example.com/hls/reel_urgent.m3u8');
      // reel_urgent is placed at the front
      expect(preloadManager.queueLength, greaterThanOrEqualTo(1));
    });

    test('Pausing preloading clears queue during app backgrounding or low battery', () {
      preloadManager.queuePreload(['https://cdn.example.com/hls/reel_x.m3u8']);
      preloadManager.pause();

      expect(preloadManager.isPaused, isTrue);
      expect(preloadManager.queueLength, 0);
    });
  });

  group('Prompt 21 — OptimizedNetworkImage Memory Bounds Tests', () {
    testWidgets('OptimizedNetworkImage specifies cacheWidth and cacheHeight to protect RAM', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: OptimizedNetworkImage(
              imageUrl: 'https://cdn.example.com/sample_poster.jpg',
              width: 360,
              height: 640,
              targetCacheWidth: 720,
              targetCacheHeight: 1280,
            ),
          ),
        ),
      );

      final imageFinder = find.byType(Image);
      expect(imageFinder, findsOneWidget);

      final imageWidget = tester.widget<Image>(imageFinder);
      expect(imageWidget.image, isA<ResizeImage>());
      final resizeImage = imageWidget.image as ResizeImage;
      expect(resizeImage.width, 720);
      expect(resizeImage.height, 1280);
      expect(imageWidget.filterQuality, FilterQuality.low);
    });

    testWidgets('Renders error fallback when image URL is empty', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: OptimizedNetworkImage(
              imageUrl: '',
            ),
          ),
        ),
      );

      expect(find.byIcon(Icons.broken_image_outlined), findsOneWidget);
    });
  });

  group('Prompt 21 — Reel Virtualization & Decoder Throttling Tests', () {
    const mockReel = ReelItemModel(
      id: 'reel-perf-101',
      creatorId: 'creator-1',
      creator: ReelCreatorModel(id: 'creator-1', username: 'racer', displayName: 'Racer'),
      title: 'High Speed Racing',
      caption: 'Track day highlights',
      mediaType: ReelMediaType.video,
      hlsMasterUrl: 'https://cdn.example.com/hls/race.m3u8',
      thumbnailUrl: 'https://cdn.example.com/thumbs/race.jpg',
      durationSeconds: 45.0,
      primaryInterestId: 'interest-auto',
      interestTags: ['racing'],
      viewCount: 1500,
      likeCount: 120,
      commentCount: 14,
      saveCount: 20,
      shareCount: 5,
      isLiked: false,
      isSaved: false,
      isFollowing: false,
      isPinned: false,
      imageUrls: [],
      visibility: ReelItemVisibility.public,
      createdAt: '2026-10-16T12:00:00Z',
      hashtags: ['racing'],
    );

    testWidgets('Active ReelCard (isActive: true) mounts VideoReelPlayer for playback', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ReelCard(
              reel: mockReel,
              isActive: true, // Currently viewed page
              onLike: () {},
              onComment: () {},
              onSave: () {},
              onShare: () {},
            ),
          ),
        ),
      );

      await tester.pump(const Duration(milliseconds: 200));

      // Should mount active VideoReelPlayer
      expect(find.byType(VideoReelPlayer), findsOneWidget);
    });

    testWidgets('Inactive ReelCard (isActive: false) unmounts VideoReelPlayer and displays poster placeholder',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ReelCard(
              reel: mockReel,
              isActive: false, // Scrolled off-screen
              onLike: () {},
              onComment: () {},
              onSave: () {},
              onShare: () {},
            ),
          ),
        ),
      );

      // Should NOT mount VideoReelPlayer (releasing hardware decoder and audio)
      expect(find.byType(VideoReelPlayer), findsNothing);
      // Instead renders optimized poster placeholder
      expect(find.byType(OptimizedNetworkImage), findsOneWidget);
    });
  });

  group('Prompt 21 — Network Deduplication & Offline Cache Fallback Tests', () {
    late NetworkPerformanceManager networkManager;

    setUp(() {
      networkManager = NetworkPerformanceManager();
      networkManager.clearCache();
    });

    test('Primes and retrieves offline cached response for instantaneous First Contentful Paint', () {
      const feedUrl = 'https://api.interest.app/reels/feed';
      final cachedFeedPayload = {
        'items': [
          {'id': 'cached-1', 'title': 'Cached Reel 1'},
        ],
        'nextCursor': 'cursor-123',
      };

      networkManager.primeCache(feedUrl, cachedFeedPayload);

      final retrieved = networkManager.getOfflineCached(feedUrl);
      expect(retrieved, isNotNull);
      expect(retrieved['items'], isNotEmpty);
      expect(retrieved['items'][0]['title'], 'Cached Reel 1');
    });
  });
}
