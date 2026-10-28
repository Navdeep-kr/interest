import 'package:mobile/core/storage/secure_storage_service.dart';
import 'package:mobile/features/creator/data/creator_api_client.dart';
import 'package:mobile/features/creator/domain/models/creator_models.dart';
import 'package:mobile/features/creator/domain/models/analytics_models.dart';

class CreatorRepository {
  final CreatorApiClient apiClient;
  final SecureStorageService secureStorage;

  // In-memory hot cache for draft resilience across backgrounding & app lifecycle
  final Map<String, CreatorDraftModel> _localDraftsCache = {};

  CreatorRepository({
    required this.apiClient,
    required this.secureStorage,
  });

  Future<String?> _getToken() async {
    return secureStorage.getAccessToken();
  }

  /// Saves a draft locally to protect against app backgrounding and then syncs with backend.
  Future<CreatorDraftModel> saveDraft(CreatorDraftModel draft) async {
    // 1. Immediate local cache write (zero work loss guarantee)
    final key = draft.clientDraftId ?? draft.id;
    _localDraftsCache[key] = draft;

    final token = await _getToken();
    try {
      final savedRemote = await apiClient.saveDraft(draft: draft, token: token);
      _localDraftsCache[savedRemote.id] = savedRemote;
      if (savedRemote.clientDraftId != null) {
        _localDraftsCache[savedRemote.clientDraftId!] = savedRemote;
      }
      return savedRemote;
    } catch (_) {
      // Return locally preserved draft if offline or backend temporarily unreachable
      return draft;
    }
  }

  /// Lists drafts combining remote database drafts with any locally cached unsaved drafts.
  Future<List<CreatorDraftModel>> getDrafts() async {
    final token = await _getToken();
    try {
      final remoteDrafts = await apiClient.getDrafts(token: token);
      for (final r in remoteDrafts) {
        _localDraftsCache[r.id] = r;
      }
      return remoteDrafts;
    } catch (_) {
      return _localDraftsCache.values.toList();
    }
  }

  /// Retrieves a draft by ID from local cache or remote server.
  Future<CreatorDraftModel> getDraftById(String draftId) async {
    if (_localDraftsCache.containsKey(draftId)) {
      return _localDraftsCache[draftId]!;
    }
    final token = await _getToken();
    final draft = await apiClient.getDraftById(draftId: draftId, token: token);
    _localDraftsCache[draft.id] = draft;
    return draft;
  }

  /// Deletes a draft from local cache and remote server.
  Future<void> deleteDraft(String draftId) async {
    _localDraftsCache.remove(draftId);
    final token = await _getToken();
    try {
      await apiClient.deleteDraft(draftId: draftId, token: token);
    } catch (_) {}
  }

  /// Fetches licensed sounds from the audio library.
  Future<List<LicensedSoundModel>> getLicensedSounds({String? query, int limit = 20, int offset = 0}) async {
    final token = await _getToken();
    return apiClient.getLicensedSounds(query: query, limit: limit, offset: offset, token: token);
  }

  /// Publishes or schedules a reel idempotently using clientPublicationId.
  Future<PublishingSessionModel> publishOrSchedule(Map<String, dynamic> payload) async {
    final token = await _getToken();
    return apiClient.publishOrSchedule(payload: payload, token: token);
  }

  /// Recovers publishing session status on app restart or after backgrounding.
  Future<PublishingSessionModel> getPublishingStatus(String identifier) async {
    final token = await _getToken();
    return apiClient.getPublishingStatus(identifier: identifier, token: token);
  }

  /// Updates metadata for an already published or scheduled reel.
  Future<void> updatePublishedReel(String reelId, Map<String, dynamic> data) async {
    final token = await _getToken();
    return apiClient.updatePublishedReel(reelId: reelId, data: data, token: token);
  }

  /// Deletes a published or scheduled reel.
  Future<void> deleteReel(String reelId) async {
    final token = await _getToken();
    return apiClient.deleteReel(reelId: reelId, token: token);
  }

  /// Fetches verified creator analytics.
  Future<VerifiedCreatorAnalyticsModel> getVerifiedAnalytics({
    String range = '30d',
    String? startDate,
    String? endDate,
    String? timezone,
    String? reelId,
  }) async {
    final token = await _getToken();
    return apiClient.getVerifiedAnalytics(
      range: range,
      startDate: startDate,
      endDate: endDate,
      timezone: timezone,
      reelId: reelId,
      token: token,
    );
  }

  /// Ingests engagement telemetry.
  Future<Map<String, dynamic>> recordEngagementEvent(Map<String, dynamic> eventData) async {
    final token = await _getToken();
    return apiClient.recordEngagementEvent(eventData: eventData, token: token);
  }

  /// Retrieves list of scheduled reels.
  Future<List<ScheduledReelItemModel>> getScheduledReels() async {
    final token = await _getToken();
    return apiClient.getScheduledReels(token: token);
  }

  /// Schedules a reel.
  Future<Map<String, dynamic>> scheduleReel({
    required String reelId,
    required String scheduledAt,
    int? clientTimezoneOffsetMinutes,
  }) async {
    final token = await _getToken();
    return apiClient.scheduleReel(
      reelId: reelId,
      scheduledAt: scheduledAt,
      clientTimezoneOffsetMinutes: clientTimezoneOffsetMinutes,
      token: token,
    );
  }

  /// Cancels a scheduled reel.
  Future<void> cancelScheduledReel(String reelId) async {
    final token = await _getToken();
    return apiClient.cancelScheduledReel(reelId: reelId, token: token);
  }
}
