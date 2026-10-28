// Domain models for Creator Studio, Drafts, Subtitles, Licensed Sounds, and Scheduling.
// STRICT ZERO-LOCATION: 0 GPS, 0 IP coordinates, zero location attributes.

enum AspectRatioPreset {
  vertical916, // 9:16 - Reels / Shorts standard
  square11,    // 1:1 - Classic square
  landscape169,// 16:9 - Widescreen
  portrait45,  // 4:5 - Tall portrait
}

extension AspectRatioPresetExt on AspectRatioPreset {
  String get value {
    switch (this) {
      case AspectRatioPreset.vertical916:
        return '9:16';
      case AspectRatioPreset.square11:
        return '1:1';
      case AspectRatioPreset.landscape169:
        return '16:9';
      case AspectRatioPreset.portrait45:
        return '4:5';
    }
  }

  double get ratio {
    switch (this) {
      case AspectRatioPreset.vertical916:
        return 9 / 16;
      case AspectRatioPreset.square11:
        return 1 / 1;
      case AspectRatioPreset.landscape169:
        return 16 / 9;
      case AspectRatioPreset.portrait45:
        return 4 / 5;
    }
  }

  static AspectRatioPreset fromString(String? val) {
    if (val == '1:1') return AspectRatioPreset.square11;
    if (val == '16:9') return AspectRatioPreset.landscape169;
    if (val == '4:5') return AspectRatioPreset.portrait45;
    return AspectRatioPreset.vertical916;
  }
}

class CropRectModel {
  final double x;
  final double y;
  final double width;
  final double height;

  const CropRectModel({
    required this.x,
    required this.y,
    required this.width,
    required this.height,
  });

  Map<String, dynamic> toJson() => {
    'x': x,
    'y': y,
    'width': width,
    'height': height,
  };

  factory CropRectModel.fromJson(Map<String, dynamic> json) {
    return CropRectModel(
      x: (json['x'] as num?)?.toDouble() ?? 0.0,
      y: (json['y'] as num?)?.toDouble() ?? 0.0,
      width: (json['width'] as num?)?.toDouble() ?? 1080.0,
      height: (json['height'] as num?)?.toDouble() ?? 1920.0,
    );
  }
}

class TextOverlayModel {
  final String id;
  final String text;
  final String color;
  final double fontSize;
  final double xPercent;
  final double yPercent;
  final int startTimeMs;
  final int endTimeMs;
  final String? fontStyle;
  final String? backgroundColor;

  const TextOverlayModel({
    required this.id,
    required this.text,
    this.color = '#FFFFFF',
    this.fontSize = 22.0,
    this.xPercent = 50.0,
    this.yPercent = 25.0,
    this.startTimeMs = 0,
    this.endTimeMs = 15000,
    this.fontStyle,
    this.backgroundColor,
  });

  TextOverlayModel copyWith({
    String? text,
    String? color,
    double? fontSize,
    double? xPercent,
    double? yPercent,
    int? startTimeMs,
    int? endTimeMs,
    String? fontStyle,
    String? backgroundColor,
  }) {
    return TextOverlayModel(
      id: id,
      text: text ?? this.text,
      color: color ?? this.color,
      fontSize: fontSize ?? this.fontSize,
      xPercent: xPercent ?? this.xPercent,
      yPercent: yPercent ?? this.yPercent,
      startTimeMs: startTimeMs ?? this.startTimeMs,
      endTimeMs: endTimeMs ?? this.endTimeMs,
      fontStyle: fontStyle ?? this.fontStyle,
      backgroundColor: backgroundColor ?? this.backgroundColor,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'text': text,
    'color': color,
    'fontSize': fontSize,
    'xPercent': xPercent,
    'yPercent': yPercent,
    'startTimeMs': startTimeMs,
    'endTimeMs': endTimeMs,
    'startTimeSeconds': startTimeMs / 1000.0,
    'endTimeSeconds': endTimeMs / 1000.0,
    'fontStyle': fontStyle,
    'backgroundColor': backgroundColor,
  };

  factory TextOverlayModel.fromJson(Map<String, dynamic> json) {
    return TextOverlayModel(
      id: json['id'] as String? ?? '',
      text: json['text'] as String? ?? '',
      color: json['color'] as String? ?? '#FFFFFF',
      fontSize: (json['fontSize'] as num?)?.toDouble() ?? 22.0,
      xPercent: (json['xPercent'] as num?)?.toDouble() ?? 50.0,
      yPercent: (json['yPercent'] as num?)?.toDouble() ?? 25.0,
      startTimeMs: (json['startTimeMs'] as num?)?.toInt() ??
          (((json['startTimeSeconds'] as num?)?.toDouble() ?? 0.0) * 1000).toInt(),
      endTimeMs: (json['endTimeMs'] as num?)?.toInt() ??
          (((json['endTimeSeconds'] as num?)?.toDouble() ?? 15.0) * 1000).toInt(),
      fontStyle: json['fontStyle'] as String?,
      backgroundColor: json['backgroundColor'] as String?,
    );
  }
}

class SubtitleCueModel {
  final String id;
  final int startTimeMs;
  final int endTimeMs;
  final String text;

  const SubtitleCueModel({
    required this.id,
    required this.startTimeMs,
    required this.endTimeMs,
    required this.text,
  });

  SubtitleCueModel copyWith({
    int? startTimeMs,
    int? endTimeMs,
    String? text,
  }) {
    return SubtitleCueModel(
      id: id,
      startTimeMs: startTimeMs ?? this.startTimeMs,
      endTimeMs: endTimeMs ?? this.endTimeMs,
      text: text ?? this.text,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'startTimeMs': startTimeMs,
    'endTimeMs': endTimeMs,
    'text': text,
  };

  factory SubtitleCueModel.fromJson(Map<String, dynamic> json) {
    return SubtitleCueModel(
      id: json['id'] as String? ?? '',
      startTimeMs: (json['startTimeMs'] as num?)?.toInt() ?? 0,
      endTimeMs: (json['endTimeMs'] as num?)?.toInt() ?? 3000,
      text: json['text'] as String? ?? '',
    );
  }
}

class AudioMixControlsModel {
  final double originalVolume; // 0.0 to 1.0
  final double soundVolume;    // 0.0 to 1.0
  final bool isMuted;
  final int soundStartOffsetMs;

  const AudioMixControlsModel({
    this.originalVolume = 1.0,
    this.soundVolume = 1.0,
    this.isMuted = false,
    this.soundStartOffsetMs = 0,
  });

  AudioMixControlsModel copyWith({
    double? originalVolume,
    double? soundVolume,
    bool? isMuted,
    int? soundStartOffsetMs,
  }) {
    return AudioMixControlsModel(
      originalVolume: originalVolume ?? this.originalVolume,
      soundVolume: soundVolume ?? this.soundVolume,
      isMuted: isMuted ?? this.isMuted,
      soundStartOffsetMs: soundStartOffsetMs ?? this.soundStartOffsetMs,
    );
  }

  Map<String, dynamic> toJson() => {
    'originalVolume': originalVolume,
    'soundVolume': soundVolume,
    'isMuted': isMuted,
    'soundStartOffsetMs': soundStartOffsetMs,
  };

  factory AudioMixControlsModel.fromJson(Map<String, dynamic> json) {
    return AudioMixControlsModel(
      originalVolume: (json['originalVolume'] as num?)?.toDouble() ?? 1.0,
      soundVolume: (json['soundVolume'] as num?)?.toDouble() ?? 1.0,
      isMuted: json['isMuted'] as bool? ?? false,
      soundStartOffsetMs: (json['soundStartOffsetMs'] as num?)?.toInt() ?? 0,
    );
  }
}

class LicensedSoundModel {
  final String id;
  final String title;
  final String artist;
  final double durationSeconds;
  final String audioUrl;
  final String? genre;
  final String? coverUrl;
  final bool isLicensed;
  final String? licenseType;
  final String? attributionText;
  final int reelsCount;

  const LicensedSoundModel({
    required this.id,
    required this.title,
    required this.artist,
    required this.durationSeconds,
    required this.audioUrl,
    this.genre,
    this.coverUrl,
    this.isLicensed = true,
    this.licenseType,
    this.attributionText,
    this.reelsCount = 0,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'artist': artist,
    'durationSeconds': durationSeconds,
    'audioUrl': audioUrl,
    'genre': genre,
    'coverUrl': coverUrl,
    'isLicensed': isLicensed,
    'licenseType': licenseType,
    'attributionText': attributionText,
    'reelsCount': reelsCount,
  };

  factory LicensedSoundModel.fromJson(Map<String, dynamic> json) {
    return LicensedSoundModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'Sound Track',
      artist: json['artist'] as String? ?? 'Artist',
      durationSeconds: (json['durationSeconds'] as num?)?.toDouble() ??
          (json['duration_seconds'] as num?)?.toDouble() ??
          30.0,
      audioUrl: json['audioUrl'] as String? ?? json['audio_url'] as String? ?? '',
      genre: json['genre'] as String?,
      coverUrl: json['coverUrl'] as String? ?? json['cover_url'] as String?,
      isLicensed: json['isLicensed'] as bool? ?? json['is_licensed'] as bool? ?? true,
      licenseType: json['licenseType'] as String? ?? json['license_type'] as String?,
      attributionText: json['attributionText'] as String? ?? json['attribution_text'] as String?,
      reelsCount: (json['reelsCount'] as num?)?.toInt() ?? (json['reels_count'] as num?)?.toInt() ?? 0,
    );
  }
}

class AudienceControlsModel {
  final String visibility; // 'PUBLIC', 'FOLLOWERS_ONLY', 'PRIVATE'
  final bool allowComments;
  final bool allowRemix;
  final bool isCommercial;
  final String? brandName;

  const AudienceControlsModel({
    this.visibility = 'PUBLIC',
    this.allowComments = true,
    this.allowRemix = true,
    this.isCommercial = false,
    this.brandName,
  });

  AudienceControlsModel copyWith({
    String? visibility,
    bool? allowComments,
    bool? allowRemix,
    bool? isCommercial,
    String? brandName,
  }) {
    return AudienceControlsModel(
      visibility: visibility ?? this.visibility,
      allowComments: allowComments ?? this.allowComments,
      allowRemix: allowRemix ?? this.allowRemix,
      isCommercial: isCommercial ?? this.isCommercial,
      brandName: brandName ?? this.brandName,
    );
  }

  Map<String, dynamic> toJson() => {
    'visibility': visibility,
    'allowComments': allowComments,
    'allowRemix': allowRemix,
    'isCommercial': isCommercial,
    'brandName': brandName,
  };

  factory AudienceControlsModel.fromJson(Map<String, dynamic> json) {
    return AudienceControlsModel(
      visibility: json['visibility'] as String? ?? 'PUBLIC',
      allowComments: json['allowComments'] as bool? ?? json['allow_comments'] as bool? ?? true,
      allowRemix: json['allowRemix'] as bool? ?? json['allow_remix'] as bool? ?? true,
      isCommercial: json['isCommercial'] as bool? ?? json['is_commercial'] as bool? ?? false,
      brandName: json['brandName'] as String? ?? json['brand_name'] as String?,
    );
  }
}

class CreatorDraftModel {
  final String id;
  final String userId;
  final String? clientDraftId;
  final String title;
  final String? caption;
  final String? primaryInterestId;
  final List<String> secondaryTagIds;
  final List<String> hashtags;
  final String? videoUri;
  final AspectRatioPreset aspectRatio;
  final int trimStartMs;
  final int? trimEndMs;
  final int coverFrameTimestampMs;
  final CropRectModel? cropRect;
  final List<SubtitleCueModel> subtitles;
  final List<TextOverlayModel> textOverlays;
  final AudioMixControlsModel audioControls;
  final String? soundId;
  final LicensedSoundModel? sound;
  final AudienceControlsModel audience;
  final String? scheduledAt;
  final String createdAt;
  final String updatedAt;

  const CreatorDraftModel({
    required this.id,
    required this.userId,
    this.clientDraftId,
    required this.title,
    this.caption,
    this.primaryInterestId,
    this.secondaryTagIds = const [],
    this.hashtags = const [],
    this.videoUri,
    this.aspectRatio = AspectRatioPreset.vertical916,
    this.trimStartMs = 0,
    this.trimEndMs,
    this.coverFrameTimestampMs = 1000,
    this.cropRect,
    this.subtitles = const [],
    this.textOverlays = const [],
    this.audioControls = const AudioMixControlsModel(),
    this.soundId,
    this.sound,
    this.audience = const AudienceControlsModel(),
    this.scheduledAt,
    required this.createdAt,
    required this.updatedAt,
  });

  CreatorDraftModel copyWith({
    String? title,
    String? caption,
    String? primaryInterestId,
    List<String>? secondaryTagIds,
    List<String>? hashtags,
    String? videoUri,
    AspectRatioPreset? aspectRatio,
    int? trimStartMs,
    int? trimEndMs,
    int? coverFrameTimestampMs,
    CropRectModel? cropRect,
    List<SubtitleCueModel>? subtitles,
    List<TextOverlayModel>? textOverlays,
    AudioMixControlsModel? audioControls,
    String? soundId,
    LicensedSoundModel? sound,
    AudienceControlsModel? audience,
    String? scheduledAt,
    String? updatedAt,
  }) {
    return CreatorDraftModel(
      id: id,
      userId: userId,
      clientDraftId: clientDraftId,
      title: title ?? this.title,
      caption: caption ?? this.caption,
      primaryInterestId: primaryInterestId ?? this.primaryInterestId,
      secondaryTagIds: secondaryTagIds ?? this.secondaryTagIds,
      hashtags: hashtags ?? this.hashtags,
      videoUri: videoUri ?? this.videoUri,
      aspectRatio: aspectRatio ?? this.aspectRatio,
      trimStartMs: trimStartMs ?? this.trimStartMs,
      trimEndMs: trimEndMs ?? this.trimEndMs,
      coverFrameTimestampMs: coverFrameTimestampMs ?? this.coverFrameTimestampMs,
      cropRect: cropRect ?? this.cropRect,
      subtitles: subtitles ?? this.subtitles,
      textOverlays: textOverlays ?? this.textOverlays,
      audioControls: audioControls ?? this.audioControls,
      soundId: soundId ?? this.soundId,
      sound: sound ?? this.sound,
      audience: audience ?? this.audience,
      scheduledAt: scheduledAt ?? this.scheduledAt,
      createdAt: createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'userId': userId,
    'clientDraftId': clientDraftId,
    'title': title,
    'caption': caption,
    'primaryInterestId': primaryInterestId,
    'secondaryTagIds': secondaryTagIds,
    'hashtags': hashtags,
    'videoUri': videoUri,
    'aspectRatio': aspectRatio.value,
    'trimStartMs': trimStartMs,
    'trimEndMs': trimEndMs,
    'coverFrameTimestampMs': coverFrameTimestampMs,
    'cropRect': cropRect?.toJson(),
    'subtitles': subtitles.map((s) => s.toJson()).toList(),
    'textOverlays': textOverlays.map((t) => t.toJson()).toList(),
    'audioControls': audioControls.toJson(),
    'soundId': soundId,
    'visibility': audience.visibility,
    'allowComments': audience.allowComments,
    'allowRemix': audience.allowRemix,
    'isCommercial': audience.isCommercial,
    'brandName': audience.brandName,
    'scheduledAt': scheduledAt,
    'createdAt': createdAt,
    'updatedAt': updatedAt,
  };

  factory CreatorDraftModel.fromJson(Map<String, dynamic> json) {
    final rawSubs = json['subtitles'] as List<dynamic>? ?? [];
    final subtitles = rawSubs.map((s) => SubtitleCueModel.fromJson(s as Map<String, dynamic>)).toList();

    final rawOverlays = json['textOverlays'] as List<dynamic>? ?? json['text_overlays'] as List<dynamic>? ?? [];
    final overlays = rawOverlays.map((t) => TextOverlayModel.fromJson(t as Map<String, dynamic>)).toList();

    final audioJson = json['audioControls'] as Map<String, dynamic>? ?? json['audio_controls'] as Map<String, dynamic>?;
    final audioControls = audioJson != null ? AudioMixControlsModel.fromJson(audioJson) : const AudioMixControlsModel();

    final cropJson = json['cropRect'] as Map<String, dynamic>? ?? json['crop_rect'] as Map<String, dynamic>?;
    final cropRect = cropJson != null ? CropRectModel.fromJson(cropJson) : null;

    final soundJson = json['sound'] as Map<String, dynamic>?;
    final sound = soundJson != null ? LicensedSoundModel.fromJson(soundJson) : null;

    final audience = AudienceControlsModel(
      visibility: json['visibility'] as String? ?? 'PUBLIC',
      allowComments: json['allowComments'] as bool? ?? json['allow_comments'] as bool? ?? true,
      allowRemix: json['allowRemix'] as bool? ?? json['allow_remix'] as bool? ?? true,
      isCommercial: json['isCommercial'] as bool? ?? json['is_commercial'] as bool? ?? false,
      brandName: json['brandName'] as String? ?? json['brand_name'] as String?,
    );

    return CreatorDraftModel(
      id: json['id'] as String? ?? '',
      userId: json['userId'] as String? ?? json['user_id'] as String? ?? '',
      clientDraftId: json['clientDraftId'] as String? ?? json['client_draft_id'] as String?,
      title: json['title'] as String? ?? '',
      caption: json['caption'] as String?,
      primaryInterestId: json['primaryInterestId'] as String? ?? json['primary_interest_id'] as String?,
      secondaryTagIds: (json['secondaryTagIds'] as List<dynamic>? ?? json['secondary_tag_ids'] as List<dynamic>? ?? [])
          .map((e) => e.toString())
          .toList(),
      hashtags: (json['hashtags'] as List<dynamic>? ?? []).map((e) => e.toString()).toList(),
      videoUri: json['videoUri'] as String? ?? json['video_uri'] as String?,
      aspectRatio: AspectRatioPresetExt.fromString(json['aspectRatio'] as String? ?? json['aspect_ratio'] as String?),
      trimStartMs: (json['trimStartMs'] as num?)?.toInt() ?? (json['trim_start_ms'] as num?)?.toInt() ?? 0,
      trimEndMs: (json['trimEndMs'] as num?)?.toInt() ?? (json['trim_end_ms'] as num?)?.toInt(),
      coverFrameTimestampMs: (json['coverFrameTimestampMs'] as num?)?.toInt() ??
          (json['cover_frame_timestamp_ms'] as num?)?.toInt() ??
          1000,
      cropRect: cropRect,
      subtitles: subtitles,
      textOverlays: overlays,
      audioControls: audioControls,
      soundId: json['soundId'] as String? ?? json['sound_id'] as String?,
      sound: sound,
      audience: audience,
      scheduledAt: json['scheduledAt'] as String? ?? json['scheduled_at'] as String?,
      createdAt: json['createdAt'] as String? ?? json['created_at'] as String? ?? DateTime.now().toIso8601String(),
      updatedAt: json['updatedAt'] as String? ?? json['updated_at'] as String? ?? DateTime.now().toIso8601String(),
    );
  }
}

class PublishingSessionModel {
  final String sessionId;
  final String? reelId;
  final String clientPublicationId;
  final String status; // 'UPLOADING', 'PROCESSING', 'SCHEDULED', 'PUBLISHED', 'FAILED', 'CANCELLED'
  final String stage;
  final double progressPercent;
  final String? errorMessage;
  final String? scheduledAt;
  final String? publishedAt;
  final String? hlsMasterUrl;
  final String? thumbnailUrl;
  final String updatedAt;

  const PublishingSessionModel({
    required this.sessionId,
    this.reelId,
    required this.clientPublicationId,
    required this.status,
    required this.stage,
    required this.progressPercent,
    this.errorMessage,
    this.scheduledAt,
    this.publishedAt,
    this.hlsMasterUrl,
    this.thumbnailUrl,
    required this.updatedAt,
  });

  factory PublishingSessionModel.fromJson(Map<String, dynamic> json) {
    return PublishingSessionModel(
      sessionId: json['sessionId'] as String? ?? json['id'] as String? ?? '',
      reelId: json['reelId'] as String? ?? json['reel_id'] as String?,
      clientPublicationId: json['clientPublicationId'] as String? ?? json['client_publication_id'] as String? ?? '',
      status: (json['status'] as String? ?? 'PROCESSING').toUpperCase(),
      stage: json['stage'] as String? ?? 'PROCESSING',
      progressPercent: (json['progressPercent'] as num?)?.toDouble() ??
          (json['progress_percent'] as num?)?.toDouble() ??
          0.0,
      errorMessage: json['errorMessage'] as String? ?? json['error_message'] as String?,
      scheduledAt: json['scheduledAt'] as String? ?? json['scheduled_at'] as String?,
      publishedAt: json['publishedAt'] as String? ?? json['published_at'] as String?,
      hlsMasterUrl: json['hlsMasterUrl'] as String? ?? json['hls_master_url'] as String?,
      thumbnailUrl: json['thumbnailUrl'] as String? ?? json['thumbnail_url'] as String?,
      updatedAt: json['updatedAt'] as String? ?? json['updated_at'] as String? ?? DateTime.now().toIso8601String(),
    );
  }
}
