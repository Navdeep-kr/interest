import 'dart:async';
import 'package:mobile/core/media/media_cache_manager.dart';
import 'package:mobile/core/performance/performance_profiler.dart';

class MediaPreloadManager {
  static final MediaPreloadManager _instance = MediaPreloadManager._internal();
  factory MediaPreloadManager() => _instance;
  MediaPreloadManager._internal();

  final MediaCacheManager _cacheManager = MediaCacheManager();
  final List<String> _preloadQueue = [];
  final Set<String> _inFlightPreloads = {};

  bool _isPaused = false;
  int _maxConcurrentPreloads = 2; // Default for mid/high tier

  int get queueLength => _preloadQueue.length;
  int get inFlightCount => _inFlightPreloads.length;
  bool get isPaused => _isPaused;

  void configureForDevice({required DeviceTier tier, required NetworkCondition network}) {
    if (tier == DeviceTier.lowEnd || network == NetworkCondition.slow3G) {
      _maxConcurrentPreloads = 1;
    } else {
      _maxConcurrentPreloads = 2;
    }
  }

  void pause() {
    _isPaused = true;
    _preloadQueue.clear();
  }

  void resume() {
    _isPaused = false;
  }

  /// Queues the next video URLs to pre-buffer initial segments.
  void queuePreload(List<String> videoUrls) {
    if (_isPaused) return;

    for (final url in videoUrls) {
      if (url.isNotEmpty &&
          !_preloadQueue.contains(url) &&
          !_inFlightPreloads.contains(url) &&
          _cacheManager.get(url) == null) {
        _preloadQueue.add(url);
      }
    }
    _processQueue();
  }

  Future<void> _processQueue() async {
    if (_isPaused || _inFlightPreloads.length >= _maxConcurrentPreloads || _preloadQueue.isEmpty) {
      return;
    }

    final url = _preloadQueue.removeAt(0);
    _inFlightPreloads.add(url);

    try {
      // Simulate/perform pre-buffering initial 1.5MB segment of the video
      await Future.delayed(const Duration(milliseconds: 80));
      _cacheManager.put(
        key: url,
        localPath: '/simulated_cache/${url.hashCode}.mp4',
        sizeBytes: 1536 * 1024, // 1.5 MB pre-buffered segment
      );
    } catch (_) {
      // Ignore network errors during background pre-buffering
    } finally {
      _inFlightPreloads.remove(url);
      _processQueue();
    }
  }

  /// Prioritizes a specific video URL (e.g., immediate next reel).
  void prioritize(String videoUrl) {
    if (_preloadQueue.remove(videoUrl)) {
      _preloadQueue.insert(0, videoUrl);
    } else if (!_inFlightPreloads.contains(videoUrl) && _cacheManager.get(videoUrl) == null) {
      _preloadQueue.insert(0, videoUrl);
    }
    _processQueue();
  }

  void clearQueue() {
    _preloadQueue.clear();
  }
}
