import '../domain/models/auth_user.dart';

abstract class AuthState {
  const AuthState();
}

class AuthInitialState extends AuthState {
  const AuthInitialState();
}

class UnauthenticatedState extends AuthState {
  const UnauthenticatedState();
}

class AuthLoadingState extends AuthState {
  final String? message;
  const AuthLoadingState({this.message});
}

class AuthenticatedState extends AuthState {
  final AuthUser user;
  const AuthenticatedState(this.user);
}

class AccountDeactivatedState extends AuthState {
  final String identifier;
  const AccountDeactivatedState(this.identifier);
}

class SessionExpiredState extends AuthState {
  final String message;
  const SessionExpiredState({this.message = 'Your session has expired. Please sign in again.'});
}

class AuthErrorState extends AuthState {
  final String message;
  final int? retryAfterSeconds;
  final bool isCoppaViolation;

  const AuthErrorState({
    required this.message,
    this.retryAfterSeconds,
    this.isCoppaViolation = false,
  });
}
