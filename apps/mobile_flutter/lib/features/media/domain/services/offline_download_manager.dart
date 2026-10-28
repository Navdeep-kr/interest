import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:mobile/core/media/media_cache_manager.dart';
import 'package:mobile/features/reels/domain/models/reel_item_model.dart';
import '../models/offline_media_item.dart';

/// Snaptube-grade Offline Media & Secret Vault Manager
/// Supports:
/// - Multi-quality video downloads (1080p, 720p, 480p)
/// - Background Audio extraction (MP3 320kbps)
/// - PIN-protected Private Vault
/// - Storage space calculator and cache cleaner
class OfflineDownloadManager extends ChangeNotifier {
  static final OfflineDownloadManager _instance = OfflineDownloadManager._internal();
  factory OfflineDownloadManager() => _instance;
  OfflineDownloadManager._internal() {
    _seedInitialDemoDownloads();
  }

  final List<OfflineMediaItem> _items = [];
  bool _isVaultUnlocked = false;
  String _vaultPin = '1234';

  List<OfflineMediaItem> get allDownloads =>
      _items.where((i) => !i.isVaulted).toList();

  List<OfflineMediaItem> get videoDownloads =>
      _items.where((i) => !i.isVaulted && !i.format.isAudio).toList();

  List<OfflineMediaItem> get audioDownloads =>
      _items.where((i) => !i.isVaulted && i.format.isAudio).toList();

  List<OfflineMediaItem> get vaultedItems =>
      _items.where((i) => i.isVaulted).toList();

  bool get isVaultUnlocked => _isVaultUnlocked;
  String get vaultPin => _vaultPin;

  int get totalDownloadedBytes =>
      _items.fold<int>(0, (acc, item) => acc + item.fileSizeBytes);

  String get formattedTotalStorageUsage {
    final total = totalDownloadedBytes + MediaCacheManager().currentCacheSizeBytes;
    if (total >= 1024 * 1024) {
      return '${(total / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    return '${(total / 1024).toStringAsFixed(0)} KB';
  }

  void _seedInitialDemoDownloads() {
    _items.addAll([
      OfflineMediaItem(
        id: 'dl_seed_1',
        originalReelId: 'reel_demo_1',
        title: 'Minimalist Architecture Walkthrough #Design',
        creatorUsername: 'alex_architect',
        creatorAvatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=720',
        format: OfflineMediaFormat.video1080p,
        fileSizeBytes: 18 * 1024 * 1024,
        durationSeconds: 15.0,
        progress: 1.0,
        isCompleted: true,
        isVaulted: false,
        downloadedAt: DateTime.now().subtract(const Duration(hours: 3)),
      ),
      OfflineMediaItem(
        id: 'dl_seed_2',
        originalReelId: 'reel_demo_2',
        title: 'Ambient Lo-Fi Coding Beats (Extracted Audio)',
        creatorUsername: 'synth_coder',
        creatorAvatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=720',
        format: OfflineMediaFormat.audioMp3,
        fileSizeBytes: 4 * 1024 * 1024,
        durationSeconds: 22.0,
        progress: 1.0,
        isCompleted: true,
        isVaulted: false,
        downloadedAt: DateTime.now().subtract(const Duration(days: 1)),
      ),
      OfflineMediaItem(
        id: 'dl_seed_3_vault',
        originalReelId: 'reel_demo_vault',
        title: 'Private Studio Masterclass & Secret Notes',
        creatorUsername: 'alex_architect',
        creatorAvatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=720',
        format: OfflineMediaFormat.video1080p,
        fileSizeBytes: 24 * 1024 * 1024,
        durationSeconds: 28.0,
        progress: 1.0,
        isCompleted: true,
        isVaulted: true, // Vaulted sample
        downloadedAt: DateTime.now().subtract(const Duration(days: 2)),
      ),
    ]);
  }

  /// Initiates Snaptube-style high-speed download with progressive feedback
  Future<void> startDownload({
    required ReelItemModel reel,
    required OfflineMediaFormat format,
    void Function(double progress)? onProgress,
  }) async {
    final downloadId = 'dl_${DateTime.now().millisecondsSinceEpoch}';
    final approximateSize = format.isAudio
        ? (3.5 * 1024 * 1024).round()
        : format == OfflineMediaFormat.video1080p
            ? (22.0 * 1024 * 1024).round()
            : format == OfflineMediaFormat.video720p
                ? (12.0 * 1024 * 1024).round()
                : (6.0 * 1024 * 1024).round();

    final newItem = OfflineMediaItem(
      id: downloadId,
      originalReelId: reel.id,
      title: reel.title.isNotEmpty ? reel.title : 'Downloaded Reel @${reel.creator.username}',
      creatorUsername: reel.creator.username,
      creatorAvatarUrl: reel.creator.avatarUrl,
      mediaUrl: reel.hlsMasterUrl.isNotEmpty ? reel.hlsMasterUrl : reel.thumbnailUrl,
      thumbnailUrl: reel.thumbnailUrl,
      format: format,
      fileSizeBytes: approximateSize,
      durationSeconds: reel.durationSeconds > 0 ? reel.durationSeconds : 15.0,
      progress: 0.05,
      isCompleted: false,
      isVaulted: false,
      downloadedAt: DateTime.now(),
    );

    _items.insert(0, newItem);
    notifyListeners();

    // Fast simulated download progress steps
    const steps = [0.25, 0.55, 0.85, 1.0];
    for (final p in steps) {
      await Future.delayed(const Duration(milliseconds: 250));
      final idx = _items.indexWhere((i) => i.id == downloadId);
      if (idx != -1) {
        _items[idx] = _items[idx].copyWith(
          progress: p,
          isCompleted: p >= 1.0,
        );
        onProgress?.call(p);
        notifyListeners();
      }
    }
  }

  /// Removes a downloaded item
  void deleteDownload(String id) {
    _items.removeWhere((i) => i.id == id);
    notifyListeners();
  }

  /// Toggles whether a media item is moved into the PIN-protected Secret Vault
  void toggleVault(String id) {
    final idx = _items.indexWhere((i) => i.id == id);
    if (idx != -1) {
      final current = _items[idx];
      _items[idx] = current.copyWith(isVaulted: !current.isVaulted);
      notifyListeners();
    }
  }

  /// Unlocks the Secret Vault with PIN
  bool unlockVault(String enteredPin) {
    if (enteredPin == _vaultPin) {
      _isVaultUnlocked = true;
      notifyListeners();
      return true;
    }
    return false;
  }

  /// Locks the vault
  void lockVault() {
    _isVaultUnlocked = false;
    notifyListeners();
  }

  /// Updates the Vault PIN
  void setVaultPin(String newPin) {
    if (newPin.length >= 4) {
      _vaultPin = newPin;
      notifyListeners();
    }
  }

  /// Cleans temporary network and cache storage while keeping vaulted files safe
  void cleanStorageCache() {
    MediaCacheManager().clearAll();
    notifyListeners();
  }
}
