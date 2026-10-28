import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:mobile/core/config/env_config.dart';
import 'package:mobile/core/error/failures.dart';
import 'package:mobile/features/search/domain/models/search_models.dart';

class SearchApiClient {
  final String baseUrl;
  final dynamic _httpClient;

  SearchApiClient({
    String? baseUrl,
    dynamic httpClient,
  })  : baseUrl = baseUrl ?? EnvConfig.apiBaseUrl,
        _httpClient = httpClient ?? (kIsWeb ? null : _createDefaultClient()) {
    if (!kIsWeb && _httpClient is HttpClient) {
      _httpClient.connectionTimeout = const Duration(seconds: 15);
    }
  }

  static dynamic _createDefaultClient() {
    if (kIsWeb) return null;
    return HttpClient();
  }

  String _generateRequestId() {
    final now = DateTime.now().millisecondsSinceEpoch;
    final random = (now % 1000000).toString().padLeft(6, '0');
    return 'req_search_$now$random';
  }

  Future<dynamic> _get(
    String endpoint, {
    String? token,
    Map<String, String>? queryParams,
  }) async {
    if (kIsWeb || EnvConfig.mockModeEnabled || _httpClient == null) {
      if (endpoint.contains('/trending')) {
        return _mockTrendingJson;
      }
      if (endpoint.contains('/recent')) {
        return _mockRecentSearchesJson;
      }
      return _mockSearchResultsJson;
    }

    Uri uri = Uri.parse('$baseUrl$endpoint');
    if (queryParams != null && queryParams.isNotEmpty) {
      uri = uri.replace(queryParameters: queryParams);
    }
    final requestId = _generateRequestId();

    try {
      final request = await _httpClient.getUrl(uri);
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      request.headers.set('X-Request-Id', requestId);
      if (token != null && token.isNotEmpty) {
        request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
      }

      final response = await request.close().timeout(const Duration(seconds: 15));
      final responseBody = await response.transform(utf8.decoder).join();
      final statusCode = response.statusCode;

      if (statusCode >= 200 && statusCode < 300) {
        return jsonDecode(responseBody);
      }

      _handleError(statusCode, responseBody);
    } on SocketException {
      throw const NetworkFailure();
    } on Failure {
      rethrow;
    } catch (e) {
      throw ServerFailure(message: 'Unexpected network error: $e');
    }
  }

  Future<dynamic> _post(
    String endpoint, {
    Map<String, dynamic>? body,
    String? token,
  }) async {
    if (kIsWeb || EnvConfig.mockModeEnabled || _httpClient == null) {
      return {'success': true};
    }

    final uri = Uri.parse('$baseUrl$endpoint');
    final requestId = _generateRequestId();

    try {
      final request = await _httpClient.postUrl(uri);
      request.headers.set(HttpHeaders.contentTypeHeader, 'application/json');
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      request.headers.set('X-Request-Id', requestId);
      if (token != null && token.isNotEmpty) {
        request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
      }

      if (body != null) {
        request.write(jsonEncode(body));
      }

      final response = await request.close().timeout(const Duration(seconds: 15));
      final responseBody = await response.transform(utf8.decoder).join();
      final statusCode = response.statusCode;

      if (statusCode >= 200 && statusCode < 300) {
        if (responseBody.isEmpty) return {};
        return jsonDecode(responseBody);
      }

      _handleError(statusCode, responseBody);
    } on SocketException {
      throw const NetworkFailure();
    } on Failure {
      rethrow;
    } catch (e) {
      throw ServerFailure(message: 'Unexpected network error: $e');
    }
  }

  Future<dynamic> _delete(
    String endpoint, {
    String? token,
  }) async {
    if (kIsWeb || EnvConfig.mockModeEnabled || _httpClient == null) {
      return {'success': true};
    }

    final uri = Uri.parse('$baseUrl$endpoint');
    final requestId = _generateRequestId();

    try {
      final request = await _httpClient.deleteUrl(uri);
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      request.headers.set('X-Request-Id', requestId);
      if (token != null && token.isNotEmpty) {
        request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
      }

      final response = await request.close().timeout(const Duration(seconds: 15));
      final responseBody = await response.transform(utf8.decoder).join();
      final statusCode = response.statusCode;

      if (statusCode >= 200 && statusCode < 300) {
        if (responseBody.isEmpty) return {};
        return jsonDecode(responseBody);
      }

      _handleError(statusCode, responseBody);
    } on SocketException {
      throw const NetworkFailure();
    } on Failure {
      rethrow;
    } catch (e) {
      throw ServerFailure(message: 'Unexpected network error: $e');
    }
  }

  void _handleError(int statusCode, String responseBody) {
    String message = 'Operation failed';
    try {
      final decoded = jsonDecode(responseBody);
      if (decoded is Map<String, dynamic> && decoded['message'] != null) {
        final rawMsg = decoded['message'];
        message = rawMsg is List ? rawMsg.join(', ') : rawMsg.toString();
      }
    } catch (_) {}

    if (statusCode == 400) throw ValidationFailure(message: message, statusCode: 400);
    if (statusCode == 401) throw AuthenticationFailure(message: message, statusCode: 401);
    if (statusCode == 403) throw AuthorizationFailure(message: message, statusCode: 403);
    if (statusCode == 404) throw NotFoundFailure(message: message, statusCode: 404);
    if (statusCode == 429) throw RateLimitFailure(message: message, statusCode: 429);
    throw ServerFailure(message: message, statusCode: statusCode);
  }

  /// Unified multi-domain search.
  Future<UnifiedSearchResultsModel> search({
    required String query,
    String type = 'all',
    int limit = 20,
    int offset = 0,
    String? token,
  }) async {
    final json = await _get(
      '/search',
      token: token,
      queryParams: {
        'q': query,
        'type': type,
        'limit': limit.toString(),
        'offset': offset.toString(),
      },
    );
    return UnifiedSearchResultsModel.fromJson(json as Map<String, dynamic>);
  }

  /// Safe autocomplete suggestions.
  Future<List<SafeAutocompleteSuggestionModel>> getSafeAutocomplete(
    String query, {
    int limit = 10,
    String? token,
  }) async {
    final json = await _get(
      '/search/autocomplete',
      token: token,
      queryParams: {
        'q': query,
        'limit': limit.toString(),
      },
    );
    final suggestions = (json['suggestions'] as List<dynamic>?) ?? [];
    return suggestions
        .map((e) => SafeAutocompleteSuggestionModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Transparent velocity trending window.
  Future<TransparentTrendingModel> getTransparentTrending({
    String window = '24h',
    int limit = 10,
    String? token,
  }) async {
    final json = await _get(
      '/search/trending',
      token: token,
      queryParams: {
        'window': window,
        'limit': limit.toString(),
      },
    );
    return TransparentTrendingModel.fromJson(json as Map<String, dynamic>);
  }

  /// Recent search queries.
  Future<List<RecentSearchItemModel>> getRecentSearches({
    int limit = 10,
    String? token,
  }) async {
    final json = await _get(
      '/search/recent',
      token: token,
      queryParams: {'limit': limit.toString()},
    );
    final list = json as List<dynamic>? ?? [];
    return list
        .map((e) => RecentSearchItemModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Record recent search.
  Future<void> recordRecentSearch({
    required String queryText,
    String searchType = 'all',
    String? token,
  }) async {
    await _post(
      '/search/recent',
      token: token,
      body: {
        'queryText': queryText,
        'searchType': searchType,
      },
    );
  }

  /// Delete single recent search.
  Future<void> deleteRecentSearch({
    required String searchId,
    String? token,
  }) async {
    await _delete('/search/recent/$searchId', token: token);
  }

  /// Clear all recent searches.
  Future<void> clearRecentSearches({String? token}) async {
    await _delete('/search/recent', token: token);
  }

  /// Topic page details.
  Future<TopicPageDetailsModel> getTopicPage({
    required String idOrSlug,
    String? token,
  }) async {
    final json = await _get('/interests/$idOrSlug/page', token: token);
    return TopicPageDetailsModel.fromJson(json as Map<String, dynamic>);
  }

  /// Follow topic.
  Future<void> followTopic({
    required String id,
    String? token,
  }) async {
    await _post('/interests/$id/follow', token: token);
  }

  /// Unfollow topic.
  Future<void> unfollowTopic({
    required String id,
    String? token,
  }) async {
    await _delete('/interests/$id/follow', token: token);
  }

  /// Toggle mute on topic.
  Future<bool> toggleMuteTopic({
    required String id,
    required bool isMuted,
    String? token,
  }) async {
    if (isMuted) {
      await _post('/interests/$id/mute', token: token);
      return true;
    } else {
      await _delete('/interests/$id/mute', token: token);
      return false;
    }
  }

  static final Map<String, dynamic> _mockTrendingJson = {
    'window': '24h',
    'calculatedAt': '2026-10-19T10:00:00Z',
    'topics': [
      {
        'id': 'top_1',
        'slug': 'autonomous-ai',
        'title': 'Autonomous Multi-Agent AI',
        'categoryTitle': 'Technology',
        'icon': 'smart_toy',
        'velocityScore': 98.5,
        'postCount': 14200,
        'rank': 1,
      },
      {
        'id': 'top_2',
        'slug': 'zero-location-privacy',
        'title': 'Zero-Location Privacy by Design',
        'categoryTitle': 'Privacy & Security',
        'icon': 'shield',
        'velocityScore': 94.2,
        'postCount': 9800,
        'rank': 2,
      },
      {
        'id': 'top_3',
        'slug': 'flutter-324',
        'title': 'Flutter 3.24 & Impeller',
        'categoryTitle': 'Mobile Engineering',
        'icon': 'flutter_dash',
        'velocityScore': 89.0,
        'postCount': 8100,
        'rank': 3,
      },
      {
        'id': 'top_4',
        'slug': 'space-jwst',
        'title': 'James Webb Deep Space Discoveries',
        'categoryTitle': 'Science & Astronomy',
        'icon': 'public',
        'velocityScore': 86.4,
        'postCount': 22500,
        'rank': 4,
      },
      {
        'id': 'top_5',
        'slug': 'modular-synths',
        'title': 'Modular Synthesizer Sound Design',
        'categoryTitle': 'Music & Audio',
        'icon': 'music_note',
        'velocityScore': 78.1,
        'postCount': 4900,
        'rank': 5,
      },
    ],
    'hashtags': [
      {'tag': '#AI', 'postCount': 28400, 'rank': 1},
      {'tag': '#PrivacyFirst', 'postCount': 19200, 'rank': 2},
      {'tag': '#Flutter', 'postCount': 15800, 'rank': 3},
      {'tag': '#Astrophotography', 'postCount': 12400, 'rank': 4},
      {'tag': '#SoundDesign', 'postCount': 8700, 'rank': 5},
    ],
  };

  static final List<Map<String, dynamic>> _mockRecentSearchesJson = [
    {
      'id': 'rec_1',
      'queryText': 'Autonomous AI Agents',
      'searchType': 'topic',
      'createdAt': '2026-10-19T09:00:00Z',
    },
    {
      'id': 'rec_2',
      'queryText': 'Zero-Location Privacy',
      'searchType': 'topic',
      'createdAt': '2026-10-19T08:30:00Z',
    },
    {
      'id': 'rec_3',
      'queryText': 'Flutter 3.24',
      'searchType': 'tag',
      'createdAt': '2026-10-19T08:00:00Z',
    },
  ];

  static final Map<String, dynamic> _mockSearchResultsJson = {
    'query': 'AI',
    'totalCount': 42,
    'isProhibited': false,
    'interests': [
      {
        'id': 'top_1',
        'slug': 'autonomous-ai',
        'title': 'Autonomous Multi-Agent AI',
        'categoryTitle': 'Technology',
        'icon': 'smart_toy',
        'reelsCount': 14200,
        'followersCount': 8900,
        'isFollowing': true,
      },
    ],
    'users': [
      {
        'id': 'usr_alex',
        'username': 'alex_tech',
        'displayName': 'Alex Rivera',
        'avatarUrl': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
        'bio': 'Distributed AI & autonomous multi-agent architectures',
        'followersCount': 14200,
        'isVerified': true,
        'isFollowing': false,
      },
    ],
    'hashtags': [
      {'id': 'h_1', 'tag': '#AI', 'reelsCount': 28400},
      {'id': 'h_2', 'tag': '#MachineLearning', 'reelsCount': 19200},
    ],
    'reels': [],
    'communities': [
      {
        'id': 'comm_1',
        'slug': 'autonomous-ai',
        'name': 'Autonomous AI & Agents',
        'description': 'Exploring LLMs, autonomous agents, and multi-agent systems.',
        'avatarUrl': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200',
        'membersCount': 4230,
        'isJoined': true,
      },
    ],
  };
}
