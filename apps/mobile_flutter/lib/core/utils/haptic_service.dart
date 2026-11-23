import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Central tactile haptics service for premium iOS/Android interaction feedback.
/// Safely handles web and desktop platforms where hardware vibration is unavailable.
class HapticService {
  static bool isEnabled = true;

  /// Subtle tactile tick for tab switching, segmented controls, and chips.
  static Future<void> light() async {
    if (!isEnabled || kIsWeb) return;
    try {
      await HapticFeedback.lightImpact();
    } catch (_) {}
  }

  /// Crisp feedback for standard button presses, likes, and toggles.
  static Future<void> medium() async {
    if (!isEnabled || kIsWeb) return;
    try {
      await HapticFeedback.mediumImpact();
    } catch (_) {}
  }

  /// Strong feedback for high-impact events: purchases, incinerating snaps, bans.
  static Future<void> heavy() async {
    if (!isEnabled || kIsWeb) return;
    try {
      await HapticFeedback.heavyImpact();
    } catch (_) {}
  }

  /// Ultra-subtle click for scroll pickers, sliders, and lens cycling.
  static Future<void> selection() async {
    if (!isEnabled || kIsWeb) return;
    try {
      await HapticFeedback.selectionClick();
    } catch (_) {}
  }

  /// Celebratory double pulse for successful orders, streak freezes, and unlocked perks.
  static Future<void> success() async {
    if (!isEnabled || kIsWeb) return;
    try {
      await HapticFeedback.mediumImpact();
      await Future.delayed(const Duration(milliseconds: 90));
      await HapticFeedback.lightImpact();
    } catch (_) {}
  }
}
