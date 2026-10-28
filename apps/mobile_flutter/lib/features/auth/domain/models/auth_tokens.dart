class AuthTokens {
  final String accessToken;
  final String refreshToken;
  final int expiresInSeconds;
  final DateTime issuedAt;

  AuthTokens({
    required this.accessToken,
    required this.refreshToken,
    this.expiresInSeconds = 900, // 15 mins default
    DateTime? issuedAt,
  }) : issuedAt = issuedAt ?? DateTime.now();

  bool get isExpired {
    final expiryTime = issuedAt.add(Duration(seconds: expiresInSeconds));
    // Buffer 60 seconds before actual expiration
    return DateTime.now().isAfter(expiryTime.subtract(const Duration(seconds: 60)));
  }

  factory AuthTokens.fromJson(Map<String, dynamic> json) {
    return AuthTokens(
      accessToken: json['accessToken'] as String? ?? '',
      refreshToken: json['refreshToken'] as String? ?? '',
      expiresInSeconds: json['expiresIn'] as int? ?? 900,
      issuedAt: DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'accessToken': accessToken,
      'refreshToken': refreshToken,
      'expiresIn': expiresInSeconds,
    };
  }
}
