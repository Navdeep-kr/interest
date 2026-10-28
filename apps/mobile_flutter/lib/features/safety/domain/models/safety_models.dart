import 'package:flutter/foundation.dart';

enum ReportTargetType {
  reel,
  comment,
  user,
  message,
  community;

  String toApiString() {
    switch (this) {
      case ReportTargetType.reel:
        return 'REEL';
      case ReportTargetType.comment:
        return 'COMMENT';
      case ReportTargetType.user:
        return 'USER';
      case ReportTargetType.message:
        return 'MESSAGE';
      case ReportTargetType.community:
        return 'COMMUNITY';
    }
  }

  static ReportTargetType fromApiString(String val) {
    switch (val.toUpperCase()) {
      case 'REEL':
        return ReportTargetType.reel;
      case 'COMMENT':
        return ReportTargetType.comment;
      case 'USER':
        return ReportTargetType.user;
      case 'MESSAGE':
        return ReportTargetType.message;
      case 'COMMUNITY':
        return ReportTargetType.community;
      default:
        return ReportTargetType.reel;
    }
  }
}

enum ReportCategory {
  minorSafety,
  selfHarmSuicide,
  violenceDangerous,
  harassmentBullying,
  hateSpeechHarassment,
  impersonation,
  adultProhibited,
  nuditySexual,
  scamFraud,
  spamScam,
  copyrightInfringement,
  misinformation,
  unlabeledAi;

  String toApiString() {
    switch (this) {
      case ReportCategory.minorSafety:
        return 'MINOR_SAFETY';
      case ReportCategory.selfHarmSuicide:
        return 'SELF_HARM_SUICIDE';
      case ReportCategory.violenceDangerous:
        return 'VIOLENCE_DANGEROUS';
      case ReportCategory.harassmentBullying:
        return 'HARASSMENT_BULLYING';
      case ReportCategory.hateSpeechHarassment:
        return 'HATE_SPEECH_HARASSMENT';
      case ReportCategory.impersonation:
        return 'IMPERSONATION';
      case ReportCategory.adultProhibited:
        return 'ADULT_PROHIBITED';
      case ReportCategory.nuditySexual:
        return 'NUDITY_SEXUAL';
      case ReportCategory.scamFraud:
        return 'SCAM_FRAUD';
      case ReportCategory.spamScam:
        return 'SPAM_SCAM';
      case ReportCategory.copyrightInfringement:
        return 'COPYRIGHT_INFRINGEMENT';
      case ReportCategory.misinformation:
        return 'MISINFORMATION';
      case ReportCategory.unlabeledAi:
        return 'UNLABELED_AI';
    }
  }

  String get displayName {
    switch (this) {
      case ReportCategory.minorSafety:
        return 'Child Safety & Exploitation';
      case ReportCategory.selfHarmSuicide:
        return 'Suicide or Self-Harm';
      case ReportCategory.violenceDangerous:
        return 'Violence & Physical Harm';
      case ReportCategory.harassmentBullying:
        return 'Harassment or Bullying';
      case ReportCategory.hateSpeechHarassment:
        return 'Hate Speech & Discrimination';
      case ReportCategory.impersonation:
        return 'Impersonation or Identity Theft';
      case ReportCategory.adultProhibited:
        return 'Prohibited Adult Content';
      case ReportCategory.nuditySexual:
        return 'Nudity or Sexual Acts';
      case ReportCategory.scamFraud:
        return 'Scam, Fraud or Phishing';
      case ReportCategory.spamScam:
        return 'Spam or Deceptive Content';
      case ReportCategory.copyrightInfringement:
        return 'Copyright Infringement';
      case ReportCategory.misinformation:
        return 'Harmful Misinformation';
      case ReportCategory.unlabeledAi:
        return 'Undisclosed AI Content';
    }
  }

  bool get isUrgent {
    return this == ReportCategory.minorSafety ||
        this == ReportCategory.selfHarmSuicide ||
        this == ReportCategory.violenceDangerous;
  }
}

@immutable
class CreateReportRequest {
  final ReportTargetType targetType;
  final String targetId;
  final ReportCategory category;
  final String? details;

  const CreateReportRequest({
    required this.targetType,
    required this.targetId,
    required this.category,
    this.details,
  });

  Map<String, dynamic> toJson() => {
        'targetType': targetType.toApiString(),
        'targetId': targetId,
        'category': category.toApiString(),
        if (details != null && details!.isNotEmpty) 'details': details,
      };
}

@immutable
class ReportResponse {
  final bool success;
  final String reportId;
  final bool isUrgent;
  final String message;

  const ReportResponse({
    required this.success,
    required this.reportId,
    required this.isUrgent,
    required this.message,
  });

  factory ReportResponse.fromJson(Map<String, dynamic> json) {
    return ReportResponse(
      success: json['success'] as bool? ?? false,
      reportId: json['reportId'] as String? ?? '',
      isUrgent: json['isUrgent'] as bool? ?? false,
      message: json['message'] as String? ?? '',
    );
  }
}

@immutable
class UserAccountSafetyStatus {
  final String userId;
  final bool isActive;
  final bool isSuspended;
  final DateTime? suspensionExpiresAt;
  final String? suspensionReason;
  final int strikesCount;
  final bool isPostingRestricted;
  final DateTime? postingRestrictedUntil;
  final bool isMessagingRestricted;
  final DateTime? messagingRestrictedUntil;
  final bool isCommentingRestricted;
  final DateTime? commentingRestrictedUntil;

  const UserAccountSafetyStatus({
    required this.userId,
    required this.isActive,
    required this.isSuspended,
    this.suspensionExpiresAt,
    this.suspensionReason,
    required this.strikesCount,
    required this.isPostingRestricted,
    this.postingRestrictedUntil,
    required this.isMessagingRestricted,
    this.messagingRestrictedUntil,
    required this.isCommentingRestricted,
    this.commentingRestrictedUntil,
  });

  factory UserAccountSafetyStatus.fromJson(Map<String, dynamic> json) {
    return UserAccountSafetyStatus(
      userId: json['userId'] as String? ?? '',
      isActive: json['isActive'] as bool? ?? true,
      isSuspended: json['isSuspended'] as bool? ?? false,
      suspensionExpiresAt: json['suspensionExpiresAt'] != null
          ? DateTime.tryParse(json['suspensionExpiresAt'] as String)
          : null,
      suspensionReason: json['suspensionReason'] as String?,
      strikesCount: json['strikesCount'] as int? ?? 0,
      isPostingRestricted: json['isPostingRestricted'] as bool? ?? false,
      postingRestrictedUntil: json['postingRestrictedUntil'] != null
          ? DateTime.tryParse(json['postingRestrictedUntil'] as String)
          : null,
      isMessagingRestricted: json['isMessagingRestricted'] as bool? ?? false,
      messagingRestrictedUntil: json['messagingRestrictedUntil'] != null
          ? DateTime.tryParse(json['messagingRestrictedUntil'] as String)
          : null,
      isCommentingRestricted: json['isCommentingRestricted'] as bool? ?? false,
      commentingRestrictedUntil: json['commentingRestrictedUntil'] != null
          ? DateTime.tryParse(json['commentingRestrictedUntil'] as String)
          : null,
    );
  }

  bool get isRestricted =>
      isSuspended ||
      isPostingRestricted ||
      isMessagingRestricted ||
      isCommentingRestricted;
}

@immutable
class CommunityGuidelineItem {
  final String id;
  final String title;
  final String category;
  final String description;
  final String enforcementAction;
  final DateTime updatedAt;

  const CommunityGuidelineItem({
    required this.id,
    required this.title,
    required this.category,
    required this.description,
    required this.enforcementAction,
    required this.updatedAt,
  });

  factory CommunityGuidelineItem.fromJson(Map<String, dynamic> json) {
    return CommunityGuidelineItem(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      category: json['category'] as String? ?? '',
      description: json['description'] as String? ?? '',
      enforcementAction: json['enforcementAction'] as String? ?? '',
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}

@immutable
class BlockedUserItem {
  final String id;
  final String username;
  final String displayName;
  final String? avatarUrl;
  final DateTime createdAt;

  const BlockedUserItem({
    required this.id,
    required this.username,
    required this.displayName,
    this.avatarUrl,
    required this.createdAt,
  });

  factory BlockedUserItem.fromJson(Map<String, dynamic> json) {
    return BlockedUserItem(
      id: json['id'] as String? ?? '',
      username: json['username'] as String? ?? 'user',
      displayName: json['displayName'] as String? ?? 'User',
      avatarUrl: json['avatarUrl'] as String?,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}

@immutable
class CreateAppealRequest {
  final String entityType;
  final String entityId;
  final String statement;

  const CreateAppealRequest({
    required this.entityType,
    required this.entityId,
    required this.statement,
  });

  Map<String, dynamic> toJson() => {
        'entityType': entityType,
        'entityId': entityId,
        'statement': statement,
      };
}
