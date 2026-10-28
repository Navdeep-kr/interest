import 'package:flutter/foundation.dart';
import '../../../core/error/failures.dart';
import '../data/auth_repository.dart';
import '../domain/models/auth_user.dart';
import 'auth_state.dart';

class AuthNotifier extends ChangeNotifier {
  final AuthRepository repository;

  AuthState _state = const AuthInitialState();
  AuthState get state => _state;

  AuthUser? get currentUser => repository.currentUser;

  AuthNotifier({required this.repository});

  void _setState(AuthState newState) {
    _state = newState;
    notifyListeners();
  }

  /// Cold start session validation.
  Future<void> checkInitialSession() async {
    _setState(const AuthLoadingState(message: 'Restoring session...'));
    try {
      final user = await repository.checkSession();
      if (user != null) {
        _setState(AuthenticatedState(user));
      } else {
        _setState(const UnauthenticatedState());
      }
    } catch (_) {
      _setState(const UnauthenticatedState());
    }
  }

  /// Sign in flow with rate limiting and deactivation recovery.
  Future<bool> login(String identifier, String password) async {
    _setState(const AuthLoadingState(message: 'Signing in...'));
    try {
      final user = await repository.login(
        identifier: identifier.trim(),
        password: password,
      );
      _setState(AuthenticatedState(user));
      return true;
    } on AccountDeactivatedFailure {
      _setState(AccountDeactivatedState(identifier.trim()));
      return false;
    } on RateLimitFailure catch (e) {
      _setState(AuthErrorState(
        message: e.message,
        retryAfterSeconds: e.retryAfterSeconds,
      ));
      return false;
    } on Failure catch (e) {
      _setState(AuthErrorState(message: e.message));
      return false;
    } catch (e) {
      _setState(AuthErrorState(message: 'Unexpected sign in error: $e'));
      return false;
    }
  }

  /// Sign up flow with COPPA age gate defense.
  Future<bool> register({
    required String username,
    required String displayName,
    required String password,
    required String birthdate,
    String? email,
    String? phoneNumber,
  }) async {
    _setState(const AuthLoadingState(message: 'Creating account...'));
    try {
      final user = await repository.register(
        username: username.trim(),
        displayName: displayName.trim(),
        password: password,
        birthdate: birthdate.trim(),
        email: email?.trim(),
        phoneNumber: phoneNumber?.trim(),
      );
      _setState(AuthenticatedState(user));
      return true;
    } on CoppaAgeGateFailure catch (e) {
      _setState(AuthErrorState(message: e.message, isCoppaViolation: true));
      return false;
    } on RateLimitFailure catch (e) {
      _setState(AuthErrorState(
        message: e.message,
        retryAfterSeconds: e.retryAfterSeconds,
      ));
      return false;
    } on Failure catch (e) {
      _setState(AuthErrorState(message: e.message));
      return false;
    } catch (e) {
      _setState(AuthErrorState(message: 'Registration failed: $e'));
      return false;
    }
  }

  /// Reactivate a previously deactivated account.
  Future<bool> reactivateAccount(String identifier, String password) async {
    _setState(const AuthLoadingState(message: 'Reactivating account...'));
    try {
      final user = await repository.reactivateAccount(
        identifier: identifier.trim(),
        password: password,
      );
      _setState(AuthenticatedState(user));
      return true;
    } on Failure catch (e) {
      _setState(AuthErrorState(message: e.message));
      return false;
    }
  }

  /// Password change with reauthentication.
  Future<bool> changePassword(String currentPassword, String newPassword) async {
    _setState(const AuthLoadingState(message: 'Updating password...'));
    try {
      await repository.changePassword(
        currentPassword: currentPassword,
        newPassword: newPassword,
      );
      _setState(const UnauthenticatedState());
      return true;
    } on Failure catch (e) {
      _setState(AuthErrorState(message: e.message));
      return false;
    }
  }

  /// Account deactivation with reauthentication.
  Future<bool> deactivateAccount(String password, {String? reason}) async {
    _setState(const AuthLoadingState(message: 'Deactivating account...'));
    try {
      await repository.deactivateAccount(password: password, reason: reason);
      _setState(const UnauthenticatedState());
      return true;
    } on Failure catch (e) {
      _setState(AuthErrorState(message: e.message));
      return false;
    }
  }

  /// Sign out and clear all secure storage.
  Future<void> logout() async {
    _setState(const AuthLoadingState(message: 'Signing out...'));
    await repository.logout();
    _setState(const UnauthenticatedState());
  }

  /// Clear errors and return to UnauthenticatedState.
  void clearError() {
    if (_state is AuthErrorState || _state is AccountDeactivatedState) {
      _setState(const UnauthenticatedState());
    }
  }
}
