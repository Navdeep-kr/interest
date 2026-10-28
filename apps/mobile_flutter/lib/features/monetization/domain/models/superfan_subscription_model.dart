// Domain models for Prompt 25/Superfans — Instagram-style Creator Subscriptions.
// Zero-Location guaranteed.

enum SuperfanTier {
  fan,
  vip,
  founder,
}

extension SuperfanTierExt on SuperfanTier {
  String get title {
    switch (this) {
      case SuperfanTier.fan:
        return 'Superfan';
      case SuperfanTier.vip:
        return 'VIP Superfan';
      case SuperfanTier.founder:
        return 'Founder Tier';
    }
  }

  double get defaultPrice {
    switch (this) {
      case SuperfanTier.fan:
        return 4.99;
      case SuperfanTier.vip:
        return 9.99;
      case SuperfanTier.founder:
        return 19.99;
    }
  }

  List<String> get perks {
    switch (this) {
      case SuperfanTier.fan:
        return [
          '👑 Purple Superfan Badge in comments & chats',
          '🔒 Unlock All Exclusive Superfans Reels & Posts',
          '✨ Access 24h Exclusive Superfans Stories',
          '💬 Access to Subscriber-Only Direct Chat Lounge',
        ];
      case SuperfanTier.vip:
        return [
          '👑 Gold VIP Superfan Badge & Crown Icon',
          '🔒 Unlock All Exclusive Reels & Behind-the-Scenes',
          '✨ Priority Reply in Direct Messages & Live Streams',
          '🎯 Monthly Exclusive 1-on-1 Q&A Audio Hangout',
          '🎁 All Standard Superfan Perks Included',
        ];
      case SuperfanTier.founder:
        return [
          '💎 Diamond Founder Badge on Profile & Comments',
          '🚀 Creator Credit in Video Reels & Descriptions',
          '🌟 Direct VIP Hotline with Creator',
          '🎁 All VIP & Standard Perks Included',
        ];
    }
  }
}

class SuperfanSubscription {
  final String id;
  final String creatorId;
  final String creatorUsername;
  final String? creatorAvatarUrl;
  final SuperfanTier tier;
  final double monthlyPriceDollars;
  final bool isActive;
  final DateTime subscribedAt;
  final DateTime expiresAt;

  const SuperfanSubscription({
    required this.id,
    required this.creatorId,
    required this.creatorUsername,
    this.creatorAvatarUrl,
    required this.tier,
    required this.monthlyPriceDollars,
    required this.isActive,
    required this.subscribedAt,
    required this.expiresAt,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'creatorId': creatorId,
    'creatorUsername': creatorUsername,
    'creatorAvatarUrl': creatorAvatarUrl,
    'tier': tier.name,
    'monthlyPriceDollars': monthlyPriceDollars,
    'isActive': isActive,
    'subscribedAt': subscribedAt.toIso8601String(),
    'expiresAt': expiresAt.toIso8601String(),
  };

  factory SuperfanSubscription.fromJson(Map<String, dynamic> json) {
    return SuperfanSubscription(
      id: json['id'] as String? ?? '',
      creatorId: json['creatorId'] as String? ?? '',
      creatorUsername: json['creatorUsername'] as String? ?? 'creator',
      creatorAvatarUrl: json['creatorAvatarUrl'] as String?,
      tier: SuperfanTier.values.firstWhere(
        (t) => t.name == json['tier'],
        orElse: () => SuperfanTier.fan,
      ),
      monthlyPriceDollars: (json['monthlyPriceDollars'] as num?)?.toDouble() ?? 4.99,
      isActive: json['isActive'] as bool? ?? true,
      subscribedAt: DateTime.tryParse(json['subscribedAt'] as String? ?? '') ?? DateTime.now(),
      expiresAt: DateTime.tryParse(json['expiresAt'] as String? ?? '') ?? DateTime.now().add(const Duration(days: 30)),
    );
  }
}

class SuperfanMember {
  final String userId;
  final String username;
  final String displayName;
  final String? avatarUrl;
  final SuperfanTier tier;
  final DateTime joinedAt;

  const SuperfanMember({
    required this.userId,
    required this.username,
    required this.displayName,
    this.avatarUrl,
    required this.tier,
    required this.joinedAt,
  });
}
