import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';

void main() {
  group('SecureStorageService Platform Security Invariant Tests', () {
    late SecureStorageService storage;

    setUp(() {
      storage = PlatformSecureStorageService();
    });

    test('should securely save and retrieve access token', () async {
      await storage.saveAccessToken('jwt.access.token.123');
      final token = await storage.getAccessToken();
      expect(token, equals('jwt.access.token.123'));
    });

    test('should securely save and retrieve refresh token', () async {
      await storage.saveRefreshToken('jwt.refresh.token.456');
      final token = await storage.getRefreshToken();
      expect(token, equals('jwt.refresh.token.456'));
    });

    test('should accurately report hasActiveSession only when both tokens exist', () async {
      expect(await storage.hasActiveSession(), isFalse);

      await storage.saveAccessToken('token');
      expect(await storage.hasActiveSession(), isFalse);

      await storage.saveRefreshToken('refresh');
      expect(await storage.hasActiveSession(), isTrue);
    });

    test('should wipe all sensitive credentials on clearAll (Session Revocation)', () async {
      await storage.saveAccessToken('token');
      await storage.saveRefreshToken('refresh');
      await storage.saveUserId('user-1');
      await storage.saveUsername('alice');

      await storage.clearAll();

      expect(await storage.getAccessToken(), isNull);
      expect(await storage.getRefreshToken(), isNull);
      expect(await storage.getUserId(), isNull);
      expect(await storage.getUsername(), isNull);
      expect(await storage.hasActiveSession(), isFalse);
    });
  });
}
