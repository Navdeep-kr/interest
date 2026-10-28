// Domain models for In-App Notifications, Push Token Registry, Preferences, and Deep Links.
// STRICT ZERO-LOCATION INVARIANT: Absolutely 0 GPS, 0 IP coordinates, 0 location metadata.

enum NotificationType {
  like,
  comment,
  mention,
  follow,
  dm,
  interestDigest,
  creatorMilestone,
  securityAlert,
  system,
}

enum NotificationChannel {
  inApp,
  push,
  email,
}

enum NotificationPriority {
  urgent,
  high,
  normal,
  low,
}

enum DeepLinkTargetScreen {
  reel,
  profile,
  chatThread,
  topic,
  notificationCenter,
  settingsNotifications,
  notFound,
  accessDenied,
}

class NotificationActorModel {
  final String id;
  final String username;
  final String displayName;
  final String? avatarUrl;

  const NotificationActorModel({
    required this.id,
    required this.username,
    required this.displayName,
    this.avatarUrl,
  });

  factory NotificationActorModel.fromJson(Map<String, dynamic> json) {
    return NotificationActorModel(
      id: json['id'] as String? ?? '',
      username: json['username'] as String? ?? 'user',
      displayName: json['displayName'] as String? ?? 'User',
      avatarUrl: json['avatarUrl'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'username': username,
    'displayName': displayName,
    'avatarUrl': avatarUrl,
  };
}

class NotificationModel {
  final String id;
  final String userId;
  final NotificationType type;
  final String title;
  final String body;
  final String? actorId;
  final List<String> actorIds;
  final int actorCount;
  final List<NotificationActorModel> actors;
  final String? entityId;
  final NotificationChannel channel;
  final NotificationPriority priority;
  final bool isRead;
  final bool isBatched;
  final String? deepLinkUrl;
  final String? dedupKey;
  final Map<String, dynamic>? metadata;
  final String createdAt;

  const NotificationModel({
    required this.id,
    required this.userId,
    required this.type,
    required this.title,
    required this.body,
    this.actorId,
    this.actorIds = const [],
    this.actorCount = 1,
    this.actors = const [],
    this.entityId,
    this.channel = NotificationChannel.inApp,
    this.priority = NotificationPriority.normal,
    this.isRead = false,
    this.isBatched = false,
    this.deepLinkUrl,
    this.dedupKey,
    this.metadata,
    required this.createdAt,
  });

  NotificationModel copyWith({
    bool? isRead,
    bool? isBatched,
    String? title,
    String? body,
    int? actorCount,
    List<NotificationActorModel>? actors,
  }) {
    return NotificationModel(
      id: id,
      userId: userId,
      type: type,
      title: title ?? this.title,
      body: body ?? this.body,
      actorId: actorId,
      actorIds: actorIds,
      actorCount: actorCount ?? this.actorCount,
      actors: actors ?? this.actors,
      entityId: entityId,
      channel: channel,
      priority: priority,
      isRead: isRead ?? this.isRead,
      isBatched: isBatched ?? this.isBatched,
      deepLinkUrl: deepLinkUrl,
      dedupKey: dedupKey,
      metadata: metadata,
      createdAt: createdAt,
    );
  }

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    final rawType = (json['type'] as String? ?? 'LIKE').toUpperCase();
    NotificationType type = NotificationType.like;
    if (rawType == 'COMMENT') type = NotificationType.comment;
    if (rawType == 'MENTION') type = NotificationType.mention;
    if (rawType == 'FOLLOW') type = NotificationType.follow;
    if (rawType == 'DM') type = NotificationType.dm;
    if (rawType == 'INTEREST_DIGEST') type = NotificationType.interestDigest;
    if (rawType == 'CREATOR_MILESTONE') type = NotificationType.creatorMilestone;
    if (rawType == 'SECURITY_ALERT') type = NotificationType.securityAlert;
    if (rawType == 'SYSTEM') type = NotificationType.system;

    final rawPriority = (json['priority'] as String? ?? 'NORMAL').toUpperCase();
    NotificationPriority priority = NotificationPriority.normal;
    if (rawPriority == 'URGENT') priority = NotificationPriority.urgent;
    if (rawPriority == 'HIGH') priority = NotificationPriority.high;
    if (rawPriority == 'LOW') priority = NotificationPriority.low;

    final rawChannel = (json['channel'] as String? ?? 'IN_APP').toUpperCase();
    NotificationChannel channel = NotificationChannel.inApp;
    if (rawChannel == 'PUSH') channel = NotificationChannel.push;
    if (rawChannel == 'EMAIL') channel = NotificationChannel.email;

    final rawActors = json['actors'] as List<dynamic>?;
    final actors = rawActors != null
        ? rawActors.map((a) => NotificationActorModel.fromJson(a as Map<String, dynamic>)).toList()
        : <NotificationActorModel>[];

    final rawActorIds = json['actorIds'] as List<dynamic>?;
    final actorIds = rawActorIds != null ? rawActorIds.map((e) => e.toString()).toList() : <String>[];

    return NotificationModel(
      id: json['id'] as String? ?? '',
      userId: json['userId'] as String? ?? json['user_id'] as String? ?? '',
      type: type,
      title: json['title'] as String? ?? 'Notification',
      body: json['body'] as String? ?? '',
      actorId: json['actorId'] as String? ?? json['actor_id'] as String?,
      actorIds: actorIds,
      actorCount: (json['actorCount'] as num?)?.toInt() ?? (json['actor_count'] as num?)?.toInt() ?? 1,
      actors: actors,
      entityId: json['entityId'] as String? ?? json['entity_id'] as String?,
      channel: channel,
      priority: priority,
      isRead: json['isRead'] as bool? ?? json['is_read'] as bool? ?? false,
      isBatched: json['isBatched'] as bool? ?? json['is_batched'] as bool? ?? false,
      deepLinkUrl: json['deepLinkUrl'] as String? ?? json['deep_link_url'] as String?,
      dedupKey: json['dedupKey'] as String? ?? json['dedup_key'] as String?,
      metadata: json['metadata'] as Map<String, dynamic>?,
      createdAt: json['createdAt'] as String? ?? json['created_at'] as String? ?? DateTime.now().toIso8601String(),
    );
  }
}

class NotificationPreferencesModel {
  final String userId;
  final bool inAppLikes;
  final bool inAppComments;
  final bool inAppMentions;
  final bool inAppFollows;
  final bool inAppDms;
  final bool inAppInterests;
  final bool inAppMilestones;
  final bool pushLikes;
  final bool pushComments;
  final bool pushMentions;
  final bool pushFollows;
  final bool pushDms;
  final bool pushInterests;
  final bool pushMilestones;
  final bool emailDigest;
  final bool emailSecurityAlerts;
  final bool emailMilestones;
  final bool hideNotificationPreviews;
  final bool quietHoursEnabled;
  final String quietHoursStart; // "22:00"
  final String quietHoursEnd;   // "08:00"
  final int clientTimezoneOffsetMinutes;
  final int maxPushesPerHour;

  const NotificationPreferencesModel({
    required this.userId,
    this.inAppLikes = true,
    this.inAppComments = true,
    this.inAppMentions = true,
    this.inAppFollows = true,
    this.inAppDms = true,
    this.inAppInterests = true,
    this.inAppMilestones = true,
    this.pushLikes = true,
    this.pushComments = true,
    this.pushMentions = true,
    this.pushFollows = true,
    this.pushDms = true,
    this.pushInterests = true,
    this.pushMilestones = true,
    this.emailDigest = true,
    this.emailSecurityAlerts = true,
    this.emailMilestones = true,
    this.hideNotificationPreviews = false,
    this.quietHoursEnabled = false,
    this.quietHoursStart = '22:00',
    this.quietHoursEnd = '08:00',
    this.clientTimezoneOffsetMinutes = 0,
    this.maxPushesPerHour = 10,
  });

  NotificationPreferencesModel copyWith({
    bool? inAppLikes,
    bool? inAppComments,
    bool? inAppMentions,
    bool? inAppFollows,
    bool? inAppDms,
    bool? inAppInterests,
    bool? inAppMilestones,
    bool? pushLikes,
    bool? pushComments,
    bool? pushMentions,
    bool? pushFollows,
    bool? pushDms,
    bool? pushInterests,
    bool? pushMilestones,
    bool? emailDigest,
    bool? emailSecurityAlerts,
    bool? emailMilestones,
    bool? hideNotificationPreviews,
    bool? quietHoursEnabled,
    String? quietHoursStart,
    String? quietHoursEnd,
    int? clientTimezoneOffsetMinutes,
    int? maxPushesPerHour,
  }) {
    return NotificationPreferencesModel(
      userId: userId,
      inAppLikes: inAppLikes ?? this.inAppLikes,
      inAppComments: inAppComments ?? this.inAppComments,
      inAppMentions: inAppMentions ?? this.inAppMentions,
      inAppFollows: inAppFollows ?? this.inAppFollows,
      inAppDms: inAppDms ?? this.inAppDms,
      inAppInterests: inAppInterests ?? this.inAppInterests,
      inAppMilestones: inAppMilestones ?? this.inAppMilestones,
      pushLikes: pushLikes ?? this.pushLikes,
      pushComments: pushComments ?? this.pushComments,
      pushMentions: pushMentions ?? this.pushMentions,
      pushFollows: pushFollows ?? this.pushFollows,
      pushDms: pushDms ?? this.pushDms,
      pushInterests: pushInterests ?? this.pushInterests,
      pushMilestones: pushMilestones ?? this.pushMilestones,
      emailDigest: emailDigest ?? this.emailDigest,
      emailSecurityAlerts: emailSecurityAlerts ?? this.emailSecurityAlerts,
      emailMilestones: emailMilestones ?? this.emailMilestones,
      hideNotificationPreviews: hideNotificationPreviews ?? this.hideNotificationPreviews,
      quietHoursEnabled: quietHoursEnabled ?? this.quietHoursEnabled,
      quietHoursStart: quietHoursStart ?? this.quietHoursStart,
      quietHoursEnd: quietHoursEnd ?? this.quietHoursEnd,
      clientTimezoneOffsetMinutes: clientTimezoneOffsetMinutes ?? this.clientTimezoneOffsetMinutes,
      maxPushesPerHour: maxPushesPerHour ?? this.maxPushesPerHour,
    );
  }

  factory NotificationPreferencesModel.fromJson(Map<String, dynamic> json) {
    return NotificationPreferencesModel(
      userId: json['userId'] as String? ?? json['user_id'] as String? ?? '',
      inAppLikes: json['inAppLikes'] as bool? ?? json['in_app_likes'] as bool? ?? true,
      inAppComments: json['inAppComments'] as bool? ?? json['in_app_comments'] as bool? ?? true,
      inAppMentions: json['inAppMentions'] as bool? ?? json['in_app_mentions'] as bool? ?? true,
      inAppFollows: json['inAppFollows'] as bool? ?? json['in_app_follows'] as bool? ?? true,
      inAppDms: json['inAppDms'] as bool? ?? json['in_app_dms'] as bool? ?? true,
      inAppInterests: json['inAppInterests'] as bool? ?? json['in_app_interests'] as bool? ?? true,
      inAppMilestones: json['inAppMilestones'] as bool? ?? json['in_app_milestones'] as bool? ?? true,
      pushLikes: json['pushLikes'] as bool? ?? json['push_likes'] as bool? ?? true,
      pushComments: json['pushComments'] as bool? ?? json['push_comments'] as bool? ?? true,
      pushMentions: json['pushMentions'] as bool? ?? json['push_mentions'] as bool? ?? true,
      pushFollows: json['pushFollows'] as bool? ?? json['push_follows'] as bool? ?? true,
      pushDms: json['pushDms'] as bool? ?? json['push_dms'] as bool? ?? true,
      pushInterests: json['pushInterests'] as bool? ?? json['push_interests'] as bool? ?? true,
      pushMilestones: json['pushMilestones'] as bool? ?? json['push_milestones'] as bool? ?? true,
      emailDigest: json['emailDigest'] as bool? ?? json['email_digest'] as bool? ?? true,
      emailSecurityAlerts: json['emailSecurityAlerts'] as bool? ?? json['email_security_alerts'] as bool? ?? true,
      emailMilestones: json['emailMilestones'] as bool? ?? json['email_milestones'] as bool? ?? true,
      hideNotificationPreviews: json['hideNotificationPreviews'] as bool? ?? json['hide_notification_previews'] as bool? ?? false,
      quietHoursEnabled: json['quietHoursEnabled'] as bool? ?? json['quiet_hours_enabled'] as bool? ?? false,
      quietHoursStart: json['quietHoursStart'] as String? ?? json['quiet_hours_start'] as String? ?? '22:00',
      quietHoursEnd: json['quietHoursEnd'] as String? ?? json['quiet_hours_end'] as String? ?? '08:00',
      clientTimezoneOffsetMinutes: (json['clientTimezoneOffsetMinutes'] as num?)?.toInt() ??
          (json['client_timezone_offset_minutes'] as num?)?.toInt() ??
          0,
      maxPushesPerHour: (json['maxPushesPerHour'] as num?)?.toInt() ?? (json['max_pushes_per_hour'] as num?)?.toInt() ?? 10,
    );
  }

  Map<String, dynamic> toJson() => {
    'inAppLikes': inAppLikes,
    'inAppComments': inAppComments,
    'inAppMentions': inAppMentions,
    'inAppFollows': inAppFollows,
    'inAppDms': inAppDms,
    'inAppInterests': inAppInterests,
    'inAppMilestones': inAppMilestones,
    'pushLikes': pushLikes,
    'pushComments': pushComments,
    'pushMentions': pushMentions,
    'pushFollows': pushFollows,
    'pushDms': pushDms,
    'pushInterests': pushInterests,
    'pushMilestones': pushMilestones,
    'emailDigest': emailDigest,
    'emailSecurityAlerts': emailSecurityAlerts,
    'emailMilestones': emailMilestones,
    'hideNotificationPreviews': hideNotificationPreviews,
    'quietHoursEnabled': quietHoursEnabled,
    'quietHoursStart': quietHoursStart,
    'quietHoursEnd': quietHoursEnd,
    'clientTimezoneOffsetMinutes': clientTimezoneOffsetMinutes,
    'maxPushesPerHour': maxPushesPerHour,
  };
}

class DeepLinkResolutionModel {
  final String url;
  final DeepLinkTargetScreen targetScreen;
  final Map<String, String> params;
  final bool isValid;
  final bool accessGranted;
  final String? title;
  final String? fallbackReason;

  const DeepLinkResolutionModel({
    required this.url,
    required this.targetScreen,
    this.params = const {},
    this.isValid = true,
    this.accessGranted = true,
    this.title,
    this.fallbackReason,
  });

  factory DeepLinkResolutionModel.fromJson(Map<String, dynamic> json) {
    final rawTarget = (json['targetScreen'] as String? ?? 'not_found').toLowerCase();
    DeepLinkTargetScreen screen = DeepLinkTargetScreen.notFound;
    if (rawTarget == 'reel') screen = DeepLinkTargetScreen.reel;
    if (rawTarget == 'profile') screen = DeepLinkTargetScreen.profile;
    if (rawTarget == 'chat_thread') screen = DeepLinkTargetScreen.chatThread;
    if (rawTarget == 'topic') screen = DeepLinkTargetScreen.topic;
    if (rawTarget == 'notification_center') screen = DeepLinkTargetScreen.notificationCenter;
    if (rawTarget == 'settings_notifications') screen = DeepLinkTargetScreen.settingsNotifications;
    if (rawTarget == 'access_denied') screen = DeepLinkTargetScreen.accessDenied;

    final rawParams = json['params'] as Map<String, dynamic>? ?? {};
    final params = rawParams.map((k, v) => MapEntry(k, v.toString()));

    return DeepLinkResolutionModel(
      url: json['url'] as String? ?? '',
      targetScreen: screen,
      params: params,
      isValid: json['isValid'] as bool? ?? true,
      accessGranted: json['accessGranted'] as bool? ?? true,
      title: json['title'] as String?,
      fallbackReason: json['fallbackReason'] as String?,
    );
  }
}
