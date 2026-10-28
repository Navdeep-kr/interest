import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:mobile/core/performance/performance_profiler.dart';

class NetworkPerformanceManager {
  static final NetworkPerformanceManager _instance = NetworkPerformanceManager._internal();
  factory NetworkPerformanceManager() => _instance;
  NetworkPerformanceManager._internal() {
    _initHttpClient();
  }

  late HttpClient _pooledHttpClient;
  final Map<String, Future<dynamic>> _inFlightRequests = {};
  final Map<String, String> _memoryDiskCache = {}; // In-memory/local response cache

  void _initHttpClient() {
    _pooledHttpClient = HttpClient();
    _pooledHttpClient.idleTimeout = const Duration(seconds: 30);
    _pooledHttpClient.connectionTimeout = const Duration(seconds: 15);
    _pooledHttpClient.maxConnectionsPerHost = 6;
  }

  HttpClient get pooledClient => _pooledHttpClient;

  /// Executes request with deduplication and latency tracking.
  Future<dynamic> executeDeduplicatedGet(
    String url, {
    Map<String, String>? headers,
    bool enableOfflineCache = true,
  }) async {
    // 1. Check if an identical GET request is already in-flight
    if (_inFlightRequests.containsKey(url)) {
      return _inFlightRequests[url]!;
    }

    final completer = Completer<dynamic>();
    _inFlightRequests[url] = completer.future;

    final startTime = DateTime.now().millisecondsSinceEpoch;

    try {
      final uri = Uri.parse(url);
      final request = await _pooledHttpClient.getUrl(uri);
      headers?.forEach((k, v) => request.headers.set(k, v));

      final response = await request.close().timeout(const Duration(seconds: 15));
      final responseBody = await response.transform(utf8.decoder).join();
      final latency = DateTime.now().millisecondsSinceEpoch - startTime;

      if (response.statusCode >= 200 && response.statusCode < 300) {
        PerformanceProfiler().recordApiCall(latency, isSuccess: true);
        if (enableOfflineCache) {
          _memoryDiskCache[url] = responseBody;
        }
        final parsed = jsonDecode(responseBody);
        completer.complete(parsed);
      } else {
        PerformanceProfiler().recordApiCall(latency, isSuccess: false);
        // Fallback to offline cached data if available
        if (enableOfflineCache && _memoryDiskCache.containsKey(url)) {
          completer.complete(jsonDecode(_memoryDiskCache[url]!));
        } else {
          completer.completeError(HttpException('HTTP ${response.statusCode}'));
        }
      }
    } catch (e) {
      final latency = DateTime.now().millisecondsSinceEpoch - startTime;
      PerformanceProfiler().recordApiCall(latency, isSuccess: false);

      // Offline fallback on socket exception or timeout
      if (enableOfflineCache && _memoryDiskCache.containsKey(url)) {
        completer.complete(jsonDecode(_memoryDiskCache[url]!));
      } else {
        completer.completeError(e);
      }
    } finally {
      _inFlightRequests.remove(url);
    }

    return completer.future;
  }

  /// Retrieves offline cached response for instantaneous First Contentful Paint.
  dynamic getOfflineCached(String url) {
    if (_memoryDiskCache.containsKey(url)) {
      try {
        return jsonDecode(_memoryDiskCache[url]!);
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  void primeCache(String url, dynamic data) {
    _memoryDiskCache[url] = jsonEncode(data);
  }

  void clearCache() {
    _memoryDiskCache.clear();
  }
}
