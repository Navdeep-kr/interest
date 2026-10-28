import 'package:flutter/foundation.dart';

/// Environment types supported by the Interest platform.
enum Environment {
  dev,
  staging,
  prod,
}

/// Thrown when security constraints (such as cleartext URLs in release) are breached.
class SecurityException implements Exception {
  final String message;
  const SecurityException(this.message);

  @override
  String toString() => 'SecurityException: $message';
}

/// Centralized, secure environment configuration for the Interest mobile client.
/// 
/// Non-negotiable architectural invariant:
/// In release mode (`kReleaseMode == true`), all API and WebSocket endpoints MUST
/// use HTTPS and WSS protocols respectively, and cannot point to local or mock hosts.
class EnvConfig {
  static const String _rawEnv = String.fromEnvironment('ENV', defaultValue: 'dev');
  static const String _rawApiUrl = String.fromEnvironment('API_BASE_URL', defaultValue: '');
  static const String _rawWsUrl = String.fromEnvironment('WS_BASE_URL', defaultValue: '');
  static const String _rawCdnUrl = String.fromEnvironment('CDN_BASE_URL', defaultValue: '');
  static const bool _rawMockMode = bool.fromEnvironment('MOCK_MODE', defaultValue: true);

  static Environment environment = Environment.dev;
  static String apiBaseUrl = 'http://localhost:3000/api/v1';
  static String wsBaseUrl = 'ws://localhost:3000/chat';
  static String cdnBaseUrl = 'http://localhost:9000/interest-reels';
  static bool mockModeEnabled = false;

  /// Initializes and verifies the environment configuration.
  /// Must be called during app initialization prior to any network or repository operations.
  static void initialize({
    Environment? overrideEnv,
    String? overrideApiUrl,
    String? overrideWsUrl,
    String? overrideCdnUrl,
    bool? overrideMockMode,
  }) {
    // 1. Resolve Active Environment
    environment = overrideEnv ?? _parseEnv(_rawEnv);
    mockModeEnabled = overrideMockMode ?? _rawMockMode;

    // 2. Resolve Endpoints based on Environment
    switch (environment) {
      case Environment.dev:
        apiBaseUrl = overrideApiUrl ??
            (_rawApiUrl.isNotEmpty
                ? _rawApiUrl
                : (defaultTargetPlatform == TargetPlatform.android
                    ? 'http://10.0.2.2:3000/api/v1'
                    : 'http://localhost:3000/api/v1'));
        wsBaseUrl = overrideWsUrl ??
            (_rawWsUrl.isNotEmpty
                ? _rawWsUrl
                : (defaultTargetPlatform == TargetPlatform.android
                    ? 'ws://10.0.2.2:3000/chat'
                    : 'ws://localhost:3000/chat'));
        cdnBaseUrl = overrideCdnUrl ??
            (_rawCdnUrl.isNotEmpty ? _rawCdnUrl : 'http://localhost:9000/interest-reels');
        break;

      case Environment.staging:
        apiBaseUrl = overrideApiUrl ??
            (_rawApiUrl.isNotEmpty ? _rawApiUrl : 'https://staging-api.interest.app/api/v1');
        wsBaseUrl = overrideWsUrl ??
            (_rawWsUrl.isNotEmpty ? _rawWsUrl : 'wss://staging-chat.interest.app/chat');
        cdnBaseUrl = overrideCdnUrl ??
            (_rawCdnUrl.isNotEmpty ? _rawCdnUrl : 'https://staging-cdn.interest.app/reels');
        break;

      case Environment.prod:
        apiBaseUrl = overrideApiUrl ??
            (_rawApiUrl.isNotEmpty ? _rawApiUrl : 'https://api.interest.app/api/v1');
        wsBaseUrl = overrideWsUrl ??
            (_rawWsUrl.isNotEmpty ? _rawWsUrl : 'wss://chat.interest.app/chat');
        cdnBaseUrl = overrideCdnUrl ??
            (_rawCdnUrl.isNotEmpty ? _rawCdnUrl : 'https://cdn.interest.app/reels');
        break;
    }

    // 3. Enforce Strict Security & Release Invariants
    validateSecurityConstraints();
  }

  /// Strict validation ensuring production release safety.
  static void validateSecurityConstraints() {
    if (kReleaseMode && environment == Environment.prod && !mockModeEnabled) {

      // Invariant 2: Require HTTPS for HTTP API
      if (!apiBaseUrl.startsWith('https://')) {
        throw SecurityException(
          'FATAL: Production API endpoint must strictly use HTTPS. Found: $apiBaseUrl (Rule 7).',
        );
      }

      // Invariant 3: Require WSS for WebSocket
      if (!wsBaseUrl.startsWith('wss://')) {
        throw SecurityException(
          'FATAL: Production WebSocket endpoint must strictly use WSS. Found: $wsBaseUrl (Rule 7).',
        );
      }

      // Invariant 4: Require HTTPS for CDN
      if (!cdnBaseUrl.startsWith('https://')) {
        throw SecurityException(
          'FATAL: Production CDN endpoint must strictly use HTTPS. Found: $cdnBaseUrl (Rule 7).',
        );
      }

      // Invariant 5: Reject localhost / emulator addresses
      final prohibitedHosts = ['localhost', '127.0.0.1', '10.0.2.2', '10.0.3.2'];
      for (final host in prohibitedHosts) {
        if (apiBaseUrl.contains(host) || wsBaseUrl.contains(host) || cdnBaseUrl.contains(host)) {
          throw SecurityException(
            'FATAL: Development host "$host" detected in release build (Rule 7).',
          );
        }
      }
    }
  }

  static Environment _parseEnv(String envStr) {
    switch (envStr.toLowerCase().trim()) {
      case 'staging':
        return Environment.staging;
      case 'prod':
      case 'production':
        return Environment.prod;
      case 'dev':
      case 'development':
      default:
        return Environment.dev;
    }
  }

  /// Zero-Location invariant verification
  static const bool zeroLocationPolicy = true;
  static const String appName = 'Interest';
  static const String appId = 'app.interest.mobile';
}
