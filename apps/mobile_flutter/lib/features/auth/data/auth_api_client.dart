import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import '../../../core/config/env_config.dart';
import '../../../core/error/failures.dart';
import '../domain/models/auth_tokens.dart';
import '../domain/models/auth_user.dart';
import '../domain/models/user_session.dart';

class AuthResponse {
  final AuthUser user;
  final AuthTokens tokens;

  AuthResponse({required this.user, required this.tokens});
}

class AuthApiClient {
  final String baseUrl;
  final dynamic _httpClient;

  AuthApiClient({
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

  /// Generates a unique request identifier for distributed tracing.
  String _generateRequestId() {
    final now = DateTime.now().millisecondsSinceEpoch;
    final random = (now % 1000000).toString().padLeft(6, '0');
    return 'req_$now$random';
  }

  Future<Map<String, dynamic>> _post(
    String endpoint,
    Map<String, dynamic> body, {
    String? token,
  }) async {
    if (kIsWeb || EnvConfig.mockModeEnabled || _httpClient == null) {
      if (endpoint.contains('/login')) {
        return {
          'user': {
            'id': 'usr_alex_dev',
            'username': body['identifier'] ?? 'alex_architect',
            'displayName': 'Alex Rivera',
            'isMinor': false,
            'isPrivateAccount': false,
            'email': 'alex@interest.app',
            'avatarUrl': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
            'bio': 'Distributed systems architect & UI creator',
          },
          'tokens': {
            'accessToken': 'ey_web_mock_access_token_12345',
            'refreshToken': 'ey_web_mock_refresh_token_67890',
            'tokenType': 'Bearer',
            'expiresIn': 3600,
          },
        };
      }
      if (endpoint.contains('/register')) {
        return {
          'user': {
            'id': 'usr_web_local_2',
            'username': body['username'] ?? 'new_user',
            'displayName': body['displayName'] ?? 'New User',
            'isMinor': false,
            'isPrivateAccount': false,
            'email': body['email'],
          },
          'tokens': {
            'accessToken': 'ey_web_mock_access_token_register',
            'refreshToken': 'ey_web_mock_refresh_token_register',
            'tokenType': 'Bearer',
            'expiresIn': 3600,
          },
        };
      }
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

      Map<String, dynamic> jsonResponse = {};
      if (responseBody.isNotEmpty) {
        try {
          jsonResponse = jsonDecode(responseBody) as Map<String, dynamic>;
        } catch (_) {
          jsonResponse = {'raw': responseBody};
        }
      }

      if (statusCode >= 200 && statusCode < 300) {
        return jsonResponse;
      }

      _handleError(statusCode, jsonResponse, response.headers);
      throw ServerFailure(message: 'Unexpected server response: $statusCode');
    } on SocketException catch (e) {
      throw NetworkFailure(message: 'Unable to connect to Interest API. Please check your connection: ${e.message}');
    } on HandshakeException catch (e) {
      throw SecurityFailure(message: 'Secure TLS handshake failed. Connection rejected: ${e.message}');
    }
  }


  Future<void> _delete(String endpoint, {required String token}) async {
    if (kIsWeb || EnvConfig.mockModeEnabled || _httpClient == null) {
      return;
    }

    final uri = Uri.parse('$baseUrl$endpoint');
    final requestId = _generateRequestId();

    try {
      final request = await _httpClient.deleteUrl(uri);
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
      request.headers.set('X-Request-Id', requestId);

      final response = await request.close().timeout(const Duration(seconds: 15));
      final responseBody = await response.transform(utf8.decoder).join();
      final statusCode = response.statusCode;

      if (statusCode >= 200 && statusCode < 300) {
        return;
      }

      final jsonResponse = responseBody.isNotEmpty
          ? jsonDecode(responseBody) as Map<String, dynamic>
          : <String, dynamic>{};

      _handleError(statusCode, jsonResponse, response.headers);
    } on SocketException catch (e) {
      throw NetworkFailure(message: 'Network connection error: ${e.message}');
    }
  }

  void _handleError(int statusCode, Map<String, dynamic> response, HttpHeaders headers) {
    final message = response['message']?.toString() ?? 'An error occurred';

    if (statusCode == 429) {
      final retryAfterStr = headers.value('retry-after');
      final retryAfter = int.tryParse(retryAfterStr ?? '60') ?? 60;
      throw RateLimitFailure(
        message: 'Too many requests. Please wait $retryAfter seconds before trying again.',
        retryAfterSeconds: retryAfter,
      );
    }

    if (statusCode == 401) {
      if (message.toLowerCase().contains('deactivated')) {
        throw const AccountDeactivatedFailure(
          message: 'Account is deactivated. Please reactivate your account to log in.',
        );
      }
      throw AuthenticationFailure(message: message);
    }

    if (statusCode == 400) {
      if (message.contains('13 years old') || message.contains('COPPA')) {
        throw CoppaAgeGateFailure(message: message);
      }
      throw ValidationFailure(message: message);
    }

    if (statusCode == 403) {
      throw AuthorizationFailure(message: message);
    }

    if (statusCode == 404) {
      throw NotFoundFailure(message: message);
    }

    throw ServerFailure(message: message);
  }

  // ==========================================================================
  // Public API Methods
  // ==========================================================================

  Future<AuthResponse> login(String identifier, String password, {String? deviceName}) async {
    final res = await _post('/auth/login', {
      'identifier': identifier,
      'password': password,
      if (deviceName != null) 'deviceName': deviceName,
    });

    final user = AuthUser.fromJson(res['user'] as Map<String, dynamic>);
    final tokens = AuthTokens.fromJson(res['tokens'] as Map<String, dynamic>);
    return AuthResponse(user: user, tokens: tokens);
  }

  Future<AuthResponse> register({
    required String username,
    required String displayName,
    required String password,
    required String birthdate,
    String? email,
    String? phoneNumber,
    String? deviceName,
  }) async {
    final res = await _post('/auth/register', {
      'username': username,
      'displayName': displayName,
      'password': password,
      'birthdate': birthdate,
      if (email != null && email.isNotEmpty) 'email': email,
      if (phoneNumber != null && phoneNumber.isNotEmpty) 'phoneNumber': phoneNumber,
      if (deviceName != null) 'deviceName': deviceName,
    });

    final user = AuthUser.fromJson(res['user'] as Map<String, dynamic>);
    final tokens = AuthTokens.fromJson(res['tokens'] as Map<String, dynamic>);
    return AuthResponse(user: user, tokens: tokens);
  }

  Future<AuthTokens> refreshToken(String refreshToken, {String? deviceName}) async {
    final res = await _post('/auth/refresh', {
      'refreshToken': refreshToken,
      if (deviceName != null) 'deviceName': deviceName,
    });

    return AuthTokens.fromJson(res);
  }

  Future<void> logout(String token, String? sessionId) async {
    await _post('/auth/logout', {}, token: token);
  }

  Future<void> changePassword(String token, String currentPassword, String newPassword) async {
    await _post('/auth/change-password', {
      'currentPassword': currentPassword,
      'newPassword': newPassword,
    }, token: token);
  }

  Future<void> deactivateAccount(String token, String password, {String? reason}) async {
    await _post('/auth/deactivate', {
      'password': password,
      if (reason != null) 'reason': reason,
    }, token: token);
  }

  Future<AuthResponse> reactivateAccount(String identifier, String password) async {
    final res = await _post('/auth/reactivate', {
      'identifier': identifier,
      'password': password,
    });

    final user = AuthUser.fromJson(res['user'] as Map<String, dynamic>);
    final tokens = AuthTokens.fromJson(res['tokens'] as Map<String, dynamic>);
    return AuthResponse(user: user, tokens: tokens);
  }

  Future<List<UserSession>> getSessions(String token) async {
    if (kIsWeb || EnvConfig.mockModeEnabled || _httpClient == null) {
      return [
        UserSession(
          id: 'sess_web_1',
          deviceName: 'Web Browser (Chrome)',
          lastActiveAt: DateTime.now().toIso8601String(),
          createdAt: DateTime.now().toIso8601String(),
          isCurrent: true,
        ),
      ];
    }

    final uri = Uri.parse('$baseUrl/auth/sessions');
    final requestId = _generateRequestId();

    final request = await _httpClient.getUrl(uri);
    request.headers.set(HttpHeaders.acceptHeader, 'application/json');
    request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
    request.headers.set('X-Request-Id', requestId);

    final response = await request.close().timeout(const Duration(seconds: 15));
    final responseBody = await response.transform(utf8.decoder).join();

    if (response.statusCode == 200) {
      final list = jsonDecode(responseBody) as List;
      return list.map((item) => UserSession.fromJson(item as Map<String, dynamic>)).toList();
    }

    _handleError(response.statusCode, jsonDecode(responseBody), response.headers);
    return [];
  }

  Future<void> revokeSession(String token, String sessionId) async {
    await _delete('/auth/sessions/$sessionId', token: token);
  }

  Future<void> forgotPassword(String email) async {
    await _post('/auth/forgot-password', {'email': email});
  }

  Future<void> resetPassword(String token, String newPassword) async {
    await _post('/auth/reset-password', {
      'token': token,
      'newPassword': newPassword,
    });
  }
}
