import 'dart:convert';
import 'dart:io';
import 'package:mobile/core/config/env_config.dart';
import 'package:mobile/core/error/failures.dart';
import 'package:mobile/features/creator/domain/models/creator_models.dart';
import 'package:mobile/features/creator/domain/models/analytics_models.dart';

class CreatorApiClient {
  final String baseUrl;
  final HttpClient _httpClient;

  CreatorApiClient({
    String? baseUrl,
    HttpClient? httpClient,
  })  : baseUrl = baseUrl ?? EnvConfig.apiBaseUrl,
        _httpClient = httpClient ?? HttpClient() {
    _httpClient.connectionTimeout = const Duration(seconds: 20);
  }

  String _generateRequestId() {
    final now = DateTime.now().millisecondsSinceEpoch;
    final random = (now % 1000000).toString().padLeft(6, '0');
    return 'req_creator_$now$random';
  }

  Future<dynamic> _get(
    String endpoint, {
    String? token,
    Map<String, String>? queryParams,
  }) async {
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
    if (statusCode == 409) throw ValidationFailure(message: message);
    if (statusCode == 429) throw RateLimitFailure(message: message);
    throw ServerFailure(message: message);
  }

  // ============================================================================
  // PUBLIC CREATOR API CONTRACTS
  // ============================================================================

  /// Fetches licensed sounds from the audio library.
  Future<List<LicensedSoundModel>> getLicensedSounds({
    String? query,
    int limit = 20,
    int offset = 0,
    String? token,
  }) async {
    final params = <String, String>{
      'limit': limit.toString(),
      'offset': offset.toString(),
    };
    if (query != null && query.isNotEmpty) {
      params['q'] = query;
    }

    final res = await _get('/creator/sounds', token: token, queryParams: params);
    final rawSounds = res['sounds'] as List<dynamic>? ?? [];
    return rawSounds.map((s) => LicensedSoundModel.fromJson(s as Map<String, dynamic>)).toList();
  }

  /// Saves or updates a creator draft with the full studio editing recipe.
  Future<CreatorDraftModel> saveDraft({
    required CreatorDraftModel draft,
    String? token,
  }) async {
    final payload = draft.toJson();
    if (draft.id.isNotEmpty && !draft.id.startsWith('local_')) {
      final res = await _put('/creator/drafts/${draft.id}', body: payload, token: token);
      return CreatorDraftModel.fromJson(res as Map<String, dynamic>);
    } else {
      final res = await _post('/creator/drafts', body: payload, token: token);
      return CreatorDraftModel.fromJson(res as Map<String, dynamic>);
    }
  }

  /// Fetches all saved drafts for the creator.
  Future<List<CreatorDraftModel>> getDrafts({String? token}) async {
    final res = await _get('/creator/drafts', token: token);
    if (res is List) {
      return res.map((d) => CreatorDraftModel.fromJson(d as Map<String, dynamic>)).toList();
    }
    return [];
  }

  /// Retrieves a specific draft by ID.
  Future<CreatorDraftModel> getDraftById({
    required String draftId,
    String? token,
  }) async {
    final res = await _get('/creator/drafts/$draftId', token: token);
    return CreatorDraftModel.fromJson(res as Map<String, dynamic>);
  }

  /// Deletes a draft by ID.
  Future<void> deleteDraft({
    required String draftId,
    String? token,
  }) async {
    await _delete('/creator/drafts/$draftId', token: token);
  }

  /// Publishes or schedules a reel idempotently using clientPublicationId.
  Future<PublishingSessionModel> publishOrSchedule({
    required Map<String, dynamic> payload,
    String? token,
  }) async {
    final res = await _post('/creator/publish', body: payload, token: token);
    return PublishingSessionModel.fromJson(res as Map<String, dynamic>);
  }

  /// Recovers publishing status for an active upload/transcode session.
  Future<PublishingSessionModel> getPublishingStatus({
    required String identifier,
    String? token,
  }) async {
    final res = await _get('/creator/publish/status/$identifier', token: token);
    return PublishingSessionModel.fromJson(res as Map<String, dynamic>);
  }

  /// Updates metadata for an already published or scheduled reel.
  Future<void> updatePublishedReel({
    required String reelId,
    required Map<String, dynamic> data,
    String? token,
  }) async {
    await _put('/creator/reels/$reelId', body: data, token: token);
  }

  /// Deletes a published or scheduled reel.
  Future<void> deleteReel({
    required String reelId,
    String? token,
  }) async {
    await _delete('/creator/reels/$reelId', token: token);
  }

  /// Fetches verified, server-side creator analytics.
  Future<VerifiedCreatorAnalyticsModel> getVerifiedAnalytics({
    String range = '30d',
    String? startDate,
    String? endDate,
    String? timezone,
    String? reelId,
    String? token,
  }) async {
    final queryParams = <String, String>{
      'range': range,
    };
    if (startDate != null) queryParams['startDate'] = startDate;
    if (endDate != null) queryParams['endDate'] = endDate;
    if (timezone != null) queryParams['timezone'] = timezone;
    if (reelId != null) queryParams['reelId'] = reelId;

    final res = await _get('/creator/analytics', token: token, queryParams: queryParams);
    return VerifiedCreatorAnalyticsModel.fromJson(res as Map<String, dynamic>);
  }

  /// Ingests a playback or interaction engagement telemetry event.
  Future<Map<String, dynamic>> recordEngagementEvent({
    required Map<String, dynamic> eventData,
    String? token,
  }) async {
    final res = await _post('/creator/analytics/events', body: eventData, token: token);
    return res as Map<String, dynamic>;
  }

  /// Retrieves list of scheduled reels.
  Future<List<ScheduledReelItemModel>> getScheduledReels({String? token}) async {
    final res = await _get('/creator/scheduled', token: token);
    if (res is List) {
      return res.map((item) => ScheduledReelItemModel.fromJson(item as Map<String, dynamic>)).toList();
    }
    return [];
  }

  /// Schedules a processed reel for future publishing.
  Future<Map<String, dynamic>> scheduleReel({
    required String reelId,
    required String scheduledAt,
    int? clientTimezoneOffsetMinutes,
    String? token,
  }) async {
    final body = <String, dynamic>{
      'reelId': reelId,
      'scheduledAt': scheduledAt,
    };
    if (clientTimezoneOffsetMinutes != null) {
      body['clientTimezoneOffsetMinutes'] = clientTimezoneOffsetMinutes;
    }
    final res = await _post('/creator/schedule', body: body, token: token);
    return res as Map<String, dynamic>;
  }

  /// Cancels a scheduled reel.
  Future<void> cancelScheduledReel({
    required String reelId,
    String? token,
  }) async {
    await _delete('/creator/scheduled/$reelId', token: token);
  }
}
