import 'package:mobile/features/safety/data/safety_api_client.dart';
import 'package:mobile/features/safety/domain/models/safety_models.dart';

class SafetyRepository {
  final SafetyApiClient _apiClient;

  SafetyRepository({SafetyApiClient? apiClient})
      : _apiClient = apiClient ?? SafetyApiClient();

  Future<ReportResponse> submitReport(
    CreateReportRequest request, {
    required String token,
  }) async {
    return _apiClient.submitReport(request, token: token);
  }

  Future<UserAccountSafetyStatus> getUserSafetyStatus({
    required String token,
  }) async {
    return _apiClient.getUserSafetyStatus(token: token);
  }

  Future<List<CommunityGuidelineItem>> getCommunityGuidelines() async {
    return _apiClient.getCommunityGuidelines();
  }

  Future<List<BlockedUserItem>> getBlockedUsers({
    required String token,
  }) async {
    return _apiClient.getBlockedUsers(token: token);
  }

  Future<void> blockUser(String userId, {required String token}) async {
    return _apiClient.blockUser(userId, token: token);
  }

  Future<void> unblockUser(String userId, {required String token}) async {
    return _apiClient.unblockUser(userId, token: token);
  }

  Future<void> submitAppeal(
    CreateAppealRequest request, {
    required String token,
  }) async {
    return _apiClient.submitAppeal(request, token: token);
  }
}
