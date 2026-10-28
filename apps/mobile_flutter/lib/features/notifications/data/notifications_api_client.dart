import 'dart:convert';
import 'dart:io';
import 'package:mobile/core/config/env_config.dart';
import 'package:mobile/core/error/failures.dart';
import 'package:mobile/features/notifications/domain/models/notification_models.dart';

class NotificationsApiClient {
  final String baseUrl;
  final HttpClient _httpClient;

  NotificationsApiClient({
    String? baseUrl,
    HttpClient? httpClient,
  })  : baseUrl = baseUrl ?? EnvConfig.apiBaseUrl,
        _httpClient = httpClient ?? HttpClient() {
    _httpClient.connectionTimeout = const Duration(seconds: 15);
  }

  String _generateRequestId() {
    final now = DateTime.now().millisecondsSinceEpoch;
    final random = (now % 1000000).toString().padLeft(6, '0');
    return 'req_notif_$now$random';
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
    final uri = Uri.parse('$baseUrl$endpoint');
    final requestId = _generateRequestId();

    try {
      final request = await _httpClient.postUrl(uri);
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      request.headers.set(HttpHeaders.contentTypeHeader, 'application/json');
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
        return responseBody.isNotEmpty ? jsonDecode(responseBody) : {};
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
    String endpoint, {
    Map<String, dynamic>? body,
    String? token,
  }) async {
    final uri = Uri.parse('$baseUrl$endpoint');
    final requestId = _generateRequestId();

    try {
      final request = await _httpClient.patchUrl(uri);
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      request.headers.set(HttpHeaders.contentTypeHeader, 'application/json');
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
        return responseBody.isNotEmpty ? jsonDecode(responseBody) : {};
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
    Map<String, dynamic>? body,
    String? token,
  }) async {
    final uri = Uri.parse('$baseUrl$endpoint');
    final requestId = _generateRequestId();

    try {
      final request = await _httpClient.putUrl(uri);
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      request.headers.set(HttpHeaders.contentTypeHeader, 'application/json');
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
        return responseBody.isNotEmpty ? jsonDecode(responseBody) : {};
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
    Map<String, dynamic>? body,
    String? token,
  }) async {
    final uri = Uri.parse('$baseUrl$endpoint');
    final requestId = _generateRequestId();

    try {
      final request = await _httpClient.deleteUrl(uri);
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      request.headers.set(HttpHeaders.contentTypeHeader, 'application/json');
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
        return responseBody.isNotEmpty ? jsonDecode(responseBody) : {};
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
      final decoded = jsonDecode(responseBody);
      if (decoded is Map && decoded['message'] != null) {
        message = decoded['message'].toString();
      }
    } catch (_) {}

    if (statusCode == 400) throw ValidationFailure(message: message);
    if (statusCode == 401) throw AuthenticationFailure(message: message);
    if (statusCode == 403) throw AuthorizationFailure(message: message);
    if (statusCode == 404) throw NotFoundFailure(message: message);
    if (statusCode == 429) throw RateLimitFailure(message: message);
    throw ServerFailure(message: message);
  }

  // ============================================================================
  // PUBLIC NOTIFICATION APIS
  // ============================================================================

  Future<Map<String, dynamic>> getNotifications({
    String? type,
    bool unreadOnly = false,
    int limit = 20,
    int offset = 0,
    String? token,
  }) async {
    final params = <String, String>{
      'limit': limit.toString(),
      'offset': offset.toString(),
    };
    if (type != null && type.isNotEmpty && type != 'ALL') {
      params['type'] = type;
    }
    if (unreadOnly) {
      params['unreadOnly'] = 'true';
    }

    final data = await _get('/api/v1/notifications', token: token, queryParams: params);
    final rawItems = data['items'] as List<dynamic>? ?? [];
    final items = rawItems.map((e) => NotificationModel.fromJson(e as Map<String, dynamic>)).toList();
    final unreadCount = (data['unreadCount'] as num?)?.toInt() ?? 0;

    return {
      'items': items,
      'unreadCount': unreadCount,
    };
  }

  Future<int> getUnreadCount({String? token}) async {
    final data = await _get('/api/v1/notifications/unread-count', token: token);
    return (data['unreadCount'] as num?)?.toInt() ?? 0;
  }

  Future<void> markAsRead({
    required String notificationId,
    String? token,
  }) async {
    await _patch('/api/v1/notifications/$notificationId/read', token: token);
  }

  Future<void> markAllAsRead({String? token}) async {
    await _patch('/api/v1/notifications/read-all', token: token);
  }

  Future<NotificationPreferencesModel> getPreferences({String? token}) async {
    final data = await _get('/api/v1/notifications/preferences', token: token);
    return NotificationPreferencesModel.fromJson(data as Map<String, dynamic>);
  }

  Future<NotificationPreferencesModel> updatePreferences({
    required NotificationPreferencesModel preferences,
    String? token,
  }) async {
    final data = await _put(
      '/api/v1/notifications/preferences',
      body: preferences.toJson(),
      token: token,
    );
    return NotificationPreferencesModel.fromJson(data as Map<String, dynamic>);
  }

  Future<void> registerDeviceToken({
    required String token,
    required String platform,
    String? deviceId,
    String? deviceName,
    String? appVersion,
    String? pushProvider,
    String? userToken,
  }) async {
    await _post(
      '/api/v1/notifications/devices',
      body: {
        'token': token,
        'platform': platform,
        if (deviceId != null) 'deviceId': deviceId,
        if (deviceName != null) 'deviceName': deviceName,
        if (appVersion != null) 'appVersion': appVersion,
        if (pushProvider != null) 'pushProvider': pushProvider,
      },
      token: userToken,
    );
  }

  Future<void> unregisterDeviceToken({
    required String token,
    String? userToken,
  }) async {
    await _delete(
      '/api/v1/notifications/devices',
      body: {'token': token},
      token: userToken,
    );
  }

  Future<DeepLinkResolutionModel> resolveDeepLink({
    required String url,
    String? token,
  }) async {
    final data = await _post(
      '/api/v1/notifications/deep-links/resolve',
      body: {'url': url},
      token: token,
    );
    return DeepLinkResolutionModel.fromJson(data as Map<String, dynamic>);
  }
}
