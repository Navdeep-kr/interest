import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/utils/haptic_service.dart';
import 'package:mobile/core/localization/app_localizations.dart';
import 'package:mobile/core/localization/currency_service.dart';
import 'package:mobile/core/performance/data_saver_manager.dart';
import 'package:mobile/features/auth/presentation/auth_notifier.dart';
import 'package:mobile/features/auth/presentation/auth_state.dart';
import 'package:mobile/features/auth/data/auth_repository.dart';
import 'package:mobile/features/auth/data/auth_api_client.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';

void main() {
  group('💎 Visual Luxury & Haptic Service Tests', () {
    test('HapticService handles enablement and executes safely', () async {
      expect(HapticService.isEnabled, isTrue);

      await HapticService.light();
      await HapticService.medium();
      await HapticService.heavy();
      await HapticService.selection();
      await HapticService.success();

      HapticService.isEnabled = false;
      expect(HapticService.isEnabled, isFalse);
      await HapticService.medium();
      HapticService.isEnabled = true;
    });
  });

  group('🗣️ Universal i18n & RTL Engine Tests', () {
    test('LocaleManager supports 12+ global languages and detects RTL', () {
      final manager = LocaleManager();
      expect(LocaleManager.supportedLanguages.length, greaterThanOrEqualTo(12));

      // Test English
      manager.setLocale('en');
      expect(manager.currentLanguageCode, equals('en'));
      expect(manager.isRtl, isFalse);
      expect(manager.textDirection, equals(TextDirection.ltr));
      expect(manager.translate('feed'), equals('Feed'));

      // Test Arabic (RTL Mirroring)
      manager.setLocale('ar');
      expect(manager.currentLanguageCode, equals('ar'));
      expect(manager.isRtl, isTrue);
      expect(manager.textDirection, equals(TextDirection.rtl));
      expect(manager.translate('feed'), equals('الرئيسية'));

      // Test Spanish
      manager.setLocale('es');
      expect(manager.currentLanguageCode, equals('es'));
      expect(manager.isRtl, isFalse);
      expect(manager.translate('feed'), equals('Inicio'));

      // Test Hindi
      manager.setLocale('hi');
      expect(manager.translate('feed'), equals('फ़ीड'));

      // Reset to English
      manager.setLocale('en');
    });

    test('CurrencyService formats amounts across global currencies', () {
      CurrencyService.setCurrency(SupportedCurrency.usd);
      expect(CurrencyService.format(29.99), equals('\$29.99'));

      CurrencyService.setCurrency(SupportedCurrency.eur);
      expect(CurrencyService.format(100.0), equals('€92.00'));

      CurrencyService.setCurrency(SupportedCurrency.inr);
      expect(CurrencyService.format(10.0), equals('₹835.00'));

      CurrencyService.setCurrency(SupportedCurrency.jpy);
      expect(CurrencyService.format(10.0), equals('¥1542'));

      // Reset
      CurrencyService.setCurrency(SupportedCurrency.usd);
    });
  });

  group('📶 Data Saver & Low-Bandwidth Optimization Tests', () {
    test('DataSaverManager optimizes media URLs and tracks offline caching', () {
      final manager = DataSaverManager();
      expect(manager.isDataSaverEnabled, isFalse);

      const sampleUrl = 'https://images.unsplash.com/photo-12345?w=1080';
      // When disabled, URL is unaltered
      expect(manager.getOptimizedMediaUrl(sampleUrl), equals(sampleUrl));

      // Enable Data Saver
      manager.toggleDataSaver(true);
      expect(manager.isDataSaverEnabled, isTrue);

      final optimizedUrl = manager.getOptimizedMediaUrl(sampleUrl);
      expect(optimizedUrl, contains('w=480&q=60'));

      // Test offline media caching registry
      manager.markMediaCached('media_reel_1');
      expect(manager.isMediaCached('media_reel_1'), isTrue);
      expect(manager.isMediaCached('media_reel_99'), isFalse);

      manager.toggleDataSaver(false);
    });
  });

  group('🚀 Universal Guest Mode & 1-Tap Auth Tests', () {
    test('AuthNotifier loginAsGuest activates frictionless exploration mode', () {
      final notifier = AuthNotifier(
        repository: AuthRepository(
          apiClient: AuthApiClient(),
          secureStorage: PlatformSecureStorageService(),
        ),
      );

      notifier.loginAsGuest();
      expect(notifier.state, isA<AuthenticatedState>());
      final user = (notifier.state as AuthenticatedState).user;
      expect(user.username, equals('guest_explorer'));
      expect(user.role, equals('GUEST'));
    });

    test('AuthNotifier loginWithSocialProvider connects seamlessly', () async {
      final notifier = AuthNotifier(
        repository: AuthRepository(
          apiClient: AuthApiClient(),
          secureStorage: PlatformSecureStorageService(),
        ),
      );

      final success = await notifier.loginWithSocialProvider('Google');
      expect(success, isTrue);
      expect(notifier.state, isA<AuthenticatedState>());
      final user = (notifier.state as AuthenticatedState).user;
      expect(user.username, contains('google_user'));
    });
  });
}
