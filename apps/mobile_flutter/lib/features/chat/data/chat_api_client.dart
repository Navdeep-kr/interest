import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:mobile/core/config/env_config.dart';
import 'package:mobile/core/error/failures.dart';
import 'package:mobile/features/chat/domain/models/chat_models.dart';

class ChatApiClient {
  final String baseUrl;
  final dynamic _httpClient;

  ChatApiClient({
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
    return 'req_chat_$now$random';
  }

  Future<dynamic> _get(
    String endpoint, {
    String? token,
    Map<String, String>? queryParams,
  }) async {
    if (kIsWeb || EnvConfig.mockModeEnabled || _httpClient == null) {
      if (endpoint.contains('/conversations/')) {
        return _mockConversationsJson[0];
      }
      return _mockConversationsJson;
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

  Future<dynamic> _patch(
    String endpoint, {
    Map<String, dynamic>? body,
    String? token,
  }) async {
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

  /// List conversations by folder ('primary', 'requests', 'archived').
  Future<List<ConversationModel>> getConversations({
    String folder = 'primary',
    int limit = 20,
    int offset = 0,
    String? token,
  }) async {
    final json = await _get(
      '/chat/conversations',
      token: token,
      queryParams: {
        'folder': folder,
        'limit': limit.toString(),
        'offset': offset.toString(),
      },
    );
    final list = json as List<dynamic>? ?? [];
    return list.map((e) => ConversationModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Global unread badge count.
  Future<int> getGlobalUnreadCount({String? token}) async {
    final json = await _get('/chat/unread-count', token: token);
    return (json['unreadCount'] as num?)?.toInt() ?? 0;
  }

  /// Conversation details.
  Future<ConversationModel> getConversationDetails({
    required String conversationId,
    String? token,
  }) async {
    final json = await _get('/chat/conversations/$conversationId', token: token);
    return ConversationModel.fromJson(json as Map<String, dynamic>);
  }

  /// Create direct chat.
  Future<ConversationModel> createDirectChat({
    required String targetUserId,
    String? initialText,
    String? token,
  }) async {
    final json = await _post(
      '/chat/direct',
      token: token,
      body: {
        'targetUserId': targetUserId,
        if (initialText != null) 'initialText': initialText,
      },
    );
    return ConversationModel.fromJson(json as Map<String, dynamic>);
  }

  /// Create group chat.
  Future<ConversationModel> createGroupChat({
    required String title,
    required List<String> participantUserIds,
    String? avatarUrl,
    int? disappearingTtlSeconds,
    String? token,
  }) async {
    final json = await _post(
      '/chat/group',
      token: token,
      body: {
        'title': title,
        'participantUserIds': participantUserIds,
        if (avatarUrl != null) 'avatarUrl': avatarUrl,
        if (disappearingTtlSeconds != null) 'disappearingTtlSeconds': disappearingTtlSeconds,
      },
    );
    return ConversationModel.fromJson(json as Map<String, dynamic>);
  }

  /// Send message with client-generated idempotency key to prevent duplicates on reconnect.
  Future<MessageModel> sendMessage({
    required String conversationId,
    String? text,
    MessageType messageType = MessageType.text,
    String? clientMsgId,
    String? mediaUrl,
    String? voiceUrl,
    double? voiceDurationSeconds,
    String? attachedReelId,
    int? expiresInSeconds,
    String? token,
  }) async {
    String typeStr = 'TEXT';
    if (messageType == MessageType.voice) typeStr = 'VOICE';
    if (messageType == MessageType.image) typeStr = 'IMAGE';
    if (messageType == MessageType.video) typeStr = 'VIDEO';
    if (messageType == MessageType.reel) typeStr = 'REEL';

    final json = await _post(
      '/chat/messages',
      token: token,
      body: {
        'conversationId': conversationId,
        if (text != null) 'text': text,
        'messageType': typeStr,
        if (clientMsgId != null) 'clientMsgId': clientMsgId,
        if (mediaUrl != null) 'mediaUrl': mediaUrl,
        if (voiceUrl != null) 'voiceUrl': voiceUrl,
        if (voiceDurationSeconds != null) 'voiceDurationSeconds': voiceDurationSeconds,
        if (attachedReelId != null) 'attachedReelId': attachedReelId,
        if (expiresInSeconds != null) 'expiresInSeconds': expiresInSeconds,
      },
    );
    return MessageModel.fromJson(json as Map<String, dynamic>);
  }

  /// Fetch message history with cursor.
  Future<List<MessageModel>> getMessages({
    required String conversationId,
    int limit = 50,
    String? beforeCursor,
    String? token,
  }) async {
    final json = await _get(
      '/chat/conversations/$conversationId/messages',
      token: token,
      queryParams: {
        'limit': limit.toString(),
        if (beforeCursor != null) 'beforeCursor': beforeCursor,
      },
    );
    final list = json as List<dynamic>? ?? [];
    return list.map((e) => MessageModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Cross-device sync: catch up on all messages after sinceSeq.
  Future<SyncMessagesResultModel> syncMessages({
    required String conversationId,
    int sinceSeq = 0,
    int limit = 50,
    String? token,
  }) async {
    final json = await _get(
      '/chat/conversations/$conversationId/sync',
      token: token,
      queryParams: {
        'sinceSeq': sinceSeq.toString(),
        'limit': limit.toString(),
      },
    );
    return SyncMessagesResultModel.fromJson(json as Map<String, dynamic>);
  }

  /// Mark messages as delivered.
  Future<void> markAsDelivered({
    required String conversationId,
    String? messageId,
    int? seqNum,
    String? token,
  }) async {
    await _post(
      '/chat/conversations/$conversationId/delivery',
      token: token,
      body: {
        if (messageId != null) 'messageId': messageId,
        if (seqNum != null) 'seqNum': seqNum,
      },
    );
  }

  /// Mark conversation as read.
  Future<void> markAsRead({
    required String conversationId,
    String? token,
  }) async {
    await _patch('/chat/conversations/$conversationId/read', token: token);
  }

  /// Edit message (within 15 minutes).
  Future<MessageModel> editMessage({
    required String messageId,
    required String text,
    String? token,
  }) async {
    final json = await _patch(
      '/chat/messages/$messageId',
      token: token,
      body: {'text': text},
    );
    return MessageModel.fromJson(json as Map<String, dynamic>);
  }

  /// Delete message.
  Future<void> deleteMessage({
    required String messageId,
    bool deleteForEveryone = false,
    String? token,
  }) async {
    await _delete(
      '/chat/messages/$messageId?deleteForEveryone=$deleteForEveryone',
      token: token,
    );
  }

  /// Add participant to group.
  Future<void> addParticipant({
    required String conversationId,
    required String userId,
    String? token,
  }) async {
    await _post(
      '/chat/conversations/$conversationId/participants',
      token: token,
      body: {'userId': userId},
    );
  }

  /// Remove participant from group.
  Future<void> removeParticipant({
    required String conversationId,
    required String targetUserId,
    String? token,
  }) async {
    await _delete(
      '/chat/conversations/$conversationId/participants/$targetUserId',
      token: token,
    );
  }

  /// Toggle mute thread notifications.
  Future<bool> toggleMute({
    required String conversationId,
    required bool isMuted,
    String? token,
  }) async {
    await _patch(
      '/chat/conversations/$conversationId/mute',
      token: token,
      body: {'isMuted': isMuted},
    );
    return isMuted;
  }

  /// Toggle archive thread.
  Future<bool> toggleArchive({
    required String conversationId,
    required bool isArchived,
    String? token,
  }) async {
    await _patch(
      '/chat/conversations/$conversationId/archive',
      token: token,
      body: {'isArchived': isArchived},
    );
    return isArchived;
  }

  /// Soft delete conversation history for user.
  Future<void> deleteConversation({
    required String conversationId,
    String? token,
  }) async {
    await _delete('/chat/conversations/$conversationId', token: token);
  }

  /// Report message.
  Future<void> reportMessage({
    required String messageId,
    required String reason,
    String? details,
    String? token,
  }) async {
    await _post(
      '/chat/messages/$messageId/report',
      token: token,
      body: {
        'reason': reason,
        if (details != null) 'details': details,
      },
    );
  }

  /// Respond to message request (ACCEPT, DECLINE, BLOCK).
  Future<void> respondToRequest({
    required String conversationId,
    required String action,
    String? token,
  }) async {
    await _post(
      '/chat/conversations/$conversationId/respond',
      token: token,
      body: {'action': action},
    );
  }

  static final List<Map<String, dynamic>> _mockConversationsJson = [
    {
      'id': 'conv_1',
      'type': 'DIRECT',
      'title': 'Alex Rivera',
      'avatarUrl': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
      'unreadCount': 2,
      'isMuted': false,
      'isArchived': false,
      'isPinned': true,
      'folder': 'primary',
      'createdAt': '2026-10-18T10:00:00Z',
      'updatedAt': '2026-10-19T11:20:00Z',
      'lastMessage': {
        'id': 'msg_1',
        'conversationId': 'conv_1',
        'senderId': 'usr_alex',
        'senderUsername': 'alex_tech',
        'content': 'The multi-agent state reconciliation test just passed! 🚀',
        'type': 'TEXT',
        'status': 'DELIVERED',
        'createdAt': '2026-10-19T11:20:00Z',
      },
      'participants': [
        {
          'id': 'usr_alex',
          'userId': 'usr_alex',
          'username': 'alex_tech',
          'displayName': 'Alex Rivera',
          'avatarUrl': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
          'role': 'MEMBER',
        },
      ],
    },
    {
      'id': 'conv_2',
      'type': 'DIRECT',
      'title': 'Sarah Chen',
      'avatarUrl': 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200',
      'unreadCount': 0,
      'isMuted': false,
      'isArchived': false,
      'isPinned': false,
      'folder': 'primary',
      'createdAt': '2026-10-17T12:00:00Z',
      'updatedAt': '2026-10-19T09:15:00Z',
      'lastMessage': {
        'id': 'msg_2',
        'conversationId': 'conv_2',
        'senderId': 'usr_sarah',
        'senderUsername': 'sarah_flutter',
        'content': 'Checked the zero-location policy AST verifier, looks completely solid.',
        'type': 'TEXT',
        'status': 'READ',
        'createdAt': '2026-10-19T09:15:00Z',
      },
      'participants': [
        {
          'id': 'usr_sarah',
          'userId': 'usr_sarah',
          'username': 'sarah_flutter',
          'displayName': 'Sarah Chen',
          'avatarUrl': 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200',
          'role': 'MEMBER',
        },
      ],
    },
  ];
}
