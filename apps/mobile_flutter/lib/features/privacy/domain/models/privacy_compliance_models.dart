import 'package:flutter/foundation.dart';

@immutable
class PrivacySettingsModel {
  final bool isPrivateAccount;
  final bool allowSearchDiscovery;
  final String messagingPermission; // 'EVERYONE', 'FOLLOWERS_ONLY', 'NOBODY'
  final String commentingPermission; // 'EVERYONE', 'FOLLOWERS_ONLY', 'OFF'
  final bool activityStatusVisible;
  final bool personalizedAdsConsent;
  final bool isMinor;

  const PrivacySettingsModel({
    required this.isPrivateAccount,
    required this.allowSearchDiscovery,
    required this.messagingPermission,
    required this.commentingPermission,
    required this.activityStatusVisible,
    required this.personalizedAdsConsent,
    required this.isMinor,
  });

  factory PrivacySettingsModel.fromJson(Map<String, dynamic> json) {
    return PrivacySettingsModel(
      isPrivateAccount: json['isPrivateAccount'] as bool? ?? false,
      allowSearchDiscovery: json['allowSearchDiscovery'] as bool? ?? true,
      messagingPermission: json['messagingPermission'] as String? ?? 'EVERYONE',
      commentingPermission: json['commentingPermission'] as String? ?? 'EVERYONE',
      activityStatusVisible: json['activityStatusVisible'] as bool? ?? true,
      personalizedAdsConsent: json['personalizedAdsConsent'] as bool? ?? false,
      isMinor: json['isMinor'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
        'isPrivateAccount': isPrivateAccount,
        'allowSearchDiscovery': allowSearchDiscovery,
        'messagingPermission': messagingPermission,
        'commentingPermission': commentingPermission,
        'activityStatusVisible': activityStatusVisible,
        'personalizedAdsConsent': personalizedAdsConsent,
      };

  PrivacySettingsModel copyWith({
    bool? isPrivateAccount,
    bool? allowSearchDiscovery,
    String? messagingPermission,
    String? commentingPermission,
    bool? activityStatusVisible,
    bool? personalizedAdsConsent,
  }) {
    return PrivacySettingsModel(
      isPrivateAccount: isPrivateAccount ?? this.isPrivateAccount,
      allowSearchDiscovery: allowSearchDiscovery ?? this.allowSearchDiscovery,
      messagingPermission: messagingPermission ?? this.messagingPermission,
      commentingPermission: commentingPermission ?? this.commentingPermission,
      activityStatusVisible: activityStatusVisible ?? this.activityStatusVisible,
      personalizedAdsConsent: personalizedAdsConsent ?? this.personalizedAdsConsent,
      isMinor: isMinor,
    );
  }
}

@immutable
class UserSessionModel {
  final String id;
  final String deviceName;
  final String? userAgent;
  final bool isCurrentSession;
  final DateTime lastActiveAt;
  final DateTime createdAt;

  const UserSessionModel({
    required this.id,
    required this.deviceName,
    this.userAgent,
    required this.isCurrentSession,
    required this.lastActiveAt,
    required this.createdAt,
  });

  factory UserSessionModel.fromJson(Map<String, dynamic> json) {
    return UserSessionModel(
      id: json['id'] as String? ?? '',
      deviceName: json['deviceName'] as String? ?? 'Unknown Device',
      userAgent: json['userAgent'] as String?,
      isCurrentSession: json['isCurrentSession'] as bool? ?? false,
      lastActiveAt: json['lastActiveAt'] != null
          ? DateTime.tryParse(json['lastActiveAt'] as String) ?? DateTime.now()
          : DateTime.now(),
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}

@immutable
class AccountDeletionRequestModel {
  final String id;
  final String status;
  final String? reason;
  final DateTime gracePeriodEndsAt;
  final DateTime requestedAt;

  const AccountDeletionRequestModel({
    required this.id,
    required this.status,
    this.reason,
    required this.gracePeriodEndsAt,
    required this.requestedAt,
  });

  factory AccountDeletionRequestModel.fromJson(Map<String, dynamic> json) {
    return AccountDeletionRequestModel(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? 'PENDING_GRACE_PERIOD',
      reason: json['reason'] as String?,
      gracePeriodEndsAt: json['gracePeriodEndsAt'] != null
          ? DateTime.tryParse(json['gracePeriodEndsAt'] as String) ?? DateTime.now().add(const Duration(days: 30))
          : DateTime.now().add(const Duration(days: 30)),
      requestedAt: json['requestedAt'] != null
          ? DateTime.tryParse(json['requestedAt'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}

@immutable
class DataExportRequestModel {
  final String id;
  final String status;
  final String? downloadToken;
  final DateTime expiresAt;

  const DataExportRequestModel({
    required this.id,
    required this.status,
    this.downloadToken,
    required this.expiresAt,
  });

  factory DataExportRequestModel.fromJson(Map<String, dynamic> json) {
    return DataExportRequestModel(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? 'PENDING',
      downloadToken: json['downloadToken'] as String?,
      expiresAt: json['expiresAt'] != null
          ? DateTime.tryParse(json['expiresAt'] as String) ?? DateTime.now().add(const Duration(days: 2))
          : DateTime.now().add(const Duration(days: 2)),
    );
  }
}
