import 'package:flutter/foundation.dart';

/// Central manager for Vault 2.0: Stealth Chat, Decoy PIN, Touch-to-View and Window Protection.
/// Zero-Location guaranteed.
class PrivacyVaultManager extends ChangeNotifier {
  static final PrivacyVaultManager _instance = PrivacyVaultManager._internal();
  factory PrivacyVaultManager() => _instance;
  PrivacyVaultManager._internal();

  bool _isFlagSecureEnabled = true;
  bool _isDecoyPinEnabled = true;
  String _decoyPin = '9999';
  String _primaryPin = '1234';
  bool _isDecoyModeActive = false;
  bool _requireTouchToView = true;

  bool get isFlagSecureEnabled => _isFlagSecureEnabled;
  bool get isDecoyPinEnabled => _isDecoyPinEnabled;
  String get decoyPin => _decoyPin;
  String get primaryPin => _primaryPin;
  bool get isDecoyModeActive => _isDecoyModeActive;
  bool get requireTouchToView => _requireTouchToView;

  void toggleFlagSecure(bool enabled) {
    _isFlagSecureEnabled = enabled;
    notifyListeners();
  }

  void toggleDecoyPin(bool enabled) {
    _isDecoyPinEnabled = enabled;
    notifyListeners();
  }

  void setDecoyPin(String pin) {
    _decoyPin = pin;
    notifyListeners();
  }

  void setPrimaryPin(String pin) {
    _primaryPin = pin;
    notifyListeners();
  }

  void toggleTouchToView(bool enabled) {
    _requireTouchToView = enabled;
    notifyListeners();
  }

  /// Attempts unlock with provided PIN. Returns true if unlocked.
  /// If PIN matches decoy PIN, switches to Decoy Mode (clean dummy chats).
  bool unlockWithPin(String pin) {
    if (pin == _primaryPin) {
      _isDecoyModeActive = false;
      notifyListeners();
      return true;
    } else if (_isDecoyPinEnabled && pin == _decoyPin) {
      _isDecoyModeActive = true;
      notifyListeners();
      return true;
    }
    return false;
  }

  void exitDecoyMode() {
    _isDecoyModeActive = false;
    notifyListeners();
  }
}
