class ProfileReelItem {
  final String id;
  final String creatorId;
  final String title;
  final String? caption;
  final String? hlsMasterUrl;
  final String? thumbnailUrl;
  final double durationSeconds;
  final int viewCount;
  final int likeCount;
  final int commentCount;
  final int saveCount;
  final String createdAt;

  const ProfileReelItem({
    required this.id,
    required this.creatorId,
    required this.title,
    this.caption,
    this.hlsMasterUrl,
    this.thumbnailUrl,
    this.durationSeconds = 0.0,
    this.viewCount = 0,
    this.likeCount = 0,
    this.commentCount = 0,
    this.saveCount = 0,
    required this.createdAt,
  });

  factory ProfileReelItem.fromJson(Map<String, dynamic> json) {
    return ProfileReelItem(
      id: json['id'] as String? ?? '',
      creatorId: json['creatorId'] as String? ?? json['creator_id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      caption: json['caption'] as String?,
      hlsMasterUrl: json['hlsMasterUrl'] as String? ?? json['hls_master_url'] as String?,
      thumbnailUrl: json['thumbnailUrl'] as String? ?? json['thumbnail_url'] as String?,
      durationSeconds: (json['durationSeconds'] as num?)?.toDouble() ??
          (json['duration_seconds'] as num?)?.toDouble() ??
          0.0,
      viewCount: (json['viewCount'] as num?)?.toInt() ?? (json['view_count'] as num?)?.toInt() ?? 0,
      likeCount: (json['likeCount'] as num?)?.toInt() ?? (json['like_count'] as num?)?.toInt() ?? 0,
      commentCount: (json['commentCount'] as num?)?.toInt() ?? (json['comment_count'] as num?)?.toInt() ?? 0,
      saveCount: (json['saveCount'] as num?)?.toInt() ?? (json['save_count'] as num?)?.toInt() ?? 0,
      createdAt: json['createdAt'] as String? ?? json['created_at'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'creatorId': creatorId,
      'title': title,
      'caption': caption,
      'hlsMasterUrl': hlsMasterUrl,
      'thumbnailUrl': thumbnailUrl,
      'durationSeconds': durationSeconds,
      'viewCount': viewCount,
      'likeCount': likeCount,
      'commentCount': commentCount,
      'saveCount': saveCount,
      'createdAt': createdAt,
    };
  }
}
