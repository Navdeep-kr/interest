class UserSession {
  final String id;
  final String? deviceName;
  final String? userAgent;
  final String lastActiveAt;
  final String createdAt;
  final bool isCurrent;

  const UserSession({
    required this.id,
    this.deviceName,
    this.userAgent,
    required this.lastActiveAt,
    required this.createdAt,
    this.isCurrent = false,
  });

  factory UserSession.fromJson(Map<String, dynamic> json) {
    return UserSession(
      id: json['id'] as String? ?? '',
      deviceName: json['deviceName'] as String?,
      userAgent: json['userAgent'] as String?,
      lastActiveAt: json['lastActiveAt'] as String? ?? '',
      createdAt: json['createdAt'] as String? ?? '',
      isCurrent: json['isCurrent'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'deviceName': deviceName,
      'userAgent': userAgent,
      'lastActiveAt': lastActiveAt,
      'createdAt': createdAt,
      'isCurrent': isCurrent,
    };
  }
}
