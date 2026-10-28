import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/failures.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';
import 'package:mobile/features/auth/data/auth_api_client.dart';
import 'package:mobile/features/auth/data/auth_repository.dart';
import 'package:mobile/features/auth/domain/models/auth_tokens.dart';
import 'package:mobile/features/auth/domain/models/auth_user.dart';
import 'package:mobile/features/auth/presentation/auth_notifier.dart';
import 'package:mobile/features/auth/presentation/auth_state.dart';

class MockAuthApiClient extends AuthApiClient {
  @override
  Future<AuthResponse> login(String identifier, String password, {String? deviceName}) async {
    if (identifier == 'inactive_user') {
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
  Future<void> logout(String token, String? sessionId) async {}
}

void main() {
  group('AuthNotifier State Machine Tests', () {
    late AuthNotifier notifier;
    late AuthRepository repository;
    late SecureStorageService secureStorage;

    setUp(() {
      secureStorage = PlatformSecureStorageService();
      repository = AuthRepository(
        apiClient: MockAuthApiClient(),
        secureStorage: secureStorage,
      );
      notifier = AuthNotifier(repository: repository);
    });

    test('initial state should be AuthInitialState', () {
      expect(notifier.state, isA<AuthInitialState>());
    });

    test('checkInitialSession should set UnauthenticatedState when storage is empty', () async {
      await notifier.checkInitialSession();
      expect(notifier.state, isA<UnauthenticatedState>());
    });

    test('login should set AuthenticatedState on success', () async {
      final success = await notifier.login('alice', 'ValidPassword123!');
      expect(success, isTrue);
      expect(notifier.state, isA<AuthenticatedState>());
      expect((notifier.state as AuthenticatedState).user.username, equals('alice'));
    });

    test('login should set AccountDeactivatedState on inactive account', () async {
      final success = await notifier.login('inactive_user', 'Pass123!');
      expect(success, isFalse);
      expect(notifier.state, isA<AccountDeactivatedState>());
      expect((notifier.state as AccountDeactivatedState).identifier, equals('inactive_user'));
    });

    test('register should set AuthErrorState with isCoppaViolation true when underage', () async {
      final now = DateTime.now();
      final underageDate = '${now.year - 9}-01-01'; // 9 years old

      final success = await notifier.register(
        username: 'kiddo',
        displayName: 'Kiddo',
        password: 'Password123!',
        birthdate: underageDate,
      );

      expect(success, isFalse);
      expect(notifier.state, isA<AuthErrorState>());
      final errorState = notifier.state as AuthErrorState;
      expect(errorState.isCoppaViolation, isTrue);
      expect(errorState.message, contains('COPPA'));
    });

    test('logout should transition to UnauthenticatedState', () async {
      await notifier.login('alice', 'ValidPassword123!');
      expect(notifier.state, isA<AuthenticatedState>());

      await notifier.logout();
      expect(notifier.state, isA<UnauthenticatedState>());
    });
  });
}
