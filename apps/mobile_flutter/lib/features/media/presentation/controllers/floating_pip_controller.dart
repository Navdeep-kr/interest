import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:mobile/features/reels/domain/models/reel_item_model.dart';

/// Controller for Snaptube-style Floating Picture-in-Picture & Background Audio Player.
class FloatingPiPController extends ChangeNotifier {
  static final FloatingPiPController _instance = FloatingPiPController._internal();
  factory FloatingPiPController() => _instance;
  FloatingPiPController._internal();

  ReelItemModel? _activeReel;
  bool _isPlaying = true;
  bool _isAudioOnly = false;
  double _playbackSpeed = 1.0;
  double _positionSeconds = 0.0;
  double _durationSeconds = 15.0;
  Timer? _progressTimer;

  ReelItemModel? get activeReel => _activeReel;
  bool get hasActivePlayer => _activeReel != null;
  bool get isPlaying => _isPlaying;
  bool get isAudioOnly => _isAudioOnly;
  double get playbackSpeed => _playbackSpeed;
  double get positionSeconds => _positionSeconds;
  double get durationSeconds => _durationSeconds;

  String get formattedPosition {
    final m = (_positionSeconds / 60).floor();
    final s = (_positionSeconds % 60).floor();
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  String get formattedDuration {
    final m = (_durationSeconds / 60).floor();
    final s = (_durationSeconds % 60).floor();
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  void startPiP({required ReelItemModel reel, bool audioOnly = false}) {
    _activeReel = reel;
    _isAudioOnly = audioOnly;
    _isPlaying = true;
    _positionSeconds = 0.0;
    _durationSeconds = reel.durationSeconds > 0 ? reel.durationSeconds : 20.0;
    _startTimer();
    notifyListeners();
  }

  void _startTimer() {
    _progressTimer?.cancel();
    _progressTimer = Timer.periodic(const Duration(milliseconds: 500), (t) {
      if (_isPlaying && _activeReel != null) {
        _positionSeconds += 0.5 * _playbackSpeed;
        if (_positionSeconds >= _durationSeconds) {
          _positionSeconds = 0.0; // Loop playback
        }
        notifyListeners();
      }
    });
  }

  void togglePlayPause() {
    _isPlaying = !_isPlaying;
    notifyListeners();
  }

  void toggleAudioOnly() {
    _isAudioOnly = !_isAudioOnly;
    notifyListeners();
  }

  void cycleSpeed() {
    if (_playbackSpeed == 1.0) {
      _playbackSpeed = 1.25;
    } else if (_playbackSpeed == 1.25) {
      _playbackSpeed = 1.5;
    } else if (_playbackSpeed == 1.5) {
      _playbackSpeed = 2.0;
    } else {
      _playbackSpeed = 1.0;
    }
    notifyListeners();
  }

  void seekRelative(double delta) {
    _positionSeconds = (_positionSeconds + delta).clamp(0.0, _durationSeconds);
    notifyListeners();
  }

  void closePiP() {
    _progressTimer?.cancel();
    _activeReel = null;
    _isPlaying = false;
    _positionSeconds = 0.0;
    notifyListeners();
  }
}
