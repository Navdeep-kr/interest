import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:mobile/core/config/env_config.dart';
import 'package:mobile/core/error/failures.dart';
import 'package:mobile/features/reels/domain/models/reel_item_model.dart';
import 'package:mobile/features/reels/domain/models/comment_item_model.dart';
import 'package:mobile/features/reels/domain/models/collection_item_model.dart';

class ReelsApiClient {
  final String baseUrl;
  final dynamic _httpClient;

  ReelsApiClient({
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
      if (endpoint.contains('/comments')) {
        return _mockCommentsJson;
      }
      if (endpoint.contains('/reels/')) {
        return _mockReelsJson[0];
      }
      return _mockReelsJson;
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
      return {'success': true, 'id': 'mock_${DateTime.now().millisecondsSinceEpoch}'};
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

  Future<dynamic> _patch(
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
      final request = await _httpClient.patchUrl(uri);
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
  // FEED & POSTS APIS
  // ==========================================================================

  Future<List<ReelItemModel>> getFeed({
    int limit = 10,
    String? cursor,
    String? interestId,
    String mode = 'FOR_YOU',
    String? token,
  }) async {
    final queryParams = <String, String>{
      'limit': limit.toString(),
      'mode': mode,
    };
    if (cursor != null && cursor.isNotEmpty) queryParams['cursor'] = cursor;
    if (interestId != null && interestId.isNotEmpty) {
      queryParams['interestId'] = interestId;
    }

    final res = await _get('/feed', token: token, queryParams: queryParams);
    final rawList = res is List ? res : (res['items'] as List<dynamic>? ?? []);
    return rawList
        .map((e) => ReelItemModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Map<String, dynamic>> applyFeedControl({
    required String reelId,
    required String action,
    String? interestId,
    required String token,
  }) async {
    final body = {
      'reelId': reelId,
      'action': action,
      if (interestId != null && interestId.isNotEmpty) 'interestId': interestId,
    };
    final res = await _post('/feed/controls', body, token: token);
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> resetFeedPreferences({
    required String token,
  }) async {
    final res = await _post('/feed/preferences/reset', {}, token: token);
    return res as Map<String, dynamic>;
  }

  Future<ReelItemModel> getReelById(String reelId, {String? token}) async {
    final res = await _get('/reels/$reelId', token: token);
    return ReelItemModel.fromJson(res as Map<String, dynamic>);
  }

  Future<List<ReelItemModel>> getCreatorReels(
    String creatorId, {
    int limit = 20,
    String? cursor,
    String? token,
  }) async {
    final queryParams = <String, String>{
      'limit': limit.toString(),
    };
    if (cursor != null && cursor.isNotEmpty) queryParams['cursor'] = cursor;

    final res = await _get(
      '/reels/creator/$creatorId',
      token: token,
      queryParams: queryParams,
    );
    final rawList = res is List ? res : (res['items'] as List<dynamic>? ?? []);
    return rawList
        .map((e) => ReelItemModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<ReelItemModel> createImagePost({
    required String title,
    String? caption,
    required List<String> imageUrls,
    required String primaryInterestId,
    List<String>? interestTags,
    List<String>? hashtags,
    String visibility = 'PUBLIC',
    required String token,
  }) async {
    final body = {
      'title': title,
      if (caption != null) 'caption': caption,
      'imageUrls': imageUrls,
      'primaryInterestId': primaryInterestId,
      if (interestTags != null) 'interestTags': interestTags,
      if (hashtags != null) 'hashtags': hashtags,
      'visibility': visibility,
    };
    final res = await _post('/reels/image-post', body, token: token);
    return ReelItemModel.fromJson(res as Map<String, dynamic>);
  }

  Future<ReelItemModel> updateReel(
    String reelId, {
    String? title,
    String? caption,
    List<String>? hashtags,
    String? visibility,
    bool? isPinned,
    required String token,
  }) async {
    final body = <String, dynamic>{};
    if (title != null) body['title'] = title;
    if (caption != null) body['caption'] = caption;
    if (hashtags != null) body['hashtags'] = hashtags;
    if (visibility != null) body['visibility'] = visibility;
    if (isPinned != null) body['isPinned'] = isPinned;

    final res = await _patch('/reels/$reelId', body, token: token);
    return ReelItemModel.fromJson(res as Map<String, dynamic>);
  }

  Future<void> deleteReel(String reelId, {required String token}) async {
    await _delete('/reels/$reelId', token: token);
  }

  Future<ReelItemModel> pinReel(String reelId, {required String token}) async {
    final res = await _post('/reels/$reelId/pin', {}, token: token);
    return ReelItemModel.fromJson(res as Map<String, dynamic>);
  }

  Future<ReelItemModel> unpinReel(String reelId, {required String token}) async {
    final res = await _delete('/reels/$reelId/pin', token: token);
    return ReelItemModel.fromJson(res as Map<String, dynamic>);
  }

  Future<void> hideReel(String reelId, {required String token}) async {
    await _post('/reels/$reelId/hide', {}, token: token);
  }

  Future<void> unhideReel(String reelId, {required String token}) async {
    await _delete('/reels/$reelId/hide', token: token);
  }

  // ==========================================================================
  // MULTIPART VIDEO UPLOAD APIS
  // ==========================================================================

  Future<Map<String, dynamic>> initiateMultipartUpload({
    required String filename,
    required String contentType,
    required int fileSizeBytes,
    required String token,
  }) async {
    final body = {
      'filename': filename,
      'contentType': contentType,
      'fileSizeBytes': fileSizeBytes,
    };
    final res = await _post('/reels/multipart/initiate', body, token: token);
    return res as Map<String, dynamic>;
  }

  Future<List<Map<String, dynamic>>> getMultipartPartUrls({
    required String reelId,
    required String uploadId,
    required String s3Key,
    required List<int> partNumbers,
    required String token,
  }) async {
    final body = {
      'reelId': reelId,
      'uploadId': uploadId,
      's3Key': s3Key,
      'partNumbers': partNumbers,
    };
    final res = await _post('/reels/multipart/part-urls', body, token: token);
    final list = res is List ? res : (res['urls'] as List<dynamic>? ?? []);
    return list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  Future<Map<String, dynamic>> completeMultipartUpload({
    required String reelId,
    required String uploadId,
    required String s3Key,
    required List<Map<String, dynamic>> parts,
    required String token,
  }) async {
    final body = {
      'reelId': reelId,
      'uploadId': uploadId,
      's3Key': s3Key,
      'parts': parts,
    };
    final res = await _post('/reels/multipart/complete', body, token: token);
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> abortMultipartUpload({
    required String reelId,
    required String uploadId,
    required String s3Key,
    required String token,
  }) async {
    final body = {
      'reelId': reelId,
      'uploadId': uploadId,
      's3Key': s3Key,
    };
    final res = await _post('/reels/multipart/abort', body, token: token);
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> finalizeReel({
    required String reelId,
    required String title,
    String? caption,
    List<String>? hashtags,
    required String primaryInterestId,
    List<String>? interestTagIds,
    String visibility = 'PUBLIC',
    double coverTimestampSeconds = 1.0,
    required String token,
  }) async {
    final body = {
      'reelId': reelId,
      'title': title,
      if (caption != null) 'caption': caption,
      if (hashtags != null) 'hashtags': hashtags,
      'primaryInterestId': primaryInterestId,
      if (interestTagIds != null) 'interestTagIds': interestTagIds,
      'visibility': visibility,
      'coverTimestampSeconds': coverTimestampSeconds,
    };
    final res = await _post('/reels/finalize', body, token: token);
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getReelStatus(String reelId, {required String token}) async {
    final res = await _get('/reels/$reelId/status', token: token);
    return res as Map<String, dynamic>;
  }

  // ==========================================================================
  // ENGAGEMENT: LIKES, SAVES, SHARES
  // ==========================================================================

  Future<Map<String, dynamic>> likeReel(String reelId, {required String token}) async {
    final res = await _post('/interactions/reels/$reelId/like', {}, token: token);
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> unlikeReel(String reelId, {required String token}) async {
    final res = await _delete('/interactions/reels/$reelId/like', token: token);
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> saveReel(
    String reelId, {
    String? collectionId,
    required String token,
  }) async {
    final body = <String, dynamic>{};
    if (collectionId != null && collectionId.isNotEmpty) {
      body['collectionId'] = collectionId;
    }
    final res = await _post('/interactions/reels/$reelId/save', body, token: token);
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> unsaveReel(String reelId, {required String token}) async {
    final res = await _delete('/interactions/reels/$reelId/save', token: token);
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> shareReel(
    String reelId, {
    String? platform,
    required String token,
  }) async {
    final body = <String, dynamic>{};
    if (platform != null) body['platform'] = platform;
    final res = await _post('/interactions/reels/$reelId/share', body, token: token);
    return res as Map<String, dynamic>;
  }

  // ==========================================================================
  // ENGAGEMENT: COMMENTS
  // ==========================================================================

  Future<List<CommentItemModel>> getComments(
    String reelId, {
    int limit = 20,
    String? cursor,
    String? token,
  }) async {
    final queryParams = <String, String>{
      'limit': limit.toString(),
    };
    if (cursor != null && cursor.isNotEmpty) queryParams['cursor'] = cursor;

    final res = await _get(
      '/interactions/reels/$reelId/comments',
      token: token,
      queryParams: queryParams,
    );
    final rawList = res is List ? res : (res['items'] as List<dynamic>? ?? []);
    return rawList
        .map((e) => CommentItemModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<CommentItemModel> addComment(
    String reelId, {
    required String text,
    String? parentId,
    required String token,
  }) async {
    final body = {
      'text': text,
      if (parentId != null) 'parentId': parentId,
    };
    final res = await _post(
      '/interactions/reels/$reelId/comments',
      body,
      token: token,
    );
    return CommentItemModel.fromJson(res as Map<String, dynamic>);
  }

  Future<Map<String, dynamic>> likeComment(String commentId, {required String token}) async {
    final res = await _post('/interactions/comments/$commentId/like', {}, token: token);
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> unlikeComment(String commentId, {required String token}) async {
    final res = await _delete('/interactions/comments/$commentId/like', token: token);
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> pinComment(String commentId, {required String token}) async {
    final res = await _post('/interactions/comments/$commentId/pin', {}, token: token);
    return res as Map<String, dynamic>;
  }

  Future<void> deleteComment(String commentId, {required String token}) async {
    await _delete('/interactions/comments/$commentId', token: token);
  }

  // ==========================================================================
  // COLLECTIONS
  // ==========================================================================

  Future<List<CollectionItemModel>> getCollections({required String token}) async {
    final res = await _get('/interactions/collections', token: token);
    final rawList = res is List ? res : (res['items'] as List<dynamic>? ?? []);
    return rawList
        .map((e) => CollectionItemModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<CollectionItemModel> createCollection({
    required String name,
    bool isPrivate = true,
    required String token,
  }) async {
    final body = {
      'name': name,
      'isPrivate': isPrivate,
    };
    final res = await _post('/interactions/collections', body, token: token);
    return CollectionItemModel.fromJson(res as Map<String, dynamic>);
  }

  static final List<Map<String, dynamic>> _mockReelsJson = [
    {
      'id': 'reel_mock_1',
      'creatorId': 'usr_alex',
      'creator': {
        'id': 'usr_alex',
        'username': 'alex_tech',
        'displayName': 'Alex Rivera',
        'avatarUrl': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
      },
      'title': 'Autonomous Multi-Agent AI Architecture',
      'caption': 'Building resilient distributed AI coding agents with zero-location telemetry and deterministic state machines. Pure interest-driven engineering!',
      'hlsMasterUrl': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      'thumbnailUrl': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=720',
      'durationSeconds': 45.0,
      'primaryInterestId': 'topic_ai',
      'interestTags': ['AI', 'Machine Learning', 'Autonomous Systems'],
      'viewCount': 18450,
      'likeCount': 4210,
      'commentCount': 184,
      'saveCount': 920,
      'shareCount': 412,
      'isLiked': false,
      'isSaved': false,
      'isFollowing': true,
      'isPinned': true,
      'mediaType': 'video',
      'imageUrls': <String>[],
      'visibility': 'public',
      'hashtags': ['#AI', '#Tech', '#Architecture'],
      'explanation': 'Recommended based on your interest in Machine Learning & Systems',
      'createdAt': '2026-10-19T10:00:00Z',
    },
    {
      'id': 'reel_mock_2',
      'creatorId': 'usr_sarah',
      'creator': {
        'id': 'usr_sarah',
        'username': 'sarah_flutter',
        'displayName': 'Sarah Chen',
        'avatarUrl': 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200',
      },
      'title': 'Zero-Location Privacy by Design',
      'caption': 'Why Interest guarantees 0 GPS permissions and AST-level stripping of location metadata. Absolute privacy for every creator and community.',
      'hlsMasterUrl': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      'thumbnailUrl': 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=720',
      'durationSeconds': 30.0,
      'primaryInterestId': 'topic_privacy',
      'interestTags': ['Privacy', 'Flutter', 'Security'],
      'viewCount': 12300,
      'likeCount': 3150,
      'commentCount': 98,
      'saveCount': 640,
      'shareCount': 280,
      'isLiked': true,
      'isSaved': true,
      'isFollowing': false,
      'isPinned': false,
      'isSuperfanOnly': true,
      'mediaType': 'video',
      'imageUrls': <String>[],
      'visibility': 'public',
      'hashtags': ['#Privacy', '#ZeroLocation', '#Security'],
      'explanation': 'Trending in Privacy & Security',
      'createdAt': '2026-10-19T09:30:00Z',
    },
    {
      'id': 'reel_mock_3',
      'creatorId': 'usr_elena',
      'creator': {
        'id': 'usr_elena',
        'username': 'cosmic_elena',
        'displayName': 'Dr. Elena Rostova',
        'avatarUrl': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200',
      },
      'title': 'James Webb Deep Space Spiral Galaxy',
      'caption': 'Captured over 14 hours of infrared exposure. The scale and complexity of the distant cosmos is humbling.',
      'hlsMasterUrl': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
      'thumbnailUrl': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=720',
      'durationSeconds': 60.0,
      'primaryInterestId': 'topic_astronomy',
      'interestTags': ['Astronomy', 'Space', 'JWST'],
      'viewCount': 45200,
      'likeCount': 12800,
      'commentCount': 512,
      'saveCount': 3400,
      'shareCount': 1850,
      'isLiked': false,
      'isSaved': false,
      'isFollowing': true,
      'isPinned': false,
      'mediaType': 'video',
      'imageUrls': <String>[],
      'visibility': 'public',
      'hashtags': ['#Space', '#Astronomy', '#Cosmos'],
      'explanation': 'Popular in Astronomy & Science',
      'createdAt': '2026-10-19T08:00:00Z',
    },
    {
      'id': 'reel_mock_4',
      'creatorId': 'usr_julian',
      'creator': {
        'id': 'usr_julian',
        'username': 'neo_producer',
        'displayName': 'Julian Vance',
        'avatarUrl': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
      },
      'title': 'Modular Synthesizer Patch Experiment',
      'caption': 'Live analog patch routing through dual bandpass filters and bucket-brigade delay line. Headphones recommended!',
      'hlsMasterUrl': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      'thumbnailUrl': 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=720',
      'durationSeconds': 50.0,
      'primaryInterestId': 'topic_music',
      'interestTags': ['Synthesizers', 'Music Production', 'Sound Design'],
      'viewCount': 9800,
      'likeCount': 2450,
      'commentCount': 88,
      'saveCount': 710,
      'shareCount': 195,
      'isLiked': false,
      'isSaved': false,
      'isFollowing': false,
      'isPinned': false,
      'isSuperfanOnly': true,
      'mediaType': 'video',
      'imageUrls': <String>[],
      'visibility': 'public',
      'hashtags': ['#Synth', '#SoundDesign', '#Music'],
      'explanation': 'Recommended from your interest in Audio Engineering',
      'createdAt': '2026-10-19T07:15:00Z',
    },
  ];

  static final List<Map<String, dynamic>> _mockCommentsJson = [
    {
      'id': 'cmt_1',
      'reelId': 'reel_mock_1',
      'userId': 'usr_dan',
      'user': {
        'id': 'usr_dan',
        'username': 'security_dan',
        'displayName': 'Dan Miller',
        'avatarUrl': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200',
      },
      'content': 'The zero-location architecture is top tier engineering. Real privacy by design!',
      'likeCount': 42,
      'isLiked': true,
      'createdAt': '2026-10-19T10:15:00Z',
    },
    {
      'id': 'cmt_2',
      'reelId': 'reel_mock_1',
      'userId': 'usr_maya',
      'user': {
        'id': 'usr_maya',
        'username': 'maya_ui',
        'displayName': 'Maya Lin',
        'avatarUrl': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
      },
      'content': 'This dark mode interface and fluid scroll is super satisfying.',
      'likeCount': 19,
      'isLiked': false,
      'createdAt': '2026-10-19T10:20:00Z',
    },
  ];
}
