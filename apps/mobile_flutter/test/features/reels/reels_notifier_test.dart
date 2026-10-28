import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/failures.dart';
import 'package:mobile/features/reels/data/reels_api_client.dart';
import 'package:mobile/features/reels/data/reels_repository.dart';
import 'package:mobile/features/reels/domain/models/reel_item_model.dart';
import 'package:mobile/features/reels/domain/models/comment_item_model.dart';
import 'package:mobile/features/reels/presentation/reels_notifier.dart';
import 'package:mobile/features/reels/presentation/reels_state.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';

class MockReelsRepository implements ReelsRepository {
  List<ReelItemModel> feedToReturn = [];
  bool shouldThrowLikeError = false;
  bool shouldThrowSaveError = false;
  bool shouldThrowHideError = false;

  int likeCallCount = 0;
  int unlikeCallCount = 0;
  int saveCallCount = 0;
  int unsaveCallCount = 0;
  int hideCallCount = 0;
  int pinCallCount = 0;

  @override
  ReelsApiClient get apiClient => throw UnimplementedError();

  @override
  SecureStorageService get secureStorage => throw UnimplementedError();

  String lastModePassed = 'FOR_YOU';
  int applyControlCallCount = 0;
  String? lastControlReelId;
  String? lastControlAction;
  bool shouldThrowControlError = false;
  int resetPreferencesCallCount = 0;

  @override
  Future<List<ReelItemModel>> getFeed({
    int limit = 10,
    String? cursor,
    String? interestId,
    String mode = 'FOR_YOU',
  }) async {
    lastModePassed = mode;
    return feedToReturn;
  }

  @override
  Future<Map<String, dynamic>> applyFeedControl({
    required String reelId,
    required String action,
    String? interestId,
  }) async {
    applyControlCallCount++;
    lastControlReelId = reelId;
    lastControlAction = action;
    if (shouldThrowControlError) {
      throw const ServerFailure(message: 'Control action failed', statusCode: 500);
    }
    return {'applied': true};
  }

  @override
  Future<Map<String, dynamic>> resetFeedPreferences() async {
    resetPreferencesCallCount++;
    return {'reset': true};
  }

  @override
  Future<Map<String, dynamic>> likeReel(String reelId) async {
    likeCallCount++;
    if (shouldThrowLikeError) {
      throw const ServerFailure(message: 'Internal server error', statusCode: 500);
    }
    return {'liked': true, 'likeCount': 11};
  }

  @override
  Future<Map<String, dynamic>> unlikeReel(String reelId) async {
    unlikeCallCount++;
    if (shouldThrowLikeError) {
      throw const ServerFailure(message: 'Internal server error', statusCode: 500);
    }
    return {'liked': false, 'likeCount': 9};
  }

  @override
  Future<Map<String, dynamic>> saveReel(String reelId, {String? collectionId}) async {
    saveCallCount++;
    if (shouldThrowSaveError) {
      throw const ServerFailure(message: 'Save failed', statusCode: 500);
    }
    return {'saved': true, 'saveCount': 6};
  }

  @override
  Future<Map<String, dynamic>> unsaveReel(String reelId) async {
    unsaveCallCount++;
    if (shouldThrowSaveError) {
      throw const ServerFailure(message: 'Unsave failed', statusCode: 500);
    }
    return {'saved': false, 'saveCount': 4};
  }

  @override
  Future<void> hideReel(String reelId) async {
    hideCallCount++;
    if (shouldThrowHideError) {
      throw const ServerFailure(message: 'Hide failed', statusCode: 500);
    }
  }

  @override
  Future<ReelItemModel> pinReel(String reelId) async {
    pinCallCount++;
    final item = feedToReturn.firstWhere((r) => r.id == reelId);
    return item.copyWith(isPinned: true);
  }

  @override
  Future<ReelItemModel> unpinReel(String reelId) async {
    final item = feedToReturn.firstWhere((r) => r.id == reelId);
    return item.copyWith(isPinned: false);
  }

  @override
  Future<ReelItemModel> getReelById(String reelId) async {
    return feedToReturn.firstWhere((r) => r.id == reelId);
  }

  @override
  Future<List<CommentItemModel>> getComments(String reelId, {int limit = 20, String? cursor}) async {
    return [];
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  late MockReelsRepository mockRepo;
  late ReelsNotifier notifier;

  const sampleReel1 = ReelItemModel(
    id: 'reel-1',
    creatorId: 'creator-1',
    creator: ReelCreatorModel(id: 'creator-1', username: 'alice', displayName: 'Alice'),
    title: 'Distributed Consensus with Paxos',
    caption: 'Clean distributed systems explanation',
    hlsMasterUrl: 'https://cdn.example.com/video.m3u8',
    thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
    durationSeconds: 45.0,
    primaryInterestId: 'distributed-systems',
    interestTags: ['distributed-systems', 'backend'],
    viewCount: 1500,
    likeCount: 10,
    commentCount: 5,
    saveCount: 5,
    shareCount: 2,
    isLiked: false,
    isSaved: false,
    isFollowing: false,
    isPinned: false,
    mediaType: ReelMediaType.video,
    imageUrls: [],
    visibility: ReelItemVisibility.public,
    hashtags: ['distributedsystems', 'paxos'],
    createdAt: '2026-10-15T12:00:00Z',
  );

  const sampleReel2 = ReelItemModel(
    id: 'reel-2',
    creatorId: 'creator-2',
    creator: ReelCreatorModel(id: 'creator-2', username: 'bob', displayName: 'Bob'),
    title: 'Autonomous Multi-Agent Swarms',
    caption: 'Deep dive into decentralized agents',
    hlsMasterUrl: 'https://cdn.example.com/video2.m3u8',
    thumbnailUrl: 'https://cdn.example.com/thumb2.jpg',
    durationSeconds: 60.0,
    primaryInterestId: 'ai-agents',
    interestTags: ['ai-agents', 'ml'],
    viewCount: 2800,
    likeCount: 20,
    commentCount: 8,
    saveCount: 12,
    shareCount: 5,
    isLiked: true,
    isSaved: true,
    isFollowing: true,
    isPinned: false,
    mediaType: ReelMediaType.image,
    imageUrls: ['https://cdn.example.com/image1.jpg'],
    visibility: ReelItemVisibility.public,
    hashtags: ['ai', 'agents'],
    createdAt: '2026-10-15T14:00:00Z',
  );

  setUp(() {
    mockRepo = MockReelsRepository();
    notifier = ReelsNotifier(repository: mockRepo);
  });

  group('ReelsNotifier Feed Loading', () {
    test('Initial state is ReelsFeedInitialState', () {
      expect(notifier.feedState, isA<ReelsFeedInitialState>());
    });

    test('loadFeed sets ReelsFeedLoadedState with items on success', () async {
      mockRepo.feedToReturn = [sampleReel1, sampleReel2];

      await notifier.loadFeed();

      expect(notifier.feedState, isA<ReelsFeedLoadedState>());
      final loaded = notifier.feedState as ReelsFeedLoadedState;
      expect(loaded.items.length, 2);
      expect(loaded.items[0].id, 'reel-1');
      expect(loaded.items[1].id, 'reel-2');
    });

    test('loadFeed sets ReelsFeedEmptyState when 0 items returned', () async {
      mockRepo.feedToReturn = [];

      await notifier.loadFeed();

      expect(notifier.feedState, isA<ReelsFeedEmptyState>());
    });
  });

  group('Optimistic Engagement & Server Rollback Invariants', () {
    test('toggleLike optimistically increments like count and sets isLiked to true', () async {
      mockRepo.feedToReturn = [sampleReel1];
      await notifier.loadFeed();

      final future = notifier.toggleLike('reel-1');

      // Immediate state check (optimistic)
      final state = notifier.feedState as ReelsFeedLoadedState;
      expect(state.items[0].isLiked, isTrue);
      expect(state.items[0].likeCount, 11);

      await future;

      expect(mockRepo.likeCallCount, 1);
      final finalState = notifier.feedState as ReelsFeedLoadedState;
      expect(finalState.items[0].isLiked, isTrue);
      expect(finalState.items[0].likeCount, 11);
      expect(finalState.isBannerError, isFalse);
    });

    test('toggleLike rolls back to original state when server fails', () async {
      mockRepo.feedToReturn = [sampleReel1];
      mockRepo.shouldThrowLikeError = true;
      await notifier.loadFeed();

      await notifier.toggleLike('reel-1');

      // Verified rollback!
      final state = notifier.feedState as ReelsFeedLoadedState;
      expect(state.items[0].isLiked, isFalse);
      expect(state.items[0].likeCount, 10);
      expect(state.isBannerError, isTrue);
      expect(state.bannerMessage, contains('Failed to update like'));
    });

    test('toggleSave optimistically updates isSaved and rolls back on failure', () async {
      mockRepo.feedToReturn = [sampleReel1];
      await notifier.loadFeed();

      // Successful save
      await notifier.toggleSave('reel-1');
      var state = notifier.feedState as ReelsFeedLoadedState;
      expect(state.items[0].isSaved, isTrue);
      expect(state.items[0].saveCount, 6);

      // Now server fails on unsave
      mockRepo.shouldThrowSaveError = true;
      await notifier.toggleSave('reel-1');

      // Must roll back to isSaved == true and saveCount == 6
      state = notifier.feedState as ReelsFeedLoadedState;
      expect(state.items[0].isSaved, isTrue);
      expect(state.items[0].saveCount, 6);
      expect(state.isBannerError, isTrue);
      expect(state.bannerMessage, contains('Failed to update save'));
    });

    test('hideReel removes reel from feed immediately and rolls back if server fails', () async {
      mockRepo.feedToReturn = [sampleReel1, sampleReel2];
      await notifier.loadFeed();

      mockRepo.shouldThrowHideError = true;
      await notifier.hideReel('reel-1');

      // Server failed: reel-1 must be restored back into the items list!
      final state = notifier.feedState as ReelsFeedLoadedState;
      expect(state.items.length, 2);
      expect(state.items[0].id, 'reel-1');
      expect(state.isBannerError, isTrue);
      expect(state.bannerMessage, contains('Failed to hide post'));
    });

    test('togglePin enforces max 3 pinned posts client-side', () async {
      final pinned1 = sampleReel1.copyWith(id: 'p-1', isPinned: true);
      final pinned2 = sampleReel1.copyWith(id: 'p-2', isPinned: true);
      final pinned3 = sampleReel1.copyWith(id: 'p-3', isPinned: true);
      final unpinned4 = sampleReel1.copyWith(id: 'p-4', isPinned: false);

      mockRepo.feedToReturn = [pinned1, pinned2, pinned3, unpinned4];
      await notifier.loadFeed();

      await notifier.togglePin('p-4');

      final state = notifier.feedState as ReelsFeedLoadedState;
      expect(state.items[3].isPinned, isFalse);
      expect(state.isBannerError, isTrue);
      expect(state.bannerMessage, contains('You can pin up to 3 posts'));
      expect(mockRepo.pinCallCount, 0);
    });
  });

  group('Feed Ranking & Recommendation Controls (Prompt 10)', () {
    test('switchFeedMode switches currentFeedMode and queries repository with mode', () async {
      mockRepo.feedToReturn = [sampleReel1];
      await notifier.loadFeed();
      expect(notifier.currentFeedMode, 'FOR_YOU');
      expect(mockRepo.lastModePassed, 'FOR_YOU');

      await notifier.switchFeedMode('FOLLOWING');
      expect(notifier.currentFeedMode, 'FOLLOWING');
      expect(mockRepo.lastModePassed, 'FOLLOWING');
    });

    test('markNotInterested removes reel optimistically and applies server control', () async {
      mockRepo.feedToReturn = [sampleReel1, sampleReel2];
      await notifier.loadFeed();

      await notifier.markNotInterested('reel-1', interestId: 'distributed-systems');

      final state = notifier.feedState as ReelsFeedLoadedState;
      expect(state.items.length, 1);
      expect(state.items[0].id, 'reel-2');
      expect(state.isBannerError, isFalse);
      expect(state.bannerMessage, contains('fewer posts like this'));
      expect(mockRepo.applyControlCallCount, 1);
      expect(mockRepo.lastControlReelId, 'reel-1');
      expect(mockRepo.lastControlAction, 'NOT_INTERESTED');
    });

    test('markNotInterested rolls back if server control fails', () async {
      mockRepo.feedToReturn = [sampleReel1, sampleReel2];
      mockRepo.shouldThrowControlError = true;
      await notifier.loadFeed();

      await notifier.markNotInterested('reel-1');

      final state = notifier.feedState as ReelsFeedLoadedState;
      expect(state.items.length, 2);
      expect(state.items[0].id, 'reel-1');
      expect(state.isBannerError, isTrue);
      expect(state.bannerMessage, contains('Failed to update preferences'));
    });

    test('resetPreferences calls reset endpoint and refreshes feed', () async {
      mockRepo.feedToReturn = [sampleReel1];
      await notifier.loadFeed();

      await notifier.resetPreferences();

      expect(mockRepo.resetPreferencesCallCount, 1);
      final state = notifier.feedState as ReelsFeedLoadedState;
      expect(state.bannerMessage, contains('reset'));
      expect(state.isBannerError, isFalse);
    });

    test('ReelItemModel properly serializes and deserializes explanation', () {
      final model = sampleReel1.copyWith(
        explanation: 'Because you follow #distributed-systems',
      );
      expect(model.explanation, 'Because you follow #distributed-systems');

      final json = model.toJson();
      expect(json['explanation'], 'Because you follow #distributed-systems');

      final restored = ReelItemModel.fromJson(json);
      expect(restored.explanation, 'Because you follow #distributed-systems');
    });
  });
}
