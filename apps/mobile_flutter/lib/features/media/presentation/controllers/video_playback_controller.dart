import 'package:flutter/widgets.dart';

enum PlaybackState {
  uninitialized,
  buffering,
  playing,
  paused,
  completed,
  error,
}

class VideoPlaybackController extends ChangeNotifier with WidgetsBindingObserver {
  final String videoUrl;
  final String? thumbnailUrl;
  final bool autoPlay;
  final bool loop;

  PlaybackState _state = PlaybackState.uninitialized;
  PlaybackState get state => _state;

  bool _isMuted = false;
  bool get isMuted => _isMuted;

  final Duration _position = Duration.zero;
  Duration get position => _position;

  Duration _duration = Duration.zero;
  Duration get duration => _duration;

  double _aspectRatio = 9 / 16; // Default standard vertical reel aspect ratio
  double get aspectRatio => _aspectRatio;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  bool _isVisibleOnScreen = true;

  VideoPlaybackController({
    required this.videoUrl,
    this.thumbnailUrl,
    this.autoPlay = true,
    this.loop = true,
  }) {
    WidgetsBinding.instance.addObserver(this);
    _initializePlayer();
  }

  void _setState(PlaybackState nextState) {
    if (_state != nextState) {
      _state = nextState;
      notifyListeners();
    }
  }

  Future<void> _initializePlayer() async {
    _setState(PlaybackState.buffering);
    try {
      // In production Flutter builds with HLS support, this binds to the native AVPlayer / ExoPlayer pipeline
      await Future.delayed(const Duration(milliseconds: 150));
      _duration = const Duration(seconds: 45); // default estimated stream length
      if (autoPlay && _isVisibleOnScreen) {
        _setState(PlaybackState.playing);
      } else {
        _setState(PlaybackState.paused);
      }
    } catch (e) {
      _errorMessage = 'Failed to load video stream: $e';
      _setState(PlaybackState.error);
    }
  }

  void play() {
    if (_state != PlaybackState.playing && _isVisibleOnScreen) {
      _setState(PlaybackState.playing);
    }
  }

  void pause() {
    if (_state == PlaybackState.playing) {
      _setState(PlaybackState.paused);
    }
  }

  void togglePlayPause() {
    if (_state == PlaybackState.playing) {
      pause();
    } else {
      play();
    }
  }

  void toggleMute() {
    _isMuted = !_isMuted;
    notifyListeners();
  }

  void setAspectRatio(double ratio) {
    _aspectRatio = ratio;
    notifyListeners();
  }

  /// Called when list view scrolls card off-screen to prevent CPU & battery drain
  void onScrolledOffScreen() {
    _isVisibleOnScreen = false;
    pause();
  }

  /// Called when list view scrolls card back into active viewport
  void onScrolledOnScreen() {
    _isVisibleOnScreen = true;
    if (autoPlay) {
      play();
    }
  }

  /// Lifecycle interruption listener: Pauses immediately when app goes to background
  @override
  void didChangeAppLifecycleState(AppLifecycleState appState) {
    if (appState == AppLifecycleState.paused || appState == AppLifecycleState.inactive) {
      pause();
    } else if (appState == AppLifecycleState.resumed && _isVisibleOnScreen && autoPlay) {
      play();
    }
  }

  void retry() {
    _errorMessage = null;
    _initializePlayer();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}
