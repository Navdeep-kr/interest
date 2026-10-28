import '../../../core/config/env_config.dart';
import '../../../core/error/failures.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../domain/models/auth_tokens.dart';
import '../domain/models/auth_user.dart';
import '../domain/models/user_session.dart';
import 'auth_api_client.dart';

class AuthRepository {
  final AuthApiClient apiClient;
  final SecureStorageService secureStorage;

  AuthUser? _currentUser;
  AuthUser? get currentUser => _currentUser;

  AuthRepository({
    required this.apiClient,
    required this.secureStorage,
  });

  /// Evaluates age against COPPA minimum age threshold (< 13 years blocked).
  void validateAgeGate(String birthdateStr) {
    final birthDate = DateTime.tryParse(birthdateStr);
    if (birthDate == null) {
      throw const ValidationFailure(message: 'Please provide a valid birthdate.');
    }

    final today = DateTime.now();
    int age = today.year - birthDate.year;
    if (today.month < birthDate.month ||
        (today.month == birthDate.month && today.day < birthDate.day)) {
      age--;
    }

    if (age < 13) {
      throw const CoppaAgeGateFailure(
        message: 'You must be at least 13 years old to use Interest (COPPA Compliance).',
      );
    }
  }

  /// Authenticates user and securely stores tokens.
  Future<AuthUser> login({
    required String identifier,
    required String password,
    String? deviceName,
  }) async {
    final response = await apiClient.login(
      identifier,
      password,
      deviceName: deviceName ?? 'Mobile App',
    );

    await secureStorage.saveAccessToken(response.tokens.accessToken);
    await secureStorage.saveRefreshToken(response.tokens.refreshToken);
    await secureStorage.saveUserId(response.user.id);
    await secureStorage.saveUsername(response.user.username);

    _currentUser = response.user;
    return response.user;
  }

  /// Registers user account with COPPA age gate validation.
  Future<AuthUser> register({
    required String username,
    required String displayName,
    required String password,
    required String birthdate,
    String? email,
    String? phoneNumber,
    String? deviceName,
  }) async {
    // Client-side COPPA age gate defense
    validateAgeGate(birthdate);

    final response = await apiClient.register(
      username: username,
      displayName: displayName,
      password: password,
      birthdate: birthdate,
      email: email,
      phoneNumber: phoneNumber,
      deviceName: deviceName ?? 'Mobile App',
    );

    await secureStorage.saveAccessToken(response.tokens.accessToken);
    await secureStorage.saveRefreshToken(response.tokens.refreshToken);
    await secureStorage.saveUserId(response.user.id);
    await secureStorage.saveUsername(response.user.username);

    _currentUser = response.user;
    return response.user;
  }

  /// Proactively refreshes expired access tokens using the refresh token.
  Future<AuthTokens> refreshSession() async {
    final refreshToken = await secureStorage.getRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) {
      await secureStorage.clearAll();
      throw const SessionExpiredFailure(message: 'No refresh token available. Session expired.');
    }

    try {
      final tokens = await apiClient.refreshToken(refreshToken);
      await secureStorage.saveAccessToken(tokens.accessToken);
      await secureStorage.saveRefreshToken(tokens.refreshToken);
      return tokens;
    } on AuthenticationFailure {
      await secureStorage.clearAll();
      _currentUser = null;
      throw const SessionExpiredFailure(message: 'Session has been revoked or expired. Please log in.');
    }
  }

  /// Checks if an active session exists upon app cold start.
  Future<AuthUser?> checkSession() async {
    final hasSession = await secureStorage.hasActiveSession();
    if (!hasSession) {
      return null;
    }

    if (EnvConfig.mockModeEnabled) {
      _currentUser = const AuthUser(
        id: 'usr_creator_mock',
        username: 'interest_creator',
        displayName: 'Interest Creator',
        email: 'creator@interest.app',
        role: 'CREATOR',
      );
      return _currentUser;
    }

    final userId = await secureStorage.getUserId();
    final username = await secureStorage.getUsername();

    if (userId == null || username == null) {
      await secureStorage.clearAll();
      return null;
    }

    try {
      // Refresh token on cold start to verify validity
      await refreshSession();
      _currentUser = AuthUser(
        id: userId,
        username: username,
        displayName: username,
      );
      return _currentUser;
    } catch (_) {
      await secureStorage.clearAll();
      _currentUser = null;
      return null;
    }
  }

  /// Logs out and revokes active device session on the server.
  Future<void> logout() async {
    final token = await secureStorage.getAccessToken();
    final sessionId = await secureStorage.getSessionId();

    if (token != null) {
      try {
        await apiClient.logout(token, sessionId);
      } catch (_) {
        // Continue clearing client credentials regardless of network failure
      }
    }

    await secureStorage.clearAll();
    _currentUser = null;
  }

  /// Sensitive operation: Changes user password with current password reauthentication.
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final token = await secureStorage.getAccessToken();
    if (token == null) {
      throw const AuthenticationFailure(message: 'Authentication required.');
    }

    await apiClient.changePassword(token, currentPassword, newPassword);
    // Invalidate local session since server revokes all sessions on password change
    await secureStorage.clearAll();
    _currentUser = null;
  }

  /// Sensitive operation: Deactivates user account with password reauthentication.
  Future<void> deactivateAccount({
    required String password,
    String? reason,
  }) async {
    final token = await secureStorage.getAccessToken();
    if (token == null) {
      throw const AuthenticationFailure(message: 'Authentication required.');
    }

    await apiClient.deactivateAccount(token, password, reason: reason);
    await secureStorage.clearAll();
    _currentUser = null;
  }

  /// Restores access to a deactivated account.
  Future<AuthUser> reactivateAccount({
    required String identifier,
    required String password,
  }) async {
    final response = await apiClient.reactivateAccount(identifier, password);

    await secureStorage.saveAccessToken(response.tokens.accessToken);
    await secureStorage.saveRefreshToken(response.tokens.refreshToken);
    await secureStorage.saveUserId(response.user.id);
    await secureStorage.saveUsername(response.user.username);

    _currentUser = response.user;
    return response.user;
  }

  /// Fetches active user sessions across all devices.
  Future<List<UserSession>> getSessions() async {
    final token = await secureStorage.getAccessToken();
    if (token == null) {
      throw const AuthenticationFailure(message: 'Authentication required.');
    }

    return apiClient.getSessions(token);
  }

  /// Remotely revokes a specific device session.
  Future<void> revokeSession(String sessionId) async {
    final token = await secureStorage.getAccessToken();
    if (token == null) {
      throw const AuthenticationFailure(message: 'Authentication required.');
    }

    await apiClient.revokeSession(token, sessionId);
  }
}
