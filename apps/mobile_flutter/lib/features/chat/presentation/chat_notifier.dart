import 'dart:async';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:mobile/core/error/failures.dart';
import 'package:mobile/features/chat/data/chat_repository.dart';
import 'package:mobile/features/chat/domain/models/chat_models.dart';
import 'package:mobile/features/chat/presentation/chat_state.dart';

class ChatNotifier extends ChangeNotifier {
  final ChatRepository repository;

  ChatState _state = const ChatInitialState();
  ChatState get state => _state;

  String _activeFolder = 'primary';
  String get activeFolder => _activeFolder;

  ChatNotifier({required this.repository});

  void _setState(ChatState newState) {
    _state = newState;
    notifyListeners();
  }

  /// Loads conversations partitioned by folder.
  Future<void> loadConversations({String folder = 'primary'}) async {
    _activeFolder = folder;
    _setState(ConversationsLoadingState(folder: folder));
    try {
      final conversations = await repository.getConversations(folder: folder);
      final globalUnread = await repository.getGlobalUnreadCount().catchError((_) => 0);
      _setState(ConversationsLoadedState(
        activeFolder: folder,
        conversations: conversations,
        globalUnreadCount: globalUnread,
      ));
    } on Failure catch (e) {
      _setState(ChatErrorState(message: e.message));
    } catch (e) {
      _setState(ChatErrorState(message: 'Failed to load conversations: $e'));
    }
  }

  /// Switches conversation folder ('primary', 'requests', 'archived').
  void switchFolder(String folder) {
    if (_activeFolder == folder && _state is ConversationsLoadedState) return;
    loadConversations(folder: folder);
  }

  /// Loads full thread history and initializes sync.
  Future<void> loadThread(String conversationId) async {
    _setState(ThreadLoadingState(conversationId: conversationId));
    try {
      final conversation = await repository.getConversationDetails(conversationId);
      final messages = await repository.getMessages(conversationId: conversationId, limit: 50);
      final latestSeq = messages.isNotEmpty ? messages.last.seqNum : conversation.lastSeqNum;

      // Mark delivered and read
      try {
        await repository.markAsDelivered(conversationId: conversationId, seqNum: latestSeq);
        await repository.markAsRead(conversationId);
      } catch (_) {}

      _setState(ThreadLoadedState(
        conversation: conversation,
        messages: messages,
        latestSeqNum: latestSeq,
      ));
    } on Failure catch (e) {
      _setState(ChatErrorState(message: e.message));
    } catch (e) {
      _setState(ChatErrorState(message: 'Failed to load chat thread: $e'));
    }
  }

  /// Synchronizes messages after latestSeqNum to guarantee ordering and gap-free recovery.
  Future<void> syncThread(String conversationId) async {
    if (_state is! ThreadLoadedState) return;
    final current = _state as ThreadLoadedState;
    if (current.isSyncing) return;

    _setState(current.copyWith(isSyncing: true));

    try {
      final syncResult = await repository.syncMessages(
        conversationId: conversationId,
        sinceSeq: current.latestSeqNum,
      );

      if (syncResult.messages.isEmpty) {
        _setState(current.copyWith(isSyncing: false));
        return;
      }

      // Deduplicate by message ID & maintain strict seqNum ordering
      final existingIds = current.messages.map((m) => m.id).toSet();
      final newUnique = syncResult.messages.where((m) => !existingIds.contains(m.id)).toList();

      final combined = [...current.messages, ...newUnique]
        ..sort((a, b) => a.seqNum.compareTo(b.seqNum));

      final newLatestSeq = combined.isNotEmpty ? combined.last.seqNum : current.latestSeqNum;

      // Acknowledge delivery
      try {
        await repository.markAsDelivered(conversationId: conversationId, seqNum: newLatestSeq);
      } catch (_) {}

      _setState(current.copyWith(
        messages: combined,
        latestSeqNum: newLatestSeq,
        hasMore: syncResult.hasMore,
        isSyncing: false,
      ));
    } catch (_) {
      _setState(current.copyWith(isSyncing: false));
    }
  }

  /// Sends a message with client-generated idempotency key and optimistic bubble display.
  Future<void> sendMessage({
    required String conversationId,
    String? text,
    MessageType messageType = MessageType.text,
    String? mediaUrl,
    String? voiceUrl,
    double? voiceDurationSeconds,
    String? attachedReelId,
    int? expiresInSeconds,
  }) async {
    if (_state is! ThreadLoadedState) return;
    final current = _state as ThreadLoadedState;

    final clientMsgId = 'c_${DateTime.now().millisecondsSinceEpoch}_${Random().nextInt(999999)}';

    // Optimistic local message
    final optimisticMessage = MessageModel(
      id: clientMsgId,
      conversationId: conversationId,
      senderId: 'me',
      senderUsername: 'me',
      senderDisplayName: 'Me',
      text: text,
      messageType: messageType,
      mediaUrl: mediaUrl,
      voiceUrl: voiceUrl,
      voiceDurationSeconds: voiceDurationSeconds,
      attachedReelId: attachedReelId,
      seqNum: current.latestSeqNum + 1,
      clientMsgId: clientMsgId,
      status: MessageStatus.sent,
      isSending: true,
      hasFailed: false,
      createdAt: DateTime.now().toIso8601String(),
    );

    final updatedMessages = [...current.messages, optimisticMessage];
    _setState(current.copyWith(messages: updatedMessages));

    try {
      final authoritative = await repository.sendMessage(
        conversationId: conversationId,
        text: text,
        messageType: messageType,
        clientMsgId: clientMsgId,
        mediaUrl: mediaUrl,
        voiceUrl: voiceUrl,
        voiceDurationSeconds: voiceDurationSeconds,
        attachedReelId: attachedReelId,
        expiresInSeconds: expiresInSeconds,
      );

      if (_state is ThreadLoadedState) {
        final nowState = _state as ThreadLoadedState;
        final reconciled = nowState.messages.map((m) {
          if (m.clientMsgId == clientMsgId) return authoritative;
          return m;
        }).toList();

        _setState(nowState.copyWith(
          messages: reconciled,
          latestSeqNum: max(nowState.latestSeqNum, authoritative.seqNum),
        ));
      }
    } catch (_) {
      // Mark as failed in UI
      if (_state is ThreadLoadedState) {
        final nowState = _state as ThreadLoadedState;
        final failedList = nowState.messages.map((m) {
          if (m.clientMsgId == clientMsgId) {
            return m.copyWith(isSending: false, hasFailed: true);
          }
          return m;
        }).toList();
        _setState(nowState.copyWith(messages: failedList));
      }
    }
  }

  /// Retries sending a failed message with its existing clientMsgId.
  Future<void> retrySendMessage(MessageModel failedMessage) async {
    if (_state is! ThreadLoadedState) return;
    final current = _state as ThreadLoadedState;

    // Set sending true
    final retryingList = current.messages.map((m) {
      if (m.clientMsgId == failedMessage.clientMsgId) {
        return m.copyWith(isSending: true, hasFailed: false);
      }
      return m;
    }).toList();
    _setState(current.copyWith(messages: retryingList));

    try {
      final authoritative = await repository.sendMessage(
        conversationId: failedMessage.conversationId,
        text: failedMessage.text,
        messageType: failedMessage.messageType,
        clientMsgId: failedMessage.clientMsgId,
        mediaUrl: failedMessage.mediaUrl,
        voiceUrl: failedMessage.voiceUrl,
        voiceDurationSeconds: failedMessage.voiceDurationSeconds,
        attachedReelId: failedMessage.attachedReelId,
      );

      if (_state is ThreadLoadedState) {
        final nowState = _state as ThreadLoadedState;
        final reconciled = nowState.messages.map((m) {
          if (m.clientMsgId == failedMessage.clientMsgId) return authoritative;
          return m;
        }).toList();

        _setState(nowState.copyWith(
          messages: reconciled,
          latestSeqNum: max(nowState.latestSeqNum, authoritative.seqNum),
        ));
      }
    } catch (_) {
      if (_state is ThreadLoadedState) {
        final nowState = _state as ThreadLoadedState;
        final failedList = nowState.messages.map((m) {
          if (m.clientMsgId == failedMessage.clientMsgId) {
            return m.copyWith(isSending: false, hasFailed: true);
          }
          return m;
        }).toList();
        _setState(nowState.copyWith(messages: failedList));
      }
    }
  }

  /// Edits message text within 15-minute window.
  Future<void> editMessage(String messageId, String newText) async {
    try {
      final updated = await repository.editMessage(messageId: messageId, text: newText);
      if (_state is ThreadLoadedState) {
        final current = _state as ThreadLoadedState;
        final list = current.messages.map((m) => m.id == messageId ? updated : m).toList();
        _setState(current.copyWith(messages: list));
      }
    } catch (_) {}
  }

  /// Deletes message (delete for everyone or for me).
  Future<void> deleteMessage(String messageId, bool deleteForEveryone) async {
    try {
      await repository.deleteMessage(messageId: messageId, deleteForEveryone: deleteForEveryone);
      if (_state is ThreadLoadedState) {
        final current = _state as ThreadLoadedState;
        List<MessageModel> list;
        if (deleteForEveryone) {
          list = current.messages.map((m) {
            if (m.id == messageId) {
              return m.copyWith(
                text: 'This message was deleted.',
                isDeletedForEveryone: true,
              );
            }
            return m;
          }).toList();
        } else {
          list = current.messages.where((m) => m.id != messageId).toList();
        }
        _setState(current.copyWith(messages: list));
      }
    } catch (_) {}
  }

  /// Toggles mute notifications on conversation.
  Future<void> toggleMute(String conversationId, bool isMuted) async {
    try {
      await repository.toggleMute(conversationId: conversationId, isMuted: isMuted);
      if (_state is ThreadLoadedState) {
        final current = _state as ThreadLoadedState;
        _setState(current.copyWith(
          conversation: current.conversation.copyWith(isMuted: isMuted),
        ));
      }
    } catch (_) {}
  }

  /// Toggles archive thread.
  Future<void> toggleArchive(String conversationId, bool isArchived) async {
    try {
      await repository.toggleArchive(conversationId: conversationId, isArchived: isArchived);
      if (_state is ThreadLoadedState) {
        final current = _state as ThreadLoadedState;
        _setState(current.copyWith(
          conversation: current.conversation.copyWith(isArchived: isArchived),
        ));
      }
    } catch (_) {}
  }

  /// Creates a direct chat with target user and opens it.
  Future<ConversationModel?> createDirectChat(String targetUserId, {String? initialText}) async {
    try {
      final conversation = await repository.createDirectChat(
        targetUserId: targetUserId,
        initialText: initialText,
      );
      await loadConversations(folder: _activeFolder);
      return conversation;
    } catch (_) {
      return null;
    }
  }

  /// Creates a group chat with participants.
  Future<ConversationModel?> createGroupChat({
    required String title,
    required List<String> participantUserIds,
    String? avatarUrl,
    int? disappearingTtlSeconds,
  }) async {
    try {
      final conversation = await repository.createGroupChat(
        title: title,
        participantUserIds: participantUserIds,
        avatarUrl: avatarUrl,
        disappearingTtlSeconds: disappearingTtlSeconds,
      );
      await loadConversations(folder: _activeFolder);
      return conversation;
    } catch (_) {
      return null;
    }
  }

  /// Responds to a message request ('ACCEPT' or 'REJECT').
  Future<void> respondToRequest(String conversationId, String action) async {
    try {
      await repository.respondToRequest(conversationId: conversationId, action: action);
      await loadConversations(folder: _activeFolder);
    } catch (_) {}
  }

  /// Deletes conversation.
  Future<void> deleteConversation(String conversationId) async {
    try {
      await repository.deleteConversation(conversationId);
      if (_state is ConversationsLoadedState) {
        final current = _state as ConversationsLoadedState;
        final updated = current.conversations.where((c) => c.id != conversationId).toList();
        _setState(current.copyWith(conversations: updated));
      }
    } catch (_) {}
  }

  /// Reports a message for content violation.
  Future<bool> reportMessage(String messageId, String reason, {String? details}) async {
    try {
      await repository.reportMessage(messageId: messageId, reason: reason, details: details);
      return true;
    } catch (_) {
      return false;
    }
  }
}
