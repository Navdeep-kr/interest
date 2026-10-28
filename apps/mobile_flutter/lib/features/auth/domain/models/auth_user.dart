class AuthUser {
  final String id;
  final String username;
  final String displayName;
  final String? email;
  final String? phoneNumber;
  final String? avatarUrl;
  final bool isMinor;
  final String role;

  const AuthUser({
    required this.id,
    required this.username,
    required this.displayName,
    this.email,
    this.phoneNumber,
    this.avatarUrl,
    this.isMinor = false,
    this.role = 'USER',
  });

  bool get isCreator => role.toUpperCase() == 'CREATOR';
  bool get isModerator => role.toUpperCase() == 'MODERATOR' || role.toUpperCase() == 'ADMIN';
  bool get isAdmin => role.toUpperCase() == 'ADMIN' || role.toUpperCase() == 'SUPERADMIN';

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id'] as String? ?? json['userId'] as String? ?? '',
      username: json['username'] as String? ?? '',
      displayName: json['displayName'] as String? ?? json['display_name'] as String? ?? '',
      email: json['email'] as String?,
      phoneNumber: json['phoneNumber'] as String? ?? json['phone_number'] as String?,
      avatarUrl: json['avatarUrl'] as String? ?? json['avatar_url'] as String?,
      isMinor: json['isMinor'] as bool? ?? json['is_minor'] as bool? ?? false,
      role: json['role'] as String? ?? 'USER',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'displayName': displayName,
      'email': email,
      'phoneNumber': phoneNumber,
      'avatarUrl': avatarUrl,
      'isMinor': isMinor,
      'role': role,
    };
  }
}
