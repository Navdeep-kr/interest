class StreamHealthModel {
  final String status; // 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'OFFLINE'
  final int bitrateKbps;
  final int fps;
  final double droppedFramePercent;
  final int jitterMs;
  final String lastHeartbeatAt;

  const StreamHealthModel({
    required this.status,
    required this.bitrateKbps,
    required this.fps,
    required this.droppedFramePercent,
    required this.jitterMs,
    required this.lastHeartbeatAt,
  });

  factory StreamHealthModel.fromJson(Map<String, dynamic> json) {
    return StreamHealthModel(
      status: json['status'] as String? ?? 'HEALTHY',
      bitrateKbps: json['bitrateKbps'] as int? ?? 0,
      fps: json['fps'] as int? ?? 0,
      droppedFramePercent: (json['droppedFramePercent'] as num?)?.toDouble() ?? 0.0,
      jitterMs: json['jitterMs'] as int? ?? 0,
      lastHeartbeatAt: json['lastHeartbeatAt'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'status': status,
        'bitrateKbps': bitrateKbps,
        'fps': fps,
        'droppedFramePercent': droppedFramePercent,
        'jitterMs': jitterMs,
        'lastHeartbeatAt': lastHeartbeatAt,
      };
}

class CoHostModel {
  final String userId;
  final String username;
  final String? avatarUrl;
  final String status; // 'INVITED' | 'ACCEPTED' | 'DECLINED' | 'DISCONNECTED'
  final String? joinedAt;

  const CoHostModel({
    required this.userId,
    required this.username,
    this.avatarUrl,
    required this.status,
    this.joinedAt,
  });

  factory CoHostModel.fromJson(Map<String, dynamic> json) {
    return CoHostModel(
      userId: json['userId'] as String? ?? '',
      username: json['username'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String?,
      status: json['status'] as String? ?? 'INVITED',
      joinedAt: json['joinedAt'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'userId': userId,
        'username': username,
        'avatarUrl': avatarUrl,
        'status': status,
        'joinedAt': joinedAt,
      };
}

class LiveEventItemModel {
  final String id;
  final String hostId;
  final String hostUsername;
  final String? hostAvatarUrl;
  final String title;
  final String description;
  final String? coverImageUrl;
  final String interestId;
  final String interestName;
  final String scheduledStartTime;
  final String? actualStartTime;
  final String? actualEndTime;
  final String status; // 'SCHEDULED' | 'STARTING' | 'LIVE' | 'ENDED' | 'CANCELLED' | 'TERMINATED_MODERATION'
  final bool is18Plus;
  final bool recordSession;
  final int recordingRetentionDays;
  final String? playbackUrl;
  final String? recordingUrl;
  final int viewerCount;
  final int peakViewers;
  final StreamHealthModel health;
  final CoHostModel? coHost;
  final int remindersCount;
  final bool isReminderSet;
  final String createdAt;
  final String updatedAt;

  const LiveEventItemModel({
    required this.id,
    required this.hostId,
    required this.hostUsername,
    this.hostAvatarUrl,
    required this.title,
    required this.description,
    this.coverImageUrl,
    required this.interestId,
    required this.interestName,
    required this.scheduledStartTime,
    this.actualStartTime,
    this.actualEndTime,
    required this.status,
    this.is18Plus = false,
    this.recordSession = true,
    this.recordingRetentionDays = 30,
    this.playbackUrl,
    this.recordingUrl,
    this.viewerCount = 0,
    this.peakViewers = 0,
    required this.health,
    this.coHost,
    this.remindersCount = 0,
    this.isReminderSet = false,
    required this.createdAt,
    required this.updatedAt,
  });

  factory LiveEventItemModel.fromJson(Map<String, dynamic> json) {
    return LiveEventItemModel(
      id: json['id'] as String? ?? '',
      hostId: json['hostId'] as String? ?? '',
      hostUsername: json['hostUsername'] as String? ?? '',
      hostAvatarUrl: json['hostAvatarUrl'] as String?,
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      coverImageUrl: json['coverImageUrl'] as String?,
      interestId: json['interestId'] as String? ?? '',
      interestName: json['interestName'] as String? ?? '',
      scheduledStartTime: json['scheduledStartTime'] as String? ?? '',
      actualStartTime: json['actualStartTime'] as String?,
      actualEndTime: json['actualEndTime'] as String?,
      status: json['status'] as String? ?? 'SCHEDULED',
      is18Plus: json['is18Plus'] as bool? ?? false,
      recordSession: json['recordSession'] as bool? ?? true,
      recordingRetentionDays: json['recordingRetentionDays'] as int? ?? 30,
      playbackUrl: json['playbackUrl'] as String?,
      recordingUrl: json['recordingUrl'] as String?,
      viewerCount: json['viewerCount'] as int? ?? 0,
      peakViewers: json['peakViewers'] as int? ?? 0,
      health: json['health'] != null
          ? StreamHealthModel.fromJson(json['health'] as Map<String, dynamic>)
          : const StreamHealthModel(
              status: 'HEALTHY',
              bitrateKbps: 0,
              fps: 0,
              droppedFramePercent: 0,
              jitterMs: 0,
              lastHeartbeatAt: '',
            ),
      coHost: json['coHost'] != null
          ? CoHostModel.fromJson(json['coHost'] as Map<String, dynamic>)
          : null,
      remindersCount: json['remindersCount'] as int? ?? 0,
      isReminderSet: json['isReminderSet'] as bool? ?? false,
      createdAt: json['createdAt'] as String? ?? '',
      updatedAt: json['updatedAt'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'hostId': hostId,
        'hostUsername': hostUsername,
        'hostAvatarUrl': hostAvatarUrl,
        'title': title,
        'description': description,
        'coverImageUrl': coverImageUrl,
        'interestId': interestId,
        'interestName': interestName,
        'scheduledStartTime': scheduledStartTime,
        'actualStartTime': actualStartTime,
        'actualEndTime': actualEndTime,
        'status': status,
        'is18Plus': is18Plus,
        'recordSession': recordSession,
        'recordingRetentionDays': recordingRetentionDays,
        'playbackUrl': playbackUrl,
        'recordingUrl': recordingUrl,
        'viewerCount': viewerCount,
        'peakViewers': peakViewers,
        'health': health.toJson(),
        'coHost': coHost?.toJson(),
        'remindersCount': remindersCount,
        'isReminderSet': isReminderSet,
        'createdAt': createdAt,
        'updatedAt': updatedAt,
      };

  LiveEventItemModel copyWith({
    String? status,
    int? viewerCount,
    int? peakViewers,
    StreamHealthModel? health,
    CoHostModel? coHost,
    int? remindersCount,
    bool? isReminderSet,
  }) {
    return LiveEventItemModel(
      id: id,
      hostId: hostId,
      hostUsername: hostUsername,
      hostAvatarUrl: hostAvatarUrl,
      title: title,
      description: description,
      coverImageUrl: coverImageUrl,
      interestId: interestId,
      interestName: interestName,
      scheduledStartTime: scheduledStartTime,
      actualStartTime: actualStartTime,
      actualEndTime: actualEndTime,
      status: status ?? this.status,
      is18Plus: is18Plus,
      recordSession: recordSession,
      recordingRetentionDays: recordingRetentionDays,
      playbackUrl: playbackUrl,
      recordingUrl: recordingUrl,
      viewerCount: viewerCount ?? this.viewerCount,
      peakViewers: peakViewers ?? this.peakViewers,
      health: health ?? this.health,
      coHost: coHost ?? this.coHost,
      remindersCount: remindersCount ?? this.remindersCount,
      isReminderSet: isReminderSet ?? this.isReminderSet,
      createdAt: createdAt,
      updatedAt: updatedAt,
    );
  }
}

class LiveQuestionModel {
  final String id;
  final String eventId;
  final String userId;
  final String username;
  final String? avatarUrl;
  final String question;
  final bool isApproved;
  final bool isAnswered;
  final bool isPinned;
  final int upvotesCount;
  final bool hasUpvoted;
  final String createdAt;

  const LiveQuestionModel({
    required this.id,
    required this.eventId,
    required this.userId,
    required this.username,
    this.avatarUrl,
    required this.question,
    required this.isApproved,
    required this.isAnswered,
    required this.isPinned,
    required this.upvotesCount,
    this.hasUpvoted = false,
    required this.createdAt,
  });

  factory LiveQuestionModel.fromJson(Map<String, dynamic> json) {
    return LiveQuestionModel(
      id: json['id'] as String? ?? '',
      eventId: json['eventId'] as String? ?? '',
      userId: json['userId'] as String? ?? '',
      username: json['username'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String?,
      question: json['question'] as String? ?? '',
      isApproved: json['isApproved'] as bool? ?? false,
      isAnswered: json['isAnswered'] as bool? ?? false,
      isPinned: json['isPinned'] as bool? ?? false,
      upvotesCount: json['upvotesCount'] as int? ?? 0,
      hasUpvoted: json['hasUpvoted'] as bool? ?? false,
      createdAt: json['createdAt'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'eventId': eventId,
        'userId': userId,
        'username': username,
        'avatarUrl': avatarUrl,
        'question': question,
        'isApproved': isApproved,
        'isAnswered': isAnswered,
        'isPinned': isPinned,
        'upvotesCount': upvotesCount,
        'hasUpvoted': hasUpvoted,
        'createdAt': createdAt,
      };

  LiveQuestionModel copyWith({
    bool? isApproved,
    bool? isAnswered,
    bool? isPinned,
    int? upvotesCount,
    bool? hasUpvoted,
  }) {
    return LiveQuestionModel(
      id: id,
      eventId: eventId,
      userId: userId,
      username: username,
      avatarUrl: avatarUrl,
      question: question,
      isApproved: isApproved ?? this.isApproved,
      isAnswered: isAnswered ?? this.isAnswered,
      isPinned: isPinned ?? this.isPinned,
      upvotesCount: upvotesCount ?? this.upvotesCount,
      hasUpvoted: hasUpvoted ?? this.hasUpvoted,
      createdAt: createdAt,
    );
  }
}
