import 'package:mobile/features/creator/domain/models/creator_models.dart';

class CreatorStudioState {
  final String? videoUri;
  final int fileSizeBytes;
  final int totalDurationMs;
  final AspectRatioPreset aspectRatio;
  final int trimStartMs;
  final int trimEndMs;
  final int coverFrameTimestampMs;
  final CropRectModel? cropRect;
  final List<SubtitleCueModel> subtitles;
  final List<TextOverlayModel> textOverlays;
  final AudioMixControlsModel audioControls;
  final LicensedSoundModel? selectedSound;
  final String title;
  final String caption;
  final List<String> hashtags;
  final AudienceControlsModel audience;
  final DateTime? scheduledAt;

  // Active editor tool tab: 'PREVIEW', 'TRIM', 'RATIO', 'TEXT', 'SUBTITLES', 'SOUNDS', 'AUDIO_MIX', 'SETTINGS'
  final String activeToolTab;

  // Sounds library
  final List<LicensedSoundModel> soundsLibrary;
  final bool isLoadingSounds;

  // Draft persistence (Zero Work Loss Guarantee)
  final String? draftId;
  final String clientDraftId;
  final bool isSavingDraft;
  final DateTime? lastSavedAt;

  // Publishing & Upload tracking
  final bool isUploading;
  final double uploadProgressPercent;
  final bool isPublishing;
  final PublishingSessionModel? publishingSession;
  final String? errorMessage;
  final bool isSuccess;

  const CreatorStudioState({
    this.videoUri,
    this.fileSizeBytes = 0,
    this.totalDurationMs = 15000,
    this.aspectRatio = AspectRatioPreset.vertical916,
    this.trimStartMs = 0,
    this.trimEndMs = 15000,
    this.coverFrameTimestampMs = 1000,
    this.cropRect,
    this.subtitles = const [],
    this.textOverlays = const [],
    this.audioControls = const AudioMixControlsModel(),
    this.selectedSound,
    this.title = '',
    this.caption = '',
    this.hashtags = const [],
    this.audience = const AudienceControlsModel(),
    this.scheduledAt,
    this.activeToolTab = 'PREVIEW',
    this.soundsLibrary = const [],
    this.isLoadingSounds = false,
    this.draftId,
    required this.clientDraftId,
    this.isSavingDraft = false,
    this.lastSavedAt,
    this.isUploading = false,
    this.uploadProgressPercent = 0.0,
    this.isPublishing = false,
    this.publishingSession,
    this.errorMessage,
    this.isSuccess = false,
  });

  CreatorStudioState copyWith({
    String? videoUri,
    int? fileSizeBytes,
    int? totalDurationMs,
    AspectRatioPreset? aspectRatio,
    int? trimStartMs,
    int? trimEndMs,
    int? coverFrameTimestampMs,
    CropRectModel? cropRect,
    List<SubtitleCueModel>? subtitles,
    List<TextOverlayModel>? textOverlays,
    AudioMixControlsModel? audioControls,
    LicensedSoundModel? selectedSound,
    bool clearSound = false,
    String? title,
    String? caption,
    List<String>? hashtags,
    AudienceControlsModel? audience,
    DateTime? scheduledAt,
    bool clearSchedule = false,
    String? activeToolTab,
    List<LicensedSoundModel>? soundsLibrary,
    bool? isLoadingSounds,
    String? draftId,
    String? clientDraftId,
    bool? isSavingDraft,
    DateTime? lastSavedAt,
    bool? isUploading,
    double? uploadProgressPercent,
    bool? isPublishing,
    PublishingSessionModel? publishingSession,
    String? errorMessage,
    bool clearError = false,
    bool? isSuccess,
  }) {
    return CreatorStudioState(
      videoUri: videoUri ?? this.videoUri,
      fileSizeBytes: fileSizeBytes ?? this.fileSizeBytes,
      totalDurationMs: totalDurationMs ?? this.totalDurationMs,
      aspectRatio: aspectRatio ?? this.aspectRatio,
      trimStartMs: trimStartMs ?? this.trimStartMs,
      trimEndMs: trimEndMs ?? this.trimEndMs,
      coverFrameTimestampMs: coverFrameTimestampMs ?? this.coverFrameTimestampMs,
      cropRect: cropRect ?? this.cropRect,
      subtitles: subtitles ?? this.subtitles,
      textOverlays: textOverlays ?? this.textOverlays,
      audioControls: audioControls ?? this.audioControls,
      selectedSound: clearSound ? null : (selectedSound ?? this.selectedSound),
      title: title ?? this.title,
      caption: caption ?? this.caption,
      hashtags: hashtags ?? this.hashtags,
      audience: audience ?? this.audience,
      scheduledAt: clearSchedule ? null : (scheduledAt ?? this.scheduledAt),
      activeToolTab: activeToolTab ?? this.activeToolTab,
      soundsLibrary: soundsLibrary ?? this.soundsLibrary,
      isLoadingSounds: isLoadingSounds ?? this.isLoadingSounds,
      draftId: draftId ?? this.draftId,
      clientDraftId: clientDraftId ?? this.clientDraftId,
      isSavingDraft: isSavingDraft ?? this.isSavingDraft,
      lastSavedAt: lastSavedAt ?? this.lastSavedAt,
      isUploading: isUploading ?? this.isUploading,
      uploadProgressPercent: uploadProgressPercent ?? this.uploadProgressPercent,
      isPublishing: isPublishing ?? this.isPublishing,
      publishingSession: publishingSession ?? this.publishingSession,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      isSuccess: isSuccess ?? this.isSuccess,
    );
  }
}
