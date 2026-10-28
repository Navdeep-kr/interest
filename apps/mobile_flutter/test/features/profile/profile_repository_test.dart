import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/profile/data/profile_api_client.dart';
import 'package:mobile/features/profile/data/profile_repository.dart';
import 'package:mobile/features/profile/domain/models/user_profile.dart';
import 'package:mobile/features/profile/domain/models/follow_request_item.dart';
import 'package:mobile/core/error/failures.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';

class MockSecureStorageService implements SecureStorageService {
  String? token = 'jwt-secure-token-123';

  @override
  Future<String?> getAccessToken() async => token;
  @override
  Future<String?> getRefreshToken() async => 'refresh-token';
  @override
  Future<String?> getSessionId() async => 'sess-123';
  @override
  Future<String?> getUserId() async => 'user-1';
  @override
  Future<String?> getUsername() async => 'testuser';
  @override
  Future<bool> hasActiveSession() async => token != null;
  @override
  Future<void> clearAll() async => token = null;
  @override
  Future<void> saveAccessToken(String t) async => token = t;
  @override
  Future<void> saveRefreshToken(String token) async {}
  @override
  Future<void> saveSessionId(String sessionId) async {}
  @override
  Future<void> saveUserId(String userId) async {}
  @override
  Future<void> saveUsername(String username) async {}
}

class FakeProfileApiClient extends ProfileApiClient {
  FakeProfileApiClient() : super(baseUrl: 'https://api.interest.app/api/v1');

  String? lastTokenPassed;

  @override
  Future<UserProfile> getMyProfile({required String token}) async {
    lastTokenPassed = token;
    return const UserProfile(
      id: 'user-me',
      username: 'my_account',
      displayName: 'My Account',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    );
  }

  @override
  Future<UserProfile> getProfile(String identifier, {String? token}) async {
    lastTokenPassed = token;
    return UserProfile(
      id: 'user-public',
      username: identifier,
      displayName: 'Public User',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    );
  }

  @override
  Future<UserProfile> updateProfile(Map<String, dynamic> data, {required String token}) async {
    lastTokenPassed = token;
    return UserProfile(
      id: 'user-me',
      username: data['username'] as String? ?? 'my_account',
      displayName: data['displayName'] as String? ?? 'Updated Name',
      bio: data['bio'] as String?,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    );
  }

  @override
  Future<List<FollowRequestItem>> getPendingFollowRequests({
    required String token,
    int limit = 20,
    int offset = 0,
  }) async {
    lastTokenPassed = token;
    return [
      const FollowRequestItem(
        id: 'req-1',
        requesterId: 'user-req-1',
        username: 'requester_one',
        displayName: 'Requester One',
        status: 'PENDING',
        createdAt: '2026-01-01T00:00:00Z',
      ),
    ];
  }

  @override
  Future<Map<String, dynamic>> respondFollowRequest(
    String requestId,
    String action, {
    required String token,
  }) async {
    lastTokenPassed = token;
    return {'success': true, 'action': action, 'requestId': requestId};
  }
}

void main() {
  late MockSecureStorageService storage;
  late FakeProfileApiClient apiClient;
  late ProfileRepository repository;

  setUp(() {
    storage = MockSecureStorageService();
    apiClient = FakeProfileApiClient();
    repository = ProfileRepository(apiClient: apiClient, secureStorage: storage);
  });

  group('ProfileRepository Tests', () {
    test('getMyProfile should retrieve token from secure storage and call API', () async {
      final profile = await repository.getMyProfile();

      expect(profile.username, 'my_account');
      expect(apiClient.lastTokenPassed, 'jwt-secure-token-123');
    });

    test('getMyProfile should throw AuthenticationFailure when no token exists', () async {
      storage.token = null;

      expect(
        () => repository.getMyProfile(),
        throwsA(isA<AuthenticationFailure>()),
      );
    });

    test('updateProfile should attach auth token and update profile', () async {
      final updated = await repository.updateProfile({
        'displayName': 'Super Creator',
        'bio': 'High performance coding',
      });

      expect(updated.displayName, 'Super Creator');
      expect(updated.bio, 'High performance coding');
      expect(apiClient.lastTokenPassed, 'jwt-secure-token-123');
    });

    test('getPendingFollowRequests should return list of incoming requests', () async {
      final requests = await repository.getPendingFollowRequests();

      expect(requests.length, 1);
      expect(requests[0].username, 'requester_one');
      expect(requests[0].status, 'PENDING');
      expect(apiClient.lastTokenPassed, 'jwt-secure-token-123');
    });

    test('respondFollowRequest should process ACCEPT or REJECT action', () async {
      final res = await repository.respondFollowRequest('req-1', 'ACCEPT');

      expect(res['success'], true);
      expect(res['action'], 'ACCEPT');
      expect(apiClient.lastTokenPassed, 'jwt-secure-token-123');
    });
  });
}
