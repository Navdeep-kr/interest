import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';
import 'package:mobile/features/chat/data/chat_api_client.dart';
import 'package:mobile/features/chat/data/chat_repository.dart';
import 'package:mobile/features/chat/domain/models/chat_models.dart';
import 'package:mobile/features/chat/presentation/chat_notifier.dart';
import 'package:mobile/features/chat/presentation/screens/chat_thread_screen.dart';
import 'package:mobile/features/chat/presentation/screens/conversations_list_screen.dart';

class WidgetTestMockChatApiClient extends ChatApiClient {
  int sendCount = 0;
  bool failNextSend = false;

  final List<ConversationModel> conversations = const [
    ConversationModel(
      id: 'conv-widget-1',
      type: ConversationType.direct,
      title: 'Bob Engineer',
      status: ConversationStatus.active,
      lastMessageAt: '2026-10-16T10:00:00Z',
      lastSeqNum: 5,
      lastMessagePreview: 'PR merged successfully!',
      unreadCount: 3,
      disappearingTtlSeconds: 3600,
    ),
  ];

  final List<MessageModel> messages = const [
    MessageModel(
      id: 'm-1',
      conversationId: 'conv-widget-1',
      senderId: 'user-bob',
      senderUsername: 'bob',
      senderDisplayName: 'Bob Engineer',
      text: 'Good morning!',
      seqNum: 1,
      status: MessageStatus.read,
      createdAt: '2026-10-16T09:00:00Z',
    ),
    MessageModel(
      id: 'm-2',
      conversationId: 'conv-widget-1',
      senderId: 'me',
      senderUsername: 'me',
      senderDisplayName: 'Me',
      text: 'Hey Bob, ready for review.',
      seqNum: 2,
      status: MessageStatus.delivered,
      createdAt: '2026-10-16T09:05:00Z',
    ),
  ];

  @override
  Future<List<ConversationModel>> getConversations({
    String folder = 'primary',
    int limit = 20,
    int offset = 0,
    String? token,
  }) async {
    if (folder == 'archived') return [];
    return conversations;
  }

  @override
  Future<int> getGlobalUnreadCount({String? token}) async => 3;

  @override
  Future<ConversationModel> getConversationDetails({
    required String conversationId,
    String? token,
  }) async {
    return conversations.first;
  }

  @override
  Future<List<MessageModel>> getMessages({
    required String conversationId,
    int limit = 50,
    String? beforeCursor,
    String? token,
  }) async {
    return messages;
  }

  @override
  Future<SyncMessagesResultModel> syncMessages({
    required String conversationId,
    int sinceSeq = 0,
    int limit = 50,
    String? token,
  }) async {
    return SyncMessagesResultModel(
      conversationId: conversationId,
      messages: [],
      latestSeqNum: 5,
      hasMore: false,
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
    sendCount++;
    if (failNextSend) {
      failNextSend = false;
      throw Exception('Simulated socket error');
    }
    return MessageModel(
      id: 'sent-${DateTime.now().millisecondsSinceEpoch}',
      conversationId: conversationId,
      senderId: 'me',
      senderUsername: 'me',
      senderDisplayName: 'Me',
      text: text,
      messageType: messageType,
      seqNum: 6,
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
  }) async {}

  @override
  Future<void> markAsRead({
    required String conversationId,
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
}

void main() {
  late WidgetTestMockChatApiClient apiClient;
  late PlatformSecureStorageService secureStorage;
  late ChatRepository repository;
  late ChatNotifier notifier;

  setUp(() async {
    apiClient = WidgetTestMockChatApiClient();
    secureStorage = PlatformSecureStorageService();
    await secureStorage.saveAccessToken('token');
    await secureStorage.saveUserId('me');
    await secureStorage.saveUsername('me');
    repository = ChatRepository(apiClient: apiClient, secureStorage: secureStorage);
    notifier = ChatNotifier(repository: repository);
  });

  Widget createWidgetUnderTest(Widget child) {
    return MaterialApp(
      home: child,
    );
  }

  group('Prompt 12: Messaging UI Widget Tests', () {
    testWidgets('ConversationsListScreen renders header, unread badge, and list item', (tester) async {
      await tester.pumpWidget(createWidgetUnderTest(
        ConversationsListScreen(notifier: notifier),
      ));

      // Wait for async load
      await tester.pumpAndSettle();

      expect(find.text('Messages'), findsOneWidget);
      expect(find.text('Primary'), findsOneWidget);
      expect(find.text('Requests'), findsOneWidget);
      expect(find.text('Archived'), findsOneWidget);

      // Verify conversation item
      expect(find.text('Bob Engineer'), findsOneWidget);
      expect(find.text('PR merged successfully!'), findsOneWidget);
      expect(find.text('3'), findsAtLeastNWidgets(1)); // Unread pill / global badge
    });

    testWidgets('ConversationsListScreen displays empty state when switching to Archived', (tester) async {
      await tester.pumpWidget(createWidgetUnderTest(
        ConversationsListScreen(notifier: notifier),
      ));
      await tester.pumpAndSettle();

      // Tap Archived tab
      await tester.tap(find.text('Archived'));
      await tester.pumpAndSettle();

      expect(find.text('No Archived Chats'), findsOneWidget);
    });

    testWidgets('ChatThreadScreen renders messages, disappearing timer, and sends message', (tester) async {
      await tester.pumpWidget(createWidgetUnderTest(
        ChatThreadScreen(
          conversationId: 'conv-widget-1',
          initialTitle: 'Bob Engineer',
          notifier: notifier,
        ),
      ));

      await tester.pumpAndSettle();

      // Header checks
      expect(find.text('Bob Engineer'), findsOneWidget);
      expect(find.text('Disappearing (60m)'), findsOneWidget);

      // Messages check
      expect(find.text('Good morning!'), findsOneWidget);
      expect(find.text('Hey Bob, ready for review.'), findsOneWidget);

      // Input bar typing & send
      final inputFinder = find.byType(TextField);
      expect(inputFinder, findsOneWidget);
      await tester.enterText(inputFinder, 'Everything is passing now!');
      await tester.pump();

      // Tap send button
      final sendFinder = find.byIcon(Icons.send);
      expect(sendFinder, findsOneWidget);
      await tester.tap(sendFinder);
      await tester.pumpAndSettle();

      // Check send was executed and optimistic bubble rendered
      expect(apiClient.sendCount, 1);
      expect(find.text('Everything is passing now!'), findsOneWidget);
    });

    testWidgets('ChatThreadScreen handles send failure and renders retry button', (tester) async {
      apiClient.failNextSend = true;

      await tester.pumpWidget(createWidgetUnderTest(
        ChatThreadScreen(
          conversationId: 'conv-widget-1',
          initialTitle: 'Bob Engineer',
          notifier: notifier,
        ),
      ));
      await tester.pumpAndSettle();

      // Enter text and send
      await tester.enterText(find.byType(TextField), 'Message that will fail');
      await tester.pump();
      await tester.tap(find.byIcon(Icons.send));
      await tester.pumpAndSettle();

      // Failed state should display
      expect(find.text('Failed. Tap to retry'), findsOneWidget);

      // Tap to retry
      await tester.tap(find.text('Failed. Tap to retry'));
      await tester.pumpAndSettle();

      // Retried successfully
      expect(find.text('Failed. Tap to retry'), findsNothing);
      expect(apiClient.sendCount, 2);
    });
  });
}
