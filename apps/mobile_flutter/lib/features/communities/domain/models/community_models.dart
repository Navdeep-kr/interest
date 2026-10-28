// Domain models for Prompt 16 — Topic Communities & Collaborative Content.
// STRICT ZERO-LOCATION: 0 GPS, 0 IP coordinates, zero location attributes.

enum CommunityVisibility {
  public,
  restricted,
  private,
}

extension CommunityVisibilityExt on CommunityVisibility {
  String get value {
    switch (this) {
      case CommunityVisibility.public:
        return 'PUBLIC';
      case CommunityVisibility.restricted:
        return 'RESTRICTED';
      case CommunityVisibility.private:
        return 'PRIVATE';
    }
  }

  static CommunityVisibility fromString(String? val) {
    switch (val?.toUpperCase()) {
      case 'RESTRICTED':
        return CommunityVisibility.restricted;
      case 'PRIVATE':
        return CommunityVisibility.private;
      case 'PUBLIC':
      default:
        return CommunityVisibility.public;
    }
  }
}

enum CommunityMemberRole {
  owner,
  admin,
  moderator,
  member,
}

extension CommunityMemberRoleExt on CommunityMemberRole {
  String get value {
    switch (this) {
      case CommunityMemberRole.owner:
        return 'OWNER';
      case CommunityMemberRole.admin:
        return 'ADMIN';
      case CommunityMemberRole.moderator:
        return 'MODERATOR';
      case CommunityMemberRole.member:
        return 'MEMBER';
    }
  }

  bool get isStaff => this == CommunityMemberRole.owner || this == CommunityMemberRole.admin || this == CommunityMemberRole.moderator;

  static CommunityMemberRole fromString(String? val) {
    switch (val?.toUpperCase()) {
      case 'OWNER':
        return CommunityMemberRole.owner;
      case 'ADMIN':
        return CommunityMemberRole.admin;
      case 'MODERATOR':
        return CommunityMemberRole.moderator;
      case 'MEMBER':
      default:
        return CommunityMemberRole.member;
    }
  }
}

enum CommunityMemberStatus {
  active,
  pendingRequest,
  invited,
  banned,
  muted,
}

extension CommunityMemberStatusExt on CommunityMemberStatus {
  String get value {
    switch (this) {
      case CommunityMemberStatus.active:
        return 'ACTIVE';
      case CommunityMemberStatus.pendingRequest:
        return 'PENDING_REQUEST';
      case CommunityMemberStatus.invited:
        return 'INVITED';
      case CommunityMemberStatus.banned:
        return 'BANNED';
      case CommunityMemberStatus.muted:
        return 'MUTED';
    }
  }

  static CommunityMemberStatus fromString(String? val) {
    switch (val?.toUpperCase()) {
      case 'PENDING_REQUEST':
        return CommunityMemberStatus.pendingRequest;
      case 'INVITED':
        return CommunityMemberStatus.invited;
      case 'BANNED':
        return CommunityMemberStatus.banned;
      case 'MUTED':
        return CommunityMemberStatus.muted;
      case 'ACTIVE':
      default:
        return CommunityMemberStatus.active;
    }
  }
}

enum CommunityPostType {
  discussion,
  sharedReel,
  collaborative,
  announcement,
}

extension CommunityPostTypeExt on CommunityPostType {
  String get value {
    switch (this) {
      case CommunityPostType.discussion:
        return 'DISCUSSION';
      case CommunityPostType.sharedReel:
        return 'SHARED_REEL';
      case CommunityPostType.collaborative:
        return 'COLLABORATIVE';
      case CommunityPostType.announcement:
        return 'ANNOUNCEMENT';
    }
  }

  static CommunityPostType fromString(String? val) {
    switch (val?.toUpperCase()) {
      case 'SHARED_REEL':
        return CommunityPostType.sharedReel;
      case 'COLLABORATIVE':
        return CommunityPostType.collaborative;
      case 'ANNOUNCEMENT':
        return CommunityPostType.announcement;
      case 'DISCUSSION':
      default:
        return CommunityPostType.discussion;
    }
  }
}

class CommunityGuidelineModel {
  final String id;
  final String title;
  final String description;

  const CommunityGuidelineModel({
    required this.id,
    required this.title,
    required this.description,
  });

  factory CommunityGuidelineModel.fromJson(Map<String, dynamic> json) {
    return CommunityGuidelineModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'description': description,
  };
}

class CommunityMemberUserInfoModel {
  final String id;
  final String username;
  final String displayName;
  final String? avatarUrl;
  final bool isVerified;

  const CommunityMemberUserInfoModel({
    required this.id,
    required this.username,
    required this.displayName,
    this.avatarUrl,
    this.isVerified = false,
  });

  factory CommunityMemberUserInfoModel.fromJson(Map<String, dynamic> json) {
    return CommunityMemberUserInfoModel(
      id: json['id'] as String? ?? '',
      username: json['username'] as String? ?? '',
      displayName: json['displayName'] as String? ?? json['display_name'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String? ?? json['avatar_url'] as String?,
      isVerified: json['isVerified'] as bool? ?? json['is_verified'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'username': username,
    'displayName': displayName,
    'avatarUrl': avatarUrl,
    'isVerified': isVerified,
  };
}

class CommunityModel {
  final String id;
  final String creatorId;
  final String? interestId;
  final String name;
  final String slug;
  final String description;
  final String? avatarUrl;
  final String? bannerUrl;
  final CommunityVisibility visibility;
  final List<CommunityGuidelineModel> guidelines;
  final int membersCount;
  final int postsCount;
  final bool isActive;
  final CommunityMemberRole? userRole;
  final CommunityMemberStatus? userStatus;
  final DateTime createdAt;
  final DateTime updatedAt;

  const CommunityModel({
    required this.id,
    required this.creatorId,
    this.interestId,
    required this.name,
    required this.slug,
    required this.description,
    this.avatarUrl,
    this.bannerUrl,
    required this.visibility,
    required this.guidelines,
    required this.membersCount,
    required this.postsCount,
    required this.isActive,
    this.userRole,
    this.userStatus,
    required this.createdAt,
    required this.updatedAt,
  });

  bool get isJoined => userStatus == CommunityMemberStatus.active;
  bool get isStaff => userRole != null && userRole!.isStaff;
  bool get isOwner => userRole == CommunityMemberRole.owner;

  factory CommunityModel.fromJson(Map<String, dynamic> json) {
    final rawGuidelines = json['guidelines'];
    List<CommunityGuidelineModel> glList = [];
    if (rawGuidelines is List) {
      glList = rawGuidelines
          .whereType<Map<String, dynamic>>()
          .map((item) => CommunityGuidelineModel.fromJson(item))
          .toList();
    }

    return CommunityModel(
      id: json['id'] as String? ?? '',
      creatorId: json['creatorId'] as String? ?? json['creator_id'] as String? ?? '',
      interestId: json['interestId'] as String? ?? json['interest_id'] as String?,
      name: json['name'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      description: json['description'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String? ?? json['avatar_url'] as String?,
      bannerUrl: json['bannerUrl'] as String? ?? json['banner_url'] as String?,
      visibility: CommunityVisibilityExt.fromString(json['visibility'] as String?),
      guidelines: glList,
      membersCount: (json['membersCount'] as num?)?.toInt() ?? (json['members_count'] as num?)?.toInt() ?? 1,
      postsCount: (json['postsCount'] as num?)?.toInt() ?? (json['posts_count'] as num?)?.toInt() ?? 0,
      isActive: json['isActive'] as bool? ?? json['is_active'] as bool? ?? true,
      userRole: json['userRole'] != null ? CommunityMemberRoleExt.fromString(json['userRole'] as String?) : null,
      userStatus: json['userStatus'] != null ? CommunityMemberStatusExt.fromString(json['userStatus'] as String?) : null,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? json['created_at'] as String? ?? '') ?? DateTime.now(),
      updatedAt: DateTime.tryParse(json['updatedAt'] as String? ?? json['updated_at'] as String? ?? '') ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'creatorId': creatorId,
    'interestId': interestId,
    'name': name,
    'slug': slug,
    'description': description,
    'avatarUrl': avatarUrl,
    'bannerUrl': bannerUrl,
    'visibility': visibility.value,
    'guidelines': guidelines.map((g) => g.toJson()).toList(),
    'membersCount': membersCount,
    'postsCount': postsCount,
    'isActive': isActive,
    'userRole': userRole?.value,
    'userStatus': userStatus?.value,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
  };

  CommunityModel copyWith({
    String? name,
    String? description,
    int? membersCount,
    int? postsCount,
    CommunityMemberRole? userRole,
    bool clearUserRole = false,
    CommunityMemberStatus? userStatus,
    bool clearUserStatus = false,
  }) {
    return CommunityModel(
      id: id,
      creatorId: creatorId,
      interestId: interestId,
      name: name ?? this.name,
      slug: slug,
      description: description ?? this.description,
      avatarUrl: avatarUrl,
      bannerUrl: bannerUrl,
      visibility: visibility,
      guidelines: guidelines,
      membersCount: membersCount ?? this.membersCount,
      postsCount: postsCount ?? this.postsCount,
      isActive: isActive,
      userRole: clearUserRole ? null : (userRole ?? this.userRole),
      userStatus: clearUserStatus ? null : (userStatus ?? this.userStatus),
      createdAt: createdAt,
      updatedAt: updatedAt,
    );
  }
}

class CommunityCollaboratorModel {
  final String userId;
  final String username;
  final String displayName;
  final String? avatarUrl;
  final String status;
  final DateTime? respondedAt;

  const CommunityCollaboratorModel({
    required this.userId,
    required this.username,
    required this.displayName,
    this.avatarUrl,
    required this.status,
    this.respondedAt,
  });

  factory CommunityCollaboratorModel.fromJson(Map<String, dynamic> json) {
    return CommunityCollaboratorModel(
      userId: json['userId'] as String? ?? json['user_id'] as String? ?? '',
      username: json['username'] as String? ?? '',
      displayName: json['displayName'] as String? ?? json['display_name'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String? ?? json['avatar_url'] as String?,
      status: json['status'] as String? ?? 'PENDING',
      respondedAt: json['respondedAt'] != null ? DateTime.tryParse(json['respondedAt'] as String) : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'userId': userId,
    'username': username,
    'displayName': displayName,
    'avatarUrl': avatarUrl,
    'status': status,
    'respondedAt': respondedAt?.toIso8601String(),
  };
}

class CommunityPostModel {
  final String id;
  final String communityId;
  final String authorId;
  final CommunityMemberUserInfoModel author;
  final CommunityPostType postType;
  final String title;
  final String body;
  final List<String> mediaUrls;
  final String? reelId;
  final bool isPinned;
  final DateTime? pinnedAt;
  final bool isAnnouncement;
  final String collaborationStatus;
  final List<CommunityCollaboratorModel> collaborators;
  final int likesCount;
  final int commentsCount;
  final DateTime createdAt;
  final DateTime updatedAt;

  const CommunityPostModel({
    required this.id,
    required this.communityId,
    required this.authorId,
    required this.author,
    required this.postType,
    required this.title,
    required this.body,
    required this.mediaUrls,
    this.reelId,
    required this.isPinned,
    this.pinnedAt,
    required this.isAnnouncement,
    required this.collaborationStatus,
    required this.collaborators,
    this.likesCount = 0,
    this.commentsCount = 0,
    required this.createdAt,
    required this.updatedAt,
  });

  factory CommunityPostModel.fromJson(Map<String, dynamic> json) {
    final rawAuthor = json['author'];
    final author = rawAuthor is Map<String, dynamic>
        ? CommunityMemberUserInfoModel.fromJson(rawAuthor)
        : CommunityMemberUserInfoModel(
            id: json['authorId'] as String? ?? json['author_id'] as String? ?? '',
            username: json['author_username'] as String? ?? '',
            displayName: json['author_display_name'] as String? ?? '',
            avatarUrl: json['author_avatar_url'] as String?,
            isVerified: json['author_is_verified'] as bool? ?? false,
          );

    final rawCollabs = json['collaborators'];
    List<CommunityCollaboratorModel> collabs = [];
    if (rawCollabs is List) {
      collabs = rawCollabs
          .whereType<Map<String, dynamic>>()
          .map((c) => CommunityCollaboratorModel.fromJson(c))
          .toList();
    }

    final rawMedia = json['mediaUrls'] ?? json['media_urls'];
    List<String> medias = [];
    if (rawMedia is List) {
      medias = rawMedia.map((m) => m.toString()).toList();
    }

    return CommunityPostModel(
      id: json['id'] as String? ?? '',
      communityId: json['communityId'] as String? ?? json['community_id'] as String? ?? '',
      authorId: json['authorId'] as String? ?? json['author_id'] as String? ?? '',
      author: author,
      postType: CommunityPostTypeExt.fromString(json['postType'] as String? ?? json['post_type'] as String?),
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? '',
      mediaUrls: medias,
      reelId: json['reelId'] as String? ?? json['reel_id'] as String?,
      isPinned: json['isPinned'] as bool? ?? json['is_pinned'] as bool? ?? false,
      pinnedAt: json['pinnedAt'] != null ? DateTime.tryParse(json['pinnedAt'] as String) : null,
      isAnnouncement: json['isAnnouncement'] as bool? ?? json['is_announcement'] as bool? ?? false,
      collaborationStatus: json['collaborationStatus'] as String? ?? json['collaboration_status'] as String? ?? 'NONE',
      collaborators: collabs,
      likesCount: (json['likesCount'] as num?)?.toInt() ?? (json['likes_count'] as num?)?.toInt() ?? 0,
      commentsCount: (json['commentsCount'] as num?)?.toInt() ?? (json['comments_count'] as num?)?.toInt() ?? 0,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? json['created_at'] as String? ?? '') ?? DateTime.now(),
      updatedAt: DateTime.tryParse(json['updatedAt'] as String? ?? json['updated_at'] as String? ?? '') ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'communityId': communityId,
    'authorId': authorId,
    'author': author.toJson(),
    'postType': postType.value,
    'title': title,
    'body': body,
    'mediaUrls': mediaUrls,
    'reelId': reelId,
    'isPinned': isPinned,
    'pinnedAt': pinnedAt?.toIso8601String(),
    'isAnnouncement': isAnnouncement,
    'collaborationStatus': collaborationStatus,
    'collaborators': collaborators.map((c) => c.toJson()).toList(),
    'likesCount': likesCount,
    'commentsCount': commentsCount,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
  };

  CommunityPostModel copyWith({
    bool? isPinned,
    DateTime? pinnedAt,
    int? likesCount,
    int? commentsCount,
  }) {
    return CommunityPostModel(
      id: id,
      communityId: communityId,
      authorId: authorId,
      author: author,
      postType: postType,
      title: title,
      body: body,
      mediaUrls: mediaUrls,
      reelId: reelId,
      isPinned: isPinned ?? this.isPinned,
      pinnedAt: pinnedAt ?? this.pinnedAt,
      isAnnouncement: isAnnouncement,
      collaborationStatus: collaborationStatus,
      collaborators: collaborators,
      likesCount: likesCount ?? this.likesCount,
      commentsCount: commentsCount ?? this.commentsCount,
      createdAt: createdAt,
      updatedAt: updatedAt,
    );
  }
}

class CommunityCollectionModel {
  final String id;
  final String communityId;
  final String creatorId;
  final String title;
  final String description;
  final bool isCurated;
  final int itemsCount;
  final DateTime createdAt;

  const CommunityCollectionModel({
    required this.id,
    required this.communityId,
    required this.creatorId,
    required this.title,
    required this.description,
    required this.isCurated,
    required this.itemsCount,
    required this.createdAt,
  });

  factory CommunityCollectionModel.fromJson(Map<String, dynamic> json) {
    return CommunityCollectionModel(
      id: json['id'] as String? ?? '',
      communityId: json['communityId'] as String? ?? json['community_id'] as String? ?? '',
      creatorId: json['creatorId'] as String? ?? json['creator_id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      isCurated: json['isCurated'] as bool? ?? json['is_curated'] as bool? ?? false,
      itemsCount: (json['itemsCount'] as num?)?.toInt() ?? (json['items_count'] as num?)?.toInt() ?? 0,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? json['created_at'] as String? ?? '') ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'communityId': communityId,
    'creatorId': creatorId,
    'title': title,
    'description': description,
    'isCurated': isCurated,
    'itemsCount': itemsCount,
    'createdAt': createdAt.toIso8601String(),
  };
}

class CommunityReportModel {
  final String id;
  final String communityId;
  final String reporterId;
  final String targetType;
  final String targetId;
  final String reason;
  final String? details;
  final String status;
  final String? actionTaken;
  final DateTime createdAt;

  const CommunityReportModel({
    required this.id,
    required this.communityId,
    required this.reporterId,
    required this.targetType,
    required this.targetId,
    required this.reason,
    this.details,
    required this.status,
    this.actionTaken,
    required this.createdAt,
  });

  factory CommunityReportModel.fromJson(Map<String, dynamic> json) {
    return CommunityReportModel(
      id: json['id'] as String? ?? '',
      communityId: json['communityId'] as String? ?? json['community_id'] as String? ?? '',
      reporterId: json['reporterId'] as String? ?? json['reporter_id'] as String? ?? '',
      targetType: json['targetType'] as String? ?? json['target_type'] as String? ?? 'POST',
      targetId: json['targetId'] as String? ?? json['target_id'] as String? ?? '',
      reason: json['reason'] as String? ?? '',
      details: json['details'] as String?,
      status: json['status'] as String? ?? 'PENDING',
      actionTaken: json['actionTaken'] as String? ?? json['action_taken'] as String?,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? json['created_at'] as String? ?? '') ?? DateTime.now(),
    );
  }
}
