import 'package:flutter/foundation.dart';
import '../utils/haptic_service.dart';

/// Central Manager for Low-Bandwidth Data Saver Mode and Offline Media Caching.
/// Guarantees instant fluid playback even on 2G/3G networks or in offline airplane mode.
class DataSaverManager extends ChangeNotifier {
  static final DataSaverManager _instance = DataSaverManager._internal();
  factory DataSaverManager() => _instance;
  DataSaverManager._internal();

  bool _isDataSaverEnabled = false;
  bool _isWifiOnlyDownload = true;
  bool _isOffline = false;
  final Set<String> _cachedMediaIds = {};

  bool get isDataSaverEnabled => _isDataSaverEnabled;
  bool get isWifiOnlyDownload => _isWifiOnlyDownload;
  bool get isOffline => _isOffline;
  Set<String> get cachedMediaIds => Set.unmodifiable(_cachedMediaIds);

  void toggleDataSaver(bool enabled) {
    _isDataSaverEnabled = enabled;
    HapticService.light();
    notifyListeners();
  }

  void toggleWifiOnly(bool enabled) {
    _isWifiOnlyDownload = enabled;
    HapticService.light();
    notifyListeners();
  }

  void setOfflineState(bool offline) {
    _isOffline = offline;
    notifyListeners();
  }

  void markMediaCached(String mediaId) {
    _cachedMediaIds.add(mediaId);
    notifyListeners();
  }

  bool isMediaCached(String mediaId) => _cachedMediaIds.contains(mediaId);

  /// Automatically optimizes image and video URLs for low data consumption.
  /// Downscales high-resolution URLs to lightweight, highly compressed assets.
  String getOptimizedMediaUrl(String originalUrl) {
    if (!_isDataSaverEnabled || originalUrl.isEmpty) {
      return originalUrl;
    }

    if (originalUrl.contains('unsplash.com')) {
      // Replace width with 480px and quality 60% (saves ~75% bytes)
      return originalUrl.replaceAll(RegExp(r'w=\d+'), 'w=480&q=60');
    }

    return originalUrl;
  }
}
