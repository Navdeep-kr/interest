// Domain models for Direct & Group Messaging.
// Strictly Zero-Location: No location or GPS metadata.

enum ConversationType { direct, group }

enum ConversationStatus { active, pending, rejected, archived }

enum ParticipantRole { admin, member }

enum MessageType { text, voice, image, video, reel, system }

enum MessageStatus { sent, delivered, read }

class MessageModel {
  final String id;
  final String conversationId;
  final String senderId;
  final String senderUsername;
  final String senderDisplayName;
  final String? senderAvatarUrl;
  final String? text;
  final MessageType messageType;
  final String? mediaUrl;
  final String? mediaType;
  final String? voiceUrl;
  final double? voiceDurationSeconds;
  final String? attachedReelId;
  final String? attachedReelTitle;
  final int seqNum;
  final String? clientMsgId;
  final MessageStatus status;
  final bool isEdited;
  final String? editedAt;
  final bool isRead;
  final String? readAt;
  final String? deliveredAt;
  final bool isEphemeral;
  final String? expiresAt;
  final bool isDeletedForEveryone;
  final String createdAt;

  // Local client optimistic & retry states
  final bool isSending;
  final bool hasFailed;

  const MessageModel({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.senderUsername,
    required this.senderDisplayName,
    this.senderAvatarUrl,
    this.text,
    this.messageType = MessageType.text,
    this.mediaUrl,
    this.mediaType,
    this.voiceUrl,
    this.voiceDurationSeconds,
    this.attachedReelId,
    this.attachedReelTitle,
    required this.seqNum,
    this.clientMsgId,
    this.status = MessageStatus.sent,
    this.isEdited = false,
    this.editedAt,
    this.isRead = false,
    this.readAt,
    this.deliveredAt,
    this.isEphemeral = false,
    this.expiresAt,
    this.isDeletedForEveryone = false,
    required this.createdAt,
    this.isSending = false,
    this.hasFailed = false,
  });

  MessageModel copyWith({
    String? id,
    String? text,
    int? seqNum,
    MessageStatus? status,
    bool? isEdited,
    String? editedAt,
    bool? isRead,
    String? readAt,
    String? deliveredAt,
    bool? isDeletedForEveryone,
    bool? isSending,
    bool? hasFailed,
  }) {
    return MessageModel(
      id: id ?? this.id,
      conversationId: conversationId,
      senderId: senderId,
      senderUsername: senderUsername,
      senderDisplayName: senderDisplayName,
      senderAvatarUrl: senderAvatarUrl,
      text: text ?? this.text,
      messageType: messageType,
      mediaUrl: mediaUrl,
      mediaType: mediaType,
      voiceUrl: voiceUrl,
      voiceDurationSeconds: voiceDurationSeconds,
      attachedReelId: attachedReelId,
      attachedReelTitle: attachedReelTitle,
      seqNum: seqNum ?? this.seqNum,
      clientMsgId: clientMsgId,
      status: status ?? this.status,
      isEdited: isEdited ?? this.isEdited,
      editedAt: editedAt ?? this.editedAt,
      isRead: isRead ?? this.isRead,
      readAt: readAt ?? this.readAt,
      deliveredAt: deliveredAt ?? this.deliveredAt,
      isEphemeral: isEphemeral,
      expiresAt: expiresAt,
      isDeletedForEveryone: isDeletedForEveryone ?? this.isDeletedForEveryone,
      createdAt: createdAt,
      isSending: isSending ?? this.isSending,
      hasFailed: hasFailed ?? this.hasFailed,
    );
  }

  factory MessageModel.fromJson(Map<String, dynamic> json) {
    final sender = json['sender'] as Map<String, dynamic>? ?? {};
    final attachedReel = json['attachedReel'] as Map<String, dynamic>?;
    final voiceMeta = json['voiceMetadata'] as Map<String, dynamic>?;

    final rawType = (json['messageType'] as String? ?? 'TEXT').toUpperCase();
    MessageType type = MessageType.text;
    if (rawType == 'VOICE') type = MessageType.voice;
    if (rawType == 'IMAGE') type = MessageType.image;
    if (rawType == 'VIDEO') type = MessageType.video;
    if (rawType == 'REEL') type = MessageType.reel;
    if (rawType == 'SYSTEM') type = MessageType.system;

    final rawStatus = (json['status'] as String? ?? 'SENT').toUpperCase();
    MessageStatus status = MessageStatus.sent;
    if (rawStatus == 'DELIVERED') status = MessageStatus.delivered;
    if (rawStatus == 'READ' || json['isRead'] == true) status = MessageStatus.read;

    return MessageModel(
      id: json['id'] as String? ?? '',
      conversationId: json['conversationId'] as String? ?? '',
      senderId: json['senderId'] as String? ?? sender['id'] as String? ?? '',
      senderUsername: sender['username'] as String? ?? 'user',
      senderDisplayName: sender['displayName'] as String? ?? 'User',
      senderAvatarUrl: sender['avatarUrl'] as String?,
      text: json['text'] as String?,
      messageType: type,
      mediaUrl: json['mediaUrl'] as String?,
      mediaType: json['mediaType'] as String?,
      voiceUrl: voiceMeta?['url'] as String? ?? json['voiceUrl'] as String?,
      voiceDurationSeconds: (voiceMeta?['durationSeconds'] as num?)?.toDouble() ??
          (json['voiceDurationSeconds'] as num?)?.toDouble(),
      attachedReelId: attachedReel?['id'] as String? ?? json['attachedReelId'] as String?,
      attachedReelTitle: attachedReel?['title'] as String?,
      seqNum: (json['seqNum'] as num?)?.toInt() ?? 0,
      clientMsgId: json['clientMsgId'] as String?,
      status: status,
      isEdited: json['isEdited'] as bool? ?? false,
      editedAt: json['editedAt'] as String?,
      isRead: json['isRead'] as bool? ?? (status == MessageStatus.read),
      readAt: json['readAt'] as String?,
      deliveredAt: json['deliveredAt'] as String?,
      isEphemeral: json['isEphemeral'] as bool? ?? false,
      expiresAt: json['expiresAt'] as String?,
      isDeletedForEveryone: json['isDeletedForEveryone'] as bool? ?? false,
      createdAt: json['createdAt'] as String? ?? DateTime.now().toIso8601String(),
    );
  }
}

class ConversationParticipantModel {
  final String userId;
  final String username;
  final String displayName;
  final String? avatarUrl;
  final ParticipantRole role;
  final String status;
  final bool isMuted;
  final bool isArchived;
  final int lastReadSeq;
  final String? lastReadAt;
  final String joinedAt;

  const ConversationParticipantModel({
    required this.userId,
    required this.username,
    required this.displayName,
    this.avatarUrl,
    this.role = ParticipantRole.member,
    required this.status,
    this.isMuted = false,
    this.isArchived = false,
    this.lastReadSeq = 0,
    this.lastReadAt,
    required this.joinedAt,
  });

  factory ConversationParticipantModel.fromJson(Map<String, dynamic> json) {
    return ConversationParticipantModel(
      userId: json['userId'] as String? ?? '',
      username: json['username'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String?,
      role: (json['role'] as String? ?? '').toUpperCase() == 'ADMIN'
          ? ParticipantRole.admin
          : ParticipantRole.member,
      status: json['status'] as String? ?? 'ACCEPTED',
      isMuted: json['isMuted'] as bool? ?? false,
      isArchived: json['isArchived'] as bool? ?? false,
      lastReadSeq: (json['lastReadSeq'] as num?)?.toInt() ?? 0,
      lastReadAt: json['lastReadAt'] as String?,
      joinedAt: json['joinedAt'] as String? ?? '',
    );
  }
}

class ConversationModel {
  final String id;
  final ConversationType type;
  final String title;
  final String? avatarUrl;
  final ConversationStatus status;
  final List<ConversationParticipantModel> participants;
  final MessageModel? lastMessage;
  final String lastMessageAt;
  final int lastSeqNum;
  final String? lastMessagePreview;
  final int unreadCount;
  final bool isMuted;
  final bool isArchived;
  final int? disappearingTtlSeconds;

  const ConversationModel({
    required this.id,
    required this.type,
    required this.title,
    this.avatarUrl,
    required this.status,
    this.participants = const [],
    this.lastMessage,
    required this.lastMessageAt,
    required this.lastSeqNum,
    this.lastMessagePreview,
    this.unreadCount = 0,
    this.isMuted = false,
    this.isArchived = false,
    this.disappearingTtlSeconds,
  });

  ConversationModel copyWith({
    String? title,
    String? avatarUrl,
    ConversationStatus? status,
    List<ConversationParticipantModel>? participants,
    MessageModel? lastMessage,
    String? lastMessageAt,
    int? lastSeqNum,
    String? lastMessagePreview,
    int? unreadCount,
    bool? isMuted,
    bool? isArchived,
  }) {
    return ConversationModel(
      id: id,
      type: type,
      title: title ?? this.title,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      status: status ?? this.status,
      participants: participants ?? this.participants,
      lastMessage: lastMessage ?? this.lastMessage,
      lastMessageAt: lastMessageAt ?? this.lastMessageAt,
      lastSeqNum: lastSeqNum ?? this.lastSeqNum,
      lastMessagePreview: lastMessagePreview ?? this.lastMessagePreview,
      unreadCount: unreadCount ?? this.unreadCount,
      isMuted: isMuted ?? this.isMuted,
      isArchived: isArchived ?? this.isArchived,
      disappearingTtlSeconds: disappearingTtlSeconds,
    );
  }

  factory ConversationModel.fromJson(Map<String, dynamic> json) {
    final rawType = (json['type'] as String? ?? 'DIRECT').toUpperCase();
    final rawStatus = (json['status'] as String? ?? 'ACTIVE').toUpperCase();

    ConversationStatus status = ConversationStatus.active;
    if (rawStatus == 'PENDING') status = ConversationStatus.pending;
    if (rawStatus == 'REJECTED') status = ConversationStatus.rejected;
    if (rawStatus == 'ARCHIVED') status = ConversationStatus.archived;

    return ConversationModel(
      id: json['id'] as String? ?? '',
      type: rawType == 'GROUP' ? ConversationType.group : ConversationType.direct,
      title: json['title'] as String? ?? 'Conversation',
      avatarUrl: json['avatarUrl'] as String?,
      status: status,
      participants: (json['participants'] as List<dynamic>?)
              ?.map((e) => ConversationParticipantModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      lastMessage: json['lastMessage'] != null
          ? MessageModel.fromJson(json['lastMessage'] as Map<String, dynamic>)
          : null,
      lastMessageAt: json['lastMessageAt'] as String? ?? '',
      lastSeqNum: (json['lastSeqNum'] as num?)?.toInt() ?? 0,
      lastMessagePreview: json['lastMessagePreview'] as String?,
      unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
      isMuted: json['isMuted'] as bool? ?? false,
      isArchived: json['isArchived'] as bool? ?? false,
      disappearingTtlSeconds: (json['disappearingTtlSeconds'] as num?)?.toInt(),
    );
  }
}

class SyncMessagesResultModel {
  final String conversationId;
  final List<MessageModel> messages;
  final int latestSeqNum;
  final bool hasMore;

  const SyncMessagesResultModel({
    required this.conversationId,
    required this.messages,
    required this.latestSeqNum,
    required this.hasMore,
  });

  factory SyncMessagesResultModel.fromJson(Map<String, dynamic> json) {
    return SyncMessagesResultModel(
      conversationId: json['conversationId'] as String? ?? '',
      messages: (json['messages'] as List<dynamic>?)
              ?.map((e) => MessageModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      latestSeqNum: (json['latestSeqNum'] as num?)?.toInt() ?? 0,
      hasMore: json['hasMore'] as bool? ?? false,
    );
  }
}
