import 'dart:developer' as developer;
import 'package:flutter/foundation.dart';

/// Structured logging utility with sensitive data redaction.
class AppLogger {
  static const String _tag = 'Interest';

  /// Log debug messages (suppressed in release mode)
  static void debug(String message, {String? tag}) {
    if (kDebugMode) {
      _log('DEBUG', _sanitize(message), tag: tag);
    }
  }

  /// Log informational messages
  static void info(String message, {String? tag}) {
    if (!kReleaseMode) {
      _log('INFO', _sanitize(message), tag: tag);
    }
  }

  /// Log warnings
  static void warn(String message, {Object? error, StackTrace? stackTrace, String? tag}) {
    _log('WARN', _sanitize(message), error: error, stackTrace: stackTrace, tag: tag);
  }

  /// Log errors (always logged)
  static void error(String message, {Object? error, StackTrace? stackTrace, String? tag}) {
    _log('ERROR', _sanitize(message), error: error, stackTrace: stackTrace, tag: tag);
  }

  static void _log(
    String level,
    String message, {
    Object? error,
    StackTrace? stackTrace,
    String? tag,
  }) {
    final timestamp = DateTime.now().toIso8601String();
    final logTag = tag != null ? '$_tag:$tag' : _tag;
    developer.log(
      '[$timestamp] [$level] $message',
      name: logTag,
      error: error,
      stackTrace: stackTrace,
    );
  }

  /// Sanitizes sensitive session tokens, passwords, and API keys
  static String _sanitize(String input) {
    var sanitized = input;
    // Redact Bearer tokens
    sanitized = sanitized.replaceAll(
      RegExp(r'Bearer\s+[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.?[A-Za-z0-9\-_=]*'),
      'Bearer [REDACTED_JWT]',
    );
    // Redact password fields
    sanitized = sanitized.replaceAll(
      RegExp(r'password["\s:=]+[^,\s"}]+', caseSensitive: false),
      'password: "[REDACTED]"',
    );
    // Redact refresh tokens
    sanitized = sanitized.replaceAll(
      RegExp(r'refreshToken["\s:=]+[^,\s"}]+', caseSensitive: false),
      'refreshToken: "[REDACTED]"',
    );
    return sanitized;
  }
}
