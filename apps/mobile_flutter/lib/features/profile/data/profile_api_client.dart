import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import '../../../core/config/env_config.dart';
import '../../../core/error/failures.dart';
import '../domain/models/user_profile.dart';
import '../domain/models/follow_request_item.dart';
import '../domain/models/profile_reel_item.dart';

class ProfileApiClient {
  final String baseUrl;
  final dynamic _httpClient;

  ProfileApiClient({
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
    return 'req_$now$random';
  }

  Future<dynamic> _get(
    String endpoint, {
    String? token,
    Map<String, String>? queryParams,
  }) async {
    if (kIsWeb || EnvConfig.mockModeEnabled || _httpClient == null) {
      if (endpoint.contains('/reels')) {
        return _mockProfileReelsJson;
      }
      if (endpoint.contains('/follow-requests')) {
        return [];
      }
      return _mockProfileJson;
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
    String endpoint,
    Map<String, dynamic> body, {
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

      final bodyBytes = utf8.encode(jsonEncode(body));
      request.contentLength = bodyBytes.length;
      request.add(bodyBytes);

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

  Future<dynamic> _put(
    String endpoint,
    Map<String, dynamic> body, {
    String? token,
  }) async {
    if (kIsWeb || EnvConfig.mockModeEnabled || _httpClient == null) {
      return {'success': true};
    }

    final uri = Uri.parse('$baseUrl$endpoint');
    final requestId = _generateRequestId();

    try {
      final request = await _httpClient.putUrl(uri);
      request.headers.set(HttpHeaders.contentTypeHeader, 'application/json');
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      request.headers.set('X-Request-Id', requestId);
      if (token != null && token.isNotEmpty) {
        request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
      }

      final bodyBytes = utf8.encode(jsonEncode(body));
      request.contentLength = bodyBytes.length;
      request.add(bodyBytes);

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
    String message = 'Request failed with status $statusCode';
    try {
      final json = jsonDecode(responseBody);
      if (json is Map && json.containsKey('message')) {
        message = json['message'].toString();
      }
    } catch (_) {}

    switch (statusCode) {
      case 400:
        throw ValidationFailure(message: message, statusCode: 400);
      case 401:
        throw AuthenticationFailure(message: message, statusCode: 401);
      case 403:
        throw AuthorizationFailure(message: message, statusCode: 403);
      case 404:
        throw NotFoundFailure(message: message, statusCode: 404);
      case 409:
        throw ValidationFailure(message: message, statusCode: 409);
      case 429:
        throw RateLimitFailure(message: message, statusCode: 429);
      default:
        throw ServerFailure(message: message, statusCode: statusCode);
    }
  }

  // ==========================================================================
  // API METHODS
  // ==========================================================================

  Future<UserProfile> getMyProfile({required String token}) async {
    final res = await _get('/profile/me', token: token);
    return UserProfile.fromJson(res as Map<String, dynamic>);
  }

  Future<UserProfile> getProfile(String identifier, {String? token}) async {
    final res = await _get('/profile/$identifier', token: token);
    return UserProfile.fromJson(res as Map<String, dynamic>);
  }

  Future<UserProfile> updateProfile(
    Map<String, dynamic> data, {
    required String token,
  }) async {
    final res = await _put('/profile/me', data, token: token);
    return UserProfile.fromJson(res as Map<String, dynamic>);
  }

  Future<List<ProfileReelItem>> getProfileReels(
    String userId, {
    String? token,
    int limit = 20,
    String? cursor,
  }) async {
    final query = <String, String>{'limit': limit.toString()};
    if (cursor != null) query['cursor'] = cursor;

    final res = await _get('/profile/$userId/reels', token: token, queryParams: query);
    final items = res['items'] as List? ?? [];
    return items
        .whereType<Map<String, dynamic>>()
        .map((e) => ProfileReelItem.fromJson(e))
        .toList();
  }

  Future<List<ProfileReelItem>> getProfileLikedReels(
    String userId, {
    required String token,
    int limit = 20,
    String? cursor,
  }) async {
    final query = <String, String>{'limit': limit.toString()};
    if (cursor != null) query['cursor'] = cursor;

    final res = await _get('/profile/$userId/liked', token: token, queryParams: query);
    final items = res['items'] as List? ?? [];
    return items
        .whereType<Map<String, dynamic>>()
        .map((e) => ProfileReelItem.fromJson(e))
        .toList();
  }

  Future<Map<String, dynamic>> followUser(
    String userId, {
    required String token,
  }) async {
    final res = await _post('/profile/$userId/follow', {}, token: token);
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> unfollowUser(
    String userId, {
    required String token,
  }) async {
    final res = await _delete('/profile/$userId/follow', token: token);
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> cancelFollowRequest(
    String userId, {
    required String token,
  }) async {
    final res = await _delete('/profile/follow-requests/cancel/$userId', token: token);
    return res as Map<String, dynamic>;
  }

  Future<List<FollowRequestItem>> getPendingFollowRequests({
    required String token,
    int limit = 20,
    int offset = 0,
  }) async {
    final query = {
      'limit': limit.toString(),
      'offset': offset.toString(),
    };
    final res = await _get(
      '/profile/follow-requests/pending',
      token: token,
      queryParams: query,
    );
    final list = res as List? ?? [];
    return list
        .whereType<Map<String, dynamic>>()
        .map((e) => FollowRequestItem.fromJson(e))
        .toList();
  }

  Future<Map<String, dynamic>> respondFollowRequest(
    String requestId,
    String action, {
    required String token,
  }) async {
    final res = await _post(
      '/profile/follow-requests/$requestId/respond',
      {'action': action},
      token: token,
    );
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> restrictUser(
    String userId, {
    required String token,
  }) async {
    final res = await _post('/profile/$userId/restrict', {}, token: token);
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> unrestrictUser(
    String userId, {
    required String token,
  }) async {
    final res = await _delete('/profile/$userId/restrict', token: token);
    return res as Map<String, dynamic>;
  }

  Future<List<Map<String, dynamic>>> searchMentions(
    String query, {
    required String token,
    int limit = 20,
  }) async {
    final queryParams = {'q': query, 'limit': limit.toString()};
    final res = await _get(
      '/profile/mentions/search',
      token: token,
      queryParams: queryParams,
    );
    final list = res as List? ?? [];
    return list.whereType<Map<String, dynamic>>().toList();
  }

  Future<List<Map<String, dynamic>>> getRecommendations({
    required String token,
    int limit = 15,
  }) async {
    final res = await _get(
      '/profile/recommendations',
      token: token,
      queryParams: {'limit': limit.toString()},
    );
    final list = res as List? ?? [];
    return list.whereType<Map<String, dynamic>>().toList();
  }

  static final Map<String, dynamic> _mockProfileJson = {
    'id': 'usr_web_local_1',
    'username': 'interest_creator',
    'displayName': 'Interest Creator',
    'bio': 'Crafting AI architectures & building privacy-first social experiences on Interest.',
    'avatarUrl': 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200',
    'bannerUrl': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200',
    'email': 'creator@interest.app',
    'reelsCount': 12,
    'followersCount': 1420,
    'followingCount': 380,
    'isPrivate': false,
    'links': [
      {'title': 'GitHub', 'url': 'https://github.com/interest-social'},
      {'title': 'Website', 'url': 'https://interest.app'},
    ],
    'hideFollowerCount': false,
    'hideFollowingCount': false,
    'allowTagging': 'everyone',
    'allowMentions': 'everyone',
    'isFollowing': false,
    'isFollower': false,
    'isMutual': false,
    'hasPendingRequest': false,
    'isBlocked': false,
    'isMuted': false,
    'isRestricted': false,
    'createdAt': '2026-01-01T00:00:00Z',
    'updatedAt': '2026-10-19T00:00:00Z',
  };

  static final List<Map<String, dynamic>> _mockProfileReelsJson = [
    {
      'id': 'reel_prof_1',
      'creatorId': 'usr_web_local_1',
      'title': 'Autonomous Multi-Agent AI',
      'caption': 'Distributed consensus and zero-location state machines.',
      'hlsMasterUrl': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      'thumbnailUrl': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=720',
      'durationSeconds': 45.0,
      'viewCount': 18450,
      'likeCount': 4210,
      'commentCount': 184,
      'saveCount': 920,
      'createdAt': '2026-10-19T10:00:00Z',
    },
    {
      'id': 'reel_prof_2',
      'creatorId': 'usr_web_local_1',
      'title': 'Zero-Location Privacy by Design',
      'caption': 'Why Interest guarantees zero location tracking.',
      'hlsMasterUrl': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      'thumbnailUrl': 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=720',
      'durationSeconds': 30.0,
      'viewCount': 12300,
      'likeCount': 3150,
      'commentCount': 98,
      'saveCount': 640,
      'createdAt': '2026-10-18T14:30:00Z',
    },
    {
      'id': 'reel_prof_3',
      'creatorId': 'usr_web_local_1',
      'title': 'Flutter 3.24 Fluid Micro-Interactions',
      'caption': 'High performance render pipeline & custom shaders.',
      'hlsMasterUrl': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      'thumbnailUrl': 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=720',
      'durationSeconds': 24.0,
      'viewCount': 9400,
      'likeCount': 2280,
      'commentCount': 65,
      'saveCount': 510,
      'createdAt': '2026-10-17T11:00:00Z',
    },
  ];
}
