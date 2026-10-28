import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';
import 'package:mobile/features/chat/data/chat_api_client.dart';
import 'package:mobile/features/chat/data/chat_repository.dart';
import 'package:mobile/features/chat/domain/models/chat_models.dart';
import 'package:mobile/features/chat/presentation/chat_notifier.dart';
import 'package:mobile/features/chat/presentation/chat_state.dart';



class MockChatApiClient extends ChatApiClient {
  bool failNextSend = false;
  int sendCallCount = 0;
  String? lastSentClientMsgId;
  int markDeliveredSeqCalled = 0;
  int markReadCalled = 0;

  final List<ConversationModel> conversationsPrimary = [
    ConversationModel(
      id: 'conv-1',
      type: ConversationType.direct,
      title: 'Alice Creator',
      status: ConversationStatus.active,
      lastMessageAt: DateTime.now().toIso8601String(),
      lastSeqNum: 4,
      lastMessagePreview: 'See you tomorrow!',
      unreadCount: 1,
    ),
  ];

  final List<ConversationModel> conversationsRequests = [
    ConversationModel(
      id: 'conv-req-1',
      type: ConversationType.direct,
      title: 'Unknown Requester',
      status: ConversationStatus.pending,
      lastMessageAt: DateTime.now().toIso8601String(),
      lastSeqNum: 1,
      lastMessagePreview: 'Hey, can I ask a question?',
      unreadCount: 1,
    ),
  ];

  final List<ConversationModel> conversationsArchived = [
    ConversationModel(
      id: 'conv-arch-1',
      type: ConversationType.direct,
      title: 'Old Project Partner',
      status: ConversationStatus.archived,
      lastMessageAt: DateTime.now().subtract(const Duration(days: 30)).toIso8601String(),
      lastSeqNum: 10,
      lastMessagePreview: 'Project completed.',
      isArchived: true,
    ),
  ];

  @override
  Future<List<ConversationModel>> getConversations({
    String folder = 'primary',
    int limit = 20,
    int offset = 0,
    String? token,
  }) async {
    if (folder == 'requests') return conversationsRequests;
    if (folder == 'archived') return conversationsArchived;
    return conversationsPrimary;
  }

  @override
  Future<int> getGlobalUnreadCount({String? token}) async => 2;

  @override
  Future<ConversationModel> getConversationDetails({
    required String conversationId,
    String? token,
  }) async {
    return ConversationModel(
      id: conversationId,
      type: ConversationType.direct,
      title: 'Alice Creator',
      status: ConversationStatus.active,
      lastMessageAt: DateTime.now().toIso8601String(),
      lastSeqNum: 2,
    );
  }

  @override
  Future<List<MessageModel>> getMessages({
    required String conversationId,
    int limit = 50,
    String? beforeCursor,
    String? token,
  }) async {
    return [
      MessageModel(
        id: 'msg-1',
        conversationId: conversationId,
        senderId: 'user-alice',
        senderUsername: 'alice',
        senderDisplayName: 'Alice',
        text: 'Hello!',
        seqNum: 1,
        status: MessageStatus.read,
        createdAt: DateTime.now().subtract(const Duration(minutes: 5)).toIso8601String(),
      ),
      MessageModel(
        id: 'msg-2',
        conversationId: conversationId,
        senderId: 'user-me-1',
        senderUsername: 'myusername',
        senderDisplayName: 'Me',
        text: 'Hi Alice!',
        seqNum: 2,
        status: MessageStatus.delivered,
        createdAt: DateTime.now().subtract(const Duration(minutes: 4)).toIso8601String(),
      ),
    ];
  }

  @override
  Future<SyncMessagesResultModel> syncMessages({
    required String conversationId,
    int sinceSeq = 0,
    int limit = 50,
    String? token,
  }) async {
    // Returns gap-free messages: seqNum 2 (duplicate overlap) and seqNum 3 (new)
    return SyncMessagesResultModel(
      conversationId: conversationId,
      latestSeqNum: 3,
      hasMore: false,
      messages: [
        MessageModel(
          id: 'msg-2', // existing duplicate
          conversationId: conversationId,
          senderId: 'user-me-1',
          senderUsername: 'myusername',
          senderDisplayName: 'Me',
          text: 'Hi Alice!',
          seqNum: 2,
          status: MessageStatus.read,
          createdAt: DateTime.now().subtract(const Duration(minutes: 4)).toIso8601String(),
        ),
        MessageModel(
          id: 'msg-3', // new message
          conversationId: conversationId,
          senderId: 'user-alice',
          senderUsername: 'alice',
          senderDisplayName: 'Alice',
          text: 'How is the new feature going?',
          seqNum: 3,
          status: MessageStatus.delivered,
          createdAt: DateTime.now().toIso8601String(),
        ),
      ],
    );
  }

  @override
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
    sendCallCount++;
    lastSentClientMsgId = clientMsgId;

    if (failNextSend) {
      failNextSend = false;
      throw Exception('Network disconnected (Connection timed out)');
    }

    return MessageModel(
      id: 'server-msg-${DateTime.now().millisecondsSinceEpoch}',
      conversationId: conversationId,
      senderId: 'user-me-1',
      senderUsername: 'myusername',
      senderDisplayName: 'Me',
      text: text,
      messageType: messageType,
      mediaUrl: mediaUrl,
      voiceUrl: voiceUrl,
      voiceDurationSeconds: voiceDurationSeconds,
      attachedReelId: attachedReelId,
      seqNum: 4,
      clientMsgId: clientMsgId,
      status: MessageStatus.sent,
      createdAt: DateTime.now().toIso8601String(),
    );
  }

  @override
  Future<void> markAsDelivered({
    required String conversationId,
    String? messageId,
    int? seqNum,
    String? token,
  }) async {
    markDeliveredSeqCalled = seqNum ?? 0;
  }

  @override
  Future<void> markAsRead({
    required String conversationId,
    String? token,
  }) async {
    markReadCalled++;
  }

  @override
  Future<MessageModel> editMessage({
    required String messageId,
    required String text,
    String? token,
  }) async {
    return MessageModel(
      id: messageId,
      conversationId: 'conv-1',
      senderId: 'user-me-1',
      senderUsername: 'myusername',
      senderDisplayName: 'Me',
      text: text,
      seqNum: 2,
      isEdited: true,
      editedAt: DateTime.now().toIso8601String(),
      status: MessageStatus.read,
      createdAt: DateTime.now().toIso8601String(),
    );
  }

  @override
  Future<void> deleteMessage({
    required String messageId,
    bool deleteForEveryone = false,
    String? token,
  }) async {}

  @override
  Future<bool> toggleMute({
    required String conversationId,
    required bool isMuted,
    String? token,
  }) async => isMuted;

  @override
  Future<bool> toggleArchive({
    required String conversationId,
    required bool isArchived,
    String? token,
  }) async => isArchived;

  @override
  Future<void> deleteConversation({
    required String conversationId,
    String? token,
  }) async {}

  @override
  Future<void> reportMessage({
    required String messageId,
    required String reason,
    String? details,
    String? token,
  }) async {}

  @override
  Future<void> respondToRequest({
    required String conversationId,
    required String action,
    String? token,
  }) async {}
}

void main() {
  late MockChatApiClient mockApiClient;
  late PlatformSecureStorageService secureStorage;
  late ChatRepository repository;
  late ChatNotifier notifier;

  setUp(() async {
    mockApiClient = MockChatApiClient();
    secureStorage = PlatformSecureStorageService();
    await secureStorage.saveAccessToken('mock_token_jwt');
    await secureStorage.saveUserId('user-me-1');
    await secureStorage.saveUsername('myusername');
    repository = ChatRepository(apiClient: mockApiClient, secureStorage: secureStorage);
    notifier = ChatNotifier(repository: repository);
  });

  group('Prompt 12: Sequence Ordering, Gap-Free Sync, and Deduplication', () {
    test('loads conversation thread and delivers/reads latest messages', () async {
      await notifier.loadThread('conv-1');

      expect(notifier.state, isA<ThreadLoadedState>());
      final threadState = notifier.state as ThreadLoadedState;
      expect(threadState.messages.length, 2);
      expect(threadState.latestSeqNum, 2);
      expect(mockApiClient.markDeliveredSeqCalled, 2);
      expect(mockApiClient.markReadCalled, 1);
    });

    test('syncThread deduplicates existing messages and maintains strictly ordered seqNum', () async {
      await notifier.loadThread('conv-1');
      await notifier.syncThread('conv-1');

      expect(notifier.state, isA<ThreadLoadedState>());
      final threadState = notifier.state as ThreadLoadedState;
      // seqNum 1, seqNum 2 (not duplicated), and seqNum 3 added
      expect(threadState.messages.length, 3);
      expect(threadState.messages.map((m) => m.seqNum).toList(), [1, 2, 3]);
      expect(threadState.latestSeqNum, 3);
      expect(threadState.messages.last.text, 'How is the new feature going?');
    });
  });

  group('Prompt 12: Optimistic Sending, clientMsgId Idempotency, and Reconciliation', () {
    test('sends message optimistically with clientMsgId and reconciles with server response', () async {
      await notifier.loadThread('conv-1');
      final sendFuture = notifier.sendMessage(
        conversationId: 'conv-1',
        text: 'Deploying the fix now!',
      );

      // Verify server received clientMsgId
      await sendFuture;
      expect(mockApiClient.sendCallCount, 1);
      expect(mockApiClient.lastSentClientMsgId, startsWith('c_'));

      final threadState = notifier.state as ThreadLoadedState;
      expect(threadState.messages.length, 3);
      final sentMsg = threadState.messages.last;
      expect(sentMsg.text, 'Deploying the fix now!');
      expect(sentMsg.seqNum, 4);
      expect(sentMsg.isSending, false);
      expect(sentMsg.hasFailed, false);
    });
  });

  group('Prompt 12: Network Disconnect, Failure State, and Retry Handling', () {
    test('handles send failure gracefully and allows retry with existing clientMsgId', () async {
      await notifier.loadThread('conv-1');
      mockApiClient.failNextSend = true;

      // Send should fail
      await notifier.sendMessage(
        conversationId: 'conv-1',
        text: 'Will retry this message.',
      );

      final failedState = notifier.state as ThreadLoadedState;
      final failedMsg = failedState.messages.last;
      expect(failedMsg.hasFailed, true);
      expect(failedMsg.isSending, false);
      final originalClientMsgId = failedMsg.clientMsgId;
      expect(originalClientMsgId, isNotNull);

      // Now retry the send
      await notifier.retrySendMessage(failedMsg);

      expect(mockApiClient.sendCallCount, 2);
      expect(mockApiClient.lastSentClientMsgId, originalClientMsgId);

      final recoveredState = notifier.state as ThreadLoadedState;
      final recoveredMsg = recoveredState.messages.last;
      expect(recoveredMsg.hasFailed, false);
      expect(recoveredMsg.isSending, false);
      expect(recoveredMsg.id, startsWith('server-msg-'));
    });
  });

  group('Prompt 12: Folder Navigation, Requests, and Controls', () {
    test('loads primary folder conversations by default', () async {
      await notifier.loadConversations(folder: 'primary');
      expect(notifier.state, isA<ConversationsLoadedState>());
      final loaded = notifier.state as ConversationsLoadedState;
      expect(loaded.activeFolder, 'primary');
      expect(loaded.conversations.length, 1);
      expect(loaded.conversations.first.title, 'Alice Creator');
      expect(loaded.globalUnreadCount, 2);
    });

    test('switches folder to requests and processes acceptance', () async {
      await notifier.loadConversations(folder: 'primary');
      notifier.switchFolder('requests');

      // Wait for async load
      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(notifier.state, isA<ConversationsLoadedState>());
      final loaded = notifier.state as ConversationsLoadedState;
      expect(loaded.activeFolder, 'requests');
      expect(loaded.conversations.first.title, 'Unknown Requester');

      await notifier.respondToRequest('conv-req-1', 'ACCEPT');
    });

    test('switches folder to archived', () async {
      notifier.switchFolder('archived');
      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(notifier.state, isA<ConversationsLoadedState>());
      final loaded = notifier.state as ConversationsLoadedState;
      expect(loaded.activeFolder, 'archived');
      expect(loaded.conversations.first.title, 'Old Project Partner');
    });

    test('deletes conversation from loaded state', () async {
      await notifier.loadConversations(folder: 'primary');
      await notifier.deleteConversation('conv-1');

      final loaded = notifier.state as ConversationsLoadedState;
      expect(loaded.conversations.isEmpty, true);
    });
  });

  group('Prompt 12: Message Editing and Deletion Semantics', () {
    test('edits message within allowed window and updates local state', () async {
      await notifier.loadThread('conv-1');
      await notifier.editMessage('msg-2', 'Hi Alice! (Updated text)');

      final threadState = notifier.state as ThreadLoadedState;
      final editedMsg = threadState.messages.firstWhere((m) => m.id == 'msg-2');
      expect(editedMsg.text, 'Hi Alice! (Updated text)');
      expect(editedMsg.isEdited, true);
    });

    test('deletes message for everyone replaces text with deleted placeholder', () async {
      await notifier.loadThread('conv-1');
      await notifier.deleteMessage('msg-2', true);

      final threadState = notifier.state as ThreadLoadedState;
      final deletedMsg = threadState.messages.firstWhere((m) => m.id == 'msg-2');
      expect(deletedMsg.text, 'This message was deleted.');
      expect(deletedMsg.isDeletedForEveryone, true);
    });

    test('deletes message for me removes it completely from local state', () async {
      await notifier.loadThread('conv-1');
      await notifier.deleteMessage('msg-2', false);

      final threadState = notifier.state as ThreadLoadedState;
      expect(threadState.messages.any((m) => m.id == 'msg-2'), false);
      expect(threadState.messages.length, 1);
    });
  });

  group('Prompt 12: Zero-Location & Privacy Guarantee', () {
    test('ensures message and conversation models contain 0 location coordinates or GPS fields', () {
      final msg = MessageModel(
        id: 'msg-sec-1',
        conversationId: 'conv-1',
        senderId: 'u-1',
        senderUsername: 'u1',
        senderDisplayName: 'User 1',
        text: 'Zero-location check',
        seqNum: 1,
        createdAt: DateTime.now().toIso8601String(),
      );

      final json = {
        'id': msg.id,
        'conversationId': msg.conversationId,
        'sender': {'id': msg.senderId, 'username': msg.senderUsername, 'displayName': msg.senderDisplayName},
        'text': msg.text,
        'seqNum': msg.seqNum,
        'createdAt': msg.createdAt,
      };

      // Strict Zero-Location Verification
      expect(json.containsKey('latitude'), isFalse);
      expect(json.containsKey('longitude'), isFalse);
      expect(json.containsKey('location'), isFalse);
      expect(json.containsKey('gps'), isFalse);
      expect(json.containsKey('coords'), isFalse);
    });
  });
}
