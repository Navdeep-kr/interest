import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/failures.dart';
import 'package:mobile/features/reels/data/reels_api_client.dart';
import 'package:mobile/features/reels/data/reels_repository.dart';
import 'package:mobile/features/reels/domain/models/reel_item_model.dart';
import 'package:mobile/features/reels/domain/models/comment_item_model.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';

class MockSecureStorageService implements SecureStorageService {
  String? token = 'valid_mock_jwt_token';

  @override
  Future<String?> getAccessToken() async => token;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class MockReelsApiClient implements ReelsApiClient {
  String? lastTokenPassed;
  String? lastReelIdPassed;
  Map<String, dynamic>? lastBodyPassed;

  @override
  String get baseUrl => 'https://api.interest.test';

  String? lastModePassed;
  String? lastControlAction;
  bool resetPreferencesCalled = false;

  @override
  Future<List<ReelItemModel>> getFeed({
    int limit = 10,
    String? cursor,
    String? interestId,
    String mode = 'FOR_YOU',
    String? token,
  }) async {
    lastTokenPassed = token;
    lastModePassed = mode;
    return [];
  }

  @override
  Future<Map<String, dynamic>> applyFeedControl({
    required String reelId,
    required String action,
    String? interestId,
    required String token,
  }) async {
    lastReelIdPassed = reelId;
    lastControlAction = action;
    lastTokenPassed = token;
    return {'applied': true};
  }

  @override
  Future<Map<String, dynamic>> resetFeedPreferences({
    required String token,
  }) async {
    resetPreferencesCalled = true;
    lastTokenPassed = token;
    return {'reset': true};
  }

  @override
  Future<Map<String, dynamic>> likeReel(String reelId, {required String token}) async {
    lastReelIdPassed = reelId;
    lastTokenPassed = token;
    return {'liked': true};
  }

  @override
  Future<Map<String, dynamic>> saveReel(String reelId, {String? collectionId, required String token}) async {
    lastReelIdPassed = reelId;
    lastTokenPassed = token;
    return {'saved': true};
  }

  @override
  Future<ReelItemModel> createImagePost({
    required String title,
    String? caption,
    required List<String> imageUrls,
    required String primaryInterestId,
    List<String>? interestTags,
    List<String>? hashtags,
    String visibility = 'PUBLIC',
    required String token,
  }) async {
    lastTokenPassed = token;
    lastBodyPassed = {
      'title': title,
      'caption': caption,
      'imageUrls': imageUrls,
      'primaryInterestId': primaryInterestId,
    };
    return ReelItemModel(
      id: 'new-reel-1',
      creatorId: 'user-1',
      creator: const ReelCreatorModel(id: 'user-1', username: 'u1', displayName: 'U1'),
      title: title,
      hlsMasterUrl: imageUrls.first,
      thumbnailUrl: imageUrls.first,
      durationSeconds: 0,
      primaryInterestId: primaryInterestId,
      interestTags: interestTags ?? [],
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
      saveCount: 0,
      shareCount: 0,
      isLiked: false,
      isSaved: false,
      isFollowing: false,
      isPinned: false,
      mediaType: ReelMediaType.image,
      imageUrls: imageUrls,
      visibility: ReelItemVisibility.public,
      hashtags: hashtags ?? [],
      createdAt: DateTime.now().toIso8601String(),
    );
  }

  @override
  Future<CommentItemModel> addComment(
    String reelId, {
    required String text,
    String? parentId,
    required String token,
  }) async {
    lastTokenPassed = token;
    lastReelIdPassed = reelId;
    return CommentItemModel(
      id: 'comment-1',
      reelId: reelId,
      userId: 'user-1',
      author: const CommentAuthorModel(id: 'user-1', username: 'u1', displayName: 'U1'),
      parentId: parentId,
      text: text,
      likeCount: 0,
      isLiked: false,
      isPinned: false,
      isAuthor: true,
      createdAt: DateTime.now().toIso8601String(),
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  late MockReelsApiClient mockApiClient;
  late MockSecureStorageService mockStorage;
  late ReelsRepository repository;

  setUp(() {
    mockApiClient = MockReelsApiClient();
    mockStorage = MockSecureStorageService();
    repository = ReelsRepository(
      apiClient: mockApiClient,
      secureStorage: mockStorage,
    );
  });

  group('ReelsRepository Authentication & Delegation', () {
    test('getFeed passes optional token from secure storage', () async {
      await repository.getFeed();

      expect(mockApiClient.lastTokenPassed, 'valid_mock_jwt_token');
    });

    test('likeReel passes required token to apiClient', () async {
      final res = await repository.likeReel('reel-123');

      expect(res['liked'], isTrue);
      expect(mockApiClient.lastReelIdPassed, 'reel-123');
      expect(mockApiClient.lastTokenPassed, 'valid_mock_jwt_token');
    });

    test('likeReel throws AuthenticationFailure when token is null', () async {
      mockStorage.token = null;

      expect(
        () => repository.likeReel('reel-123'),
        throwsA(isA<AuthenticationFailure>()),
      );
    });

    test('createImagePost passes all parameters and token', () async {
      final post = await repository.createImagePost(
        title: 'Microservices Architecture',
        caption: 'Event-driven systems in Go',
        imageUrls: ['https://cdn.example.com/slide1.jpg'],
        primaryInterestId: 'microservices',
      );

      expect(post.title, 'Microservices Architecture');
      expect(mockApiClient.lastTokenPassed, 'valid_mock_jwt_token');
      expect(mockApiClient.lastBodyPassed?['title'], 'Microservices Architecture');
    });

    test('addComment passes reelId, text, and token to apiClient', () async {
      final comment = await repository.addComment(
        'reel-456',
        text: 'Super clean explanation! @author',
      );

      expect(comment.reelId, 'reel-456');
      expect(comment.text, 'Super clean explanation! @author');
      expect(mockApiClient.lastTokenPassed, 'valid_mock_jwt_token');
    });

    test('getFeed passes mode parameter to apiClient', () async {
      await repository.getFeed(mode: 'FOLLOWING');

      expect(mockApiClient.lastModePassed, 'FOLLOWING');
      expect(mockApiClient.lastTokenPassed, 'valid_mock_jwt_token');
    });

    test('applyFeedControl passes reelId, action, and required token', () async {
      final res = await repository.applyFeedControl(
        reelId: 'reel-999',
        action: 'NOT_INTERESTED',
        interestId: 'distributed-systems',
      );

      expect(res['applied'], isTrue);
      expect(mockApiClient.lastReelIdPassed, 'reel-999');
      expect(mockApiClient.lastControlAction, 'NOT_INTERESTED');
      expect(mockApiClient.lastTokenPassed, 'valid_mock_jwt_token');
    });

    test('resetFeedPreferences passes required token to apiClient', () async {
      final res = await repository.resetFeedPreferences();

      expect(res['reset'], isTrue);
      expect(mockApiClient.resetPreferencesCalled, isTrue);
      expect(mockApiClient.lastTokenPassed, 'valid_mock_jwt_token');
    });
  });
}
