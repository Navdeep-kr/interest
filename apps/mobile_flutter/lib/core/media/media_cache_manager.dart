import 'dart:collection';
import 'dart:io';

class CacheEntry {
  final String key;
  final String localPath;
  final int sizeBytes;
  DateTime lastAccessedAt;
  final DateTime createdAt;

  CacheEntry({
    required this.key,
    required this.localPath,
    required this.sizeBytes,
    required this.lastAccessedAt,
    required this.createdAt,
  });
}

class MediaCacheManager {
  static final MediaCacheManager _instance = MediaCacheManager._internal();
  factory MediaCacheManager() => _instance;
  MediaCacheManager._internal();

  static const int defaultMaxCacheSizeBytes = 64 * 1024 * 1024; // 64 MB lightweight quota
  static const Duration defaultTtl = Duration(days: 3);

  int maxCacheSizeBytes = defaultMaxCacheSizeBytes;
  Duration ttl = defaultTtl;

  final LinkedHashMap<String, CacheEntry> _entries = LinkedHashMap<String, CacheEntry>();
  int _currentCacheSizeBytes = 0;

  int _cacheHits = 0;
  int _cacheMisses = 0;

  int get currentCacheSizeBytes => _currentCacheSizeBytes;
  int get entryCount => _entries.length;
  int get cacheHits => _cacheHits;
  int get cacheMisses => _cacheMisses;

  double get hitRatioPercent {
    final total = _cacheHits + _cacheMisses;
    if (total == 0) return 0.0;
    return double.parse(((_cacheHits / total) * 100).toStringAsFixed(1));
  }

  /// Retrieves a cached file path by URL key. Updates LRU order.
  String? get(String key) {
    final entry = _entries[key];
    if (entry == null) {
      _cacheMisses++;
      return null;
    }

    // Check TTL expiration
    if (DateTime.now().difference(entry.createdAt) > ttl) {
      _removeEntry(key);
      _cacheMisses++;
      return null;
    }

    _cacheHits++;
    entry.lastAccessedAt = DateTime.now();
    // Re-insert to move to the back of LinkedHashMap (most recently used)
    _entries.remove(key);
    _entries[key] = entry;
    return entry.localPath;
  }

  /// Records a new cached file, evicting LRU entries if quota is exceeded.
  void put({
    required String key,
    required String localPath,
    required int sizeBytes,
  }) {
    if (_entries.containsKey(key)) {
      _removeEntry(key);
    }

    // Evict LRU entries if adding this item would exceed quota
    while (_currentCacheSizeBytes + sizeBytes > maxCacheSizeBytes && _entries.isNotEmpty) {
      final oldestKey = _entries.keys.first;
      _removeEntry(oldestKey);
    }

    final entry = CacheEntry(
      key: key,
      localPath: localPath,
      sizeBytes: sizeBytes,
      lastAccessedAt: DateTime.now(),
      createdAt: DateTime.now(),
    );

    _entries[key] = entry;
    _currentCacheSizeBytes += sizeBytes;
  }

  void _removeEntry(String key) {
    final entry = _entries.remove(key);
    if (entry != null) {
      _currentCacheSizeBytes -= entry.sizeBytes;
      try {
        final file = File(entry.localPath);
        if (file.existsSync()) {
          file.deleteSync();
        }
      } catch (_) {
        // Ignored in headless/test environments
      }
    }
  }

  /// Manually clears all cached media.
  void clearAll() {
    final keys = List<String>.from(_entries.keys);
    for (final key in keys) {
      _removeEntry(key);
    }
    _entries.clear();
    _currentCacheSizeBytes = 0;
  }

  /// Evicts any expired entries past the TTL window.
  void purgeExpired() {
    final now = DateTime.now();
    final expiredKeys = _entries.entries
        .where((e) => now.difference(e.value.createdAt) > ttl)
        .map((e) => e.key)
        .toList();

    for (final key in expiredKeys) {
      _removeEntry(key);
    }
  }

  void resetMetrics() {
    _cacheHits = 0;
    _cacheMisses = 0;
  }
}
