class AiGroundedSourceModel {
  final String id;
  final String title;
  final String type; // REEL, INTEREST, COMMUNITY, LEARN_PATH, CREATOR, PLAYLIST
  final String deepLinkUrl;
  final String snippet;
  final bool isPublic;
  final String? authorName;

  const AiGroundedSourceModel({
    required this.id,
    required this.title,
    required this.type,
    required this.deepLinkUrl,
    required this.snippet,
    this.isPublic = true,
    this.authorName,
  });

  factory AiGroundedSourceModel.fromJson(Map<String, dynamic> json) {
    return AiGroundedSourceModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      type: json['type'] as String? ?? 'REEL',
      deepLinkUrl: json['deepLinkUrl'] as String? ?? '',
      snippet: json['snippet'] as String? ?? '',
      isPublic: json['isPublic'] as bool? ?? true,
      authorName: json['authorName'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'type': type,
        'deepLinkUrl': deepLinkUrl,
        'snippet': snippet,
        'isPublic': isPublic,
        'authorName': authorName,
      };
}

class AiRelatedInterestModel {
  final String id;
  final String slug;
  final String title;
  final double vectorSimilarity;

  const AiRelatedInterestModel({
    required this.id,
    required this.slug,
    required this.title,
    required this.vectorSimilarity,
  });

  factory AiRelatedInterestModel.fromJson(Map<String, dynamic> json) {
    return AiRelatedInterestModel(
      id: json['id'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      title: json['title'] as String? ?? '',
      vectorSimilarity: (json['vectorSimilarity'] as num?)?.toDouble() ?? 0.8,
    );
  }
}

class AiTokenUsageModel {
  final int promptTokens;
  final int completionTokens;
  final int totalTokens;
  final int estimatedCostMicrocents;

  const AiTokenUsageModel({
    this.promptTokens = 0,
    this.completionTokens = 0,
    this.totalTokens = 0,
    this.estimatedCostMicrocents = 0,
  });

  factory AiTokenUsageModel.fromJson(Map<String, dynamic> json) {
    return AiTokenUsageModel(
      promptTokens: json['promptTokens'] as int? ?? 0,
      completionTokens: json['completionTokens'] as int? ?? 0,
      totalTokens: json['totalTokens'] as int? ?? 0,
      estimatedCostMicrocents: json['estimatedCostMicrocents'] as int? ?? 0,
    );
  }
}

class AiAssistantMessageModel {
  final String id;
  final String conversationId;
  final String role; // user, assistant, system
  final String content;
  final String? summary;
  final List<AiGroundedSourceModel> groundedSources;
  final List<AiRelatedInterestModel> relatedInterests;
  final List<String> suggestedActions;
  final bool isFallbackToSearch;
  final AiTokenUsageModel tokenUsage;
  final int latencyMs;
  final String timestamp;
  bool? userHelpfulFeedback; // local tracking for UI

  AiAssistantMessageModel({
    required this.id,
    required this.conversationId,
    required this.role,
    required this.content,
    this.summary,
    this.groundedSources = const [],
    this.relatedInterests = const [],
    this.suggestedActions = const [],
    this.isFallbackToSearch = false,
    this.tokenUsage = const AiTokenUsageModel(),
    this.latencyMs = 0,
    required this.timestamp,
    this.userHelpfulFeedback,
  });

  factory AiAssistantMessageModel.fromJson(Map<String, dynamic> json) {
    return AiAssistantMessageModel(
      id: json['id'] as String? ?? '',
      conversationId: json['conversationId'] as String? ?? '',
      role: json['role'] as String? ?? 'assistant',
      content: json['content'] as String? ?? '',
      summary: json['summary'] as String?,
      groundedSources: (json['groundedSources'] as List<dynamic>?)
              ?.map((e) => AiGroundedSourceModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      relatedInterests: (json['relatedInterests'] as List<dynamic>?)
              ?.map((e) => AiRelatedInterestModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      suggestedActions: (json['suggestedActions'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      isFallbackToSearch: json['isFallbackToSearch'] as bool? ?? false,
      tokenUsage: json['tokenUsage'] != null
          ? AiTokenUsageModel.fromJson(json['tokenUsage'] as Map<String, dynamic>)
          : const AiTokenUsageModel(),
      latencyMs: json['latencyMs'] as int? ?? 0,
      timestamp: json['timestamp'] as String? ?? '',
    );
  }
}

class AiRateLimitAndCostStatusModel {
  final String userId;
  final int queriesRemainingThisHour;
  final int dailyTokenUsage;
  final int dailyTokenLimit;
  final bool isBudgetExceeded;
  final bool isBetaEnrolled;

  const AiRateLimitAndCostStatusModel({
    required this.userId,
    required this.queriesRemainingThisHour,
    required this.dailyTokenUsage,
    required this.dailyTokenLimit,
    required this.isBudgetExceeded,
    required this.isBetaEnrolled,
  });

  factory AiRateLimitAndCostStatusModel.fromJson(Map<String, dynamic> json) {
    return AiRateLimitAndCostStatusModel(
      userId: json['userId'] as String? ?? '',
      queriesRemainingThisHour: json['queriesRemainingThisHour'] as int? ?? 20,
      dailyTokenUsage: json['dailyTokenUsage'] as int? ?? 0,
      dailyTokenLimit: json['dailyTokenLimit'] as int? ?? 50000,
      isBudgetExceeded: json['isBudgetExceeded'] as bool? ?? false,
      isBetaEnrolled: json['isBetaEnrolled'] as bool? ?? true,
    );
  }
}
