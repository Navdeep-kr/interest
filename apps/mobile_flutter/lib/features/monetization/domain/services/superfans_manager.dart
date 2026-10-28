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

  /// Cancels a subscription
  void cancelSubscription(String creatorId) {
    _activeSubscriptions.remove(creatorId);
    notifyListeners();
  }
}
