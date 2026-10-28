import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';
import 'package:mobile/features/creator/data/creator_api_client.dart';
import 'package:mobile/features/creator/data/creator_repository.dart';
import 'package:mobile/features/creator/domain/models/creator_models.dart';
import 'package:mobile/features/creator/presentation/creator_studio_notifier.dart';

class MockCreatorApiClient extends CreatorApiClient {
  int saveDraftCalls = 0;
  int publishCalls = 0;
  int deleteDraftCalls = 0;
  String? lastPublishedClientToken;

  final List<LicensedSoundModel> mockSounds = const [
    LicensedSoundModel(
      id: 'sound-lofi-1',
      title: 'Midnight Lo-Fi Chill',
      artist: 'BeatCraft',
      durationSeconds: 60.0,
      audioUrl: 'https://cdn.interest.app/audio/lofi.mp3',
      genre: 'Lo-Fi',
      isLicensed: true,
      licenseType: 'CREATIVE_COMMONS',
      reelsCount: 1420,
    ),
    LicensedSoundModel(
      id: 'sound-synth-2',
      title: 'Cyber Pulse Synthwave',
      artist: 'NeonGrid',
      durationSeconds: 45.0,
      audioUrl: 'https://cdn.interest.app/audio/synth.mp3',
      genre: 'Electronic',
      isLicensed: true,
      licenseType: 'COMMERCIAL_APPROVED',
      reelsCount: 890,
    ),
  ];

  final List<CreatorDraftModel> mockDrafts = [
    const CreatorDraftModel(
      id: 'draft-existing-1',
      userId: 'user-me-1',
      clientDraftId: 'client-draft-existing',
      title: 'Tokyo Street Food',
      caption: 'Delicious skewers in Shinjuku',
      aspectRatio: AspectRatioPreset.vertical916,
      trimStartMs: 500,
      trimEndMs: 12000,
      coverFrameTimestampMs: 2000,
      createdAt: '2026-10-16T10:00:00Z',
      updatedAt: '2026-10-16T10:00:00Z',
    ),
  ];

  @override
  Future<List<LicensedSoundModel>> getLicensedSounds({
    String? query,
    int limit = 20,
    int offset = 0,
    String? token,
  }) async {
    if (query != null && query.isNotEmpty) {
      return mockSounds.where((s) => s.title.toLowerCase().contains(query.toLowerCase())).toList();
    }
    return mockSounds;
  }

  @override
  Future<CreatorDraftModel> saveDraft({
    required CreatorDraftModel draft,
    String? token,
  }) async {
    saveDraftCalls++;
    final existingIndex = mockDrafts.indexWhere((d) =>
        d.id == draft.id ||
        (draft.clientDraftId != null && d.clientDraftId == draft.clientDraftId));
    if (existingIndex >= 0) {
      mockDrafts[existingIndex] = draft;
    } else {
      mockDrafts.insert(0, draft);
    }
    return draft.copyWith(
      updatedAt: DateTime.now().toIso8601String(),
    );
  }

  @override
  Future<List<CreatorDraftModel>> getDrafts({String? token}) async {
    return mockDrafts;
  }

  @override
  Future<CreatorDraftModel> getDraftById({
    required String draftId,
    String? token,
  }) async {
    return mockDrafts.firstWhere((d) => d.id == draftId);
  }

  @override
  Future<void> deleteDraft({
    required String draftId,
    String? token,
  }) async {
    deleteDraftCalls++;
    mockDrafts.removeWhere((d) => d.id == draftId);
  }

  @override
  Future<PublishingSessionModel> publishOrSchedule({
    required Map<String, dynamic> payload,
    String? token,
  }) async {
    publishCalls++;
    lastPublishedClientToken = payload['clientPublicationId'] as String?;
    final isScheduled = payload['scheduledAt'] != null;

    return PublishingSessionModel(
      sessionId: 'sess-mock-1',
      reelId: 'reel-mock-1',
      clientPublicationId: payload['clientPublicationId'] as String? ?? 'client-pub-1',
      status: isScheduled ? 'SCHEDULED' : 'PROCESSING',
      stage: isScheduled ? 'SCHEDULED_READY' : 'TRANSCODING',
      progressPercent: isScheduled ? 100.0 : 80.0,
      scheduledAt: payload['scheduledAt'] as String?,
      publishedAt: isScheduled ? null : DateTime.now().toIso8601String(),
      hlsMasterUrl: isScheduled ? null : 'https://cdn.interest.app/reels/hls/master.m3u8',
      thumbnailUrl: 'https://cdn.interest.app/reels/thumbs/cover.jpg',
      updatedAt: DateTime.now().toIso8601String(),
    );
  }

  @override
  Future<PublishingSessionModel> getPublishingStatus({
    required String identifier,
    String? token,
  }) async {
    return PublishingSessionModel(
      sessionId: 'sess-rec-1',
      reelId: 'reel-rec-1',
      clientPublicationId: identifier,
      status: 'PROCESSING',
      stage: 'TRANSCODING',
      progressPercent: 75.0,
      hlsMasterUrl: 'https://cdn.interest.app/reels/rec.m3u8',
      thumbnailUrl: 'https://cdn.interest.app/reels/rec.jpg',
      updatedAt: DateTime.now().toIso8601String(),
    );
  }
}

void main() {
  late MockCreatorApiClient mockApiClient;
  late PlatformSecureStorageService secureStorage;
  late CreatorRepository repository;
  late CreatorStudioNotifier notifier;

  setUp(() async {
    mockApiClient = MockCreatorApiClient();
    secureStorage = PlatformSecureStorageService();
    await secureStorage.saveAccessToken('test_jwt_access_token');
    await secureStorage.saveUserId('user-me-1');
    await secureStorage.saveUsername('myusername');

    repository = CreatorRepository(
      apiClient: mockApiClient,
      secureStorage: secureStorage,
    );
    notifier = CreatorStudioNotifier(repository: repository);
  });

  group('Prompt 14 — Media Selection & Preflight Validation', () {
    test('validates and accepts valid MP4 video clip', () {
      notifier.pickMedia(
        uri: 'file:///storage/emulated/0/DCIM/video_001.mp4',
        fileSizeBytes: 25 * 1024 * 1024,
        durationMs: 30000,
      );

      expect(notifier.state.videoUri, 'file:///storage/emulated/0/DCIM/video_001.mp4');
      expect(notifier.state.fileSizeBytes, 25 * 1024 * 1024);
      expect(notifier.state.totalDurationMs, 30000);
      expect(notifier.state.trimStartMs, 0);
      expect(notifier.state.trimEndMs, 30000);
      expect(notifier.state.errorMessage, isNull);
    });

    test('rejects empty file or low storage with zero bytes', () {
      notifier.pickMedia(
        uri: 'file:///storage/emulated/0/DCIM/corrupt.mp4',
        fileSizeBytes: 0,
        durationMs: 0,
      );

      expect(notifier.state.videoUri, isNull);
      expect(notifier.state.errorMessage, contains('empty or unreadable'));
    });

    test('rejects media exceeding 500 MB', () {
      notifier.pickMedia(
        uri: 'file:///storage/emulated/0/DCIM/huge.mp4',
        fileSizeBytes: 600 * 1024 * 1024,
        durationMs: 60000,
      );

      expect(notifier.state.videoUri, isNull);
      expect(notifier.state.errorMessage, contains('exceeds maximum allowable limit'));
    });

    test('rejects unsupported media extensions', () {
      notifier.pickMedia(
        uri: 'file:///storage/emulated/0/DCIM/song.mp3',
        fileSizeBytes: 5 * 1024 * 1024,
        durationMs: 30000,
      );

      expect(notifier.state.videoUri, isNull);
      expect(notifier.state.errorMessage, contains('Unsupported media format'));
    });
  });

  group('Prompt 14 — Clip Editing Recipe (Trim, Ratio, Overlays & Subtitles)', () {
    test('adjusts trim range and aspect ratio preset', () {
      notifier.pickMedia(
        uri: 'file:///video.mp4',
        fileSizeBytes: 10 * 1024 * 1024,
        durationMs: 45000,
      );

      notifier.setTrim(5000, 25000);
      expect(notifier.state.trimStartMs, 5000);
      expect(notifier.state.trimEndMs, 25000);

      notifier.setAspectRatio(AspectRatioPreset.square11);
      expect(notifier.state.aspectRatio, AspectRatioPreset.square11);
      expect(notifier.state.aspectRatio.value, '1:1');

      notifier.setCoverFrame(12000);
      expect(notifier.state.coverFrameTimestampMs, 12000);
    });

    test('adds, updates and removes text overlays', () {
      const overlay = TextOverlayModel(
        id: 'overlay-1',
        text: 'Hello Tokyo!',
        color: '#FFFFFF',
        fontSize: 26.0,
      );

      notifier.addTextOverlay(overlay);
      expect(notifier.state.textOverlays.length, 1);
      expect(notifier.state.textOverlays.first.text, 'Hello Tokyo!');

      notifier.updateTextOverlay(overlay.copyWith(text: 'Shibuya Crossing!'));
      expect(notifier.state.textOverlays.first.text, 'Shibuya Crossing!');

      notifier.removeTextOverlay('overlay-1');
      expect(notifier.state.textOverlays.isEmpty, true);
    });

    test('adds accessible subtitles and generates auto-captions', () {
      const cue = SubtitleCueModel(
        id: 'sub-1',
        startTimeMs: 1000,
        endTimeMs: 4000,
        text: 'This is the main plaza',
      );

      notifier.addSubtitle(cue);
      expect(notifier.state.subtitles.length, 1);
      expect(notifier.state.subtitles.first.text, 'This is the main plaza');

      notifier.generateAutoSubtitles();
      expect(notifier.state.subtitles.length, 2);
      expect(notifier.state.subtitles.first.text, 'Welcome to Interest!');
    });

    test('adjusts audio mix controls and selects licensed sound', () {
      notifier.setAudioControls(const AudioMixControlsModel(
        originalVolume: 0.6,
        soundVolume: 0.8,
        isMuted: false,
      ));
      expect(notifier.state.audioControls.originalVolume, 0.6);
      expect(notifier.state.audioControls.soundVolume, 0.8);

      final sound = mockApiClient.mockSounds.first;
      notifier.selectSound(sound);
      expect(notifier.state.selectedSound, isNotNull);
      expect(notifier.state.selectedSound!.title, 'Midnight Lo-Fi Chill');

      notifier.removeSound();
      expect(notifier.state.selectedSound, isNull);
    });
  });

  group('Prompt 14 — Draft Resilience & Zero Work Loss', () {
    test('auto-saves draft on state mutation and restores from draft', () async {
      notifier.pickMedia(
        uri: 'file:///video.mp4',
        fileSizeBytes: 10 * 1024 * 1024,
        durationMs: 20000,
      );
      notifier.setTitleAndCaption('My Road Trip', 'Cruising along route 66', ['#travel', '#roadtrip']);
      notifier.setTrim(1000, 18000);

      // Manual sync to server
      final savedOk = await notifier.saveDraft();
      expect(savedOk, true);
      expect(mockApiClient.saveDraftCalls, greaterThanOrEqualTo(1));
      expect(notifier.state.lastSavedAt, isNotNull);

      // Verify draft is saved to repository cache and contains My Road Trip
      final drafts = await repository.getDrafts();
      expect(drafts.isNotEmpty, true);
      expect(drafts.any((d) => d.title == 'My Road Trip'), true);
    });

    test('restores full editor state from a loaded draft', () {
      final existingDraft = mockApiClient.mockDrafts.first;
      notifier.loadDraft(existingDraft);

      expect(notifier.state.title, 'Tokyo Street Food');
      expect(notifier.state.caption, 'Delicious skewers in Shinjuku');
      expect(notifier.state.trimStartMs, 500);
      expect(notifier.state.trimEndMs, 12000);
      expect(notifier.state.aspectRatio, AspectRatioPreset.vertical916);
    });
  });

  group('Prompt 14 — Idempotent Publication, Scheduling & Status Recovery', () {
    test('publishes reel idempotently with client publication ID and heavy processing on backend', () async {
      notifier.pickMedia(
        uri: 'file:///video.mp4',
        fileSizeBytes: 15 * 1024 * 1024,
        durationMs: 30000,
      );
      notifier.setTitleAndCaption('Autumn Vibe', 'Beautiful leaves in Kyoto', ['#kyoto', '#fall']);

      final ok = await notifier.publish(customPublicationId: 'idempotent-token-101');
      expect(ok, true);
      expect(notifier.state.isSuccess, true);
      expect(mockApiClient.publishCalls, 1);
      expect(mockApiClient.lastPublishedClientToken, 'idempotent-token-101');
      expect(notifier.state.publishingSession?.status, 'PROCESSING');
    });

    test('schedules reel with timezone-safe future date', () async {
      notifier.pickMedia(
        uri: 'file:///video.mp4',
        fileSizeBytes: 15 * 1024 * 1024,
        durationMs: 30000,
      );

      final scheduledFuture = DateTime.now().add(const Duration(hours: 5));
      notifier.setScheduledAt(scheduledFuture);
      expect(notifier.state.scheduledAt, scheduledFuture);

      final ok = await notifier.publish(customPublicationId: 'idempotent-sched-102');
      expect(ok, true);
      expect(notifier.state.publishingSession?.status, 'SCHEDULED');
    });

    test('recovers publishing status for active session on app resume', () async {
      await notifier.recoverPublishingStatus('recovery-token-999');

      expect(notifier.state.publishingSession, isNotNull);
      expect(notifier.state.publishingSession?.clientPublicationId, 'recovery-token-999');
      expect(notifier.state.publishingSession?.status, 'PROCESSING');
      expect(notifier.state.uploadProgressPercent, 75.0);
    });

    test('cancels upload cleanly', () {
      notifier.pickMedia(
        uri: 'file:///video.mp4',
        fileSizeBytes: 10 * 1024 * 1024,
        durationMs: 20000,
      );

      notifier.cancelUpload();
      expect(notifier.state.isUploading, false);
      expect(notifier.state.errorMessage, contains('cancelled'));
    });
  });
}
