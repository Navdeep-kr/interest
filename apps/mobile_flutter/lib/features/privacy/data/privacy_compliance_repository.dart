import 'package:mobile/features/privacy/data/privacy_compliance_api_client.dart';
import 'package:mobile/features/privacy/domain/models/privacy_compliance_models.dart';

class PrivacyComplianceRepository {
  final PrivacyComplianceApiClient _apiClient;

  PrivacyComplianceRepository({PrivacyComplianceApiClient? apiClient})
      : _apiClient = apiClient ?? PrivacyComplianceApiClient();

  Future<PrivacySettingsModel> getPrivacySettings({required String token}) async {
    return _apiClient.getPrivacySettings(token: token);
  }

  Future<PrivacySettingsModel> updatePrivacySettings(
    PrivacySettingsModel settings, {
    required String token,
  }) async {
    return _apiClient.updatePrivacySettings(settings, token: token);
  }

  Future<List<UserSessionModel>> getUserSessions({required String token}) async {
    return _apiClient.getUserSessions(token: token);
  }

  Future<void> revokeSession(String sessionId, {required String token}) async {
    return _apiClient.revokeSession(sessionId, token: token);
  }

  Future<int> revokeAllOtherSessions({required String token}) async {
    return _apiClient.revokeAllOtherSessions(token: token);
  }

  Future<AccountDeletionRequestModel> requestAccountDeletion({
    String? reason,
    required String token,
  }) async {
    return _apiClient.requestAccountDeletion(reason: reason, token: token);
  }

  Future<void> cancelAccountDeletion({required String token}) async {
    return _apiClient.cancelAccountDeletion(token: token);
  }

  Future<DataExportRequestModel> requestDataExport({required String token}) async {
    return _apiClient.requestDataExport(token: token);
  }
}
