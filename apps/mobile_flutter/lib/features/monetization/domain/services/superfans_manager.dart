import 'package:flutter/foundation.dart';
import '../models/superfan_subscription_model.dart';
import '../models/creator_bounty_model.dart';

/// Central state manager for Instagram-style Superfans & Creator Subscriptions.
class SuperfansManager extends ChangeNotifier {
  static final SuperfansManager _instance = SuperfansManager._internal();
  factory SuperfansManager() => _instance;
  SuperfansManager._internal() {
    _seedInitialSubscriptions();
  }

  final Map<String, SuperfanSubscription> _activeSubscriptions = {};

  final List<SuperfanMember> _demoMembers = [
    SuperfanMember(
      userId: 'usr_fan_1',
      username: 'elena_dev',
      displayName: 'Elena Rostova',
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200',
      tier: SuperfanTier.vip,
      joinedAt: DateTime.now().subtract(const Duration(days: 12)),
    ),
    SuperfanMember(
      userId: 'usr_fan_2',
      username: 'marcus_code',
      displayName: 'Marcus Chen',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
      tier: SuperfanTier.fan,
      joinedAt: DateTime.now().subtract(const Duration(days: 5)),
    ),
    SuperfanMember(
      userId: 'usr_fan_3',
      username: 'sarah_design',
      displayName: 'Sarah Connor',
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200',
      tier: SuperfanTier.founder,
      joinedAt: DateTime.now().subtract(const Duration(days: 28)),
    ),
  ];

  void _seedInitialSubscriptions() {
    // Seed sample active subscription
    final sample = SuperfanSubscription(
      id: 'sub_seed_1',
      creatorId: 'c_synth_dev',
      creatorUsername: 'synth_coder',
      creatorAvatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
      tier: SuperfanTier.vip,
      monthlyPriceDollars: 9.99,
      isActive: true,
      subscribedAt: DateTime.now().subtract(const Duration(days: 14)),
      expiresAt: DateTime.now().add(const Duration(days: 16)),
    );
    _activeSubscriptions[sample.creatorId] = sample;
  }

  bool isSuperfanOf(String creatorId) {
    final sub = _activeSubscriptions[creatorId];
    return sub != null && sub.isActive;
  }

  SuperfanSubscription? getSubscriptionFor(String creatorId) {
    return _activeSubscriptions[creatorId];
  }

  List<SuperfanSubscription> get allMySubscriptions =>
      _activeSubscriptions.values.where((s) => s.isActive).toList();

  int get activeSuperfansCount => 148 + _activeSubscriptions.length;
  double get monthlyRecurringRevenue => 738.52 + (_activeSubscriptions.length * 4.99);

  List<SuperfanMember> get recentSuperfans => List.unmodifiable(_demoMembers);

  /// Activates a new Superfans subscription for a creator
  void subscribe({
    required String creatorId,
    required String creatorUsername,
    String? creatorAvatarUrl,
    required SuperfanTier tier,
    required double price,
  }) {
    final newSub = SuperfanSubscription(
      id: 'sub_${DateTime.now().millisecondsSinceEpoch}',
      creatorId: creatorId,
      creatorUsername: creatorUsername,
      creatorAvatarUrl: creatorAvatarUrl,
      tier: tier,
      monthlyPriceDollars: price,
      isActive: true,
      subscribedAt: DateTime.now(),
      expiresAt: DateTime.now().add(const Duration(days: 30)),
    );

    _activeSubscriptions[creatorId] = newSub;
    notifyListeners();
  }

  double _availableBalance = 1240.50;
  final List<SentGiftEvent> _sentGifts = [];
  final List<PayoutRecord> _payoutHistory = [
    PayoutRecord(
      id: 'payout_hist_1',
      amount: 450.00,
      method: 'Stripe Connect',
      destinationAccount: 'acct_1N****892',
      status: 'completed',
      requestedAt: DateTime.now().subtract(const Duration(days: 14)),
    ),
  ];

  double get availableBalance => _availableBalance;
  List<SentGiftEvent> get sentGifts => List.unmodifiable(_sentGifts);
  List<PayoutRecord> get payoutHistory => List.unmodifiable(_payoutHistory);

  /// Sends an instant micro-gift or creator tip
  void sendGift({
    required String creatorId,
    required String creatorName,
    required CreatorGift gift,
  }) {
    final event = SentGiftEvent(
      id: 'gift_${DateTime.now().millisecondsSinceEpoch}',
      creatorId: creatorId,
      creatorName: creatorName,
      gift: gift,
      sentAt: DateTime.now(),
    );
    _sentGifts.add(event);
    _availableBalance += (gift.price * 0.85); // 85% creator payout share after store fees
    notifyListeners();
  }

  /// Requests a payout / withdrawal to Stripe or PayPal
  Future<bool> requestPayout({
    required double amount,
    required String method,
    required String destinationAccount,
  }) async {
    if (amount <= 0 || amount > _availableBalance) return false;

    _availableBalance -= amount;
    _payoutHistory.insert(
      0,
      PayoutRecord(
        id: 'payout_${DateTime.now().millisecondsSinceEpoch}',
        amount: amount,
        method: method,
        destinationAccount: destinationAccount,
        status: 'processing',
        requestedAt: DateTime.now(),
      ),
    );
    notifyListeners();
    return true;
  }

  final List<CreatorBounty> _bounties = [
    CreatorBounty(
      id: 'bounty_1',
      creatorId: 'c_synth_dev',
      creatorUsername: 'synth_coder',
      sponsorUsername: 'alex_mobile',
      sponsorAvatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200',
      title: 'Review Flutter 3.24 Impeller Engine',
      description: 'Break down the frame pacing and Vulkan rasterization improvements in a 60-second Reel.',
      rewardAmount: 50.0,
      status: BountyStatus.open,
      createdAt: DateTime.now().subtract(const Duration(hours: 18)),
    ),
    CreatorBounty(
      id: 'bounty_2',
      creatorId: 'c_synth_dev',
      creatorUsername: 'synth_coder',
      sponsorUsername: 'sarah_design',
      sponsorAvatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200',
      title: 'Speedrun 60s CSS / Flutter Art',
      description: 'Create a generative animated neon glowing sphere using CustomPainter.',
      rewardAmount: 35.0,
      status: BountyStatus.completed,
      fulfillmentUrl: 'https://interest.app/reel/reel_glow_sphere',
      createdAt: DateTime.now().subtract(const Duration(days: 2)),
      completedAt: DateTime.now().subtract(const Duration(hours: 4)),
    ),
    CreatorBounty(
      id: 'bounty_3',
      creatorId: 'c_synth_dev',
      creatorUsername: 'synth_coder',
      sponsorUsername: 'crypto_whale',
      sponsorAvatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200',
      title: 'Synthesize Cyberpunk Guitar Solo',
      description: 'Record an original synthwave lead riff over our retro beat track.',
      rewardAmount: 100.0,
      status: BountyStatus.inProgress,
      createdAt: DateTime.now().subtract(const Duration(days: 1)),
    ),
  ];

  List<CreatorBounty> get bounties => List.unmodifiable(_bounties);

  void createBounty({
    required String creatorId,
    required String creatorUsername,
    required String sponsorUsername,
    String? sponsorAvatarUrl,
    required String title,
    required String description,
    required double rewardAmount,
  }) {
    final bounty = CreatorBounty(
      id: 'bounty_${DateTime.now().millisecondsSinceEpoch}',
      creatorId: creatorId,
      creatorUsername: creatorUsername,
      sponsorUsername: sponsorUsername,
      sponsorAvatarUrl: sponsorAvatarUrl,
      title: title,
      description: description,
      rewardAmount: rewardAmount,
      status: BountyStatus.open,
      createdAt: DateTime.now(),
    );
    _bounties.insert(0, bounty);
    notifyListeners();
  }

  void fulfillBounty(String bountyId, String fulfillmentUrl) {
    final index = _bounties.indexWhere((b) => b.id == bountyId);
    if (index != -1) {
      _bounties[index] = _bounties[index].copyWith(
        status: BountyStatus.completed,
        fulfillmentUrl: fulfillmentUrl,
        completedAt: DateTime.now(),
      );
      notifyListeners();
    }
  }

  void releaseBountyPayout(String bountyId) {
    final index = _bounties.indexWhere((b) => b.id == bountyId);
    if (index != -1) {
      final bounty = _bounties[index];
      _bounties[index] = bounty.copyWith(
        status: BountyStatus.paidOut,
      );
      _availableBalance += (bounty.rewardAmount * 0.90); // 90% creator bounty payout
      notifyListeners();
    }
  }

  /// Cancels a subscription
  void cancelSubscription(String creatorId) {
    _activeSubscriptions.remove(creatorId);
    notifyListeners();
  }
}
