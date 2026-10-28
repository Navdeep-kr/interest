import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/failures.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';
import 'package:mobile/features/auth/data/auth_api_client.dart';
import 'package:mobile/features/auth/data/auth_repository.dart';
import 'package:mobile/features/auth/domain/models/auth_tokens.dart';
import 'package:mobile/features/auth/domain/models/auth_user.dart';

class MockAuthApiClient extends AuthApiClient {
  @override
  Future<AuthResponse> login(String identifier, String password, {String? deviceName}) async {
    if (password == 'WrongPassword!') {
      throw const AuthenticationFailure(message: 'Invalid credentials.');
    }
    if (identifier == 'deactivated_user') {
      throw const AccountDeactivatedFailure(message: 'Account is deactivated.');
    }
    return AuthResponse(
      user: const AuthUser(id: 'u-1', username: 'alice', displayName: 'Alice'),
      tokens: AuthTokens(accessToken: 'mock.access', refreshToken: 'mock.refresh'),
    );
  }

  @override
  Future<AuthResponse> register({
    required String username,
    required String displayName,
    required String password,
    required String birthdate,
    String? email,
    String? phoneNumber,
    String? deviceName,
  }) async {
    return AuthResponse(
      user: AuthUser(id: 'u-new', username: username, displayName: displayName),
      tokens: AuthTokens(accessToken: 'new.access', refreshToken: 'new.refresh'),
    );
  }

  @override
  Future<AuthTokens> refreshToken(String refreshToken, {String? deviceName}) async {
    if (refreshToken == 'expired.refresh') {
      throw const AuthenticationFailure(message: 'Session revoked.');
    }
    return AuthTokens(accessToken: 'refreshed.access', refreshToken: 'refreshed.refresh');
  }

  @override
  Future<void> logout(String token, String? sessionId) async {}

  @override
  Future<void> changePassword(String token, String currentPassword, String newPassword) async {
    if (currentPassword == 'WrongCurrent!') {
      throw const AuthenticationFailure(message: 'Current password does not match.');
    }
  }
}

void main() {
  group('AuthRepository Integration & Security Tests', () {
    late AuthRepository repository;
    late SecureStorageService secureStorage;
    late MockAuthApiClient apiClient;

    setUp(() {
      secureStorage = PlatformSecureStorageService();
      apiClient = MockAuthApiClient();
      repository = AuthRepository(
        apiClient: apiClient,
        secureStorage: secureStorage,
      );
    });

    test('should reject registration when birthdate indicates age < 13 (COPPA)', () {
      final now = DateTime.now();
      final underageBirthdate = '${now.year - 10}-01-01'; // 10 years old

      expect(
        () => repository.validateAgeGate(underageBirthdate),
        throwsA(isA<CoppaAgeGateFailure>()),
      );
    });

    test('should accept registration when birthdate indicates age >= 13', () {
      final now = DateTime.now();
      final compliantBirthdate = '${now.year - 18}-01-01'; // 18 years old

      expect(() => repository.validateAgeGate(compliantBirthdate), returnsNormally);
    });

    test('should successfully login and securely store session tokens', () async {
      final user = await repository.login(
        identifier: 'alice',
        password: 'ValidPassword123!',
      );

      expect(user.username, equals('alice'));
      expect(await secureStorage.getAccessToken(), equals('mock.access'));
      expect(await secureStorage.getRefreshToken(), equals('mock.refresh'));
      expect(await secureStorage.hasActiveSession(), isTrue);
    });

    test('should throw AuthenticationFailure on invalid login credentials', () async {
      await expectLater(
        repository.login(
          identifier: 'alice',
          password: 'WrongPassword!',
        ),
        throwsA(isA<AuthenticationFailure>()),
      );
      expect(await secureStorage.hasActiveSession(), isFalse);
    });

    test('should throw AccountDeactivatedFailure on deactivated account login', () async {
      await expectLater(
        repository.login(
          identifier: 'deactivated_user',
          password: 'CorrectPass!',
        ),
        throwsA(isA<AccountDeactivatedFailure>()),
      );
    });

    test('should refresh tokens and update secure storage', () async {
      await secureStorage.saveAccessToken('old.access');
      await secureStorage.saveRefreshToken('valid.refresh');

      final tokens = await repository.refreshSession();

      expect(tokens.accessToken, equals('refreshed.access'));
      expect(await secureStorage.getAccessToken(), equals('refreshed.access'));
    });

    test('should wipe credentials when refresh token is revoked on server', () async {
      await secureStorage.saveAccessToken('old.access');
      await secureStorage.saveRefreshToken('expired.refresh');

      await expectLater(
        repository.refreshSession(),
        throwsA(isA<SessionExpiredFailure>()),
      );
      expect(await secureStorage.hasActiveSession(), isFalse);
    });

    test('should wipe credentials on logout', () async {
      await secureStorage.saveAccessToken('token');
      await secureStorage.saveRefreshToken('refresh');

      await repository.logout();

      expect(await secureStorage.hasActiveSession(), isFalse);
      expect(repository.currentUser, isNull);
    });
  });
}
