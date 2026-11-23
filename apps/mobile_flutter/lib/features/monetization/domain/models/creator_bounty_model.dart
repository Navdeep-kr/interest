enum BountyStatus {
  open,
  inProgress,
  completed,
  paidOut,
}

extension BountyStatusExt on BountyStatus {
  String get label {
    switch (this) {
      case BountyStatus.open:
        return 'Open Challenge 🎯';
      case BountyStatus.inProgress:
        return 'In Progress ⏳';
      case BountyStatus.completed:
        return 'Submitted 🎬';
      case BountyStatus.paidOut:
        return 'Paid & Released 💰';
    }
  }
}

class CreatorBounty {
  final String id;
  final String creatorId;
  final String creatorUsername;
  final String sponsorUsername;
  final String? sponsorAvatarUrl;
  final String title;
  final String description;
  final double rewardAmount;
  final BountyStatus status;
  final String? fulfillmentUrl;
  final DateTime createdAt;
  final DateTime? completedAt;

  const CreatorBounty({
    required this.id,
    required this.creatorId,
    required this.creatorUsername,
    required this.sponsorUsername,
    this.sponsorAvatarUrl,
    required this.title,
    required this.description,
    required this.rewardAmount,
    this.status = BountyStatus.open,
    this.fulfillmentUrl,
    required this.createdAt,
    this.completedAt,
  });

  CreatorBounty copyWith({
    BountyStatus? status,
    String? fulfillmentUrl,
    DateTime? completedAt,
  }) {
    return CreatorBounty(
      id: id,
      creatorId: creatorId,
      creatorUsername: creatorUsername,
      sponsorUsername: sponsorUsername,
      sponsorAvatarUrl: sponsorAvatarUrl,
      title: title,
      description: description,
      rewardAmount: rewardAmount,
      status: status ?? this.status,
      fulfillmentUrl: fulfillmentUrl ?? this.fulfillmentUrl,
      createdAt: createdAt,
      completedAt: completedAt ?? this.completedAt,
    );
  }
}
