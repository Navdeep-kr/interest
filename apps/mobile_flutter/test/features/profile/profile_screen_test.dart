import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/profile/presentation/screens/profile_screen.dart';
import 'package:mobile/features/profile/presentation/profile_notifier.dart';
import 'package:mobile/features/profile/domain/models/user_profile.dart';
import 'package:mobile/features/profile/domain/models/profile_reel_item.dart';
import 'package:mobile/features/profile/data/profile_repository.dart';
import 'package:mobile/features/profile/data/profile_api_client.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';

class MockSecureStorageService implements SecureStorageService {
  @override
  Future<String?> getAccessToken() async => 'mock-token';
  @override
  Future<String?> getRefreshToken() async => null;
  @override
  Future<String?> getSessionId() async => null;
  @override
  Future<String?> getUserId() async => null;
  @override
  Future<String?> getUsername() async => null;
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

  UserProfile profileToReturn = const UserProfile(
    id: 'user-id-1',
    username: 'antigravity_dev',
    displayName: 'Antigravity Dev',
    bio: 'Zero-Location architect crafting distributed social engines',
    reelsCount: 12,
    followersCount: 1200,
    followingCount: 300,
    isPrivate: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  );

  @override
  Future<UserProfile> getProfile(String identifier) async => profileToReturn;

  @override
  Future<UserProfile> getMyProfile() async => profileToReturn;

  @override
  Future<List<ProfileReelItem>> getProfileReels(String userId, {int limit = 20, String? cursor}) async {
    return [
      const ProfileReelItem(
        id: 'reel-101',
        creatorId: 'user-id-1',
        title: 'Building 512-dim Vector Discovery',
        durationSeconds: 30.0,
        viewCount: 4500,
        createdAt: '2026-01-01T00:00:00Z',
      ),
    ];
  }
}

void main() {
  late FakeProfileRepository repository;
  late ProfileNotifier notifier;

  setUp(() {
    repository = FakeProfileRepository();
    notifier = ProfileNotifier(repository: repository);
  });

  Widget createTestWidget({required bool isMe}) {
    return MaterialApp(
      home: ProfileScreen(
        notifier: notifier,
        identifier: 'antigravity_dev',
        isMe: isMe,
      ),
    );
  }

  testWidgets('ProfileScreen renders profile header, bio, stats, and reels grid', (tester) async {
    await tester.pumpWidget(createTestWidget(isMe: true));
    await tester.pumpAndSettle();

    expect(find.text('@antigravity_dev'), findsWidgets);
    expect(find.text('Antigravity Dev'), findsOneWidget);
    expect(
      find.text('Zero-Location architect crafting distributed social engines'),
      findsOneWidget,
    );
    expect(find.text('Reels'), findsWidgets);
    expect(find.text('Followers'), findsOneWidget);
    expect(find.text('Following'), findsOneWidget);
    expect(find.text('Edit Profile'), findsOneWidget);
    expect(find.text('Building 512-dim Vector Discovery'), findsOneWidget);
  });

  testWidgets('ProfileScreen displays Follow button when viewing another user profile', (tester) async {
    await tester.pumpWidget(createTestWidget(isMe: false));
    await tester.pumpAndSettle();

    expect(find.text('Follow'), findsOneWidget);
    expect(find.text('Edit Profile'), findsNothing);
  });

  testWidgets('ProfileScreen displays private account gate when account is private and viewer is not following', (tester) async {
    repository.profileToReturn = repository.profileToReturn.copyWith(
      isPrivate: true,
      isFollowing: false,
    );

    await tester.pumpWidget(createTestWidget(isMe: false));
    await tester.pumpAndSettle();

    expect(find.text('This Account is Private'), findsOneWidget);
    expect(
      find.text('Follow this account to see their published reels and collections.'),
      findsOneWidget,
    );
  });
}
