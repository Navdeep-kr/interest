import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/profile/data/profile_api_client.dart';
import 'package:mobile/features/profile/data/profile_repository.dart';
import 'package:mobile/features/profile/domain/models/user_profile.dart';
import 'package:mobile/features/profile/domain/models/profile_reel_item.dart';
import 'package:mobile/features/profile/presentation/profile_notifier.dart';
import 'package:mobile/features/profile/presentation/profile_state.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';

class MockSecureStorageService implements SecureStorageService {
  @override
  Future<String?> getAccessToken() async => 'mock-jwt-token-xyz';
  @override
  Future<String?> getRefreshToken() async => 'mock-refresh-token';
  @override
  Future<String?> getSessionId() async => 'mock-session-id';
  @override
  Future<String?> getUserId() async => 'user-1';
  @override
  Future<String?> getUsername() async => 'testuser';
  @override
  Future<bool> hasActiveSession() async => true;
  @override
  Future<void> clearAll() async {}
  @override
  Future<void> saveAccessToken(String token) async {}
  @override
  Future<void> saveRefreshToken(String token) async {}
  @override
  Future<void> saveSessionId(String sessionId) async {}
  @override
  Future<void> saveUserId(String userId) async {}
  @override
  Future<void> saveUsername(String username) async {}
}

class FakeProfileRepository extends ProfileRepository {
  FakeProfileRepository()
      : super(
          apiClient: ProfileApiClient(baseUrl: 'https://api.interest.app/api/v1'),
          secureStorage: MockSecureStorageService(),
        );

  UserProfile mockProfile = const UserProfile(
    id: 'user-123',
    username: 'vector_coder',
    displayName: 'Vector Coder',
    bio: 'Coding zero-location feed architectures',
    reelsCount: 5,
    followersCount: 100,
    followingCount: 50,
    isPrivate: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  );

  List<ProfileReelItem> mockReels = [
    const ProfileReelItem(
      id: 'reel-1',
      creatorId: 'user-123',
      title: 'Neural Vectors in Dart',
      durationSeconds: 15.0,
      createdAt: '2026-01-01T00:00:00Z',
    ),
  ];

  bool followUserCalled = false;
  bool unfollowUserCalled = false;
  bool cancelFollowRequestCalled = false;
  bool restrictUserCalled = false;
  bool unrestrictUserCalled = false;

  @override
  Future<UserProfile> getProfile(String identifier) async => mockProfile;

  @override
  Future<UserProfile> getMyProfile() async => mockProfile;

  @override
  Future<List<ProfileReelItem>> getProfileReels(String userId, {int limit = 20, String? cursor}) async {
    return mockReels;
  }

  @override
  Future<Map<String, dynamic>> followUser(String userId) async {
    followUserCalled = true;
    if (mockProfile.isPrivate) {
      return {'following': false, 'requested': true, 'status': 'REQUESTED'};
    }
    return {'following': true, 'requested': false, 'status': 'FOLLOWING', 'isMutual': true};
  }

  @override
  Future<Map<String, dynamic>> unfollowUser(String userId) async {
    unfollowUserCalled = true;
    return {'following': false, 'requested': false, 'status': 'NOT_FOLLOWING'};
  }

  @override
  Future<Map<String, dynamic>> cancelFollowRequest(String userId) async {
    cancelFollowRequestCalled = true;
    return {'cancelled': true};
  }

  @override
  Future<Map<String, dynamic>> restrictUser(String userId) async {
    restrictUserCalled = true;
    return {'restricted': true};
  }

  @override
  Future<Map<String, dynamic>> unrestrictUser(String userId) async {
    unrestrictUserCalled = true;
    return {'restricted': false};
  }

  @override
  Future<UserProfile> updateProfile(Map<String, dynamic> data) async {
    mockProfile = mockProfile.copyWith(
      displayName: data['displayName'] as String?,
      bio: data['bio'] as String?,
    );
    return mockProfile;
  }
}

void main() {
  late FakeProfileRepository repo;
  late ProfileNotifier notifier;

  setUp(() {
    repo = FakeProfileRepository();
    notifier = ProfileNotifier(repository: repo);
  });

  group('ProfileNotifier State Machine Tests', () {
    test('initial state should be ProfileInitialState', () {
      expect(notifier.state, isA<ProfileInitialState>());
    });

    test('loadProfile should transition to ProfileLoadedState with profile and reels', () async {
      await notifier.loadProfile('vector_coder');

      expect(notifier.state, isA<ProfileLoadedState>());
      final state = notifier.state as ProfileLoadedState;
      expect(state.profile.username, 'vector_coder');
      expect(state.reels.length, 1);
      expect(state.reels[0].title, 'Neural Vectors in Dart');
    });

    test('toggleFollow should follow public account and update followers count', () async {
      await notifier.loadProfile('vector_coder');
      expect((notifier.state as ProfileLoadedState).profile.isFollowing, false);

      await notifier.toggleFollow();

      expect(repo.followUserCalled, true);
      final state = notifier.state as ProfileLoadedState;
      expect(state.profile.isFollowing, true);
      expect(state.profile.isMutual, true);
      expect(state.profile.followersCount, 101);
    });

    test('toggleFollow should create pending request when target account is private', () async {
      repo.mockProfile = repo.mockProfile.copyWith(isPrivate: true);
      await notifier.loadProfile('vector_coder');

      await notifier.toggleFollow();

      expect(repo.followUserCalled, true);
      final state = notifier.state as ProfileLoadedState;
      expect(state.profile.isFollowing, false);
      expect(state.profile.hasPendingRequest, true);
    });

    test('toggleFollow should cancel request if hasPendingRequest is true', () async {
      repo.mockProfile = repo.mockProfile.copyWith(hasPendingRequest: true);
      await notifier.loadProfile('vector_coder');

      await notifier.toggleFollow();

      expect(repo.cancelFollowRequestCalled, true);
      final state = notifier.state as ProfileLoadedState;
      expect(state.profile.hasPendingRequest, false);
    });

    test('toggleFollow should unfollow if already following', () async {
      repo.mockProfile = repo.mockProfile.copyWith(isFollowing: true, followersCount: 100);
      await notifier.loadProfile('vector_coder');

      await notifier.toggleFollow();

      expect(repo.unfollowUserCalled, true);
      final state = notifier.state as ProfileLoadedState;
      expect(state.profile.isFollowing, false);
      expect(state.profile.followersCount, 99);
    });

    test('toggleRestrict should alternate between restricted and unrestricted states', () async {
      await notifier.loadProfile('vector_coder');
      expect((notifier.state as ProfileLoadedState).profile.isRestricted, false);

      await notifier.toggleRestrict();
      expect(repo.restrictUserCalled, true);
      expect((notifier.state as ProfileLoadedState).profile.isRestricted, true);

      await notifier.toggleRestrict();
      expect(repo.unrestrictUserCalled, true);
      expect((notifier.state as ProfileLoadedState).profile.isRestricted, false);
    });

    test('updateProfile should update local state with new profile attributes', () async {
      await notifier.loadProfile('vector_coder');

      await notifier.updateProfile({
        'displayName': 'AI Agent Engineer',
        'bio': 'Zero-Location architect',
      });

      final state = notifier.state as ProfileLoadedState;
      expect(state.profile.displayName, 'AI Agent Engineer');
      expect(state.profile.bio, 'Zero-Location architect');
    });

    test('switchTab should update selected tab', () async {
      await notifier.loadProfile('vector_coder');

      await notifier.switchTab('saved');
      expect((notifier.state as ProfileLoadedState).selectedTab, 'saved');
    });
  });
}
