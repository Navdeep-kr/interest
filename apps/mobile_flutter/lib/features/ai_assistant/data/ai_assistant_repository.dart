import 'package:mobile/core/storage/secure_storage_service.dart';
import '../domain/models/ai_assistant_models.dart';
import 'ai_assistant_api_client.dart';

class AiAssistantRepository {
  final AiAssistantApiClient _apiClient;
  final SecureStorageService? _storage;

  AiAssistantRepository({
    AiAssistantApiClient? apiClient,
    SecureStorageService? storage,
  })  : _apiClient = apiClient ?? AiAssistantApiClient(),
        _storage = storage;

  Future<String?> _getToken() async {
    if (_storage == null) return null;
    return _storage.getAccessToken();
  }

  Future<AiAssistantMessageModel> sendQuery(
    String query, {
    String? conversationId,
    bool? includeSummaries = true,
  }) async {
    final token = await _getToken();
    return _apiClient.queryAssistant(
      query,
      conversationId: conversationId,
      includeSummaries: includeSummaries,
      token: token,
    );
  }

  Future<AiRateLimitAndCostStatusModel> fetchStatus() async {
    final token = await _getToken();
    return _apiClient.getRateLimitStatus(token: token);
  }

  Future<bool> submitFeedback({
    required String messageId,
    required bool isHelpful,
    String? category,
    String? comments,
  }) async {
    final token = await _getToken();
    return _apiClient.submitFeedback(
      messageId: messageId,
      isHelpful: isHelpful,
      category: category,
      comments: comments,
      token: token,
    );
  }

  Future<bool> enrollBeta(bool enrolled) async {
    final token = await _getToken();
    return _apiClient.enrollBeta(enrolled, token: token);
  }
}
