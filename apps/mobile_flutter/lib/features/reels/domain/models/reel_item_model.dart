enum ReelMediaType { video, image }

enum ReelItemVisibility { public, followersOnly, private }

class ReelCreatorModel {
  final String id;
  final String username;
  final String displayName;
  final String? avatarUrl;

  const ReelCreatorModel({
    required this.id,
    required this.username,
    required this.displayName,
    this.avatarUrl,
  });

  factory ReelCreatorModel.fromJson(Map<String, dynamic> json) {
    return ReelCreatorModel(
      id: json['id'] as String? ?? '',
      username: json['username'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'username': username,
        'displayName': displayName,
        'avatarUrl': avatarUrl,
      };
}

class ReelItemModel {
  final String id;
  final String creatorId;
  final ReelCreatorModel creator;
  final String title;
  final String? caption;
  final String hlsMasterUrl;
  final String thumbnailUrl;
  final double durationSeconds;
  final String primaryInterestId;
  final List<String> interestTags;
  final int viewCount;
  final int likeCount;
  final int commentCount;
  final int saveCount;
  final int shareCount;
  final bool isLiked;
  final bool isSaved;
  final bool isFollowing;
  final bool isPinned;
  final bool isSuperfanOnly;
  final ReelMediaType mediaType;
  final List<String> imageUrls;
  final ReelItemVisibility visibility;
  final List<String> hashtags;
  final String? explanation;
  final String createdAt;

  const ReelItemModel({
    required this.id,
    required this.creatorId,
    required this.creator,
    required this.title,
    this.caption,
    required this.hlsMasterUrl,
    required this.thumbnailUrl,
    required this.durationSeconds,
    required this.primaryInterestId,
    required this.interestTags,
    required this.viewCount,
    required this.likeCount,
    required this.commentCount,
    required this.saveCount,
    required this.shareCount,
    required this.isLiked,
    required this.isSaved,
    required this.isFollowing,
    required this.isPinned,
    this.isSuperfanOnly = false,
    required this.mediaType,
    required this.imageUrls,
    required this.visibility,
    required this.hashtags,
    this.explanation,
    required this.createdAt,
  });

  ReelItemModel copyWith({
    String? id,
    String? creatorId,
    ReelCreatorModel? creator,
    String? title,
    String? caption,
    String? hlsMasterUrl,
    String? thumbnailUrl,
    double? durationSeconds,
    String? primaryInterestId,
    List<String>? interestTags,
    int? viewCount,
    int? likeCount,
    int? commentCount,
    int? saveCount,
    int? shareCount,
    bool? isLiked,
    bool? isSaved,
    bool? isFollowing,
    bool? isPinned,
    bool? isSuperfanOnly,
    ReelMediaType? mediaType,
    List<String>? imageUrls,
    ReelItemVisibility? visibility,
    List<String>? hashtags,
    String? explanation,
    String? createdAt,
  }) {
    return ReelItemModel(
      id: id ?? this.id,
      creatorId: creatorId ?? this.creatorId,
      creator: creator ?? this.creator,
      title: title ?? this.title,
      caption: caption ?? this.caption,
      hlsMasterUrl: hlsMasterUrl ?? this.hlsMasterUrl,
      thumbnailUrl: thumbnailUrl ?? this.thumbnailUrl,
      durationSeconds: durationSeconds ?? this.durationSeconds,
      primaryInterestId: primaryInterestId ?? this.primaryInterestId,
      interestTags: interestTags ?? this.interestTags,
      viewCount: viewCount ?? this.viewCount,
      likeCount: likeCount ?? this.likeCount,
      commentCount: commentCount ?? this.commentCount,
      saveCount: saveCount ?? this.saveCount,
      shareCount: shareCount ?? this.shareCount,
      isLiked: isLiked ?? this.isLiked,
      isSaved: isSaved ?? this.isSaved,
      isFollowing: isFollowing ?? this.isFollowing,
      isPinned: isPinned ?? this.isPinned,
      isSuperfanOnly: isSuperfanOnly ?? this.isSuperfanOnly,
      mediaType: mediaType ?? this.mediaType,
      imageUrls: imageUrls ?? this.imageUrls,
      visibility: visibility ?? this.visibility,
      hashtags: hashtags ?? this.hashtags,
      explanation: explanation ?? this.explanation,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  factory ReelItemModel.fromJson(Map<String, dynamic> json) {
    ReelMediaType parseMediaType(String? val) {
      if (val == 'IMAGE') return ReelMediaType.image;
      return ReelMediaType.video;
    }

    ReelItemVisibility parseVisibility(String? val) {
      if (val == 'FOLLOWERS_ONLY') return ReelItemVisibility.followersOnly;
      if (val == 'PRIVATE') return ReelItemVisibility.private;
      return ReelItemVisibility.public;
    }

    return ReelItemModel(
      id: json['id'] as String? ?? '',
      creatorId: json['creatorId'] as String? ?? '',
      creator: json['creator'] is Map<String, dynamic>
          ? ReelCreatorModel.fromJson(json['creator'] as Map<String, dynamic>)
          : ReelCreatorModel(
              id: json['creatorId'] as String? ?? '',
              username: json['username'] as String? ?? 'creator',
              displayName: json['displayName'] as String? ?? 'Creator',
              avatarUrl: json['avatarUrl'] as String?,
            ),
      title: json['title'] as String? ?? '',
      caption: json['caption'] as String?,
      hlsMasterUrl: json['hlsMasterUrl'] as String? ?? '',
      thumbnailUrl: json['thumbnailUrl'] as String? ?? '',
      durationSeconds: (json['durationSeconds'] as num?)?.toDouble() ?? 0.0,
      primaryInterestId: json['primaryInterestId'] as String? ?? '',
      interestTags: (json['interestTags'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      viewCount: (json['viewCount'] as num?)?.toInt() ?? 0,
      likeCount: (json['likeCount'] as num?)?.toInt() ?? 0,
      commentCount: (json['commentCount'] as num?)?.toInt() ?? 0,
      saveCount: (json['saveCount'] as num?)?.toInt() ?? 0,
      shareCount: (json['shareCount'] as num?)?.toInt() ?? 0,
      isLiked: json['isLiked'] as bool? ?? false,
      isSaved: json['isSaved'] as bool? ?? false,
      isFollowing: json['isFollowing'] as bool? ?? false,
      isPinned: json['isPinned'] as bool? ?? false,
      isSuperfanOnly: json['isSuperfanOnly'] as bool? ?? false,
      mediaType: parseMediaType(json['mediaType'] as String?),
      imageUrls: (json['imageUrls'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      visibility: parseVisibility(json['visibility'] as String?),
      hashtags: (json['hashtags'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      explanation: json['explanation'] as String?,
      createdAt: json['createdAt'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'creatorId': creatorId,
        'creator': creator.toJson(),
        'title': title,
        'caption': caption,
        'hlsMasterUrl': hlsMasterUrl,
        'thumbnailUrl': thumbnailUrl,
        'durationSeconds': durationSeconds,
        'primaryInterestId': primaryInterestId,
        'interestTags': interestTags,
        'viewCount': viewCount,
        'likeCount': likeCount,
        'commentCount': commentCount,
        'saveCount': saveCount,
        'shareCount': shareCount,
        'isLiked': isLiked,
        'isSaved': isSaved,
        'isFollowing': isFollowing,
        'isPinned': isPinned,
        'isSuperfanOnly': isSuperfanOnly,
        'mediaType': mediaType == ReelMediaType.image ? 'IMAGE' : 'VIDEO',
        'imageUrls': imageUrls,
        'visibility': visibility == ReelItemVisibility.followersOnly
            ? 'FOLLOWERS_ONLY'
            : visibility == ReelItemVisibility.private
                ? 'PRIVATE'
                : 'PUBLIC',
        'hashtags': hashtags,
        'explanation': explanation,
        'createdAt': createdAt,
      };
}
