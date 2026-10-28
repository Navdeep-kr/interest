class FollowRequestItem {
  final String id;
  final String requesterId;
  final String username;
  final String displayName;
  final String? avatarUrl;
  final String status;
  final String createdAt;

  const FollowRequestItem({
    required this.id,
    required this.requesterId,
    required this.username,
    required this.displayName,
    this.avatarUrl,
    required this.status,
    required this.createdAt,
  });

  factory FollowRequestItem.fromJson(Map<String, dynamic> json) {
    final requester = json['requester'] as Map<String, dynamic>?;

    return FollowRequestItem(
      id: json['id'] as String? ?? '',
      requesterId: json['requesterId'] as String? ?? json['requester_id'] as String? ?? '',
      username: requester?['username'] as String? ?? json['username'] as String? ?? '',
      displayName: requester?['displayName'] as String? ?? json['displayName'] as String? ?? json['display_name'] as String? ?? '',
      avatarUrl: requester?['avatarUrl'] as String? ?? json['avatarUrl'] as String? ?? json['avatar_url'] as String?,
      status: json['status'] as String? ?? 'PENDING',
      createdAt: json['createdAt'] as String? ?? json['created_at'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'requesterId': requesterId,
      'username': username,
      'displayName': displayName,
      'avatarUrl': avatarUrl,
      'status': status,
      'createdAt': createdAt,
    };
  }
}
