class CommentAuthorModel {
  final String id;
  final String username;
  final String displayName;
  final String? avatarUrl;

  const CommentAuthorModel({
    required this.id,
    required this.username,
    required this.displayName,
    this.avatarUrl,
  });

  factory CommentAuthorModel.fromJson(Map<String, dynamic> json) {
    return CommentAuthorModel(
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

class CommentItemModel {
  final String id;
  final String reelId;
  final String userId;
  final CommentAuthorModel author;
  final String? parentId;
  final String text;
  final int likeCount;
  final bool isLiked;
  final bool isPinned;
  final bool isAuthor;
  final String createdAt;
  final int repliesCount;
  final List<CommentItemModel> replies;

  const CommentItemModel({
    required this.id,
    required this.reelId,
    required this.userId,
    required this.author,
    this.parentId,
    required this.text,
    required this.likeCount,
    required this.isLiked,
    required this.isPinned,
    required this.isAuthor,
    required this.createdAt,
    this.repliesCount = 0,
    this.replies = const [],
  });

  CommentItemModel copyWith({
    String? id,
    String? reelId,
    String? userId,
    CommentAuthorModel? author,
    String? parentId,
    String? text,
    int? likeCount,
    bool? isLiked,
    bool? isPinned,
    bool? isAuthor,
    String? createdAt,
    int? repliesCount,
    List<CommentItemModel>? replies,
  }) {
    return CommentItemModel(
      id: id ?? this.id,
      reelId: reelId ?? this.reelId,
      userId: userId ?? this.userId,
      author: author ?? this.author,
      parentId: parentId ?? this.parentId,
      text: text ?? this.text,
      likeCount: likeCount ?? this.likeCount,
      isLiked: isLiked ?? this.isLiked,
      isPinned: isPinned ?? this.isPinned,
      isAuthor: isAuthor ?? this.isAuthor,
      createdAt: createdAt ?? this.createdAt,
      repliesCount: repliesCount ?? this.repliesCount,
      replies: replies ?? this.replies,
    );
  }

  factory CommentItemModel.fromJson(Map<String, dynamic> json) {
    final authorJson = json['author'];
    final author = authorJson is Map<String, dynamic>
        ? CommentAuthorModel.fromJson(authorJson)
        : CommentAuthorModel(
            id: json['userId'] as String? ?? '',
            username: json['username'] as String? ?? 'user',
            displayName: json['displayName'] as String? ?? 'User',
            avatarUrl: json['avatarUrl'] as String?,
          );

    final rawReplies = json['replies'] as List<dynamic>?;
    final replies = rawReplies != null
        ? rawReplies
            .map((r) => CommentItemModel.fromJson(r as Map<String, dynamic>))
            .toList()
        : <CommentItemModel>[];

    return CommentItemModel(
      id: json['id'] as String? ?? '',
      reelId: json['reelId'] as String? ?? '',
      userId: json['userId'] as String? ?? '',
      author: author,
      parentId: json['parentId'] as String?,
      text: json['text'] as String? ?? '',
      likeCount: (json['likeCount'] as num?)?.toInt() ?? 0,
      isLiked: json['isLiked'] as bool? ?? false,
      isPinned: json['isPinned'] as bool? ?? false,
      isAuthor: json['isAuthor'] as bool? ?? false,
      createdAt: json['createdAt'] as String? ?? '',
      repliesCount: (json['repliesCount'] as num?)?.toInt() ?? replies.length,
      replies: replies,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'reelId': reelId,
        'userId': userId,
        'author': author.toJson(),
        'parentId': parentId,
        'text': text,
        'likeCount': likeCount,
        'isLiked': isLiked,
        'isPinned': isPinned,
        'isAuthor': isAuthor,
        'createdAt': createdAt,
        'repliesCount': repliesCount,
        'replies': replies.map((r) => r.toJson()).toList(),
      };
}
