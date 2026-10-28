// Domain models for Creator Subscriptions, Tips, Payouts, Entitlements & Compliance
// STRICT ZERO-LOCATION GUARANTEE: Zero GPS, Zero IP coordinates, zero location attributes.
// NEVER stores raw credit card details (PCI-DSS compliant).
// Unresolved compliance and KYC issues remain blocked.

enum PaymentGateway {
  stripe,
  razorpay,
  appleIap,
  googlePlay;

  String toJson() {
    switch (this) {
      case PaymentGateway.stripe:
        return 'stripe';
      case PaymentGateway.razorpay:
        return 'razorpay';
      case PaymentGateway.appleIap:
        return 'apple_iap';
      case PaymentGateway.googlePlay:
        return 'google_play';
    }
  }

  static PaymentGateway fromJson(String value) {
    switch (value.toLowerCase()) {
      case 'stripe':
        return PaymentGateway.stripe;
      case 'razorpay':
        return PaymentGateway.razorpay;
      case 'apple_iap':
      case 'apple':
        return PaymentGateway.appleIap;
      case 'google_play':
      case 'google':
        return PaymentGateway.googlePlay;
      default:
        return PaymentGateway.stripe;
    }
  }
}

enum EntitlementType {
  creatorSubscription,
  communityPass,
  exclusiveContent,
  vipBadge;

  String toJson() {
    switch (this) {
      case EntitlementType.creatorSubscription:
        return 'CREATOR_SUBSCRIPTION';
      case EntitlementType.communityPass:
        return 'COMMUNITY_PASS';
      case EntitlementType.exclusiveContent:
        return 'EXCLUSIVE_CONTENT';
      case EntitlementType.vipBadge:
        return 'VIP_BADGE';
    }
  }

  static EntitlementType fromJson(String value) {
    switch (value.toUpperCase()) {
      case 'CREATOR_SUBSCRIPTION':
        return EntitlementType.creatorSubscription;
      case 'COMMUNITY_PASS':
        return EntitlementType.communityPass;
      case 'EXCLUSIVE_CONTENT':
        return EntitlementType.exclusiveContent;
      case 'VIP_BADGE':
        return EntitlementType.vipBadge;
      default:
        return EntitlementType.creatorSubscription;
    }
  }
}

enum EntitlementStatus {
  active,
  expired,
  revoked,
  disputed;

  static EntitlementStatus fromJson(String value) {
    switch (value.toUpperCase()) {
      case 'ACTIVE':
        return EntitlementStatus.active;
      case 'EXPIRED':
        return EntitlementStatus.expired;
      case 'REVOKED':
        return EntitlementStatus.revoked;
      case 'DISPUTED':
        return EntitlementStatus.disputed;
      default:
        return EntitlementStatus.active;
    }
  }
}

enum KycStatus {
  unverified,
  pending,
  verified,
  rejected;

  static KycStatus fromJson(String value) {
    switch (value.toUpperCase()) {
      case 'UNVERIFIED':
        return KycStatus.unverified;
      case 'PENDING':
        return KycStatus.pending;
      case 'VERIFIED':
        return KycStatus.verified;
      case 'REJECTED':
        return KycStatus.rejected;
      default:
        return KycStatus.unverified;
    }
  }
}

class CreatorFinancialAccountModel {
  final String userId;
  final PaymentGateway gateway;
  final String? stripeAccountId;
  final String? razorpayAccountId;
  final bool payoutEnabled;
  final int availableBalanceCents;
  final int pendingBalanceCents;
  final int lifetimeEarningsCents;
  final String currency;
  final String? taxIdNumber;
  final String taxEntityType;
  final String? taxLegalName;
  final String? taxJurisdictionCode;
  final int taxWithholdingRateBps;
  final KycStatus kycStatus;
  final bool isComplianceBlocked;
  final String? complianceBlockReason;
  final String? taxFormType;
  final String? taxFormSubmittedAt;

  const CreatorFinancialAccountModel({
    required this.userId,
    required this.gateway,
    this.stripeAccountId,
    this.razorpayAccountId,
    required this.payoutEnabled,
    required this.availableBalanceCents,
    required this.pendingBalanceCents,
    required this.lifetimeEarningsCents,
    required this.currency,
    this.taxIdNumber,
    required this.taxEntityType,
    this.taxLegalName,
    this.taxJurisdictionCode,
    required this.taxWithholdingRateBps,
    required this.kycStatus,
    required this.isComplianceBlocked,
    this.complianceBlockReason,
    this.taxFormType,
    this.taxFormSubmittedAt,
  });

  factory CreatorFinancialAccountModel.fromJson(Map<String, dynamic> json) {
    return CreatorFinancialAccountModel(
      userId: json['userId'] as String? ?? '',
      gateway: PaymentGateway.fromJson(json['gateway'] as String? ?? 'stripe'),
      stripeAccountId: json['stripeAccountId'] as String?,
      razorpayAccountId: json['razorpayAccountId'] as String?,
      payoutEnabled: json['payoutEnabled'] as bool? ?? false,
      availableBalanceCents: (json['availableBalanceCents'] as num?)?.toInt() ?? 0,
      pendingBalanceCents: (json['pendingBalanceCents'] as num?)?.toInt() ?? 0,
      lifetimeEarningsCents: (json['lifetimeEarningsCents'] as num?)?.toInt() ?? 0,
      currency: json['currency'] as String? ?? 'usd',
      taxIdNumber: json['taxIdNumber'] as String?,
      taxEntityType: json['taxEntityType'] as String? ?? 'INDIVIDUAL',
      taxLegalName: json['taxLegalName'] as String?,
      taxJurisdictionCode: json['taxJurisdictionCode'] as String?,
      taxWithholdingRateBps: (json['taxWithholdingRateBps'] as num?)?.toInt() ?? 0,
      kycStatus: KycStatus.fromJson(json['kycStatus'] as String? ?? 'UNVERIFIED'),
      isComplianceBlocked: json['isComplianceBlocked'] as bool? ?? true,
      complianceBlockReason: json['complianceBlockReason'] as String?,
      taxFormType: json['taxFormType'] as String?,
      taxFormSubmittedAt: json['taxFormSubmittedAt'] as String?,
    );
  }

  double get availableBalanceDollars => availableBalanceCents / 100.0;
  double get lifetimeEarningsDollars => lifetimeEarningsCents / 100.0;
}

class CreatorEligibilityStatusModel {
  final bool isEligible;
  final int minFollowersRequired;
  final int currentFollowers;
  final int minAccountAgeDays;
  final int currentAccountAgeDays;
  final KycStatus kycStatus;
  final bool isTaxCompliant;
  final bool isComplianceBlocked;
  final String? complianceBlockReason;
  final List<String> reasons;

  const CreatorEligibilityStatusModel({
    required this.isEligible,
    required this.minFollowersRequired,
    required this.currentFollowers,
    required this.minAccountAgeDays,
    required this.currentAccountAgeDays,
    required this.kycStatus,
    required this.isTaxCompliant,
    required this.isComplianceBlocked,
    this.complianceBlockReason,
    required this.reasons,
  });

  factory CreatorEligibilityStatusModel.fromJson(Map<String, dynamic> json) {
    return CreatorEligibilityStatusModel(
      isEligible: json['isEligible'] as bool? ?? false,
      minFollowersRequired: (json['minFollowersRequired'] as num?)?.toInt() ?? 10,
      currentFollowers: (json['currentFollowers'] as num?)?.toInt() ?? 0,
      minAccountAgeDays: (json['minAccountAgeDays'] as num?)?.toInt() ?? 7,
      currentAccountAgeDays: (json['currentAccountAgeDays'] as num?)?.toInt() ?? 0,
      kycStatus: KycStatus.fromJson(json['kycStatus'] as String? ?? 'UNVERIFIED'),
      isTaxCompliant: json['isTaxCompliant'] as bool? ?? false,
      isComplianceBlocked: json['isComplianceBlocked'] as bool? ?? true,
      complianceBlockReason: json['complianceBlockReason'] as String?,
      reasons: (json['reasons'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
    );
  }
}

class UserEntitlementItemModel {
  final String id;
  final String userId;
  final String? creatorId;
  final EntitlementType entitlementType;
  final String? planId;
  final String? reelId;
  final PaymentGateway gateway;
  final String transactionId;
  final EntitlementStatus status;
  final String? expiresAt;

  const UserEntitlementItemModel({
    required this.id,
    required this.userId,
    this.creatorId,
    required this.entitlementType,
    this.planId,
    this.reelId,
    required this.gateway,
    required this.transactionId,
    required this.status,
    this.expiresAt,
  });

  factory UserEntitlementItemModel.fromJson(Map<String, dynamic> json) {
    return UserEntitlementItemModel(
      id: json['id'] as String? ?? '',
      userId: json['userId'] as String? ?? '',
      creatorId: json['creatorId'] as String?,
      entitlementType: EntitlementType.fromJson(json['entitlementType'] as String? ?? 'CREATOR_SUBSCRIPTION'),
      planId: json['planId'] as String?,
      reelId: json['reelId'] as String?,
      gateway: PaymentGateway.fromJson(json['gateway'] as String? ?? 'stripe'),
      transactionId: json['transactionId'] as String? ?? '',
      status: EntitlementStatus.fromJson(json['status'] as String? ?? 'ACTIVE'),
      expiresAt: json['expiresAt'] as String?,
    );
  }

  bool get isActive => status == EntitlementStatus.active;
}

class RestorePurchasesResultModel {
  final int restoredCount;
  final List<UserEntitlementItemModel> restoredEntitlements;
  final String message;

  const RestorePurchasesResultModel({
    required this.restoredCount,
    required this.restoredEntitlements,
    required this.message,
  });

  factory RestorePurchasesResultModel.fromJson(Map<String, dynamic> json) {
    return RestorePurchasesResultModel(
      restoredCount: (json['restoredCount'] as num?)?.toInt() ?? 0,
      restoredEntitlements: (json['restoredEntitlements'] as List<dynamic>?)
              ?.map((e) => UserEntitlementItemModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      message: json['message'] as String? ?? '',
    );
  }
}

class CreatorPayoutInvoiceItemModel {
  final String id;
  final String? payoutRecordId;
  final String invoiceNumber;
  final String creatorId;
  final int grossAmountCents;
  final int platformFeeCents;
  final int taxWithheldCents;
  final int netPayoutCents;
  final String currency;
  final String? taxIdMasked;
  final String issuedAt;
  final String? pdfUrl;

  const CreatorPayoutInvoiceItemModel({
    required this.id,
    this.payoutRecordId,
    required this.invoiceNumber,
    required this.creatorId,
    required this.grossAmountCents,
    required this.platformFeeCents,
    required this.taxWithheldCents,
    required this.netPayoutCents,
    required this.currency,
    this.taxIdMasked,
    required this.issuedAt,
    this.pdfUrl,
  });

  factory CreatorPayoutInvoiceItemModel.fromJson(Map<String, dynamic> json) {
    return CreatorPayoutInvoiceItemModel(
      id: json['id'] as String? ?? '',
      payoutRecordId: json['payoutRecordId'] as String?,
      invoiceNumber: json['invoiceNumber'] as String? ?? '',
      creatorId: json['creatorId'] as String? ?? '',
      grossAmountCents: (json['grossAmountCents'] as num?)?.toInt() ?? 0,
      platformFeeCents: (json['platformFeeCents'] as num?)?.toInt() ?? 0,
      taxWithheldCents: (json['taxWithheldCents'] as num?)?.toInt() ?? 0,
      netPayoutCents: (json['netPayoutCents'] as num?)?.toInt() ?? 0,
      currency: json['currency'] as String? ?? 'usd',
      taxIdMasked: json['taxIdMasked'] as String?,
      issuedAt: json['issuedAt'] as String? ?? '',
      pdfUrl: json['pdfUrl'] as String?,
    );
  }

  double get netPayoutDollars => netPayoutCents / 100.0;
  double get grossDollars => grossAmountCents / 100.0;
}

class FinancialAuditTrailItemModel {
  final String id;
  final String userId;
  final String actionType;
  final int amountCents;
  final int feeCents;
  final int balanceBeforeCents;
  final int balanceAfterCents;
  final String? referenceId;
  final String? notes;
  final String createdAt;

  const FinancialAuditTrailItemModel({
    required this.id,
    required this.userId,
    required this.actionType,
    required this.amountCents,
    required this.feeCents,
    required this.balanceBeforeCents,
    required this.balanceAfterCents,
    this.referenceId,
    this.notes,
    required this.createdAt,
  });

  factory FinancialAuditTrailItemModel.fromJson(Map<String, dynamic> json) {
    return FinancialAuditTrailItemModel(
      id: json['id'] as String? ?? '',
      userId: json['userId'] as String? ?? '',
      actionType: json['actionType'] as String? ?? '',
      amountCents: (json['amountCents'] as num?)?.toInt() ?? 0,
      feeCents: (json['feeCents'] as num?)?.toInt() ?? 0,
      balanceBeforeCents: (json['balanceBeforeCents'] as num?)?.toInt() ?? 0,
      balanceAfterCents: (json['balanceAfterCents'] as num?)?.toInt() ?? 0,
      referenceId: json['referenceId'] as String?,
      notes: json['notes'] as String?,
      createdAt: json['createdAt'] as String? ?? '',
    );
  }

  double get amountDollars => amountCents / 100.0;
}

class SubscriberContentGateResultModel {
  final bool hasAccess;
  final bool isSubscriberOnly;
  final String reason;
  final bool previewAvailable;

  const SubscriberContentGateResultModel({
    required this.hasAccess,
    required this.isSubscriberOnly,
    required this.reason,
    required this.previewAvailable,
  });

  factory SubscriberContentGateResultModel.fromJson(Map<String, dynamic> json) {
    return SubscriberContentGateResultModel(
      hasAccess: json['hasAccess'] as bool? ?? false,
      isSubscriberOnly: json['isSubscriberOnly'] as bool? ?? false,
      reason: json['reason'] as String? ?? 'PUBLIC',
      previewAvailable: json['previewAvailable'] as bool? ?? true,
    );
  }
}

class CreatorSubscriptionPlanModel {
  final String id;
  final String creatorId;
  final String title;
  final String? description;
  final int priceCents;
  final String currency;
  final String billingInterval;
  final List<String> perks;
  final bool isActive;

  const CreatorSubscriptionPlanModel({
    required this.id,
    required this.creatorId,
    required this.title,
    this.description,
    required this.priceCents,
    required this.currency,
    required this.billingInterval,
    required this.perks,
    required this.isActive,
  });

  factory CreatorSubscriptionPlanModel.fromJson(Map<String, dynamic> json) {
    return CreatorSubscriptionPlanModel(
      id: json['id'] as String? ?? '',
      creatorId: json['creatorId'] as String? ?? '',
      title: json['title'] as String? ?? '',
      description: json['description'] as String?,
      priceCents: (json['priceCents'] as num?)?.toInt() ?? 0,
      currency: json['currency'] as String? ?? 'usd',
      billingInterval: json['billingInterval'] as String? ?? 'month',
      perks: (json['perks'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      isActive: json['isActive'] as bool? ?? true,
    );
  }

  double get priceDollars => priceCents / 100.0;
}
