import 'package:flutter/foundation.dart';
import '../models/interest_plus_model.dart';

class InterestPlusManager extends ChangeNotifier {
  static final InterestPlusManager _instance = InterestPlusManager._internal();
  factory InterestPlusManager() => _instance;

  InterestPlusManager._internal();

  InterestPlusState _state = const InterestPlusState(
    isSubscribed: false,
    streakFreezesRemaining: 2,
    isGhostModeEnabled: false,
    pinnedBffUsername: 'elena_rostova',
    pinnedBffEmoji: '💖',
    activeCustomAppIcon: 'midnight_gold',
    hasHolographicGlow: true,
  );

  InterestPlusState get state => _state;
  bool get isSubscribed => _state.isSubscribed;
  bool get isGhostModeEnabled => _state.isSubscribed && _state.isGhostModeEnabled;
  int get streakFreezesRemaining => _state.streakFreezesRemaining;
  String? get pinnedBffUsername => _state.pinnedBffUsername;
  String get pinnedBffEmoji => _state.pinnedBffEmoji;
  String get activeCustomAppIcon => _state.activeCustomAppIcon;
  bool get hasHolographicGlow => _state.isSubscribed && _state.hasHolographicGlow;

  void subscribe(InterestPlusPlan plan) {
    _state = _state.copyWith(
      isSubscribed: true,
      plan: plan,
      subscribedAt: DateTime.now(),
      expiresAt: DateTime.now().add(plan == InterestPlusPlan.annual ? const Duration(days: 365) : const Duration(days: 30)),
    );
    notifyListeners();
  }

  void cancelSubscription() {
    _state = _state.copyWith(
      isSubscribed: false,
      plan: null,
    );
    notifyListeners();
  }

  bool useStreakFreeze() {
    if (!_state.isSubscribed || _state.streakFreezesRemaining <= 0) {
      return false;
    }
    _state = _state.copyWith(
      streakFreezesRemaining: _state.streakFreezesRemaining - 1,
    );
    notifyListeners();
    return true;
  }

  void toggleGhostMode(bool enabled) {
    _state = _state.copyWith(isGhostModeEnabled: enabled);
    notifyListeners();
  }

  void pinBestFriend(String username, {String emoji = '💖'}) {
    _state = _state.copyWith(
      pinnedBffUsername: username,
      pinnedBffEmoji: emoji,
    );
    notifyListeners();
  }

  void unpinBestFriend() {
    _state = _state.copyWith(pinnedBffUsername: null);
    notifyListeners();
  }

  void setCustomAppIcon(String iconId) {
    _state = _state.copyWith(activeCustomAppIcon: iconId);
    notifyListeners();
  }

  void toggleHolographicGlow(bool enabled) {
    _state = _state.copyWith(hasHolographicGlow: enabled);
    notifyListeners();
  }
}
