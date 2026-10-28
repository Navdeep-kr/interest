import 'package:mobile/core/storage/secure_storage_service.dart';
import 'package:mobile/features/chat/data/chat_api_client.dart';
import 'package:mobile/features/chat/domain/models/chat_models.dart';

class ChatRepository {
  final ChatApiClient apiClient;
  final SecureStorageService secureStorage;

  // Local offline queue for pending message retransmissions
  final List<MessageModel> _offlineQueue = [];
  List<MessageModel> get offlineQueue => List.unmodifiable(_offlineQueue);

  ChatRepository({
    required this.apiClient,
    required this.secureStorage,
  });

  Future<String?> _getToken() async {
    return secureStorage.getAccessToken();
  }

  Future<List<ConversationModel>> getConversations({
    String folder = 'primary',
    int limit = 20,
    int offset = 0,
  }) async {
    final token = await _getToken();
    return apiClient.getConversations(
      folder: folder,
      limit: limit,
      offset: offset,
      token: token,
    );
  }

  Future<int> getGlobalUnreadCount() async {
    final token = await _getToken();
    return apiClient.getGlobalUnreadCount(token: token);
  }

  Future<ConversationModel> getConversationDetails(String conversationId) async {
    final token = await _getToken();
    return apiClient.getConversationDetails(conversationId: conversationId, token: token);
  }

  Future<ConversationModel> createDirectChat({
    required String targetUserId,
    String? initialText,
  }) async {
    final token = await _getToken();
    return apiClient.createDirectChat(
      targetUserId: targetUserId,
      initialText: initialText,
      token: token,
    );
  }

  Future<ConversationModel> createGroupChat({
    required String title,
    required List<String> participantUserIds,
    String? avatarUrl,
    int? disappearingTtlSeconds,
  }) async {
    final token = await _getToken();
    return apiClient.createGroupChat(
      title: title,
      participantUserIds: participantUserIds,
      avatarUrl: avatarUrl,
      disappearingTtlSeconds: disappearingTtlSeconds,
      token: token,
    );
  }

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
  }) async {
    final token = await _getToken();
    try {
      final sent = await apiClient.sendMessage(
        conversationId: conversationId,
        text: text,
        messageType: messageType,
        clientMsgId: clientMsgId,
        mediaUrl: mediaUrl,
        voiceUrl: voiceUrl,
        voiceDurationSeconds: voiceDurationSeconds,
        attachedReelId: attachedReelId,
        expiresInSeconds: expiresInSeconds,
        token: token,
      );
      // Remove from offline queue if it was pending
      _offlineQueue.removeWhere((m) => m.clientMsgId == clientMsgId);
      return sent;
    } catch (e) {
      // Create local failed model and queue for retry
      final failedMessage = MessageModel(
        id: clientMsgId ?? 'local_${DateTime.now().millisecondsSinceEpoch}',
        conversationId: conversationId,
        senderId: await secureStorage.getUserId() ?? '',
        senderUsername: await secureStorage.getUsername() ?? 'me',
        senderDisplayName: 'Me',
        text: text,
        messageType: messageType,
        mediaUrl: mediaUrl,
        voiceUrl: voiceUrl,
        voiceDurationSeconds: voiceDurationSeconds,
        attachedReelId: attachedReelId,
        seqNum: 0,
        clientMsgId: clientMsgId,
        status: MessageStatus.sent,
        hasFailed: true,
        createdAt: DateTime.now().toIso8601String(),
      );
      _offlineQueue.add(failedMessage);
      rethrow;
    }
  }

  Future<List<MessageModel>> getMessages({
    required String conversationId,
    int limit = 50,
    String? beforeCursor,
  }) async {
    final token = await _getToken();
    return apiClient.getMessages(
      conversationId: conversationId,
      limit: limit,
      beforeCursor: beforeCursor,
      token: token,
    );
  }

  Future<SyncMessagesResultModel> syncMessages({
    required String conversationId,
    int sinceSeq = 0,
    int limit = 50,
  }) async {
    final token = await _getToken();
    return apiClient.syncMessages(
      conversationId: conversationId,
      sinceSeq: sinceSeq,
      limit: limit,
      token: token,
    );
  }

  Future<void> markAsDelivered({
    required String conversationId,
    String? messageId,
    int? seqNum,
  }) async {
    final token = await _getToken();
    return apiClient.markAsDelivered(
      conversationId: conversationId,
      messageId: messageId,
      seqNum: seqNum,
      token: token,
    );
  }

  Future<void> markAsRead(String conversationId) async {
    final token = await _getToken();
    return apiClient.markAsRead(conversationId: conversationId, token: token);
  }

  Future<MessageModel> editMessage({
    required String messageId,
    required String text,
  }) async {
    final token = await _getToken();
    return apiClient.editMessage(messageId: messageId, text: text, token: token);
  }

  Future<void> deleteMessage({
    required String messageId,
    bool deleteForEveryone = false,
  }) async {
    final token = await _getToken();
    return apiClient.deleteMessage(
      messageId: messageId,
      deleteForEveryone: deleteForEveryone,
      token: token,
    );
  }

  Future<void> addParticipant({
    required String conversationId,
    required String userId,
  }) async {
    final token = await _getToken();
    return apiClient.addParticipant(
      conversationId: conversationId,
      userId: userId,
      token: token,
    );
  }

  Future<void> removeParticipant({
    required String conversationId,
    required String targetUserId,
  }) async {
    final token = await _getToken();
    return apiClient.removeParticipant(
      conversationId: conversationId,
      targetUserId: targetUserId,
      token: token,
    );
  }

  Future<bool> toggleMute({
    required String conversationId,
    required bool isMuted,
  }) async {
    final token = await _getToken();
    return apiClient.toggleMute(
      conversationId: conversationId,
      isMuted: isMuted,
      token: token,
    );
  }

  Future<bool> toggleArchive({
    required String conversationId,
    required bool isArchived,
  }) async {
    final token = await _getToken();
    return apiClient.toggleArchive(
      conversationId: conversationId,
      isArchived: isArchived,
      token: token,
    );
  }

  Future<void> deleteConversation(String conversationId) async {
    final token = await _getToken();
    return apiClient.deleteConversation(conversationId: conversationId, token: token);
  }

  Future<void> reportMessage({
    required String messageId,
    required String reason,
    String? details,
  }) async {
    final token = await _getToken();
    return apiClient.reportMessage(
      messageId: messageId,
      reason: reason,
      details: details,
      token: token,
    );
  }

  Future<void> respondToRequest({
    required String conversationId,
    required String action,
  }) async {
    final token = await _getToken();
    return apiClient.respondToRequest(
      conversationId: conversationId,
      action: action,
      token: token,
    );
  }
}
