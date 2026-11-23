import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/config/simple_mode_manager.dart';

void main() {
  group('⚡ Simple Mode (Interest Lite) vs Pro Mode Engine Tests', () {
    late SimpleModeManager manager;

    setUp(() {
      manager = SimpleModeManager();
      manager.setSimpleMode(true);
    });

    test('Initializes correctly in Simple Mode (Lite)', () {
      expect(manager.isSimpleMode, isTrue);
      expect(manager.isProMode, isFalse);
      expect(manager.currentModeName, equals('Interest Lite'));
      expect(manager.currentModeDescription, contains('Clean, fast & distraction-free'));
    });

    test('Simple Mode hides complex and distracting features', () {
      manager.setSimpleMode(true);
      expect(manager.showFloatingPiP, isFalse);
      expect(manager.showAdvancedOverlays, isFalse);
      expect(manager.showMonetizationHub, isFalse);
      expect(manager.showDuressStealthTools, isFalse);
      expect(manager.showShoppablePopups, isFalse);
      expect(manager.showComplexFilters, isFalse);
    });

    test('Pro Mode exposes creator tools, backstage, and floating overlays', () {
      manager.setSimpleMode(false);
      expect(manager.isSimpleMode, isFalse);
      expect(manager.isProMode, isTrue);
      expect(manager.currentModeName, equals('Interest Pro'));
      expect(manager.showFloatingPiP, isTrue);
      expect(manager.showAdvancedOverlays, isTrue);
      expect(manager.showMonetizationHub, isTrue);
      expect(manager.showDuressStealthTools, isTrue);
      expect(manager.showShoppablePopups, isTrue);
    });

    test('toggleSimpleMode alternates between Lite and Pro with notification', () {
      int notificationsCount = 0;
      void listener() => notificationsCount++;
      manager.addListener(listener);

      manager.toggleSimpleMode();
      expect(manager.isSimpleMode, isFalse);
      expect(notificationsCount, equals(1));

      manager.toggleSimpleMode();
      expect(manager.isSimpleMode, isTrue);
      expect(notificationsCount, equals(2));

      manager.removeListener(listener);
    });

    test('setSimpleMode respects no-op on identical value', () {
      int notificationsCount = 0;
      void listener() => notificationsCount++;
      manager.addListener(listener);

      manager.setSimpleMode(true); // already true
      expect(notificationsCount, equals(0));

      manager.setSimpleMode(false);
      expect(notificationsCount, equals(1));

      manager.removeListener(listener);
    });
  });
}
