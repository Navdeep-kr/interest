class MarketplaceDemandMetricsModel {
  final int totalBrandCampaignsCount;
  final int totalCreatorApplicationsCount;
  final int activeContractVolumeCents;
  final List<Map<String, dynamic>> topInterestsByDemand;
  final bool isMarketplaceEnabled;

  const MarketplaceDemandMetricsModel({
    required this.totalBrandCampaignsCount,
    required this.totalCreatorApplicationsCount,
    required this.activeContractVolumeCents,
    required this.topInterestsByDemand,
    required this.isMarketplaceEnabled,
  });

  factory MarketplaceDemandMetricsModel.fromJson(Map<String, dynamic> json) {
    return MarketplaceDemandMetricsModel(
      totalBrandCampaignsCount: json['totalBrandCampaignsCount'] as int? ?? 0,
      totalCreatorApplicationsCount: json['totalCreatorApplicationsCount'] as int? ?? 0,
      activeContractVolumeCents: json['activeContractVolumeCents'] as int? ?? 0,
      topInterestsByDemand: (json['topInterestsByDemand'] as List<dynamic>?)
              ?.map((e) => e as Map<String, dynamic>)
              .toList() ??
          [],
      isMarketplaceEnabled: json['isMarketplaceEnabled'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
        'totalBrandCampaignsCount': totalBrandCampaignsCount,
        'totalCreatorApplicationsCount': totalCreatorApplicationsCount,
        'activeContractVolumeCents': activeContractVolumeCents,
        'topInterestsByDemand': topInterestsByDemand,
        'isMarketplaceEnabled': isMarketplaceEnabled,
      };
}

class MarketplaceEligibilityModel {
  final bool isEligible;
  final int followersCount;
  final int requiredFollowers;
  final int accountAgeDays;
  final int activeStrikesCount;
  final bool hasVerifiedIdentity;
  final bool hasStripeConnectAccount;
  final List<String> ineligibilityReasons;

  const MarketplaceEligibilityModel({
    required this.isEligible,
    required this.followersCount,
    required this.requiredFollowers,
    required this.accountAgeDays,
    required this.activeStrikesCount,
    required this.hasVerifiedIdentity,
    required this.hasStripeConnectAccount,
    this.ineligibilityReasons = const [],
  });

  factory MarketplaceEligibilityModel.fromJson(Map<String, dynamic> json) {
    return MarketplaceEligibilityModel(
      isEligible: json['isEligible'] as bool? ?? false,
      followersCount: json['followersCount'] as int? ?? 0,
      requiredFollowers: json['requiredFollowers'] as int? ?? 1000,
      accountAgeDays: json['accountAgeDays'] as int? ?? 0,
      activeStrikesCount: json['activeStrikesCount'] as int? ?? 0,
      hasVerifiedIdentity: json['hasVerifiedIdentity'] as bool? ?? false,
      hasStripeConnectAccount: json['hasStripeConnectAccount'] as bool? ?? false,
      ineligibilityReasons: (json['ineligibilityReasons'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
    );
  }

  Map<String, dynamic> toJson() => {
        'isEligible': isEligible,
        'followersCount': followersCount,
        'requiredFollowers': requiredFollowers,
        'accountAgeDays': accountAgeDays,
        'activeStrikesCount': activeStrikesCount,
        'hasVerifiedIdentity': hasVerifiedIdentity,
        'hasStripeConnectAccount': hasStripeConnectAccount,
        'ineligibilityReasons': ineligibilityReasons,
      };
}

class CreatorPortfolioModel {
  final String creatorId;
  final String username;
  final String displayName;
  final String? avatarUrl;
  final String bio;
  final List<String> interestCategories;
  final List<String> featuredReelIds;
  final int baseRateCents;
  final double averageEngagementRate;
  final int verifiedPastCampaignsCount;

  const CreatorPortfolioModel({
    required this.creatorId,
    required this.username,
    required this.displayName,
    this.avatarUrl,
    required this.bio,
    this.interestCategories = const [],
    this.featuredReelIds = const [],
    required this.baseRateCents,
    required this.averageEngagementRate,
    required this.verifiedPastCampaignsCount,
  });

  factory CreatorPortfolioModel.fromJson(Map<String, dynamic> json) {
    return CreatorPortfolioModel(
      creatorId: json['creatorId'] as String? ?? '',
      username: json['username'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String?,
      bio: json['bio'] as String? ?? '',
      interestCategories: (json['interestCategories'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      featuredReelIds: (json['featuredReelIds'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      baseRateCents: json['baseRateCents'] as int? ?? 0,
      averageEngagementRate: (json['averageEngagementRate'] as num?)?.toDouble() ?? 0.0,
      verifiedPastCampaignsCount: json['verifiedPastCampaignsCount'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
        'creatorId': creatorId,
        'username': username,
        'displayName': displayName,
        'avatarUrl': avatarUrl,
        'bio': bio,
        'interestCategories': interestCategories,
        'featuredReelIds': featuredReelIds,
        'baseRateCents': baseRateCents,
        'averageEngagementRate': averageEngagementRate,
        'verifiedPastCampaignsCount': verifiedPastCampaignsCount,
      };
}

class BrandCampaignModel {
  final String id;
  final String brandId;
  final String brandName;
  final String? brandLogoUrl;
  final String title;
  final String description;
  final String interestId;
  final String interestName;
  final int budgetMinCents;
  final int budgetMaxCents;
  final List<String> requiredDeliverables;
  final String applicationDeadline;
  final String campaignDeadline;
  final String status;
  final int applicationsCount;
  final bool sponsorshipDisclosureRequired;
  final String createdAt;
  final String updatedAt;

  const BrandCampaignModel({
    required this.id,
    required this.brandId,
    required this.brandName,
    this.brandLogoUrl,
    required this.title,
    required this.description,
    required this.interestId,
    required this.interestName,
    required this.budgetMinCents,
    required this.budgetMaxCents,
    this.requiredDeliverables = const [],
    required this.applicationDeadline,
    required this.campaignDeadline,
    required this.status,
    this.applicationsCount = 0,
    this.sponsorshipDisclosureRequired = true,
    required this.createdAt,
    required this.updatedAt,
  });

  factory BrandCampaignModel.fromJson(Map<String, dynamic> json) {
    return BrandCampaignModel(
      id: json['id'] as String? ?? '',
      brandId: json['brandId'] as String? ?? '',
      brandName: json['brandName'] as String? ?? '',
      brandLogoUrl: json['brandLogoUrl'] as String?,
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      interestId: json['interestId'] as String? ?? '',
      interestName: json['interestName'] as String? ?? '',
      budgetMinCents: json['budgetMinCents'] as int? ?? 0,
      budgetMaxCents: json['budgetMaxCents'] as int? ?? 0,
      requiredDeliverables: (json['requiredDeliverables'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      applicationDeadline: json['applicationDeadline'] as String? ?? '',
      campaignDeadline: json['campaignDeadline'] as String? ?? '',
      status: json['status'] as String? ?? 'OPEN_FOR_APPLICATIONS',
      applicationsCount: json['applicationsCount'] as int? ?? 0,
      sponsorshipDisclosureRequired: json['sponsorshipDisclosureRequired'] as bool? ?? true,
      createdAt: json['createdAt'] as String? ?? '',
      updatedAt: json['updatedAt'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'brandId': brandId,
        'brandName': brandName,
        'brandLogoUrl': brandLogoUrl,
        'title': title,
        'description': description,
        'interestId': interestId,
        'interestName': interestName,
        'budgetMinCents': budgetMinCents,
        'budgetMaxCents': budgetMaxCents,
        'requiredDeliverables': requiredDeliverables,
        'applicationDeadline': applicationDeadline,
        'campaignDeadline': campaignDeadline,
        'status': status,
        'applicationsCount': applicationsCount,
        'sponsorshipDisclosureRequired': sponsorshipDisclosureRequired,
        'createdAt': createdAt,
        'updatedAt': updatedAt,
      };
}

class CampaignDeliverableModel {
  final String id;
  final String contractId;
  final String title;
  final String description;
  final String? reelId;
  final String? previewUrl;
  final bool hasSponsorshipDisclosure;
  final String? feedbackNotes;
  final String status; // 'PENDING_SUBMISSION' | 'SUBMITTED' | 'CHANGES_REQUESTED' | 'APPROVED'
  final String? submittedAt;
  final String? approvedAt;

  const CampaignDeliverableModel({
    required this.id,
    required this.contractId,
    required this.title,
    required this.description,
    this.reelId,
    this.previewUrl,
    required this.hasSponsorshipDisclosure,
    this.feedbackNotes,
    required this.status,
    this.submittedAt,
    this.approvedAt,
  });

  factory CampaignDeliverableModel.fromJson(Map<String, dynamic> json) {
    return CampaignDeliverableModel(
      id: json['id'] as String? ?? '',
      contractId: json['contractId'] as String? ?? '',
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      reelId: json['reelId'] as String?,
      previewUrl: json['previewUrl'] as String?,
      hasSponsorshipDisclosure: json['hasSponsorshipDisclosure'] as bool? ?? false,
      feedbackNotes: json['feedbackNotes'] as String?,
      status: json['status'] as String? ?? 'PENDING_SUBMISSION',
      submittedAt: json['submittedAt'] as String?,
      approvedAt: json['approvedAt'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'contractId': contractId,
        'title': title,
        'description': description,
        'reelId': reelId,
        'previewUrl': previewUrl,
        'hasSponsorshipDisclosure': hasSponsorshipDisclosure,
        'feedbackNotes': feedbackNotes,
        'status': status,
        'submittedAt': submittedAt,
        'approvedAt': approvedAt,
      };
}

class CampaignContractModel {
  final String id;
  final String campaignId;
  final String applicationId;
  final String brandId;
  final String brandName;
  final String creatorId;
  final String creatorUsername;
  final int agreedAmountCents;
  final String deliverableBrief;
  final String sponsorshipDisclosureText;
  final String status; // 'DRAFTED' | 'ACTIVE' | 'SUBMITTED' | 'CHANGES_REQUESTED' | 'APPROVED' | 'DISPUTED' | 'FULFILLED'
  final List<CampaignDeliverableModel> deliverables;
  final String signedAt;
  final String? completedAt;

  const CampaignContractModel({
    required this.id,
    required this.campaignId,
    required this.applicationId,
    required this.brandId,
    required this.brandName,
    required this.creatorId,
    required this.creatorUsername,
    required this.agreedAmountCents,
    required this.deliverableBrief,
    required this.sponsorshipDisclosureText,
    required this.status,
    this.deliverables = const [],
    required this.signedAt,
    this.completedAt,
  });

  factory CampaignContractModel.fromJson(Map<String, dynamic> json) {
    return CampaignContractModel(
      id: json['id'] as String? ?? '',
      campaignId: json['campaignId'] as String? ?? '',
      applicationId: json['applicationId'] as String? ?? '',
      brandId: json['brandId'] as String? ?? '',
      brandName: json['brandName'] as String? ?? '',
      creatorId: json['creatorId'] as String? ?? '',
      creatorUsername: json['creatorUsername'] as String? ?? '',
      agreedAmountCents: json['agreedAmountCents'] as int? ?? 0,
      deliverableBrief: json['deliverableBrief'] as String? ?? '',
      sponsorshipDisclosureText: json['sponsorshipDisclosureText'] as String? ?? '#sponsored',
      status: json['status'] as String? ?? 'ACTIVE',
      deliverables: (json['deliverables'] as List<dynamic>?)
              ?.map((e) => CampaignDeliverableModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      signedAt: json['signedAt'] as String? ?? '',
      completedAt: json['completedAt'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'campaignId': campaignId,
        'applicationId': applicationId,
        'brandId': brandId,
        'brandName': brandName,
        'creatorId': creatorId,
        'creatorUsername': creatorUsername,
        'agreedAmountCents': agreedAmountCents,
        'deliverableBrief': deliverableBrief,
        'sponsorshipDisclosureText': sponsorshipDisclosureText,
        'status': status,
        'deliverables': deliverables.map((e) => e.toJson()).toList(),
        'signedAt': signedAt,
        'completedAt': completedAt,
      };
}
