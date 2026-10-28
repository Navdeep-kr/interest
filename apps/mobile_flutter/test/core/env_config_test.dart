import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/config/env_config.dart';

void main() {
  group('EnvConfig Tests', () {
    test('Default initialization resolves development endpoints', () {
      EnvConfig.initialize(overrideEnv: Environment.dev);

      expect(EnvConfig.environment, equals(Environment.dev));
      expect(EnvConfig.apiBaseUrl, contains('/api/v1'));
      expect(EnvConfig.wsBaseUrl, contains('/chat'));
      expect(EnvConfig.zeroLocationPolicy, isTrue);
      expect(EnvConfig.appId, equals('app.interest.mobile'));
    });

    test('Staging initialization resolves HTTPS and WSS endpoints', () {
      EnvConfig.initialize(overrideEnv: Environment.staging);

      expect(EnvConfig.environment, equals(Environment.staging));
      expect(EnvConfig.apiBaseUrl, startsWith('https://'));
      expect(EnvConfig.wsBaseUrl, startsWith('wss://'));
      expect(EnvConfig.cdnBaseUrl, startsWith('https://'));
    });

    test('Production initialization resolves HTTPS and WSS endpoints', () {
      EnvConfig.initialize(overrideEnv: Environment.prod);

      expect(EnvConfig.environment, equals(Environment.prod));
      expect(EnvConfig.apiBaseUrl, equals('https://api.interest.app/api/v1'));
      expect(EnvConfig.wsBaseUrl, equals('wss://chat.interest.app/chat'));
      expect(EnvConfig.cdnBaseUrl, equals('https://cdn.interest.app/reels'));
    });

    test('Strict Zero-Location invariant is always true', () {
      expect(EnvConfig.zeroLocationPolicy, isTrue);
    });
  });
}
