// Domain models for Interest+ Consumer Subscription Suite
// Zero-Location invariant guaranteed.

enum InterestPlusPlan {
  monthly,
  annual,
}

extension InterestPlusPlanExt on InterestPlusPlan {
  String get title {
    switch (this) {
      case InterestPlusPlan.monthly:
        return 'Monthly VIP';
      case InterestPlusPlan.annual:
        return 'Annual Founder VIP';
    }
  }

  double get price {
    switch (this) {
      case InterestPlusPlan.monthly:
        return 3.99;
      case InterestPlusPlan.annual:
        return 29.99;
    }
  }

  String get billingPeriod {
    switch (this) {
      case InterestPlusPlan.monthly:
        return '/ month';
      case InterestPlusPlan.annual:
        return '/ year (Save 37%)';
    }
  }
}

class InterestPlusState {
  final bool isSubscribed;
  final InterestPlusPlan? plan;
  final int streakFreezesRemaining;
  final bool isGhostModeEnabled;
  final String? pinnedBffUsername;
  final String pinnedBffEmoji;
  final String activeCustomAppIcon;
  final bool hasHolographicGlow;
  final DateTime? subscribedAt;
  final DateTime? expiresAt;

  const InterestPlusState({
    required this.isSubscribed,
    this.plan,
    this.streakFreezesRemaining = 2,
    this.isGhostModeEnabled = false,
    this.pinnedBffUsername,
    this.pinnedBffEmoji = '💖',
    this.activeCustomAppIcon = 'default',
    this.hasHolographicGlow = true,
    this.subscribedAt,
    this.expiresAt,
  });

  InterestPlusState copyWith({
    bool? isSubscribed,
    InterestPlusPlan? plan,
    int? streakFreezesRemaining,
    bool? isGhostModeEnabled,
    String? pinnedBffUsername,
    String? pinnedBffEmoji,
    String? activeCustomAppIcon,
    bool? hasHolographicGlow,
    DateTime? subscribedAt,
    DateTime? expiresAt,
  }) {
    return InterestPlusState(
      isSubscribed: isSubscribed ?? this.isSubscribed,
      plan: plan ?? this.plan,
      streakFreezesRemaining: streakFreezesRemaining ?? this.streakFreezesRemaining,
      isGhostModeEnabled: isGhostModeEnabled ?? this.isGhostModeEnabled,
      pinnedBffUsername: pinnedBffUsername ?? this.pinnedBffUsername,
      pinnedBffEmoji: pinnedBffEmoji ?? this.pinnedBffEmoji,
      activeCustomAppIcon: activeCustomAppIcon ?? this.activeCustomAppIcon,
      hasHolographicGlow: hasHolographicGlow ?? this.hasHolographicGlow,
      subscribedAt: subscribedAt ?? this.subscribedAt,
      expiresAt: expiresAt ?? this.expiresAt,
    );
  }

  Map<String, dynamic> toJson() => {
        'isSubscribed': isSubscribed,
        'plan': plan?.name,
        'streakFreezesRemaining': streakFreezesRemaining,
        'isGhostModeEnabled': isGhostModeEnabled,
        'pinnedBffUsername': pinnedBffUsername,
        'pinnedBffEmoji': pinnedBffEmoji,
        'activeCustomAppIcon': activeCustomAppIcon,
        'hasHolographicGlow': hasHolographicGlow,
        'subscribedAt': subscribedAt?.toIso8601String(),
        'expiresAt': expiresAt?.toIso8601String(),
      };
}
