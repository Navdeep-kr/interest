import 'package:mobile/core/storage/secure_storage_service.dart';
import '../domain/models/learn_models.dart';
import 'learn_api_client.dart';

class LearnRepository {
  final LearnApiClient _apiClient;
  final SecureStorageService? _storage;

  LearnRepository({
    LearnApiClient? apiClient,
    SecureStorageService? storage,
  })  : _apiClient = apiClient ?? LearnApiClient(),
        _storage = storage;

  Future<String?> _getToken() async {
    if (_storage == null) return null;
    return _storage.getAccessToken();
  }

  Future<List<SkillPathModel>> fetchSkillPaths({
    String? level,
    bool? isVerifiedCredential,
  }) async {
    final token = await _getToken();
    return _apiClient.getSkillPaths(
      level: level,
      isVerifiedCredential: isVerifiedCredential,
      token: token,
    );
  }

  Future<Map<String, dynamic>> fetchPathDetails(String pathId) async {
    final token = await _getToken();
    return _apiClient.getPathDetails(pathId, token: token);
  }

  Future<Map<String, dynamic>> fetchResumeSession() async {
    final token = await _getToken();
    return _apiClient.getResumeProgress(token: token);
  }

  Future<UserPathProgressModel?> recordProgress({
    required String pathId,
    required String lessonId,
    required bool completed,
    int? timeSpentSeconds,
  }) async {
    final token = await _getToken();
    return _apiClient.recordProgress(
      pathId: pathId,
      lessonId: lessonId,
      completed: completed,
      timeSpentSeconds: timeSpentSeconds,
      token: token,
    );
  }

  Future<bool> submitFeedback({
    required String pathId,
    String? lessonId,
    required String feedback,
    required int ratingScore,
    String? comments,
  }) async {
    final token = await _getToken();
    return _apiClient.submitFeedback(
      pathId: pathId,
      lessonId: lessonId,
      feedback: feedback,
      ratingScore: ratingScore,
      comments: comments,
      token: token,
    );
  }

  Future<UserLearnReminderModel> fetchReminderSettings() async {
    final token = await _getToken();
    return _apiClient.getReminderSettings(token: token);
  }

  Future<UserLearnReminderModel> updateReminderSettings({
    required bool enabled,
    required String reminderTime,
    required List<int> daysOfWeek,
    required String channel,
    String? targetSkillPathId,
  }) async {
    final token = await _getToken();
    return _apiClient.updateReminderSettings(
      enabled: enabled,
      reminderTime: reminderTime,
      daysOfWeek: daysOfWeek,
      channel: channel,
      targetSkillPathId: targetSkillPathId,
      token: token,
    );
  }
}
