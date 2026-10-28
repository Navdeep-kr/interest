import 'dart:convert';
import 'dart:io';
import 'package:mobile/core/config/env_config.dart';
import 'package:mobile/core/error/failures.dart';
import 'package:mobile/features/monetization/domain/models/monetization_models.dart';

class MonetizationApiClient {
  final String baseUrl;
  final HttpClient _httpClient;

  MonetizationApiClient({
    String? baseUrl,
    HttpClient? httpClient,
  })  : baseUrl = baseUrl ?? EnvConfig.apiBaseUrl,
        _httpClient = httpClient ?? HttpClient() {
    _httpClient.connectionTimeout = const Duration(seconds: 20);
  }

  String _generateRequestId() {
    final now = DateTime.now().millisecondsSinceEpoch;
    final random = (now % 1000000).toString().padLeft(6, '0');
    return 'req_monetization_$now$random';
  }

  Future<dynamic> _get(
    String endpoint, {
    String? token,
    Map<String, String>? queryParams,
  }) async {
    Uri uri = Uri.parse('$baseUrl$endpoint');
    if (queryParams != null && queryParams.isNotEmpty) {
      uri = uri.replace(queryParameters: queryParams);
    }
    final requestId = _generateRequestId();

    try {
      final request = await _httpClient.getUrl(uri);
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      request.headers.set('X-Request-Id', requestId);
      if (token != null && token.isNotEmpty) {
        request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
      }

      final response = await request.close().timeout(const Duration(seconds: 20));
      final responseBody = await response.transform(utf8.decoder).join();
      final statusCode = response.statusCode;

      if (statusCode >= 200 && statusCode < 300) {
        return jsonDecode(responseBody);
      }

      _handleError(statusCode, responseBody);
    } on SocketException {
      throw const NetworkFailure();
    } on Failure {
      rethrow;
    } catch (e) {
      throw ServerFailure(message: 'Unexpected network error: $e');
    }
  }

  Future<dynamic> _post(
    String endpoint, {
    required Map<String, dynamic> body,
    String? token,
  }) async {
    final uri = Uri.parse('$baseUrl$endpoint');
    final requestId = _generateRequestId();

    try {
      final request = await _httpClient.postUrl(uri);
      request.headers.set(HttpHeaders.contentTypeHeader, 'application/json');
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      request.headers.set('X-Request-Id', requestId);
      if (token != null && token.isNotEmpty) {
        request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
      }

      final jsonStr = jsonEncode(body);
      request.add(utf8.encode(jsonStr));

      final response = await request.close().timeout(const Duration(seconds: 20));
      final responseBody = await response.transform(utf8.decoder).join();
      final statusCode = response.statusCode;

      if (statusCode >= 200 && statusCode < 300) {
        return jsonDecode(responseBody);
      }

      _handleError(statusCode, responseBody);
    } on SocketException {
      throw const NetworkFailure();
    } on Failure {
      rethrow;
    } catch (e) {
      throw ServerFailure(message: 'Unexpected network error: $e');
    }
  }

  void _handleError(int statusCode, String responseBody) {
    String message = 'Monetization request failed with status $statusCode';
    try {
      final parsed = jsonDecode(responseBody);
      if (parsed is Map<String, dynamic> && parsed.containsKey('message')) {
        final rawMsg = parsed['message'];
        message = rawMsg is List ? rawMsg.join(', ') : rawMsg.toString();
      }
    } catch (_) {}

    if (statusCode == 400) {
      throw ValidationFailure(message: message);
    } else if (statusCode == 401) {
      throw const AuthenticationFailure(message: 'Authentication required for monetization operations.');
    } else if (statusCode == 403) {
      throw AuthorizationFailure(message: message);
    } else if (statusCode == 404) {
      throw NotFoundFailure(message: message);
    } else {
      throw ServerFailure(message: message);
    }
  }

  // ==========================================================================
  // Public API Methods
  // ==========================================================================

  Future<CreatorFinancialAccountModel> getFinancialAccount(String token) async {
    final res = await _get('/monetization/financial-account', token: token);
    return CreatorFinancialAccountModel.fromJson(res as Map<String, dynamic>);
  }

  Future<CreatorEligibilityStatusModel> getEligibility(String token) async {
    final res = await _get('/monetization/eligibility', token: token);
    return CreatorEligibilityStatusModel.fromJson(res as Map<String, dynamic>);
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
    final res = await _post(
      '/monetization/kyc/submit',
      token: token,
      body: {
        'taxFormType': taxFormType,
        'taxLegalName': taxLegalName,
        'taxIdNumber': taxIdNumber,
        'countryCode': countryCode,
        'bankAccountLast4': bankAccountLast4,
        'bankRoutingNumber': bankRoutingNumber,
        'certificationAccepted': certificationAccepted,
      },
    );
    return CreatorFinancialAccountModel.fromJson(res as Map<String, dynamic>);
  }

  Future<List<UserEntitlementItemModel>> getEntitlements(String token) async {
    final res = await _get('/monetization/entitlements', token: token);
    return (res as List<dynamic>)
        .map((e) => UserEntitlementItemModel.fromJson(e as Map<String, dynamic>))
        .toList();
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
    final res = await _post(
      '/monetization/iap/verify',
      token: token,
      body: {
        'gateway': gateway.toJson(),
        'receiptOrToken': receiptOrToken,
        'productId': productId,
        'transactionId': transactionId,
        if (planId != null) 'planId': planId,
        if (creatorId != null) 'creatorId': creatorId,
        if (reelId != null) 'reelId': reelId,
      },
    );
    return UserEntitlementItemModel.fromJson(res as Map<String, dynamic>);
  }

  Future<RestorePurchasesResultModel> restorePurchases({
    required String token,
    required PaymentGateway gateway,
    String? receiptData,
    String? purchaseToken,
    String? productId,
  }) async {
    final res = await _post(
      '/monetization/iap/restore',
      token: token,
      body: {
        'gateway': gateway.toJson(),
        if (receiptData != null) 'receiptData': receiptData,
        if (purchaseToken != null) 'purchaseToken': purchaseToken,
        if (productId != null) 'productId': productId,
      },
    );
    return RestorePurchasesResultModel.fromJson(res as Map<String, dynamic>);
  }

  Future<SubscriberContentGateResultModel> checkSubscriberContentAccess({
    required String token,
    required String reelId,
  }) async {
    final res = await _get('/monetization/content/gate/$reelId', token: token);
    return SubscriberContentGateResultModel.fromJson(res as Map<String, dynamic>);
  }

  Future<Map<String, dynamic>> requestPayout({
    required String token,
    int? amountCents,
  }) async {
    final res = await _post(
      '/monetization/payouts/request',
      token: token,
      body: {
        if (amountCents != null) 'amountCents': amountCents,
      },
    );
    return res as Map<String, dynamic>;
  }

  Future<List<CreatorPayoutInvoiceItemModel>> getPayoutInvoices(String token) async {
    final res = await _get('/monetization/payouts/invoices', token: token);
    return (res as List<dynamic>)
        .map((e) => CreatorPayoutInvoiceItemModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<FinancialAuditTrailItemModel>> getAuditTrail({
    required String token,
    int limit = 50,
    int offset = 0,
  }) async {
    final res = await _get(
      '/monetization/audit-trail',
      token: token,
      queryParams: {
        'limit': limit.toString(),
        'offset': offset.toString(),
      },
    );
    return (res as List<dynamic>)
        .map((e) => FinancialAuditTrailItemModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<CreatorSubscriptionPlanModel>> getCreatorPlans(String creatorId, {String? token}) async {
    final res = await _get('/monetization/plans/creator/$creatorId', token: token);
    return (res as List<dynamic>)
        .map((e) => CreatorSubscriptionPlanModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
