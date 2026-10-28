/// Core domain failures used throughout the presentation layer.
abstract class Failure {
  final String message;
  final int? statusCode;

  const Failure(this.message, [this.statusCode]);

  @override
  String toString() => '$runtimeType: $message (Status: $statusCode)';
}

class ServerFailure extends Failure {
  const ServerFailure({String message = 'Internal server error occurred.', int? statusCode})
      : super(message, statusCode);
}

class NetworkFailure extends Failure {
  const NetworkFailure({String message = 'Network connection unavailable. Please check your internet.'})
      : super(message);
}

class AuthFailure extends Failure {
  const AuthFailure({required String message, int? statusCode}) : super(message, statusCode);
}

class AuthenticationFailure extends AuthFailure {
  const AuthenticationFailure({required super.message, super.statusCode});
}

class AuthorizationFailure extends AuthFailure {
  const AuthorizationFailure({required super.message, super.statusCode});
}

class SessionExpiredFailure extends AuthFailure {
  const SessionExpiredFailure({required super.message, super.statusCode});
}

class AccountDeactivatedFailure extends AuthFailure {
  const AccountDeactivatedFailure({required super.message, super.statusCode});
}

class RateLimitFailure extends Failure {
  final int? retryAfterSeconds;
  const RateLimitFailure({required String message, this.retryAfterSeconds, int? statusCode})
      : super(message, statusCode);
}

class CoppaAgeGateFailure extends Failure {
  const CoppaAgeGateFailure({required String message, int? statusCode})
      : super(message, statusCode);
}

class ValidationFailure extends Failure {
  const ValidationFailure({required String message, int? statusCode})
      : super(message, statusCode);
}

class NotFoundFailure extends Failure {
  const NotFoundFailure({required String message, int? statusCode})
      : super(message, statusCode);
}

class SecurityFailure extends Failure {
  const SecurityFailure({required String message, int? statusCode})
      : super(message, statusCode);
}

class StorageFailure extends Failure {
  const StorageFailure({required String message, int? statusCode})
      : super(message, statusCode);
}

