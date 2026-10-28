import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/monetization/data/monetization_api_client.dart';
import 'package:mobile/features/monetization/data/monetization_repository.dart';
import 'package:mobile/features/monetization/domain/models/monetization_models.dart';
import 'package:mobile/features/monetization/presentation/screens/creator_monetization_dashboard_screen.dart';

class MockMonetizationApiClient extends MonetizationApiClient {
  bool getFinancialAccountCalled = false;
  bool getEligibilityCalled = false;
  bool getInvoicesCalled = false;
  bool getAuditTrailCalled = false;
  bool restorePurchasesCalled = false;
  bool requestPayoutCalled = false;

  CreatorFinancialAccountModel mockAccount = const CreatorFinancialAccountModel(
    userId: 'user-creator-1',
    gateway: PaymentGateway.stripe,
    payoutEnabled: true,
    availableBalanceCents: 15000, // $150.00
    pendingBalanceCents: 0,
    lifetimeEarningsCents: 45000, // $450.00
    currency: 'usd',
    taxIdNumber: '123-45-6789',
    taxEntityType: 'INDIVIDUAL',
    taxLegalName: 'Jane Creator',
    taxJurisdictionCode: 'US',
    taxWithholdingRateBps: 0,
    kycStatus: KycStatus.verified,
    isComplianceBlocked: false,
    taxFormType: 'W9',
    taxFormSubmittedAt: '2026-10-01T12:00:00Z',
  );

  CreatorEligibilityStatusModel mockEligibility = const CreatorEligibilityStatusModel(
    isEligible: true,
    minFollowersRequired: 10,
    currentFollowers: 125,
    minAccountAgeDays: 7,
    currentAccountAgeDays: 45,
    kycStatus: KycStatus.verified,
    isTaxCompliant: true,
    isComplianceBlocked: false,
    reasons: [],
  );

  List<CreatorPayoutInvoiceItemModel> mockInvoices = [
    const CreatorPayoutInvoiceItemModel(
      id: 'inv-1',
      invoiceNumber: 'POINV-2026-001',
      creatorId: 'user-creator-1',
      grossAmountCents: 10000,
      platformFeeCents: 0,
      taxWithheldCents: 0,
      netPayoutCents: 10000,
      currency: 'usd',
      taxIdMasked: '***-**-6789',
      issuedAt: '2026-10-10T14:00:00Z',
    ),
  ];

  List<FinancialAuditTrailItemModel> mockAuditTrail = [
    const FinancialAuditTrailItemModel(
      id: 'audit-1',
      userId: 'user-creator-1',
      actionType: 'CREDIT_SUBSCRIPTION',
      amountCents: 899,
      feeCents: 100,
      balanceBeforeCents: 14101,
      balanceAfterCents: 15000,
      notes: 'Subscription renewal',
      createdAt: '2026-10-15T09:30:00Z',
    ),
  ];

  @override
  Future<CreatorFinancialAccountModel> getFinancialAccount(String token) async {
    getFinancialAccountCalled = true;
    return mockAccount;
  }

  @override
  Future<CreatorEligibilityStatusModel> getEligibility(String token) async {
    getEligibilityCalled = true;
    return mockEligibility;
  }

  @override
  Future<List<CreatorPayoutInvoiceItemModel>> getPayoutInvoices(String token) async {
    getInvoicesCalled = true;
    return mockInvoices;
  }

  @override
  Future<List<FinancialAuditTrailItemModel>> getAuditTrail({
    required String token,
    int limit = 50,
    int offset = 0,
  }) async {
    getAuditTrailCalled = true;
    return mockAuditTrail;
  }

  @override
  Future<RestorePurchasesResultModel> restorePurchases({
    required String token,
    required PaymentGateway gateway,
    String? receiptData,
    String? purchaseToken,
    String? productId,
  }) async {
    restorePurchasesCalled = true;
    return const RestorePurchasesResultModel(
      restoredCount: 1,
      restoredEntitlements: [],
      message: 'Successfully restored 1 active entitlement.',
    );
  }

  @override
  Future<Map<String, dynamic>> requestPayout({
    required String token,
    int? amountCents,
  }) async {
    requestPayoutCalled = true;
    return {'payoutId': 'po_mock_123', 'status': 'PAID'};
  }
}

void main() {
  late MockMonetizationApiClient mockClient;
  late MonetizationRepository repository;

  setUp(() {
    mockClient = MockMonetizationApiClient();
    repository = MonetizationRepository(apiClient: mockClient);
  });

  Widget createWidgetUnderTest() {
    return MaterialApp(
      home: CreatorMonetizationDashboardScreen(
        token: 'mock-valid-jwt-token',
        repository: repository,
      ),
    );
  }

  group('Prompt 18 — Creator Monetization, Subscriptions & Payouts Mobile Dashboard', () {
    testWidgets(r'renders earnings overview correctly ($150.00 available, $450.00 lifetime)', (tester) async {
      await tester.pumpWidget(createWidgetUnderTest());
      await tester.pumpAndSettle();

      expect(find.text('Monetization & Payouts'), findsOneWidget);
      expect(find.text('Available Balance'), findsOneWidget);
      expect(find.text('\$150.00'), findsOneWidget);
      expect(find.text('\$450.00'), findsOneWidget);
      expect(find.text('Lifetime Gross'), findsOneWidget);
    });

    testWidgets('displays Compliant & Verified card when creator is KYC-verified without compliance blocks', (tester) async {
      await tester.pumpWidget(createWidgetUnderTest());
      await tester.pumpAndSettle();

      expect(find.text('Compliant & Verified'), findsOneWidget);
      expect(find.text('KYC Status: VERIFIED'), findsOneWidget);
      expect(find.text('Tax Form: W9'), findsOneWidget);
    });

    testWidgets('displays Compliance Hold Active card and disables payout when creator is blocked', (tester) async {
      mockClient.mockAccount = const CreatorFinancialAccountModel(
        userId: 'user-blocked-1',
        gateway: PaymentGateway.stripe,
        payoutEnabled: false,
        availableBalanceCents: 10000,
        pendingBalanceCents: 0,
        lifetimeEarningsCents: 10000,
        currency: 'usd',
        taxEntityType: 'INDIVIDUAL',
        taxWithholdingRateBps: 0,
        kycStatus: KycStatus.unverified,
        isComplianceBlocked: true,
        complianceBlockReason: 'Identity and tax verification required before enabling payouts.',
      );

      mockClient.mockEligibility = const CreatorEligibilityStatusModel(
        isEligible: false,
        minFollowersRequired: 10,
        currentFollowers: 4,
        minAccountAgeDays: 7,
        currentAccountAgeDays: 3,
        kycStatus: KycStatus.unverified,
        isTaxCompliant: false,
        isComplianceBlocked: true,
        complianceBlockReason: 'Identity and tax verification required before enabling payouts.',
        reasons: ['Minimum 10 followers required (currently 4).'],
      );

      await tester.pumpWidget(createWidgetUnderTest());
      await tester.pumpAndSettle();

      expect(find.text('Compliance Hold Active'), findsOneWidget);
      expect(find.text('Identity and tax verification required before enabling payouts.'), findsOneWidget);
      expect(find.text('Payouts Locked (Requirements Unmet)'), findsOneWidget);
    });

    testWidgets(r'enables Request Payout button when creator is verified, compliant, and balance >= $50.00', (tester) async {
      await tester.pumpWidget(createWidgetUnderTest());
      await tester.pumpAndSettle();

      final payoutButton = find.text('Request Payout');
      expect(payoutButton, findsOneWidget);

      await tester.tap(payoutButton);
      await tester.pumpAndSettle();

      expect(mockClient.requestPayoutCalled, isTrue);
    });

    testWidgets('triggers restore purchases and displays confirmation message without duplicate charges', (tester) async {
      await tester.pumpWidget(createWidgetUnderTest());
      await tester.pumpAndSettle();

      final restoreButton = find.text('Restore Purchases');
      expect(restoreButton, findsOneWidget);

      await tester.ensureVisible(restoreButton);
      await tester.tap(restoreButton);
      await tester.pumpAndSettle();

      expect(mockClient.restorePurchasesCalled, isTrue);
      expect(find.text('Successfully restored 1 active entitlement.'), findsWidgets);
    });

    testWidgets('renders payout invoices and tamper-evident audit trail entries', (tester) async {
      await tester.pumpWidget(createWidgetUnderTest());
      await tester.pumpAndSettle();

      expect(find.text('POINV-2026-001'), findsOneWidget);
      expect(find.text('CREDIT_SUBSCRIPTION'), findsOneWidget);
      expect(find.text('Subscription renewal'), findsOneWidget);
    });
  });
}
