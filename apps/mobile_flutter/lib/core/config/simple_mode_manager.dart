import 'package:flutter/foundation.dart';
import '../utils/haptic_service.dart';

/// Global Manager for Dual Mode:
/// - **Simple Mode (Interest Lite)**: Minimalist, clean, lightning-fast browsing
///   for everyday users without clutter, complex overlays, or monetization widgets.
/// - **Standard / Pro Mode**: Full creator suite, backstage bounties, privacy vaults,
///   floating picture-in-picture, and analytics.
class SimpleModeManager extends ChangeNotifier {
  static final SimpleModeManager _instance = SimpleModeManager._internal();
  factory SimpleModeManager() => _instance;
  SimpleModeManager._internal();

  /// Default to Simple Mode for a clean, effortless experience.
  bool _isSimpleMode = true;

  bool get isSimpleMode => _isSimpleMode;
  bool get isProMode => !_isSimpleMode;

  String get currentModeName => _isSimpleMode ? 'Interest Lite' : 'Interest Pro';
  String get currentModeDescription => _isSimpleMode
      ? 'Clean, fast & distraction-free browsing'
      : 'Full creator suite, live backstage & stealth vault';

  // Feature visibility guards
  bool get showFloatingPiP => !_isSimpleMode;
  bool get showAdvancedOverlays => !_isSimpleMode;
  bool get showMonetizationHub => !_isSimpleMode;
  bool get showDuressStealthTools => !_isSimpleMode;
  bool get showShoppablePopups => !_isSimpleMode;
  bool get showComplexFilters => !_isSimpleMode;

  /// Toggles between Simple Mode (Lite) and Pro Mode.
  void toggleSimpleMode([bool? forceValue]) {
    _isSimpleMode = forceValue ?? !_isSimpleMode;
    HapticService.selection();
    notifyListeners();
  }

  /// Explicitly activates or deactivates Simple Mode.
  void setSimpleMode(bool enabled) {
    if (_isSimpleMode == enabled) return;
    _isSimpleMode = enabled;
    HapticService.selection();
    notifyListeners();
  }
}
