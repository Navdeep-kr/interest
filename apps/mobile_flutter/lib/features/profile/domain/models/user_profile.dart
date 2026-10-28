class SocialLink {
  final String title;
  final String url;

  const SocialLink({
    required this.title,
    required this.url,
  });

  factory SocialLink.fromJson(Map<String, dynamic> json) {
    return SocialLink(
      title: json['title'] as String? ?? '',
      url: json['url'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'title': title,
        'url': url,
      };
}

class UserProfile {
  final String id;
  final String username;
  final String displayName;
  final String? bio;
  final String? avatarUrl;
  final String? bannerUrl;
  final String? email;
  final String? phoneNumber;
  final List<String> preferredLanguages;
  final int reelsCount;
  final int followersCount;
  final int followingCount;
  final bool isPrivate;
  final List<SocialLink> links;
  final bool hideFollowerCount;
  final bool hideFollowingCount;
  final String allowTagging;
  final String allowMentions;
  // Relationship with viewing user
  final bool isFollowing;
  final bool isFollower;
  final bool isMutual;
  final bool hasPendingRequest;
  final bool isBlocked;
  final bool isMuted;
  final bool isRestricted;
  final String createdAt;
  final String updatedAt;

  const UserProfile({
    required this.id,
    required this.username,
    required this.displayName,
    this.bio,
    this.avatarUrl,
    this.bannerUrl,
    this.email,
    this.phoneNumber,
    this.preferredLanguages = const ['en'],
    this.reelsCount = 0,
    this.followersCount = 0,
    this.followingCount = 0,
    this.isPrivate = false,
    this.links = const [],
    this.hideFollowerCount = false,
    this.hideFollowingCount = false,
    this.allowTagging = 'EVERYONE',
    this.allowMentions = 'EVERYONE',
    this.isFollowing = false,
    this.isFollower = false,
    this.isMutual = false,
    this.hasPendingRequest = false,
    this.isBlocked = false,
    this.isMuted = false,
    this.isRestricted = false,
    required this.createdAt,
    required this.updatedAt,
  });

  bool get isFollowerCountHidden => followersCount < 0;
  bool get isFollowingCountHidden => followingCount < 0;

  UserProfile copyWith({
    String? id,
    String? username,
    String? displayName,
    String? bio,
    String? avatarUrl,
    String? bannerUrl,
    String? email,
    String? phoneNumber,
    List<String>? preferredLanguages,
    int? reelsCount,
    int? followersCount,
    int? followingCount,
    bool? isPrivate,
    List<SocialLink>? links,
    bool? hideFollowerCount,
    bool? hideFollowingCount,
    String? allowTagging,
    String? allowMentions,
    bool? isFollowing,
    bool? isFollower,
    bool? isMutual,
    bool? hasPendingRequest,
    bool? isBlocked,
    bool? isMuted,
    bool? isRestricted,
    String? createdAt,
    String? updatedAt,
  }) {
    return UserProfile(
      id: id ?? this.id,
      username: username ?? this.username,
      displayName: displayName ?? this.displayName,
      bio: bio ?? this.bio,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      bannerUrl: bannerUrl ?? this.bannerUrl,
      email: email ?? this.email,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      preferredLanguages: preferredLanguages ?? this.preferredLanguages,
      reelsCount: reelsCount ?? this.reelsCount,
      followersCount: followersCount ?? this.followersCount,
      followingCount: followingCount ?? this.followingCount,
      isPrivate: isPrivate ?? this.isPrivate,
      links: links ?? this.links,
      hideFollowerCount: hideFollowerCount ?? this.hideFollowerCount,
      hideFollowingCount: hideFollowingCount ?? this.hideFollowingCount,
      allowTagging: allowTagging ?? this.allowTagging,
      allowMentions: allowMentions ?? this.allowMentions,
      isFollowing: isFollowing ?? this.isFollowing,
      isFollower: isFollower ?? this.isFollower,
      isMutual: isMutual ?? this.isMutual,
      hasPendingRequest: hasPendingRequest ?? this.hasPendingRequest,
      isBlocked: isBlocked ?? this.isBlocked,
      isMuted: isMuted ?? this.isMuted,
      isRestricted: isRestricted ?? this.isRestricted,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    var rawLinks = json['links'];
    List<SocialLink> parsedLinks = [];
    if (rawLinks is List) {
      parsedLinks = rawLinks
          .whereType<Map<String, dynamic>>()
          .map((item) => SocialLink.fromJson(item))
          .toList();
    }

    var rawLanguages = json['preferredLanguages'] ?? json['preferred_languages'];
    List<String> parsedLanguages = ['en'];
    if (rawLanguages is List) {
      parsedLanguages = rawLanguages.map((e) => e.toString()).toList();
    }

    return UserProfile(
      id: json['id'] as String? ?? '',
      username: json['username'] as String? ?? '',
      displayName: json['displayName'] as String? ?? json['display_name'] as String? ?? '',
      bio: json['bio'] as String?,
      avatarUrl: json['avatarUrl'] as String? ?? json['avatar_url'] as String?,
      bannerUrl: json['bannerUrl'] as String? ?? json['banner_url'] as String?,
      email: json['email'] as String?,
      phoneNumber: json['phoneNumber'] as String? ?? json['phone_number'] as String?,
      preferredLanguages: parsedLanguages,
      reelsCount: (json['reelsCount'] as num?)?.toInt() ?? (json['reels_count'] as num?)?.toInt() ?? 0,
      followersCount: (json['followersCount'] as num?)?.toInt() ?? (json['followers_count'] as num?)?.toInt() ?? 0,
      followingCount: (json['followingCount'] as num?)?.toInt() ?? (json['following_count'] as num?)?.toInt() ?? 0,
      isPrivate: json['isPrivate'] as bool? ?? json['is_private'] as bool? ?? false,
      links: parsedLinks,
      hideFollowerCount: json['hideFollowerCount'] as bool? ?? json['hide_follower_count'] as bool? ?? false,
      hideFollowingCount: json['hideFollowingCount'] as bool? ?? json['hide_following_count'] as bool? ?? false,
      allowTagging: json['allowTagging'] as String? ?? json['allow_tagging'] as String? ?? 'EVERYONE',
      allowMentions: json['allowMentions'] as String? ?? json['allow_mentions'] as String? ?? 'EVERYONE',
      isFollowing: json['isFollowing'] as bool? ?? json['is_following'] as bool? ?? false,
      isFollower: json['isFollower'] as bool? ?? json['is_follower'] as bool? ?? false,
      isMutual: json['isMutual'] as bool? ?? json['is_mutual'] as bool? ?? false,
      hasPendingRequest: json['hasPendingRequest'] as bool? ?? json['has_pending_request'] as bool? ?? false,
      isBlocked: json['isBlocked'] as bool? ?? json['is_blocked'] as bool? ?? false,
      isMuted: json['isMuted'] as bool? ?? json['is_muted'] as bool? ?? false,
      isRestricted: json['isRestricted'] as bool? ?? json['is_restricted'] as bool? ?? false,
      createdAt: json['createdAt'] as String? ?? json['created_at'] as String? ?? DateTime.now().toIso8601String(),
      updatedAt: json['updatedAt'] as String? ?? json['updated_at'] as String? ?? DateTime.now().toIso8601String(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'displayName': displayName,
      'bio': bio,
      'avatarUrl': avatarUrl,
      'bannerUrl': bannerUrl,
      'email': email,
      'phoneNumber': phoneNumber,
      'preferredLanguages': preferredLanguages,
      'reelsCount': reelsCount,
      'followersCount': followersCount,
      'followingCount': followingCount,
      'isPrivate': isPrivate,
      'links': links.map((l) => l.toJson()).toList(),
      'hideFollowerCount': hideFollowerCount,
      'hideFollowingCount': hideFollowingCount,
      'allowTagging': allowTagging,
      'allowMentions': allowMentions,
      'isFollowing': isFollowing,
      'isFollower': isFollower,
      'isMutual': isMutual,
      'hasPendingRequest': hasPendingRequest,
      'isBlocked': isBlocked,
      'isMuted': isMuted,
      'isRestricted': isRestricted,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }
}
