// Domain models for Interest Graph & Multi-Domain Search.
// Strictly Zero-Location: No location or GPS attributes.

class UnifiedSearchResultsModel {
  final String query;
  final int totalCount;
  final bool isProhibited;
  final String? moderationMessage;
  final List<ReelSearchResultModel> reels;
  final List<UserSearchResultModel> users;
  final List<HashtagSearchResultModel> hashtags;
  final List<InterestSearchResultModel> interests;
  final List<CommunitySearchResultModel> communities;
  final Map<String, List<String>>? emptySuggestions;

  const UnifiedSearchResultsModel({
    required this.query,
    required this.totalCount,
    this.isProhibited = false,
    this.moderationMessage,
    this.reels = const [],
    this.users = const [],
    this.hashtags = const [],
    this.interests = const [],
    this.communities = const [],
    this.emptySuggestions,
  });

  factory UnifiedSearchResultsModel.fromJson(Map<String, dynamic> json) {
    return UnifiedSearchResultsModel(
      query: json['query'] as String? ?? '',
      totalCount: (json['totalCount'] as num?)?.toInt() ?? 0,
      isProhibited: json['isProhibited'] as bool? ?? false,
      moderationMessage: json['moderationMessage'] as String?,
      reels: (json['reels'] as List<dynamic>?)
              ?.map((e) => ReelSearchResultModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      users: (json['users'] as List<dynamic>?)
              ?.map((e) => UserSearchResultModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      hashtags: (json['hashtags'] as List<dynamic>?)
              ?.map((e) => HashtagSearchResultModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      interests: (json['interests'] as List<dynamic>?)
              ?.map((e) => InterestSearchResultModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      communities: (json['communities'] as List<dynamic>?)
              ?.map((e) => CommunitySearchResultModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      emptySuggestions: json['emptySuggestions'] != null
          ? (json['emptySuggestions'] as Map<String, dynamic>).map(
              (k, v) => MapEntry(k, (v as List<dynamic>).map((e) => e.toString()).toList()),
            )
          : null,
    );
  }
}

class ReelSearchResultModel {
  final String id;
  final String title;
  final String? caption;
  final String thumbnailUrl;
  final String hlsMasterUrl;
  final int viewCount;
  final int likeCount;
  final int commentCount;
  final String creatorUsername;
  final String creatorDisplayName;
  final String? creatorAvatarUrl;
  final String? primaryInterestTitle;
  final String? matchSnippet;
  final String? matchSource;

  const ReelSearchResultModel({
    required this.id,
    required this.title,
    this.caption,
    required this.thumbnailUrl,
    required this.hlsMasterUrl,
    required this.viewCount,
    required this.likeCount,
    required this.commentCount,
    required this.creatorUsername,
    required this.creatorDisplayName,
    this.creatorAvatarUrl,
    this.primaryInterestTitle,
    this.matchSnippet,
    this.matchSource,
  });

  factory ReelSearchResultModel.fromJson(Map<String, dynamic> json) {
    final creator = json['creator'] as Map<String, dynamic>? ?? {};
    final primaryInterest = json['primaryInterest'] as Map<String, dynamic>? ?? {};

    return ReelSearchResultModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      caption: json['caption'] as String?,
      thumbnailUrl: json['thumbnailUrl'] as String? ?? '',
      hlsMasterUrl: json['hlsMasterUrl'] as String? ?? '',
      viewCount: (json['viewCount'] as num?)?.toInt() ?? 0,
      likeCount: (json['likeCount'] as num?)?.toInt() ?? 0,
      commentCount: (json['commentCount'] as num?)?.toInt() ?? 0,
      creatorUsername: creator['username'] as String? ?? json['creatorUsername'] as String? ?? 'creator',
      creatorDisplayName: creator['displayName'] as String? ?? json['creatorDisplayName'] as String? ?? 'Creator',
      creatorAvatarUrl: creator['avatarUrl'] as String? ?? json['creatorAvatarUrl'] as String?,
      primaryInterestTitle: primaryInterest['title'] as String? ?? json['primaryInterestTitle'] as String?,
      matchSnippet: json['matchSnippet'] as String?,
      matchSource: json['matchSource'] as String?,
    );
  }
}

class UserSearchResultModel {
  final String id;
  final String username;
  final String displayName;
  final String? bio;
  final String? avatarUrl;
  final int followersCount;
  final int reelsCount;
  final bool isVerified;
  final int sharedInterestsCount;

  const UserSearchResultModel({
    required this.id,
    required this.username,
    required this.displayName,
    this.bio,
    this.avatarUrl,
    required this.followersCount,
    required this.reelsCount,
    this.isVerified = false,
    this.sharedInterestsCount = 0,
  });

  factory UserSearchResultModel.fromJson(Map<String, dynamic> json) {
    return UserSearchResultModel(
      id: json['id'] as String? ?? json['userId'] as String? ?? '',
      username: json['username'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      bio: json['bio'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      followersCount: (json['followersCount'] as num?)?.toInt() ?? 0,
      reelsCount: (json['reelsCount'] as num?)?.toInt() ?? 0,
      isVerified: json['isVerified'] as bool? ?? false,
      sharedInterestsCount: (json['sharedInterestsCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class HashtagSearchResultModel {
  final String id;
  final String tag;
  final int reelsCount;
  final bool isTrending;

  const HashtagSearchResultModel({
    required this.id,
    required this.tag,
    required this.reelsCount,
    this.isTrending = false,
  });

  factory HashtagSearchResultModel.fromJson(Map<String, dynamic> json) {
    return HashtagSearchResultModel(
      id: json['id'] as String? ?? '',
      tag: json['tag'] as String? ?? '',
      reelsCount: (json['reelsCount'] as num?)?.toInt() ?? 0,
      isTrending: json['isTrending'] as bool? ?? false,
    );
  }
}

class InterestSearchResultModel {
  final String id;
  final String slug;
  final String title;
  final String description;
  final int level;
  final String? icon;
  final String? categoryTitle;
  final int reelsCount;
  final double viewerAffinityWeight;

  const InterestSearchResultModel({
    required this.id,
    required this.slug,
    required this.title,
    required this.description,
    required this.level,
    this.icon,
    this.categoryTitle,
    required this.reelsCount,
    this.viewerAffinityWeight = 1.0,
  });

  factory InterestSearchResultModel.fromJson(Map<String, dynamic> json) {
    return InterestSearchResultModel(
      id: json['id'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      level: (json['level'] as num?)?.toInt() ?? 1,
      icon: json['icon'] as String?,
      categoryTitle: json['categoryTitle'] as String?,
      reelsCount: (json['reelsCount'] as num?)?.toInt() ?? 0,
      viewerAffinityWeight: (json['viewerAffinityWeight'] as num?)?.toDouble() ?? 1.0,
    );
  }
}

class CommunitySearchResultModel {
  final String id;
  final String name;
  final String? description;
  final String? bannerUrl;
  final String? creatorUsername;
  final String? interestTitle;
  final int membersCount;
  final int priceCents;
  final String currency;
  final String pricingType;

  const CommunitySearchResultModel({
    required this.id,
    required this.name,
    this.description,
    this.bannerUrl,
    this.creatorUsername,
    this.interestTitle,
    required this.membersCount,
    required this.priceCents,
    required this.currency,
    required this.pricingType,
  });

  factory CommunitySearchResultModel.fromJson(Map<String, dynamic> json) {
    return CommunitySearchResultModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      description: json['description'] as String?,
      bannerUrl: json['bannerUrl'] as String?,
      creatorUsername: json['creatorUsername'] as String?,
      interestTitle: json['interestTitle'] as String?,
      membersCount: (json['membersCount'] as num?)?.toInt() ?? 0,
      priceCents: (json['priceCents'] as num?)?.toInt() ?? 0,
      currency: json['currency'] as String? ?? 'USD',
      pricingType: json['pricingType'] as String? ?? 'free',
    );
  }
}

class SafeAutocompleteSuggestionModel {
  final String text;
  final String type; // 'topic' | 'creator' | 'hashtag' | 'community' | 'query'
  final String? id;
  final String? icon;
  final String? subtitle;

  const SafeAutocompleteSuggestionModel({
    required this.text,
    required this.type,
    this.id,
    this.icon,
    this.subtitle,
  });

  factory SafeAutocompleteSuggestionModel.fromJson(Map<String, dynamic> json) {
    return SafeAutocompleteSuggestionModel(
      text: json['text'] as String? ?? '',
      type: json['type'] as String? ?? 'query',
      id: json['id'] as String?,
      icon: json['icon'] as String?,
      subtitle: json['subtitle'] as String?,
    );
  }
}

class RecentSearchItemModel {
  final String id;
  final String queryText;
  final String searchType;
  final String createdAt;

  const RecentSearchItemModel({
    required this.id,
    required this.queryText,
    required this.searchType,
    required this.createdAt,
  });

  factory RecentSearchItemModel.fromJson(Map<String, dynamic> json) {
    return RecentSearchItemModel(
      id: json['id'] as String? ?? '',
      queryText: json['queryText'] as String? ?? '',
      searchType: json['searchType'] as String? ?? 'all',
      createdAt: json['createdAt'] as String? ?? '',
    );
  }
}

class TrendingTopicItemModel {
  final String id;
  final String slug;
  final String title;
  final String categoryTitle;
  final String? icon;
  final double velocityScore;
  final int postCount;
  final int rank;

  const TrendingTopicItemModel({
    required this.id,
    required this.slug,
    required this.title,
    required this.categoryTitle,
    this.icon,
    required this.velocityScore,
    required this.postCount,
    required this.rank,
  });

  factory TrendingTopicItemModel.fromJson(Map<String, dynamic> json) {
    return TrendingTopicItemModel(
      id: json['id'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      title: json['title'] as String? ?? '',
      categoryTitle: json['categoryTitle'] as String? ?? 'General',
      icon: json['icon'] as String?,
      velocityScore: (json['velocityScore'] as num?)?.toDouble() ?? 0.0,
      postCount: (json['postCount'] as num?)?.toInt() ?? 0,
      rank: (json['rank'] as num?)?.toInt() ?? 1,
    );
  }
}

class TrendingHashtagItemModel {
  final String tag;
  final int postCount;
  final int rank;

  const TrendingHashtagItemModel({
    required this.tag,
    required this.postCount,
    required this.rank,
  });

  factory TrendingHashtagItemModel.fromJson(Map<String, dynamic> json) {
    return TrendingHashtagItemModel(
      tag: json['tag'] as String? ?? '',
      postCount: (json['postCount'] as num?)?.toInt() ?? 0,
      rank: (json['rank'] as num?)?.toInt() ?? 1,
    );
  }
}

class TransparentTrendingModel {
  final String window;
  final String calculatedAt;
  final List<TrendingTopicItemModel> topics;
  final List<TrendingHashtagItemModel> hashtags;

  const TransparentTrendingModel({
    required this.window,
    required this.calculatedAt,
    this.topics = const [],
    this.hashtags = const [],
  });

  factory TransparentTrendingModel.fromJson(Map<String, dynamic> json) {
    return TransparentTrendingModel(
      window: json['window'] as String? ?? '24h',
      calculatedAt: json['calculatedAt'] as String? ?? '',
      topics: (json['topics'] as List<dynamic>?)
              ?.map((e) => TrendingTopicItemModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      hashtags: (json['hashtags'] as List<dynamic>?)
              ?.map((e) => TrendingHashtagItemModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}

class BreadcrumbItemModel {
  final String id;
  final String slug;
  final String title;
  final int level;

  const BreadcrumbItemModel({
    required this.id,
    required this.slug,
    required this.title,
    required this.level,
  });

  factory BreadcrumbItemModel.fromJson(Map<String, dynamic> json) {
    return BreadcrumbItemModel(
      id: json['id'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      title: json['title'] as String? ?? '',
      level: (json['level'] as num?)?.toInt() ?? 0,
    );
  }
}

class SubtopicItemModel {
  final String id;
  final String slug;
  final String title;
  final String? icon;
  final int reelsCount;

  const SubtopicItemModel({
    required this.id,
    required this.slug,
    required this.title,
    this.icon,
    required this.reelsCount,
  });

  factory SubtopicItemModel.fromJson(Map<String, dynamic> json) {
    return SubtopicItemModel(
      id: json['id'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      title: json['title'] as String? ?? '',
      icon: json['icon'] as String?,
      reelsCount: (json['reelsCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class RelatedInterestItemModel {
  final String id;
  final String slug;
  final String title;
  final double similarityScore;

  const RelatedInterestItemModel({
    required this.id,
    required this.slug,
    required this.title,
    required this.similarityScore,
  });

  factory RelatedInterestItemModel.fromJson(Map<String, dynamic> json) {
    return RelatedInterestItemModel(
      id: json['id'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      title: json['title'] as String? ?? '',
      similarityScore: (json['similarityScore'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class TopicPageDetailsModel {
  final String id;
  final String slug;
  final String title;
  final String description;
  final int level;
  final String? icon;
  final String? parentTitle;
  final List<BreadcrumbItemModel> breadcrumbs;
  final List<SubtopicItemModel> subtopics;
  final List<RelatedInterestItemModel> relatedInterests;
  final int reelsCount;
  final int followersCount;
  final bool isFollowing;
  final bool isMuted;
  final bool isPaused;
  final List<ReelSearchResultModel> recentReels;
  final List<ReelSearchResultModel> topReels;

  const TopicPageDetailsModel({
    required this.id,
    required this.slug,
    required this.title,
    required this.description,
    required this.level,
    this.icon,
    this.parentTitle,
    this.breadcrumbs = const [],
    this.subtopics = const [],
    this.relatedInterests = const [],
    required this.reelsCount,
    required this.followersCount,
    this.isFollowing = false,
    this.isMuted = false,
    this.isPaused = false,
    this.recentReels = const [],
    this.topReels = const [],
  });

  TopicPageDetailsModel copyWith({
    bool? isFollowing,
    bool? isMuted,
    bool? isPaused,
    int? followersCount,
  }) {
    return TopicPageDetailsModel(
      id: id,
      slug: slug,
      title: title,
      description: description,
      level: level,
      icon: icon,
      parentTitle: parentTitle,
      breadcrumbs: breadcrumbs,
      subtopics: subtopics,
      relatedInterests: relatedInterests,
      reelsCount: reelsCount,
      followersCount: followersCount ?? this.followersCount,
      isFollowing: isFollowing ?? this.isFollowing,
      isMuted: isMuted ?? this.isMuted,
      isPaused: isPaused ?? this.isPaused,
      recentReels: recentReels,
      topReels: topReels,
    );
  }

  factory TopicPageDetailsModel.fromJson(Map<String, dynamic> json) {
    return TopicPageDetailsModel(
      id: json['id'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      level: (json['level'] as num?)?.toInt() ?? 1,
      icon: json['icon'] as String?,
      parentTitle: json['parentTitle'] as String?,
      breadcrumbs: (json['breadcrumbs'] as List<dynamic>?)
              ?.map((e) => BreadcrumbItemModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      subtopics: (json['subtopics'] as List<dynamic>?)
              ?.map((e) => SubtopicItemModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      relatedInterests: (json['relatedInterests'] as List<dynamic>?)
              ?.map((e) => RelatedInterestItemModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      reelsCount: (json['reelsCount'] as num?)?.toInt() ?? 0,
      followersCount: (json['followersCount'] as num?)?.toInt() ?? 0,
      isFollowing: json['isFollowing'] as bool? ?? false,
      isMuted: json['isMuted'] as bool? ?? false,
      isPaused: json['isPaused'] as bool? ?? false,
      recentReels: (json['recentReels'] as List<dynamic>?)
              ?.map((e) => ReelSearchResultModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      topReels: (json['topReels'] as List<dynamic>?)
              ?.map((e) => ReelSearchResultModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}
