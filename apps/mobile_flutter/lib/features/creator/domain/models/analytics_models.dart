// Domain models for Creator Analytics and Content Scheduling
// STRICT ZERO-LOCATION: 0 GPS, 0 IP coordinates, zero location attributes.
// All analytics metrics are server-verified and reconcile to authoritative records.

class ViewCountingRulesModel {
  final double minWatchSecondsForView;
  final double completionRatioThreshold;
  final int deduplicationWindowMinutes;
  final double rapidSkipDurationLimitSeconds;
  final bool botFilteringEnabled;

  const ViewCountingRulesModel({
    required this.minWatchSecondsForView,
    required this.completionRatioThreshold,
    required this.deduplicationWindowMinutes,
    required this.rapidSkipDurationLimitSeconds,
    required this.botFilteringEnabled,
  });

  factory ViewCountingRulesModel.fromJson(Map<String, dynamic> json) {
    return ViewCountingRulesModel(
      minWatchSecondsForView: (json['minWatchSecondsForView'] as num?)?.toDouble() ?? 1.5,
      completionRatioThreshold: (json['completionRatioThreshold'] as num?)?.toDouble() ?? 0.90,
      deduplicationWindowMinutes: (json['deduplicationWindowMinutes'] as num?)?.toInt() ?? 30,
      rapidSkipDurationLimitSeconds: (json['rapidSkipDurationLimitSeconds'] as num?)?.toDouble() ?? 1.5,
      botFilteringEnabled: json['botFilteringEnabled'] as bool? ?? true,
    );
  }
}

class AnalyticsTimeframeModel {
  final String startDate;
  final String endDate;
  final String timezone;
  final int processingDelayMinutes;
  final String lastAggregatedAt;

  const AnalyticsTimeframeModel({
    required this.startDate,
    required this.endDate,
    required this.timezone,
    required this.processingDelayMinutes,
    required this.lastAggregatedAt,
  });

  factory AnalyticsTimeframeModel.fromJson(Map<String, dynamic> json) {
    return AnalyticsTimeframeModel(
      startDate: json['startDate'] as String? ?? '',
      endDate: json['endDate'] as String? ?? '',
      timezone: json['timezone'] as String? ?? 'UTC',
      processingDelayMinutes: (json['processingDelayMinutes'] as num?)?.toInt() ?? 15,
      lastAggregatedAt: json['lastAggregatedAt'] as String? ?? '',
    );
  }
}

class CreatorEarningsModel {
  final int grossRevenueCents;
  final int platformFeeCents;
  final int netEarningsCents;
  final int tipsCount;
  final int activeSubscriptionsCount;
  final String currency;
  final bool isFinancialAuthoritative;

  const CreatorEarningsModel({
    required this.grossRevenueCents,
    required this.platformFeeCents,
    required this.netEarningsCents,
    required this.tipsCount,
    required this.activeSubscriptionsCount,
    required this.currency,
    required this.isFinancialAuthoritative,
  });

  double get grossRevenueDollars => grossRevenueCents / 100.0;
  double get netEarningsDollars => netEarningsCents / 100.0;

  String get grossFormatted => '\$${grossRevenueDollars.toStringAsFixed(2)}';
  String get netFormatted => '\$${netEarningsDollars.toStringAsFixed(2)}';

  factory CreatorEarningsModel.fromJson(Map<String, dynamic> json) {
    return CreatorEarningsModel(
      grossRevenueCents: (json['grossRevenueCents'] as num?)?.toInt() ?? 0,
      platformFeeCents: (json['platformFeeCents'] as num?)?.toInt() ?? 0,
      netEarningsCents: (json['netEarningsCents'] as num?)?.toInt() ?? 0,
      tipsCount: (json['tipsCount'] as num?)?.toInt() ?? 0,
      activeSubscriptionsCount: (json['activeSubscriptionsCount'] as num?)?.toInt() ?? 0,
      currency: json['currency'] as String? ?? 'usd',
      isFinancialAuthoritative: json['isFinancialAuthoritative'] as bool? ?? true,
    );
  }
}

class DiscoverySourceBreakdownModel {
  final String source;
  final int count;
  final double percentage;

  const DiscoverySourceBreakdownModel({
    required this.source,
    required this.count,
    required this.percentage,
  });

  String get displayName {
    switch (source) {
      case 'FOR_YOU':
        return 'For You Feed';
      case 'FOLLOWING':
        return 'Following Feed';
      case 'SEARCH':
        return 'Search & Explore';
      case 'TOPIC_PAGE':
        return 'Topic Pages';
      case 'COMMUNITY':
        return 'Communities';
      case 'DIRECT_LINK':
        return 'Direct Link';
      default:
        return source;
    }
  }

  factory DiscoverySourceBreakdownModel.fromJson(Map<String, dynamic> json) {
    return DiscoverySourceBreakdownModel(
      source: json['source'] as String? ?? 'FOR_YOU',
      count: (json['count'] as num?)?.toInt() ?? 0,
      percentage: (json['percentage'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class TopicPerformanceItemModel {
  final String topicId;
  final String topicTitle;
  final int reelsCount;
  final int viewsCount;
  final int watchTimeSeconds;
  final double avgWatchRatio;
  final double engagementRate;

  const TopicPerformanceItemModel({
    required this.topicId,
    required this.topicTitle,
    required this.reelsCount,
    required this.viewsCount,
    required this.watchTimeSeconds,
    required this.avgWatchRatio,
    required this.engagementRate,
  });

  double get watchTimeHours => (watchTimeSeconds / 3600.0);

  factory TopicPerformanceItemModel.fromJson(Map<String, dynamic> json) {
    return TopicPerformanceItemModel(
      topicId: json['topicId'] as String? ?? '',
      topicTitle: json['topicTitle'] as String? ?? '',
      reelsCount: (json['reelsCount'] as num?)?.toInt() ?? 0,
      viewsCount: (json['viewsCount'] as num?)?.toInt() ?? 0,
      watchTimeSeconds: (json['watchTimeSeconds'] as num?)?.toInt() ?? 0,
      avgWatchRatio: (json['avgWatchRatio'] as num?)?.toDouble() ?? 0.0,
      engagementRate: (json['engagementRate'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class FollowerGrowthPointModel {
  final String date; // YYYY-MM-DD
  final int newFollowers;
  final int netFollowers;

  const FollowerGrowthPointModel({
    required this.date,
    required this.newFollowers,
    required this.netFollowers,
  });

  factory FollowerGrowthPointModel.fromJson(Map<String, dynamic> json) {
    return FollowerGrowthPointModel(
      date: json['date'] as String? ?? '',
      newFollowers: (json['newFollowers'] as num?)?.toInt() ?? 0,
      netFollowers: (json['netFollowers'] as num?)?.toInt() ?? 0,
    );
  }
}

class RetentionPointModel {
  final int bucketPercent; // 0, 10, ..., 100
  final int retentionPercent; // 0..100%

  const RetentionPointModel({
    required this.bucketPercent,
    required this.retentionPercent,
  });

  factory RetentionPointModel.fromJson(Map<String, dynamic> json) {
    return RetentionPointModel(
      bucketPercent: (json['bucketPercent'] as num?)?.toInt() ?? 0,
      retentionPercent: (json['retentionPercent'] as num?)?.toInt() ?? 0,
    );
  }
}

class CreatorTopReelModel {
  final String id;
  final String title;
  final String? thumbnailUrl;
  final int viewCount;
  final int likeCount;
  final int commentCount;
  final int saveCount;
  final int shareCount;
  final double avgCompletionRate;
  final String primaryInterestTitle;
  final String createdAt;

  const CreatorTopReelModel({
    required this.id,
    required this.title,
    this.thumbnailUrl,
    required this.viewCount,
    required this.likeCount,
    required this.commentCount,
    required this.saveCount,
    required this.shareCount,
    required this.avgCompletionRate,
    required this.primaryInterestTitle,
    required this.createdAt,
  });

  bool get isDeleted => title == '[Deleted Reel]';

  factory CreatorTopReelModel.fromJson(Map<String, dynamic> json) {
    return CreatorTopReelModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      thumbnailUrl: json['thumbnailUrl'] as String?,
      viewCount: (json['viewCount'] as num?)?.toInt() ?? 0,
      likeCount: (json['likeCount'] as num?)?.toInt() ?? 0,
      commentCount: (json['commentCount'] as num?)?.toInt() ?? 0,
      saveCount: (json['saveCount'] as num?)?.toInt() ?? 0,
      shareCount: (json['shareCount'] as num?)?.toInt() ?? 0,
      avgCompletionRate: (json['avgCompletionRate'] as num?)?.toDouble() ?? 0.0,
      primaryInterestTitle: json['primaryInterestTitle'] as String? ?? 'General',
      createdAt: json['createdAt'] as String? ?? '',
    );
  }
}

class VerifiedCreatorAnalyticsModel {
  final AnalyticsTimeframeModel timeframe;
  final ViewCountingRulesModel countingRules;
  final int totalViews;
  final double totalWatchHours;
  final double avgWatchRatio;
  final double completionRate;
  final double engagementRate;
  final int totalLikes;
  final int totalComments;
  final int totalSaves;
  final int totalShares;
  final int totalFollowers;
  final double followerGrowthPercent;
  final List<FollowerGrowthPointModel> followerGrowth;
  final List<RetentionPointModel> retentionCurve;
  final List<DiscoverySourceBreakdownModel> discoverySources;
  final List<TopicPerformanceItemModel> topicPerformance;
  final CreatorEarningsModel earnings;
  final List<CreatorTopReelModel> topReels;
  final int scheduledCount;
  final bool hasSufficientData;
  final String zeroLocationGuarantee;

  const VerifiedCreatorAnalyticsModel({
    required this.timeframe,
    required this.countingRules,
    required this.totalViews,
    required this.totalWatchHours,
    required this.avgWatchRatio,
    required this.completionRate,
    required this.engagementRate,
    required this.totalLikes,
    required this.totalComments,
    required this.totalSaves,
    required this.totalShares,
    required this.totalFollowers,
    required this.followerGrowthPercent,
    required this.followerGrowth,
    required this.retentionCurve,
    required this.discoverySources,
    required this.topicPerformance,
    required this.earnings,
    required this.topReels,
    required this.scheduledCount,
    required this.hasSufficientData,
    required this.zeroLocationGuarantee,
  });

  factory VerifiedCreatorAnalyticsModel.fromJson(Map<String, dynamic> json) {
    return VerifiedCreatorAnalyticsModel(
      timeframe: AnalyticsTimeframeModel.fromJson(
        json['timeframe'] as Map<String, dynamic>? ?? {},
      ),
      countingRules: ViewCountingRulesModel.fromJson(
        json['countingRules'] as Map<String, dynamic>? ?? {},
      ),
      totalViews: (json['totalViews'] as num?)?.toInt() ?? 0,
      totalWatchHours: (json['totalWatchHours'] as num?)?.toDouble() ?? 0.0,
      avgWatchRatio: (json['avgWatchRatio'] as num?)?.toDouble() ?? 0.0,
      completionRate: (json['completionRate'] as num?)?.toDouble() ?? 0.0,
      engagementRate: (json['engagementRate'] as num?)?.toDouble() ?? 0.0,
      totalLikes: (json['totalLikes'] as num?)?.toInt() ?? 0,
      totalComments: (json['totalComments'] as num?)?.toInt() ?? 0,
      totalSaves: (json['totalSaves'] as num?)?.toInt() ?? 0,
      totalShares: (json['totalShares'] as num?)?.toInt() ?? 0,
      totalFollowers: (json['totalFollowers'] as num?)?.toInt() ?? 0,
      followerGrowthPercent: (json['followerGrowthPercent'] as num?)?.toDouble() ?? 0.0,
      followerGrowth: (json['followerGrowth'] as List<dynamic>? ?? [])
          .map((e) => FollowerGrowthPointModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      retentionCurve: (json['retentionCurve'] as List<dynamic>? ?? [])
          .map((e) => RetentionPointModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      discoverySources: (json['discoverySources'] as List<dynamic>? ?? [])
          .map((e) => DiscoverySourceBreakdownModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      topicPerformance: (json['topicPerformance'] as List<dynamic>? ?? [])
          .map((e) => TopicPerformanceItemModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      earnings: CreatorEarningsModel.fromJson(
        json['earnings'] as Map<String, dynamic>? ?? {},
      ),
      topReels: (json['topReels'] as List<dynamic>? ?? [])
          .map((e) => CreatorTopReelModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      scheduledCount: (json['scheduledCount'] as num?)?.toInt() ?? 0,
      hasSufficientData: json['hasSufficientData'] as bool? ?? false,
      zeroLocationGuarantee: json['zeroLocationGuarantee'] as String? ??
          'Strict zero-location guarantee: 0 GPS, 0 IP coordinates, zero geographic attributes.',
    );
  }
}

class ScheduledReelItemModel {
  final String id;
  final String creatorId;
  final String title;
  final String? caption;
  final String? thumbnailUrl;
  final String scheduledAt;
  final String primaryInterestId;
  final String status;
  final String createdAt;

  const ScheduledReelItemModel({
    required this.id,
    required this.creatorId,
    required this.title,
    this.caption,
    this.thumbnailUrl,
    required this.scheduledAt,
    required this.primaryInterestId,
    required this.status,
    required this.createdAt,
  });

  DateTime get scheduledDateTime => DateTime.tryParse(scheduledAt) ?? DateTime.now();

  factory ScheduledReelItemModel.fromJson(Map<String, dynamic> json) {
    return ScheduledReelItemModel(
      id: json['id'] as String? ?? '',
      creatorId: json['creatorId'] as String? ?? json['creator_id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      caption: json['caption'] as String?,
      thumbnailUrl: json['thumbnailUrl'] as String? ?? json['thumbnail_url'] as String?,
      scheduledAt: json['scheduledAt'] as String? ?? json['scheduled_at'] as String? ?? '',
      primaryInterestId: json['primaryInterestId'] as String? ?? json['primary_interest_id'] as String? ?? '',
      status: json['status'] as String? ?? 'SCHEDULED',
      createdAt: json['createdAt'] as String? ?? json['created_at'] as String? ?? '',
    );
  }
}
