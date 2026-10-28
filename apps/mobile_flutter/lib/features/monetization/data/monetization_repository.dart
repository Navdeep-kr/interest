import 'package:mobile/features/monetization/data/monetization_api_client.dart';
import 'package:mobile/features/monetization/domain/models/monetization_models.dart';

class MonetizationRepository {
  final MonetizationApiClient _apiClient;

  MonetizationRepository({MonetizationApiClient? apiClient})
      : _apiClient = apiClient ?? MonetizationApiClient();

  Future<CreatorFinancialAccountModel> getFinancialAccount(String token) async {
    return _apiClient.getFinancialAccount(token);
  }

  Future<CreatorEligibilityStatusModel> getEligibility(String token) async {
    return _apiClient.getEligibility(token);
  }

  Future<CreatorFinancialAccountModel> submitKyc({
    required String token,
    required String taxFormType,
    required String taxLegalName,
    required String taxIdNumber,
    required String countryCode,
    required String bankAccountLast4,
    required String bankRoutingNumber,
    required bool certificationAccepted,
  }) async {
    return _apiClient.submitKyc(
      token: token,
      taxFormType: taxFormType,
      taxLegalName: taxLegalName,
      taxIdNumber: taxIdNumber,
      countryCode: countryCode,
      bankAccountLast4: bankAccountLast4,
      bankRoutingNumber: bankRoutingNumber,
      certificationAccepted: certificationAccepted,
    );
  }

  Future<List<UserEntitlementItemModel>> getEntitlements(String token) async {
    return _apiClient.getEntitlements(token);
  }

  Future<UserEntitlementItemModel> verifyInAppPurchase({
    required String token,
    required PaymentGateway gateway,
    required String receiptOrToken,
    required String productId,
    required String transactionId,
    String? planId,
    String? creatorId,
    String? reelId,
  }) async {
    return _apiClient.verifyInAppPurchase(
      token: token,
      gateway: gateway,
      receiptOrToken: receiptOrToken,
      productId: productId,
      transactionId: transactionId,
      planId: planId,
      creatorId: creatorId,
      reelId: reelId,
    );
  }

  Future<RestorePurchasesResultModel> restorePurchases({
    required String token,
    required PaymentGateway gateway,
    String? receiptData,
    String? purchaseToken,
    String? productId,
  }) async {
    return _apiClient.restorePurchases(
      token: token,
      gateway: gateway,
      receiptData: receiptData,
      purchaseToken: purchaseToken,
      productId: productId,
    );
  }

  Future<SubscriberContentGateResultModel> checkSubscriberContentAccess({
    required String token,
    required String reelId,
  }) async {
    return _apiClient.checkSubscriberContentAccess(token: token, reelId: reelId);
  }

  Future<Map<String, dynamic>> requestPayout({
    required String token,
    int? amountCents,
  }) async {
    return _apiClient.requestPayout(token: token, amountCents: amountCents);
  }

  Future<List<CreatorPayoutInvoiceItemModel>> getPayoutInvoices(String token) async {
    return _apiClient.getPayoutInvoices(token);
  }

  Future<List<FinancialAuditTrailItemModel>> getAuditTrail({
    required String token,
    int limit = 50,
    int offset = 0,
  }) async {
    return _apiClient.getAuditTrail(token: token, limit: limit, offset: offset);
  }

  Future<List<CreatorSubscriptionPlanModel>> getCreatorPlans(String creatorId, {String? token}) async {
    return _apiClient.getCreatorPlans(creatorId, token: token);
  }
}
