import 'package:flutter/foundation.dart';
import '../models/superfan_subscription_model.dart';

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

  /// Cancels a subscription
  void cancelSubscription(String creatorId) {
    _activeSubscriptions.remove(creatorId);
    notifyListeners();
  }
}
