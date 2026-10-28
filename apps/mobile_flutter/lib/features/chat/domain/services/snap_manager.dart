import 'package:flutter/foundation.dart';
import '../models/snap_models.dart';

/// Central state manager for Snapchat-style Snap Streaks, Ephemeral Snaps, & Screenshot Alerts.
class SnapManager extends ChangeNotifier {
  static final SnapManager _instance = SnapManager._internal();
  factory SnapManager() => _instance;
  SnapManager._internal() {
    _seedInitialStreaks();
  }

  final Map<String, SnapStreak> _streaks = {};
  final Map<String, EphemeralSnap> _snaps = {};
  String? _activeScreenshotAlert;

  String? get activeScreenshotAlert => _activeScreenshotAlert;

  void _seedInitialStreaks() {
    _streaks['conv_direct_1'] = SnapStreak(
      conversationId: 'conv_direct_1',
      friendUsername: 'elena_rostova',
      streakDays: 14,
      isAtRisk: false,
      lastSnapSentAt: DateTime.now().subtract(const Duration(hours: 4)),
    );
    _streaks['conv_direct_2'] = SnapStreak(
      conversationId: 'conv_direct_2',
      friendUsername: 'marcus_chen',
      streakDays: 8,
      isAtRisk: false,
      lastSnapSentAt: DateTime.now().subtract(const Duration(hours: 10)),
    );
    _streaks['conv_direct_3'] = SnapStreak(
      conversationId: 'conv_direct_3',
      friendUsername: 'sarah_connor',
      streakDays: 21,
      isAtRisk: true, // Hourglass: expiring within 2h!
      lastSnapSentAt: DateTime.now().subtract(const Duration(hours: 22)),
    );

    // Seed sample incoming View Once Snap
    _snaps['snap_incoming_1'] = EphemeralSnap(
      id: 'snap_incoming_1',
      senderUsername: 'elena_rostova',
      senderAvatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200',
      mediaUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=720',
      caption: 'Testing the new Snapchat camera lenses! ⚡🔥',
      lens: SnapLensType.cyberpunk,
      durationSeconds: 10.0,
      isViewOnce: true,
      isViewed: false,
      sentAt: DateTime.now().subtract(const Duration(minutes: 5)),
    );
  }

  SnapStreak? getStreak(String conversationId) => _streaks[conversationId];

  EphemeralSnap? getSnap(String snapId) => _snaps[snapId];

  /// Sends a Snap and keeps/increments the Snap Streak
  void sendSnap({
    required String conversationId,
    required String recipientUsername,
    required String mediaUrl,
    required String caption,
    required SnapLensType lens,
    required bool isViewOnce,
    required double durationSeconds,
  }) {
    final existingStreak = _streaks[conversationId];
    final newDays = (existingStreak?.streakDays ?? 0) + 1;

    _streaks[conversationId] = SnapStreak(
      conversationId: conversationId,
      friendUsername: recipientUsername,
      streakDays: newDays,
      isAtRisk: false,
      lastSnapSentAt: DateTime.now(),
    );

    notifyListeners();
  }

  /// Marks an ephemeral snap as viewed and permanently expired
  void markSnapViewed(String snapId) {
    final current = _snaps[snapId];
    if (current != null) {
      _snaps[snapId] = current.copyWith(isViewed: true);
      notifyListeners();
    }
  }

  /// Replays a snap once
  void replaySnap(String snapId) {
    final current = _snaps[snapId];
    if (current != null) {
      _snaps[snapId] = current.copyWith(isReplayed: true);
      notifyListeners();
    }
  }

  /// Triggers a Snapchat-style Screenshot Detection Security Alert
  void recordScreenshotAlert(String whoTookIt) {
    _activeScreenshotAlert = '⚠️ @$whoTookIt took a screenshot of private Snap!';
    notifyListeners();

    // Auto-clear notification after 4 seconds
    Future.delayed(const Duration(seconds: 4), () {
      if (_activeScreenshotAlert != null) {
        _activeScreenshotAlert = null;
        notifyListeners();
      }
    });
  }

  void clearScreenshotAlert() {
    _activeScreenshotAlert = null;
    notifyListeners();
  }
}
