import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:mobile/core/config/env_config.dart';
import 'package:mobile/core/error/failures.dart';
import 'package:mobile/features/stories/domain/models/story_models.dart';

class StoriesApiClient {
  final String baseUrl;
  final dynamic _httpClient;

  StoriesApiClient({
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
    return 'req_story_$now$random';
  }

  Future<dynamic> _get(
    String endpoint, {
    String? token,
    Map<String, String>? queryParams,
  }) async {
    if (kIsWeb || EnvConfig.mockModeEnabled || _httpClient == null) {
      if (endpoint.contains('/tray')) {
        return _mockStoryTrayJson;
      }
      return [];
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
      return {'success': true, 'id': 'mock_story_${DateTime.now().millisecondsSinceEpoch}'};
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

  Future<dynamic> _delete(
    String endpoint, {
    String? token,
  }) async {
    final uri = Uri.parse('$baseUrl$endpoint');
    final requestId = _generateRequestId();

    try {
      final request = await _httpClient.deleteUrl(uri);
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
  Future<List<CreatorStoryTrayModel>> getStoriesTray({String? token}) async {
    final response = await _get('/api/v1/stories/tray', token: token);
    if (response is List) {
      return response.map((item) => CreatorStoryTrayModel.fromJson(item as Map<String, dynamic>)).toList();
    }
    return [];
  }

  Future<List<StoryModel>> getCreatorStories(String creatorId, {String? token}) async {
    final response = await _get('/api/v1/stories/creator/$creatorId', token: token);
    if (response is List) {
      return response.map((item) => StoryModel.fromJson(item as Map<String, dynamic>)).toList();
    }
    return [];
  }

  Future<StoryModel> getStoryById(String storyId, {String? token}) async {
    final response = await _get('/api/v1/stories/$storyId', token: token);
    return StoryModel.fromJson(response as Map<String, dynamic>);
  }

  Future<StoryModel> createStory(CreateStoryRequest request, {String? token}) async {
    final response = await _post('/api/v1/stories', body: request.toJson(), token: token);
    return StoryModel.fromJson(response as Map<String, dynamic>);
  }

  Future<void> recordView(String storyId, RecordStoryViewRequest request, {String? token}) async {
    await _post('/api/v1/stories/$storyId/view', body: request.toJson(), token: token);
  }

  Future<void> reactToStory(String storyId, String reaction, {String? token}) async {
    await _post('/api/v1/stories/$storyId/react', body: {'reaction': reaction}, token: token);
  }

  Future<void> replyToStory(String storyId, String text, {String? token}) async {
    await _post('/api/v1/stories/$storyId/reply', body: {'text': text}, token: token);
  }

  Future<void> reportStory(String storyId, String reason, String? details, {String? token}) async {
    await _post('/api/v1/stories/$storyId/report', body: {
      'reason': reason,
      if (details != null) 'details': details,
    }, token: token);
  }

  Future<void> deleteStory(String storyId, {String? token}) async {
    await _delete('/api/v1/stories/$storyId', token: token);
  }

  Future<void> addCloseFriend(String friendId, {String? token}) async {
    await _post('/api/v1/stories/close-friends/$friendId', body: {}, token: token);
  }

  Future<void> removeCloseFriend(String friendId, {String? token}) async {
    await _delete('/api/v1/stories/close-friends/$friendId', token: token);
  }

  static final List<Map<String, dynamic>> _mockStoryTrayJson = [
    {
      'creatorId': 'usr_alex',
      'username': 'alex_tech',
      'displayName': 'Alex Rivera',
      'avatarUrl': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
      'isVerified': true,
      'hasUnviewedStories': true,
      'latestStoryAt': '2026-10-19T11:00:00Z',
      'stories': [
        {
          'id': 'st_1',
          'creatorId': 'usr_alex',
          'mediaType': 'PHOTO',
          'mediaUrl': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
          'caption': 'Deploying new multi-agent consensus nodes today! 🚀',
          'audience': 'PUBLIC',
          'allowReplies': 'ALL',
          'expiresAt': '2026-10-20T11:00:00Z',
          'createdAt': '2026-10-19T11:00:00Z',
          'viewCount': 342,
          'hasViewed': false,
        },
      ],
    },
    {
      'creatorId': 'usr_sarah',
      'username': 'sarah_flutter',
      'displayName': 'Sarah Chen',
      'avatarUrl': 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200',
      'isVerified': true,
      'hasUnviewedStories': true,
      'latestStoryAt': '2026-10-19T10:30:00Z',
      'stories': [
        {
          'id': 'st_2',
          'creatorId': 'usr_sarah',
          'mediaType': 'PHOTO',
          'mediaUrl': 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800',
          'caption': 'Zero-location audit passed with 100% pass rate 🛡️',
          'audience': 'PUBLIC',
          'allowReplies': 'ALL',
          'expiresAt': '2026-10-20T10:30:00Z',
          'createdAt': '2026-10-19T10:30:00Z',
          'viewCount': 510,
          'hasViewed': false,
        },
      ],
    },
    {
      'creatorId': 'usr_elena',
      'username': 'cosmic_elena',
      'displayName': 'Dr. Elena Rostova',
      'avatarUrl': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200',
      'isVerified': true,
      'hasUnviewedStories': false,
      'latestStoryAt': '2026-10-19T08:00:00Z',
      'stories': [
        {
          'id': 'st_3',
          'creatorId': 'usr_elena',
          'mediaType': 'PHOTO',
          'mediaUrl': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800',
          'caption': 'James Webb raw spectra just calibrated! 🌌',
          'audience': 'PUBLIC',
          'allowReplies': 'ALL',
          'expiresAt': '2026-10-20T08:00:00Z',
          'createdAt': '2026-10-19T08:00:00Z',
          'viewCount': 1200,
          'hasViewed': true,
        },
      ],
    },
  ];
}
