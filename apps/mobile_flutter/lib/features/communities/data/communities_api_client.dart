import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:mobile/core/config/env_config.dart';
import 'package:mobile/core/error/failures.dart';
import 'package:mobile/features/communities/domain/models/community_models.dart';

class CommunitiesApiClient {
  final String baseUrl;
  final dynamic _httpClient;

  CommunitiesApiClient({
    String? baseUrl,
    dynamic httpClient,
  })  : baseUrl = baseUrl ?? EnvConfig.apiBaseUrl,
        _httpClient = httpClient ?? (kIsWeb ? null : _createDefaultClient()) {
    if (!kIsWeb && _httpClient is HttpClient) {
      _httpClient.connectionTimeout = const Duration(seconds: 20);
    }
  }

  static dynamic _createDefaultClient() {
    if (kIsWeb) return null;
    return HttpClient();
  }

  String _generateRequestId() {
    final now = DateTime.now().millisecondsSinceEpoch;
    final random = (now % 1000000).toString().padLeft(6, '0');
    return 'req_comm_$now$random';
  }

  Future<dynamic> _get(
    String endpoint, {
    String? token,
    Map<String, String>? queryParams,
  }) async {
    if (kIsWeb || EnvConfig.mockModeEnabled || _httpClient == null) {
      if (endpoint.contains('/communities/')) {
        return _mockCommunitiesJson[0];
      }
      return _mockCommunitiesJson;
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

      final response = await request.close().timeout(const Duration(seconds: 20));
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
    required Map<String, dynamic> body,
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

      request.write(jsonEncode(body));
      final response = await request.close().timeout(const Duration(seconds: 20));
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
    String endpoint, {
    required Map<String, dynamic> body,
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

      request.write(jsonEncode(body));
      final response = await request.close().timeout(const Duration(seconds: 20));
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
    String message = 'An error occurred';
    try {
      final parsed = jsonDecode(responseBody);
      if (parsed is Map && parsed.containsKey('message')) {
        message = parsed['message'] is List
            ? (parsed['message'] as List).join(', ')
            : parsed['message'].toString();
      }
    } catch (_) {
      message = responseBody;
    }

    if (statusCode == 400) throw ValidationFailure(message: message);
    if (statusCode == 401) throw AuthenticationFailure(message: message);
    if (statusCode == 403) throw AuthorizationFailure(message: message);
    if (statusCode == 404) throw NotFoundFailure(message: message);
    throw ServerFailure(message: message, statusCode: statusCode);
  }

  // API Methods
  Future<List<CommunityModel>> listCommunities({
    String? interestId,
    bool? joinedOnly,
    String? search,
    String? token,
  }) async {
    final queryParams = <String, String>{};
    if (interestId != null) queryParams['interestId'] = interestId;
    if (joinedOnly == true) queryParams['joinedOnly'] = 'true';
    if (search != null && search.isNotEmpty) queryParams['search'] = search;

    final response = await _get('/api/v1/communities', queryParams: queryParams, token: token);
    if (response is List) {
      return response.map((item) => CommunityModel.fromJson(item as Map<String, dynamic>)).toList();
    }
    return [];
  }

  Future<CommunityModel> getCommunity(String identifier, {String? token}) async {
    final response = await _get('/api/v1/communities/$identifier', token: token);
    return CommunityModel.fromJson(response as Map<String, dynamic>);
  }

  Future<CommunityModel> createCommunity(Map<String, dynamic> body, {String? token}) async {
    final response = await _post('/api/v1/communities', body: body, token: token);
    return CommunityModel.fromJson(response as Map<String, dynamic>);
  }

  Future<void> joinCommunity(String communityId, {String? token}) async {
    await _post('/api/v1/communities/$communityId/join', body: {}, token: token);
  }

  Future<void> leaveCommunity(String communityId, {String? token}) async {
    await _post('/api/v1/communities/$communityId/leave', body: {}, token: token);
  }

  Future<void> inviteUser(String communityId, String targetUserId, {String? token}) async {
    await _post('/api/v1/communities/$communityId/invite', body: {'userId': targetUserId}, token: token);
  }

  Future<CommunityPostModel> createPost(String communityId, Map<String, dynamic> body, {String? token}) async {
    final response = await _post('/api/v1/communities/$communityId/posts', body: body, token: token);
    return CommunityPostModel.fromJson(response as Map<String, dynamic>);
  }

  Future<List<CommunityPostModel>> listPosts(
    String communityId, {
    String? postType,
    bool? pinnedOnly,
    String? token,
  }) async {
    final queryParams = <String, String>{};
    if (postType != null) queryParams['postType'] = postType;
    if (pinnedOnly == true) queryParams['pinnedOnly'] = 'true';

    final response = await _get('/api/v1/communities/$communityId/posts', queryParams: queryParams, token: token);
    if (response is List) {
      return response.map((p) => CommunityPostModel.fromJson(p as Map<String, dynamic>)).toList();
    }
    return [];
  }

  Future<void> togglePinPost(String communityId, String postId, {String? token}) async {
    await _post('/api/v1/communities/$communityId/posts/$postId/pin', body: {}, token: token);
  }

  Future<void> respondToCollaboration(String postId, String status, {String? token}) async {
    await _post('/api/v1/communities/posts/$postId/collaborate', body: {'status': status}, token: token);
  }

  Future<List<CommunityCollectionModel>> listCollections(String communityId, {String? token}) async {
    final response = await _get('/api/v1/communities/$communityId/collections', token: token);
    if (response is List) {
      return response.map((c) => CommunityCollectionModel.fromJson(c as Map<String, dynamic>)).toList();
    }
    return [];
  }

  Future<void> reportTarget(String communityId, Map<String, dynamic> body, {String? token}) async {
    await _post('/api/v1/communities/$communityId/report', body: body, token: token);
  }

  Future<List<CommunityReportModel>> getModerationQueue(String communityId, {String? token}) async {
    final response = await _get('/api/v1/communities/$communityId/moderation/queue', token: token);
    if (response is List) {
      return response.map((r) => CommunityReportModel.fromJson(r as Map<String, dynamic>)).toList();
    }
    return [];
  }

  Future<void> reviewReport(String communityId, String reportId, Map<String, dynamic> body, {String? token}) async {
    await _post('/api/v1/communities/$communityId/moderation/reports/$reportId', body: body, token: token);
  }

  Future<void> submitAppeal(String communityId, String appealReason, {String? token}) async {
    await _post('/api/v1/communities/$communityId/appeals', body: {'appealReason': appealReason}, token: token);
  }

  Future<void> updateMemberRole(String communityId, String targetUserId, String role, {String? token}) async {
    await _put('/api/v1/communities/$communityId/members/$targetUserId/role', body: {'role': role}, token: token);
  }

  Future<void> moderateMember(String communityId, String targetUserId, Map<String, dynamic> body, {String? token}) async {
    await _post('/api/v1/communities/$communityId/members/$targetUserId/moderate', body: body, token: token);
  }

  Future<void> handoverOwnership(String communityId, String newOwnerId, {String? token}) async {
    await _post('/api/v1/communities/$communityId/handover', body: {'newOwnerId': newOwnerId}, token: token);
  }

  static final List<Map<String, dynamic>> _mockCommunitiesJson = [
    {
      'id': 'comm_1',
      'creatorId': 'usr_alex',
      'name': 'Autonomous AI & Agents',
      'slug': 'autonomous-ai',
      'description': 'Exploring LLMs, autonomous agents, and multi-agent consensus protocols.',
      'avatarUrl': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200',
      'bannerUrl': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200',
      'visibility': 'PUBLIC',
      'guidelines': [
        {'id': 'g_1', 'title': 'Respectful Collaboration', 'description': 'Constructive technical feedback only.'},
        {'id': 'g_2', 'title': 'No Location Tracking', 'description': 'Preserve zero-location privacy in all shares.'},
      ],
      'membersCount': 4230,
      'postsCount': 185,
      'isActive': true,
      'userRole': 'MEMBER',
      'userStatus': 'ACTIVE',
      'createdAt': '2026-01-15T00:00:00Z',
      'updatedAt': '2026-10-19T00:00:00Z',
    },
    {
      'id': 'comm_2',
      'creatorId': 'usr_sarah',
      'name': 'Flutter & Dart Developers',
      'slug': 'flutter-dart',
      'description': 'Building beautiful, zero-bloat reactive mobile and desktop apps.',
      'avatarUrl': 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=200',
      'bannerUrl': 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1200',
      'visibility': 'PUBLIC',
      'guidelines': [
        {'id': 'g_3', 'title': 'Clean Architecture', 'description': 'Keep domain and UI layers separated.'},
      ],
      'membersCount': 6890,
      'postsCount': 412,
      'isActive': true,
      'userRole': 'MEMBER',
      'userStatus': 'ACTIVE',
      'createdAt': '2026-02-01T00:00:00Z',
      'updatedAt': '2026-10-19T00:00:00Z',
    },
    {
      'id': 'comm_3',
      'creatorId': 'usr_elena',
      'name': 'Deep Space Astrophotography',
      'slug': 'space-astrophotography',
      'description': 'Observing the universe, deep-sky astrophotography, and JWST imaging.',
      'avatarUrl': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=200',
      'bannerUrl': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200',
      'visibility': 'PUBLIC',
      'guidelines': [
        {'id': 'g_4', 'title': 'Original Image Attribution', 'description': 'Credit telescopes and capture gear.'},
      ],
      'membersCount': 8410,
      'postsCount': 520,
      'isActive': true,
      'userRole': 'MEMBER',
      'userStatus': 'ACTIVE',
      'createdAt': '2026-03-10T00:00:00Z',
      'updatedAt': '2026-10-19T00:00:00Z',
    },
  ];
}
