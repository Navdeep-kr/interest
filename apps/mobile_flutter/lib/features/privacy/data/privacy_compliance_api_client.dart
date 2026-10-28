import 'dart:convert';
import 'dart:io';
import 'package:mobile/core/config/env_config.dart';
import 'package:mobile/core/error/failures.dart';
import 'package:mobile/features/privacy/domain/models/privacy_compliance_models.dart';

class PrivacyComplianceApiClient {
  final String baseUrl;
  final HttpClient _httpClient;

  PrivacyComplianceApiClient({
    String? baseUrl,
    HttpClient? httpClient,
  })  : baseUrl = baseUrl ?? EnvConfig.apiBaseUrl,
        _httpClient = httpClient ?? HttpClient() {
    _httpClient.connectionTimeout = const Duration(seconds: 20);
  }

  String _generateRequestId() {
    final now = DateTime.now().millisecondsSinceEpoch;
    return 'req_privacy_$now';
  }

  Future<dynamic> _get(String endpoint, {String? token}) async {
    final uri = Uri.parse('$baseUrl$endpoint');
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

  Future<dynamic> _put(String endpoint, {required dynamic body, String? token}) async {
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

      final payload = jsonEncode(body);
      request.add(utf8.encode(payload));

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

  Future<dynamic> _post(String endpoint, {required dynamic body, String? token}) async {
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

      final payload = jsonEncode(body);
      request.add(utf8.encode(payload));

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

  Future<dynamic> _delete(String endpoint, {String? token}) async {
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
    try {
      final json = jsonDecode(responseBody);
      final message = json['message'] is List
          ? (json['message'] as List).join(', ')
          : (json['message'] ?? 'Request failed');

      if (statusCode == 400) throw ValidationFailure(message: message, statusCode: 400);
      if (statusCode == 401) throw const AuthFailure(message: 'Unauthorized', statusCode: 401);
      if (statusCode == 403) throw AuthorizationFailure(message: message, statusCode: 403);
      if (statusCode == 404) throw NotFoundFailure(message: message, statusCode: 404);
      if (statusCode == 409) throw ValidationFailure(message: message, statusCode: 409);
      throw ServerFailure(message: message, statusCode: statusCode);
    } catch (e) {
      if (e is Failure) rethrow;
      throw ServerFailure(message: 'HTTP $statusCode: $responseBody');
    }
  }

  Future<PrivacySettingsModel> getPrivacySettings({required String token}) async {
    final res = await _get('/compliance/privacy-settings', token: token);
    return PrivacySettingsModel.fromJson(res);
  }

  Future<PrivacySettingsModel> updatePrivacySettings(PrivacySettingsModel settings, {required String token}) async {
    final res = await _put('/compliance/privacy-settings', body: settings.toJson(), token: token);
    return PrivacySettingsModel.fromJson(res);
  }

  Future<List<UserSessionModel>> getUserSessions({required String token}) async {
    final res = await _get('/compliance/sessions', token: token);
    return (res as List).map((i) => UserSessionModel.fromJson(i)).toList();
  }

  Future<void> revokeSession(String sessionId, {required String token}) async {
    await _delete('/compliance/sessions/$sessionId', token: token);
  }

  Future<int> revokeAllOtherSessions({required String token}) async {
    final res = await _delete('/compliance/sessions/all-other', token: token);
    return res['revokedCount'] as int? ?? 0;
  }

  Future<AccountDeletionRequestModel> requestAccountDeletion({
    String? reason,
    required String token,
  }) async {
    final res = await _post(
      '/compliance/account/delete',
      body: {
        'confirmImmediateFreeze': true,
        if (reason != null && reason.isNotEmpty) 'reason': reason,
      },
      token: token,
    );
    return AccountDeletionRequestModel.fromJson(res);
  }

  Future<void> cancelAccountDeletion({required String token}) async {
    await _post('/compliance/account/cancel-deletion', body: {}, token: token);
  }

  Future<DataExportRequestModel> requestDataExport({required String token}) async {
    final res = await _post('/compliance/export', body: {'format': 'JSON'}, token: token);
    return DataExportRequestModel.fromJson(res);
  }
}
