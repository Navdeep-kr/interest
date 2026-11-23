import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/core/theme/theme_manager.dart';

void main() {
  group('🎨 Luxury Theme & Gradient System Tests', () {
    late ThemeManager manager;

    setUp(() {
      manager = ThemeManager();
      manager.setPalette(AppThemePalette.neonAurora);
    });

    test('Initializes with Neon Aurora signature aesthetic', () {
      expect(manager.currentPalette, equals(AppThemePalette.neonAurora));
      expect(manager.activeConfig.name, equals('Neon Aurora'));
      expect(manager.activeConfig.previewColors.length, equals(3));
      expect(manager.activeConfig.gradient, equals(AppColors.primaryGradient));
    });

    test('Available palettes includes 4 curated luxury themes', () {
      expect(ThemeManager.availablePalettes.length, equals(4));
      final names = ThemeManager.availablePalettes.map((p) => p.name).toList();
      expect(names, containsAll(['Neon Aurora', 'Cyberpunk Matrix', 'Sunset Mirage', 'Minimal Titanium']));
    });

    test('Switching palettes updates active config, themeData, and notifies listeners', () {
      int notifications = 0;
      void listener() => notifications++;
      manager.addListener(listener);

      // Switch to Cyberpunk Matrix
      manager.setPalette(AppThemePalette.cyberTeal);
      expect(manager.currentPalette, equals(AppThemePalette.cyberTeal));
      expect(manager.activeConfig.name, equals('Cyberpunk Matrix'));
      expect(manager.themeData.scaffoldBackgroundColor, equals(const Color(0xFF05080E)));
      expect(notifications, equals(1));

      // Switch to Sunset Mirage
      manager.setPalette(AppThemePalette.sunsetLuxe);
      expect(manager.currentPalette, equals(AppThemePalette.sunsetLuxe));
      expect(manager.activeConfig.name, equals('Sunset Mirage'));
      expect(notifications, equals(2));

      // Switch to Minimal Titanium
      manager.setPalette(AppThemePalette.pureObsidian);
      expect(manager.currentPalette, equals(AppThemePalette.pureObsidian));
      expect(manager.activeConfig.name, equals('Minimal Titanium'));
      expect(notifications, equals(3));

      // Revert to Neon Aurora
      manager.setPalette(AppThemePalette.neonAurora);
      expect(manager.currentPalette, equals(AppThemePalette.neonAurora));

      manager.removeListener(listener);
    });

    test('AppTheme.darkTheme dynamically reflects ThemeManager active state', () {
      manager.setPalette(AppThemePalette.neonAurora);
      final darkTheme = AppTheme.darkTheme;
      expect(darkTheme.scaffoldBackgroundColor, equals(const Color(0xFF090714)));
      expect(darkTheme.colorScheme.primary, equals(const Color(0xFF8B5CF6)));
    });

    test('AppColors signature gradients are properly configured', () {
      expect(AppColors.primaryGradient.colors.length, equals(3));
      expect(AppColors.auroraGradient.colors.length, equals(4));
      expect(AppColors.cyberGradient.colors.length, equals(2));
      expect(AppColors.sunsetGradient.colors.length, equals(3));
    });
  });
}
