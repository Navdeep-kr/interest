class LessonItemModel {
  final String id;
  final String pathId;
  final int orderIndex;
  final String title;
  final String description;
  final String contentType; // VIDEO, ARTICLE, QUIZ, PROJECT_BRIEF
  final String? contentUrl;
  final String? reelId;
  final int durationSeconds;
  final List<String> prerequisiteLessonIds;
  final bool isDeleted;
  final int version;

  const LessonItemModel({
    required this.id,
    required this.pathId,
    required this.orderIndex,
    required this.title,
    required this.description,
    required this.contentType,
    this.contentUrl,
    this.reelId,
    required this.durationSeconds,
    this.prerequisiteLessonIds = const [],
    this.isDeleted = false,
    this.version = 1,
  });

  factory LessonItemModel.fromJson(Map<String, dynamic> json) {
    return LessonItemModel(
      id: json['id'] as String? ?? '',
      pathId: json['pathId'] as String? ?? '',
      orderIndex: json['orderIndex'] as int? ?? 1,
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      contentType: json['contentType'] as String? ?? 'VIDEO',
      contentUrl: json['contentUrl'] as String?,
      reelId: json['reelId'] as String?,
      durationSeconds: json['durationSeconds'] as int? ?? 300,
      prerequisiteLessonIds: (json['prerequisiteLessonIds'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      isDeleted: json['isDeleted'] as bool? ?? false,
      version: json['version'] as int? ?? 1,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'pathId': pathId,
        'orderIndex': orderIndex,
        'title': title,
        'description': description,
        'contentType': contentType,
        'contentUrl': contentUrl,
        'reelId': reelId,
        'durationSeconds': durationSeconds,
        'prerequisiteLessonIds': prerequisiteLessonIds,
        'isDeleted': isDeleted,
        'version': version,
      };
}

class DifficultyStatsModel {
  final int tooEasyVotes;
  final int justRightVotes;
  final int tooHardVotes;
  final double averageRating;
  final int totalFeedbackCount;

  const DifficultyStatsModel({
    this.tooEasyVotes = 0,
    this.justRightVotes = 0,
    this.tooHardVotes = 0,
    this.averageRating = 5.0,
    this.totalFeedbackCount = 0,
  });

  factory DifficultyStatsModel.fromJson(Map<String, dynamic> json) {
    return DifficultyStatsModel(
      tooEasyVotes: json['tooEasyVotes'] as int? ?? 0,
      justRightVotes: json['justRightVotes'] as int? ?? 0,
      tooHardVotes: json['tooHardVotes'] as int? ?? 0,
      averageRating: (json['averageRating'] as num?)?.toDouble() ?? 5.0,
      totalFeedbackCount: json['totalFeedbackCount'] as int? ?? 0,
    );
  }
}

class SkillPathModel {
  final String id;
  final String title;
  final String slug;
  final String description;
  final String interestId;
  final String interestName;
  final String level; // BEGINNER, INTERMEDIATE, ADVANCED
  final String classification;
  final bool isVerifiedCredential; // True for institutional certification, false for informal creator tips
  final String? issuingOrganization;
  final String? verificationBadgeUrl;
  final String creatorId;
  final String creatorName;
  final String? creatorAvatarUrl;
  final bool isCreatorCurated;
  final List<String> prerequisitePathIds;
  final int estimatedDurationMinutes;
  final int lessonCount;
  final List<LessonItemModel> lessons;
  final DifficultyStatsModel difficultyStats;
  final double rating;
  final int ratingsCount;
  final int enrolledCount;
  final int completedCount;
  final bool isPublished;

  const SkillPathModel({
    required this.id,
    required this.title,
    required this.slug,
    required this.description,
    required this.interestId,
    required this.interestName,
    required this.level,
    required this.classification,
    required this.isVerifiedCredential,
    this.issuingOrganization,
    this.verificationBadgeUrl,
    required this.creatorId,
    required this.creatorName,
    this.creatorAvatarUrl,
    required this.isCreatorCurated,
    this.prerequisitePathIds = const [],
    required this.estimatedDurationMinutes,
    required this.lessonCount,
    this.lessons = const [],
    this.difficultyStats = const DifficultyStatsModel(),
    this.rating = 5.0,
    this.ratingsCount = 0,
    this.enrolledCount = 0,
    this.completedCount = 0,
    this.isPublished = true,
  });

  factory SkillPathModel.fromJson(Map<String, dynamic> json) {
    return SkillPathModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      description: json['description'] as String? ?? '',
      interestId: json['interestId'] as String? ?? '',
      interestName: json['interestName'] as String? ?? '',
      level: json['level'] as String? ?? 'BEGINNER',
      classification: json['classification'] as String? ?? 'COMMUNITY_WORKSHOP',
      isVerifiedCredential: json['isVerifiedCredential'] as bool? ?? false,
      issuingOrganization: json['issuingOrganization'] as String?,
      verificationBadgeUrl: json['verificationBadgeUrl'] as String?,
      creatorId: json['creatorId'] as String? ?? '',
      creatorName: json['creatorName'] as String? ?? 'Creator',
      creatorAvatarUrl: json['creatorAvatarUrl'] as String?,
      isCreatorCurated: json['isCreatorCurated'] as bool? ?? true,
      prerequisitePathIds: (json['prerequisitePathIds'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      estimatedDurationMinutes: json['estimatedDurationMinutes'] as int? ?? 45,
      lessonCount: json['lessonCount'] as int? ?? 0,
      lessons: (json['lessons'] as List<dynamic>?)
              ?.map((e) => LessonItemModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      difficultyStats: json['difficultyStats'] != null
          ? DifficultyStatsModel.fromJson(
              json['difficultyStats'] as Map<String, dynamic>)
          : const DifficultyStatsModel(),
      rating: (json['rating'] as num?)?.toDouble() ?? 5.0,
      ratingsCount: json['ratingsCount'] as int? ?? 0,
      enrolledCount: json['enrolledCount'] as int? ?? 0,
      completedCount: json['completedCount'] as int? ?? 0,
      isPublished: json['isPublished'] as bool? ?? true,
    );
  }
}

class UserPathProgressModel {
  final String userId;
  final String pathId;
  final String currentLessonId;
  final List<String> completedLessonIds;
  final int percentComplete;
  final bool isCompleted;
  final String? completedAt;
  final String lastAccessedAt;
  final int timeSpentSeconds;
  final bool missingOrDeletedLessonsHandled;

  const UserPathProgressModel({
    required this.userId,
    required this.pathId,
    required this.currentLessonId,
    this.completedLessonIds = const [],
    this.percentComplete = 0,
    this.isCompleted = false,
    this.completedAt,
    required this.lastAccessedAt,
    this.timeSpentSeconds = 0,
    this.missingOrDeletedLessonsHandled = false,
  });

  factory UserPathProgressModel.fromJson(Map<String, dynamic> json) {
    return UserPathProgressModel(
      userId: json['userId'] as String? ?? '',
      pathId: json['pathId'] as String? ?? '',
      currentLessonId: json['currentLessonId'] as String? ?? '',
      completedLessonIds: (json['completedLessonIds'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      percentComplete: json['percentComplete'] as int? ?? 0,
      isCompleted: json['isCompleted'] as bool? ?? false,
      completedAt: json['completedAt'] as String?,
      lastAccessedAt: json['lastAccessedAt'] as String? ?? '',
      timeSpentSeconds: json['timeSpentSeconds'] as int? ?? 0,
      missingOrDeletedLessonsHandled:
          json['missingOrDeletedLessonsHandled'] as bool? ?? false,
    );
  }
}

class UserLearnReminderModel {
  final String userId;
  final bool enabled;
  final String reminderTime;
  final List<int> daysOfWeek;
  final String channel;
  final String? targetSkillPathId;
  final String? targetSkillPathTitle;

  const UserLearnReminderModel({
    required this.userId,
    required this.enabled,
    required this.reminderTime,
    this.daysOfWeek = const [1, 2, 3, 4, 5],
    this.channel = 'IN_APP',
    this.targetSkillPathId,
    this.targetSkillPathTitle,
  });

  factory UserLearnReminderModel.fromJson(Map<String, dynamic> json) {
    return UserLearnReminderModel(
      userId: json['userId'] as String? ?? '',
      enabled: json['enabled'] as bool? ?? false,
      reminderTime: json['reminderTime'] as String? ?? '19:00',
      daysOfWeek: (json['daysOfWeek'] as List<dynamic>?)
              ?.map((e) => (e as num).toInt())
              .toList() ??
          [1, 2, 3, 4, 5],
      channel: json['channel'] as String? ?? 'IN_APP',
      targetSkillPathId: json['targetSkillPathId'] as String?,
      targetSkillPathTitle: json['targetSkillPathTitle'] as String?,
    );
  }
}
