import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/failures.dart';
import 'package:mobile/features/stories/data/stories_api_client.dart';
import 'package:mobile/features/stories/data/stories_repository.dart';
import 'package:mobile/features/stories/domain/models/story_models.dart';
import 'package:mobile/features/stories/presentation/stories_tray_notifier.dart';
import 'package:mobile/features/stories/presentation/story_player_notifier.dart';

class MockStoriesApiClient extends StoriesApiClient {
  int getTrayCalls = 0;
  int createStoryCalls = 0;
  int recordViewCalls = 0;
  int reactCalls = 0;
  int replyCalls = 0;
  int reportCalls = 0;
  int deleteCalls = 0;

  bool shouldSimulateOffline = false;

  List<CreatorStoryTrayModel> mockTray = [];

  @override
  Future<List<CreatorStoryTrayModel>> getStoriesTray({String? token}) async {
    getTrayCalls++;
    if (shouldSimulateOffline) {
      throw const NetworkFailure();
    }
    return mockTray;
  }

  @override
  Future<StoryModel> createStory(CreateStoryRequest request, {String? token}) async {
    createStoryCalls++;
    final newStory = StoryModel(
      id: 'story_new_created',
      creatorId: 'user_alice',
      creator: const StoryCreatorModel(
        id: 'user_alice',
        username: 'alice',
        displayName: 'Alice In Tech',
        isVerified: true,
      ),
      mediaType: request.mediaType,
      mediaUrl: request.mediaUrl,
      durationSeconds: request.durationSeconds ?? 5.0,
      caption: request.caption ?? '',
      textOverlays: request.textOverlays ?? const [],
      audience: request.audience,
      allowReplies: request.allowReplies,
      createdAt: DateTime.now(),
      expiresAt: DateTime.now().add(const Duration(hours: 24)),
      isExpired: false,
      isViewed: false,
      viewProgressPercent: 0.0,
    );
    return newStory;
  }

  @override
  Future<void> recordView(String storyId, RecordStoryViewRequest request, {String? token}) async {
    recordViewCalls++;
    if (shouldSimulateOffline) {
      throw const NetworkFailure();
    }
  }

  @override
  Future<void> reactToStory(String storyId, String reaction, {String? token}) async {
    reactCalls++;
  }

  @override
  Future<void> replyToStory(String storyId, String text, {String? token}) async {
    replyCalls++;
  }

  @override
  Future<void> reportStory(String storyId, String reason, String? details, {String? token}) async {
    reportCalls++;
  }

  @override
  Future<void> deleteStory(String storyId, {String? token}) async {
    deleteCalls++;
  }
}

void main() {
  late MockStoriesApiClient mockApiClient;
  late StoriesRepository repository;

  final activeStory = StoryModel(
    id: 'story_active_1',
    creatorId: 'creator_1',
    creator: const StoryCreatorModel(
      id: 'creator_1',
      username: 'art_creator',
      displayName: 'Art & Design',
      isVerified: true,
    ),
    mediaType: StoryMediaType.photo,
    mediaUrl: 'https://cdn.interest.test/stories/art.jpg',
    durationSeconds: 5.0,
    caption: 'New watercolor painting!',
    textOverlays: const [
      StoryOverlayModel(
        id: 'ov_1',
        text: 'Tokyo Colors',
        color: '#FFFFFF',
        fontSize: 22,
        xPercent: 50,
        yPercent: 30,
        startTimeSeconds: 0,
        endTimeSeconds: 5,
      ),
    ],
    audience: StoryAudience.public,
    allowReplies: StoryReplySetting.all,
    createdAt: DateTime.now().subtract(const Duration(hours: 2)),
    expiresAt: DateTime.now().add(const Duration(hours: 22)),
    isExpired: false,
    isViewed: false,
    viewProgressPercent: 0.0,
    viewsCount: 15,
    reactionsCount: 3,
  );

  final expiredStory = StoryModel(
    id: 'story_expired_2',
    creatorId: 'creator_1',
    creator: const StoryCreatorModel(
      id: 'creator_1',
      username: 'art_creator',
      displayName: 'Art & Design',
      isVerified: true,
    ),
    mediaType: StoryMediaType.photo,
    mediaUrl: 'https://cdn.interest.test/stories/old.jpg',
    durationSeconds: 5.0,
    caption: 'Yesterday art',
    textOverlays: const [],
    audience: StoryAudience.public,
    allowReplies: StoryReplySetting.all,
    createdAt: DateTime.now().subtract(const Duration(hours: 26)),
    expiresAt: DateTime.now().subtract(const Duration(hours: 2)), // expired
    isExpired: true,
    isViewed: true,
    viewProgressPercent: 1.0,
  );

  final closeFriendsStory = StoryModel(
    id: 'story_cf_3',
    creatorId: 'creator_2',
    creator: const StoryCreatorModel(
      id: 'creator_2',
      username: 'secret_agent',
      displayName: 'Secret Friend',
      isVerified: false,
    ),
    mediaType: StoryMediaType.photo,
    mediaUrl: 'https://cdn.interest.test/stories/secret.jpg',
    durationSeconds: 5.0,
    caption: 'Only for best friends',
    textOverlays: const [],
    audience: StoryAudience.closeFriends,
    allowReplies: StoryReplySetting.followers,
    createdAt: DateTime.now().subtract(const Duration(minutes: 30)),
    expiresAt: DateTime.now().add(const Duration(hours: 23, minutes: 30)),
    isExpired: false,
    isViewed: false,
    viewProgressPercent: 0.0,
  );

  setUp(() {
    mockApiClient = MockStoriesApiClient();
    repository = StoriesRepository(apiClient: mockApiClient);

    mockApiClient.mockTray = [
      CreatorStoryTrayModel(
        creatorId: 'creator_1',
        username: 'art_creator',
        displayName: 'Art & Design',
        isVerified: true,
        hasUnviewedStories: true,
        latestStoryAt: DateTime.now(),
        stories: [activeStory, expiredStory],
      ),
      CreatorStoryTrayModel(
        creatorId: 'creator_2',
        username: 'secret_agent',
        displayName: 'Secret Friend',
        isVerified: false,
        hasUnviewedStories: true,
        latestStoryAt: DateTime.now(),
        stories: [closeFriendsStory],
      ),
    ];
  });

  group('1. Domain Models & Expiry Logic', () {
    test('StoryModel correctly identifies active vs locally expired stories', () {
      expect(activeStory.isLocallyExpired, false);
      expect(expiredStory.isLocallyExpired, true);

      expect(activeStory.remainingTimeFormatted, contains('h left'));
      expect(expiredStory.remainingTimeFormatted, 'Expired');
    });

    test('StoryModel serializes and deserializes accurately with all overlays and settings', () {
      final json = activeStory.toJson();
      final deserialized = StoryModel.fromJson(json);

      expect(deserialized.id, activeStory.id);
      expect(deserialized.creator.username, 'art_creator');
      expect(deserialized.mediaType, StoryMediaType.photo);
      expect(deserialized.audience, StoryAudience.public);
      expect(deserialized.allowReplies, StoryReplySetting.all);
      expect(deserialized.textOverlays.length, 1);
      expect(deserialized.textOverlays[0].text, 'Tokyo Colors');
      expect(deserialized.viewsCount, 15);
      expect(deserialized.reactionsCount, 3);
    });
  });

  group('2. StoriesRepository Caching & Offline View Queueing', () {
    test('fetches tray and purges expired stories from cache', () async {
      final tray = await repository.getStoriesTray(token: 'token_123');

      expect(mockApiClient.getTrayCalls, 1);
      expect(tray.length, 2);

      // Creator 1 had 2 stories (1 active, 1 expired). Only active story should be kept.
      final creator1Tray = tray.firstWhere((t) => t.creatorId == 'creator_1');
      expect(creator1Tray.stories.length, 1);
      expect(creator1Tray.stories[0].id, 'story_active_1');
    });

    test('queues offline views when network fails and flushes when online', () async {
      // First populate cache
      await repository.getStoriesTray(token: 'token_123');

      // Simulate offline network
      mockApiClient.shouldSimulateOffline = true;

      // Attempt recording view while offline
      await repository.recordView('story_active_1', progressPercent: 1.0, token: 'token_123');

      expect(repository.offlineViewQueue.length, 1);
      expect(repository.offlineViewQueue[0].storyId, 'story_active_1');
      expect(repository.offlineViewQueue[0].completed, true);

      // Now back online
      mockApiClient.shouldSimulateOffline = false;
      await repository.flushOfflineViews(token: 'token_123');

      expect(repository.offlineViewQueue, isEmpty);
      expect(mockApiClient.recordViewCalls, 2); // 1 initial failed + 1 successful flush
    });

    test('reports story and removes it immediately from local cache', () async {
      await repository.getStoriesTray(token: 'token_123');
      expect(repository.cachedTray.length, 2);

      await repository.reportStory('story_cf_3', 'SPAM', 'Unwanted post', token: 'token_123');

      expect(mockApiClient.reportCalls, 1);
      // Creator 2 only had story_cf_3, so creator 2 is removed completely from tray
      expect(repository.cachedTray.length, 1);
      expect(repository.cachedTray[0].creatorId, 'creator_1');
    });

    test('deletes own story and removes it from local cache', () async {
      await repository.getStoriesTray(token: 'token_123');
      await repository.deleteStory('story_active_1', token: 'token_123');

      expect(mockApiClient.deleteCalls, 1);
      expect(repository.cachedTray.length, 1);
      expect(repository.cachedTray[0].creatorId, 'creator_2');
    });
  });

  group('3. StoryPlayerNotifier Playback & Engagement', () {
    test('advances through stories and notifies on completion', () {
      bool completed = false;
      final notifier = StoryPlayerNotifier(
        repository: repository,
        stories: [activeStory, closeFriendsStory],
        authToken: 'token_123',
        onCompletedAllStories: () {
          completed = true;
        },
      );

      expect(notifier.state.currentIndex, 0);
      expect(notifier.state.currentStory?.id, 'story_active_1');

      // Advance to second story
      notifier.advance();
      expect(notifier.state.currentIndex, 1);
      expect(notifier.state.currentStory?.id, 'story_cf_3');
      expect(completed, false);

      // Advance past second story -> completes playlist
      notifier.advance();
      expect(notifier.state.isFinished, true);
      expect(completed, true);

      notifier.dispose();
    });

    test('pauses and resumes playback correctly', () {
      final notifier = StoryPlayerNotifier(
        repository: repository,
        stories: [activeStory],
        authToken: 'token_123',
      );

      expect(notifier.state.isPaused, false);
      notifier.pause();
      expect(notifier.state.isPaused, true);
      notifier.resume();
      expect(notifier.state.isPaused, false);

      notifier.dispose();
    });

    test('sends emoji reactions with optimistic count update', () async {
      final notifier = StoryPlayerNotifier(
        repository: repository,
        stories: [activeStory],
        authToken: 'token_123',
      );

      final initialReactions = notifier.state.currentStory!.reactionsCount;
      await notifier.sendReaction('🔥');

      expect(mockApiClient.reactCalls, 1);
      expect(notifier.state.currentStory!.reactionsCount, initialReactions + 1);

      notifier.dispose();
    });

    test('validates story replies against allowReplies settings', () async {
      // Create a story with OFF setting
      final noReplyStory = StoryModel(
        id: 'no_reply_story',
        creatorId: 'c1',
        creator: activeStory.creator,
        mediaType: StoryMediaType.photo,
        mediaUrl: 'https://test.com/photo.jpg',
        durationSeconds: 5,
        caption: 'No replies',
        textOverlays: const [],
        audience: StoryAudience.public,
        allowReplies: StoryReplySetting.off,
        createdAt: DateTime.now(),
        expiresAt: DateTime.now().add(const Duration(hours: 10)),
        isExpired: false,
        isViewed: false,
        viewProgressPercent: 0,
      );

      final notifier = StoryPlayerNotifier(
        repository: repository,
        stories: [activeStory, noReplyStory],
        authToken: 'token_123',
      );

      // Story 1 allows replies
      final res1 = await notifier.sendReply('Nice art!');
      expect(res1, true);
      expect(mockApiClient.replyCalls, 1);

      // Advance to story 2 (replies OFF)
      notifier.advance();
      final res2 = await notifier.sendReply('Can I reply?');
      expect(res2, false);
      expect(mockApiClient.replyCalls, 1); // Not incremented

      notifier.dispose();
    });
  });

  group('4. StoriesTrayNotifier State Management', () {
    test('loads tray and updates loading state cleanly', () async {
      final trayNotifier = StoriesTrayNotifier(repository: repository);
      expect(trayNotifier.state.isLoading, false);

      final loadFuture = trayNotifier.loadTray(token: 'token_123');
      expect(trayNotifier.state.isLoading, true);

      await loadFuture;
      expect(trayNotifier.state.isLoading, false);
      expect(trayNotifier.state.tray.length, 2);
    });

    test('marks story viewed in tray state', () async {
      final trayNotifier = StoriesTrayNotifier(repository: repository);
      await trayNotifier.loadTray(token: 'token_123');

      expect(trayNotifier.state.tray[0].hasUnviewedStories, true);

      trayNotifier.markStoryViewed('story_active_1');

      // Now all stories of creator 1 in tray are viewed
      expect(trayNotifier.state.tray[0].hasUnviewedStories, false);
    });
  });
}
