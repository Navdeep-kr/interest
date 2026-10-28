import '../domain/models/live_models.dart';
import 'live_api_client.dart';

class LiveRepository {
  final LiveApiClient _apiClient;

  LiveRepository({
    LiveApiClient? apiClient,
    dynamic storage,
  }) : _apiClient = apiClient ?? LiveApiClient();

  Future<List<LiveEventItemModel>> fetchEvents({String? status, String? interestId}) async {
    return _apiClient.getEvents(status: status, interestId: interestId);
  }

  Future<LiveEventItemModel> fetchEventById(String eventId) async {
    return _apiClient.getEventById(eventId);
  }

  Future<Map<String, dynamic>> createEvent({
    required String title,
    required String description,
    required String interestId,
    required String interestName,
    required String scheduledStartTime,
    String? coverImageUrl,
    bool is18Plus = false,
    bool recordSession = true,
  }) async {
    return _apiClient.createEvent(
      title: title,
      description: description,
      interestId: interestId,
      interestName: interestName,
      scheduledStartTime: scheduledStartTime,
      coverImageUrl: coverImageUrl,
      is18Plus: is18Plus,
      recordSession: recordSession,
    );
  }

  Future<Map<String, dynamic>> toggleReminder(String eventId) async {
    return _apiClient.toggleReminder(eventId);
  }

  Future<List<LiveQuestionModel>> fetchQuestions(String eventId) async {
    return _apiClient.getQuestions(eventId);
  }

  Future<LiveQuestionModel> submitQuestion(String eventId, String question) async {
    return _apiClient.submitQuestion(eventId, question);
  }

  Future<Map<String, dynamic>> upvoteQuestion(String eventId, String questionId) async {
    return _apiClient.upvoteQuestion(eventId, questionId);
  }

  Future<Map<String, dynamic>> sendReaction(String eventId, String reactionType) async {
    return _apiClient.sendReaction(eventId, reactionType);
  }
}
