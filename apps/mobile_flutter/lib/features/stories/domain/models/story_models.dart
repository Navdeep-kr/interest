// Domain models for Prompt 15 — Stories & Temporary Content.
// STRICT ZERO-LOCATION: 0 GPS, 0 IP coordinates, zero location attributes.

enum StoryMediaType {
  photo,
  video,
}

extension StoryMediaTypeExt on StoryMediaType {
  String get value {
    switch (this) {
      case StoryMediaType.photo:
        return 'PHOTO';
      case StoryMediaType.video:
        return 'VIDEO';
    }
  }

  static StoryMediaType fromString(String? val) {
    if (val?.toUpperCase() == 'VIDEO') {
      return StoryMediaType.video;
    }
    return StoryMediaType.photo;
  }
}

enum StoryAudience {
  public,
  followersOnly,
  closeFriends,
}

extension StoryAudienceExt on StoryAudience {
  String get value {
    switch (this) {
      case StoryAudience.public:
        return 'PUBLIC';
      case StoryAudience.followersOnly:
        return 'FOLLOWERS_ONLY';
      case StoryAudience.closeFriends:
        return 'CLOSE_FRIENDS';
    }
  }

  static StoryAudience fromString(String? val) {
    switch (val?.toUpperCase()) {
      case 'FOLLOWERS_ONLY':
        return StoryAudience.followersOnly;
      case 'CLOSE_FRIENDS':
        return StoryAudience.closeFriends;
      case 'PUBLIC':
      default:
        return StoryAudience.public;
    }
  }
}

enum StoryReplySetting {
  all,
  followers,
  off,
}

extension StoryReplySettingExt on StoryReplySetting {
  String get value {
    switch (this) {
      case StoryReplySetting.all:
        return 'ALL';
      case StoryReplySetting.followers:
        return 'FOLLOWERS';
      case StoryReplySetting.off:
        return 'OFF';
    }
  }

  static StoryReplySetting fromString(String? val) {
    switch (val?.toUpperCase()) {
      case 'FOLLOWERS':
        return StoryReplySetting.followers;
      case 'OFF':
        return StoryReplySetting.off;
      case 'ALL':
      default:
        return StoryReplySetting.all;
    }
  }
}

class StoryCreatorModel {
  final String id;
  final String username;
  final String displayName;
  final String? avatarUrl;
  final bool isVerified;

  const StoryCreatorModel({
    required this.id,
    required this.username,
    required this.displayName,
    this.avatarUrl,
    this.isVerified = false,
  });

  factory StoryCreatorModel.fromJson(Map<String, dynamic> json) {
    return StoryCreatorModel(
      id: json['id'] as String? ?? '',
      username: json['username'] as String? ?? '',
      displayName: json['displayName'] as String? ?? json['display_name'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String? ?? json['avatar_url'] as String?,
      isVerified: json['isVerified'] as bool? ?? json['is_verified'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'username': username,
    'displayName': displayName,
    'avatarUrl': avatarUrl,
    'isVerified': isVerified,
  };
}

class StoryOverlayModel {
  final String id;
  final String text;
  final String color;
  final double fontSize;
  final double xPercent;
  final double yPercent;
  final double startTimeSeconds;
  final double endTimeSeconds;

  const StoryOverlayModel({
    required this.id,
    required this.text,
    this.color = '#FFFFFF',
    this.fontSize = 24.0,
    this.xPercent = 50.0,
    this.yPercent = 50.0,
    this.startTimeSeconds = 0.0,
    this.endTimeSeconds = 5.0,
  });

  factory StoryOverlayModel.fromJson(Map<String, dynamic> json) {
    return StoryOverlayModel(
      id: json['id'] as String? ?? '',
      text: json['text'] as String? ?? '',
      color: json['color'] as String? ?? '#FFFFFF',
      fontSize: (json['fontSize'] as num?)?.toDouble() ?? 24.0,
      xPercent: (json['xPercent'] as num?)?.toDouble() ?? 50.0,
      yPercent: (json['yPercent'] as num?)?.toDouble() ?? 50.0,
      startTimeSeconds: (json['startTimeSeconds'] as num?)?.toDouble() ?? 0.0,
      endTimeSeconds: (json['endTimeSeconds'] as num?)?.toDouble() ?? 5.0,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'text': text,
    'color': color,
    'fontSize': fontSize,
    'xPercent': xPercent,
    'yPercent': yPercent,
    'startTimeSeconds': startTimeSeconds,
    'endTimeSeconds': endTimeSeconds,
  };
}

class StoryModel {
  final String id;
  final String creatorId;
  final StoryCreatorModel creator;
  final StoryMediaType mediaType;
  final String mediaUrl;
  final String? thumbnailUrl;
  final double durationSeconds;
  final String caption;
  final List<StoryOverlayModel> textOverlays;
  final StoryAudience audience;
  final StoryReplySetting allowReplies;
  final DateTime createdAt;
  final DateTime expiresAt;
  final bool isExpired;
  final bool isViewed;
  final double viewProgressPercent;
  final int viewsCount;
  final int reactionsCount;

  const StoryModel({
    required this.id,
    required this.creatorId,
    required this.creator,
    required this.mediaType,
    required this.mediaUrl,
    this.thumbnailUrl,
    required this.durationSeconds,
    required this.caption,
    required this.textOverlays,
    required this.audience,
    required this.allowReplies,
    required this.createdAt,
    required this.expiresAt,
    required this.isExpired,
    required this.isViewed,
    required this.viewProgressPercent,
    this.viewsCount = 0,
    this.reactionsCount = 0,
  });

  bool get isLocallyExpired => expiresAt.isBefore(DateTime.now());

  String get remainingTimeFormatted {
    final now = DateTime.now();
    final diff = expiresAt.difference(now);
    if (diff.isNegative) return 'Expired';
    if (diff.inHours > 0) return '${diff.inHours}h left';
    if (diff.inMinutes > 0) return '${diff.inMinutes}m left';
    return '${diff.inSeconds}s left';
  }

  factory StoryModel.fromJson(Map<String, dynamic> json) {
    final rawCreator = json['creator'];
    final creator = rawCreator is Map<String, dynamic>
        ? StoryCreatorModel.fromJson(rawCreator)
        : StoryCreatorModel(
            id: json['creatorId'] as String? ?? json['creator_id'] as String? ?? '',
            username: json['creator_username'] as String? ?? '',
            displayName: json['creator_display_name'] as String? ?? '',
            avatarUrl: json['creator_avatar_url'] as String?,
            isVerified: json['creator_is_verified'] as bool? ?? false,
          );

    final overlaysRaw = json['textOverlays'] ?? json['text_overlays'];
    List<StoryOverlayModel> overlays = [];
    if (overlaysRaw is List) {
      overlays = overlaysRaw
          .whereType<Map<String, dynamic>>()
          .map((item) => StoryOverlayModel.fromJson(item))
          .toList();
    }

    final createdAt = DateTime.tryParse(json['createdAt'] as String? ?? json['created_at'] as String? ?? '') ??
        DateTime.now();
    final expiresAt = DateTime.tryParse(json['expiresAt'] as String? ?? json['expires_at'] as String? ?? '') ??
        DateTime.now().add(const Duration(hours: 24));

    final rawDuration = json['durationSeconds'] ?? json['duration_seconds'];
    final duration = rawDuration is num
        ? rawDuration.toDouble()
        : double.tryParse(rawDuration?.toString() ?? '5.0') ?? 5.0;

    final rawProgress = json['viewProgressPercent'] ?? json['viewer_progress'];
    final progress = rawProgress is num
        ? rawProgress.toDouble()
        : double.tryParse(rawProgress?.toString() ?? '0.0') ?? 0.0;

    return StoryModel(
      id: json['id'] as String? ?? '',
      creatorId: json['creatorId'] as String? ?? json['creator_id'] as String? ?? '',
      creator: creator,
      mediaType: StoryMediaTypeExt.fromString(json['mediaType'] as String? ?? json['media_type'] as String?),
      mediaUrl: json['mediaUrl'] as String? ?? json['media_url'] as String? ?? '',
      thumbnailUrl: json['thumbnailUrl'] as String? ?? json['thumbnail_url'] as String?,
      durationSeconds: duration,
      caption: json['caption'] as String? ?? '',
      textOverlays: overlays,
      audience: StoryAudienceExt.fromString(json['audience'] as String?),
      allowReplies: StoryReplySettingExt.fromString(json['allowReplies'] as String? ?? json['allow_replies'] as String?),
      createdAt: createdAt,
      expiresAt: expiresAt,
      isExpired: json['isExpired'] as bool? ?? (expiresAt.isBefore(DateTime.now())),
      isViewed: json['isViewed'] as bool? ?? json['viewer_completed'] as bool? ?? false,
      viewProgressPercent: progress,
      viewsCount: (json['viewsCount'] as num?)?.toInt() ?? (json['views_count'] as num?)?.toInt() ?? 0,
      reactionsCount: (json['reactionsCount'] as num?)?.toInt() ?? (json['reactions_count'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'creatorId': creatorId,
    'creator': creator.toJson(),
    'mediaType': mediaType.value,
    'mediaUrl': mediaUrl,
    'thumbnailUrl': thumbnailUrl,
    'durationSeconds': durationSeconds,
    'caption': caption,
    'textOverlays': textOverlays.map((o) => o.toJson()).toList(),
    'audience': audience.value,
    'allowReplies': allowReplies.value,
    'createdAt': createdAt.toIso8601String(),
    'expiresAt': expiresAt.toIso8601String(),
    'isExpired': isExpired,
    'isViewed': isViewed,
    'viewProgressPercent': viewProgressPercent,
    'viewsCount': viewsCount,
    'reactionsCount': reactionsCount,
  };

  StoryModel copyWith({
    bool? isViewed,
    double? viewProgressPercent,
    int? reactionsCount,
    int? viewsCount,
  }) {
    return StoryModel(
      id: id,
      creatorId: creatorId,
      creator: creator,
      mediaType: mediaType,
      mediaUrl: mediaUrl,
      thumbnailUrl: thumbnailUrl,
      durationSeconds: durationSeconds,
      caption: caption,
      textOverlays: textOverlays,
      audience: audience,
      allowReplies: allowReplies,
      createdAt: createdAt,
      expiresAt: expiresAt,
      isExpired: isExpired,
      isViewed: isViewed ?? this.isViewed,
      viewProgressPercent: viewProgressPercent ?? this.viewProgressPercent,
      viewsCount: viewsCount ?? this.viewsCount,
      reactionsCount: reactionsCount ?? this.reactionsCount,
    );
  }
}

class CreatorStoryTrayModel {
  final String creatorId;
  final String username;
  final String displayName;
  final String? avatarUrl;
  final bool isVerified;
  final bool hasUnviewedStories;
  final DateTime latestStoryAt;
  final List<StoryModel> stories;

  const CreatorStoryTrayModel({
    required this.creatorId,
    required this.username,
    required this.displayName,
    this.avatarUrl,
    this.isVerified = false,
    required this.hasUnviewedStories,
    required this.latestStoryAt,
    required this.stories,
  });

  factory CreatorStoryTrayModel.fromJson(Map<String, dynamic> json) {
    final storiesList = (json['stories'] as List? ?? [])
        .whereType<Map<String, dynamic>>()
        .map((s) => StoryModel.fromJson(s))
        .toList();

    return CreatorStoryTrayModel(
      creatorId: json['creatorId'] as String? ?? json['creator_id'] as String? ?? '',
      username: json['username'] as String? ?? '',
      displayName: json['displayName'] as String? ?? json['display_name'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String? ?? json['avatar_url'] as String?,
      isVerified: json['isVerified'] as bool? ?? json['is_verified'] as bool? ?? false,
      hasUnviewedStories: json['hasUnviewedStories'] as bool? ?? json['has_unviewed_stories'] as bool? ?? true,
      latestStoryAt: DateTime.tryParse(json['latestStoryAt'] as String? ?? json['latest_story_at'] as String? ?? '') ??
          DateTime.now(),
      stories: storiesList,
    );
  }

  Map<String, dynamic> toJson() => {
    'creatorId': creatorId,
    'username': username,
    'displayName': displayName,
    'avatarUrl': avatarUrl,
    'isVerified': isVerified,
    'hasUnviewedStories': hasUnviewedStories,
    'latestStoryAt': latestStoryAt.toIso8601String(),
    'stories': stories.map((s) => s.toJson()).toList(),
  };

  CreatorStoryTrayModel copyWith({
    bool? hasUnviewedStories,
    List<StoryModel>? stories,
  }) {
    return CreatorStoryTrayModel(
      creatorId: creatorId,
      username: username,
      displayName: displayName,
      avatarUrl: avatarUrl,
      isVerified: isVerified,
      hasUnviewedStories: hasUnviewedStories ?? this.hasUnviewedStories,
      latestStoryAt: latestStoryAt,
      stories: stories ?? this.stories,
    );
  }
}

class CreateStoryRequest {
  final StoryMediaType mediaType;
  final String mediaUrl;
  final String? thumbnailUrl;
  final double? durationSeconds;
  final String? caption;
  final List<StoryOverlayModel>? textOverlays;
  final StoryAudience audience;
  final StoryReplySetting allowReplies;

  const CreateStoryRequest({
    required this.mediaType,
    required this.mediaUrl,
    this.thumbnailUrl,
    this.durationSeconds,
    this.caption,
    this.textOverlays,
    this.audience = StoryAudience.public,
    this.allowReplies = StoryReplySetting.all,
  });

  Map<String, dynamic> toJson() => {
    'mediaType': mediaType.value,
    'mediaUrl': mediaUrl,
    if (thumbnailUrl != null) 'thumbnailUrl': thumbnailUrl,
    if (durationSeconds != null) 'durationSeconds': durationSeconds,
    if (caption != null) 'caption': caption,
    if (textOverlays != null) 'textOverlays': textOverlays!.map((o) => o.toJson()).toList(),
    'audience': audience.value,
    'allowReplies': allowReplies.value,
  };
}

class RecordStoryViewRequest {
  final double progressPercent;
  final bool? completed;

  const RecordStoryViewRequest({
    required this.progressPercent,
    this.completed,
  });

  Map<String, dynamic> toJson() => {
    'progressPercent': progressPercent,
    if (completed != null) 'completed': completed,
  };
}
