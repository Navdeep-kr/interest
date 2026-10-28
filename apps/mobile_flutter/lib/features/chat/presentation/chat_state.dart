import 'package:mobile/features/chat/domain/models/chat_models.dart';

abstract class ChatState {
  const ChatState();
}

class ChatInitialState extends ChatState {
  const ChatInitialState();
}

class ConversationsLoadingState extends ChatState {
  final String folder;
  const ConversationsLoadingState({this.folder = 'primary'});
}

class ConversationsLoadedState extends ChatState {
  final String activeFolder; // 'primary' | 'requests' | 'archived'
  final List<ConversationModel> conversations;
  final int globalUnreadCount;

  const ConversationsLoadedState({
    required this.activeFolder,
    required this.conversations,
    this.globalUnreadCount = 0,
  });

  ConversationsLoadedState copyWith({
    String? activeFolder,
    List<ConversationModel>? conversations,
    int? globalUnreadCount,
  }) {
    return ConversationsLoadedState(
      activeFolder: activeFolder ?? this.activeFolder,
      conversations: conversations ?? this.conversations,
      globalUnreadCount: globalUnreadCount ?? this.globalUnreadCount,
    );
  }
}

class ThreadLoadingState extends ChatState {
  final String conversationId;
  const ThreadLoadingState({required this.conversationId});
}

class ThreadLoadedState extends ChatState {
  final ConversationModel conversation;
  final List<MessageModel> messages;
  final int latestSeqNum;
  final bool hasMore;
  final bool isSyncing;
  final List<MessageModel> pendingQueue;

  const ThreadLoadedState({
    required this.conversation,
    required this.messages,
    required this.latestSeqNum,
    this.hasMore = false,
    this.isSyncing = false,
    this.pendingQueue = const [],
  });

  ThreadLoadedState copyWith({
    ConversationModel? conversation,
    List<MessageModel>? messages,
    int? latestSeqNum,
    bool? hasMore,
    bool? isSyncing,
    List<MessageModel>? pendingQueue,
  }) {
    return ThreadLoadedState(
      conversation: conversation ?? this.conversation,
      messages: messages ?? this.messages,
      latestSeqNum: latestSeqNum ?? this.latestSeqNum,
      hasMore: hasMore ?? this.hasMore,
      isSyncing: isSyncing ?? this.isSyncing,
      pendingQueue: pendingQueue ?? this.pendingQueue,
    );
  }
}

class ChatErrorState extends ChatState {
  final String message;
  const ChatErrorState({required this.message});
}
