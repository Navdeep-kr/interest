import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/monetization/domain/models/superfan_subscription_model.dart';
import 'package:mobile/features/monetization/domain/services/superfans_manager.dart';
import 'package:mobile/features/chat/domain/models/snap_models.dart';
import 'package:mobile/features/chat/domain/services/snap_manager.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Superfans (Instagram-style Creator Subscriptions) Tests', () {
    late SuperfansManager manager;

    setUp(() {
      manager = SuperfansManager();
    });

    test('Initial seeded subscriptions and members exist', () {
      expect(manager.recentSuperfans.isNotEmpty, isTrue);
      expect(manager.activeSuperfansCount, greaterThan(0));
      expect(manager.monthlyRecurringRevenue, greaterThan(0.0));
    });

    test('Subscribe to a creator activates superfan entitlement', () {
      const creatorId = 'c_art_dev';
      expect(manager.isSuperfanOf(creatorId), isFalse);

      manager.subscribe(
        creatorId: creatorId,
        creatorUsername: 'art_dev',
        tier: SuperfanTier.vip,
        price: 9.99,
      );

      expect(manager.isSuperfanOf(creatorId), isTrue);
      final sub = manager.getSubscriptionFor(creatorId);
      expect(sub, isNotNull);
      expect(sub!.tier, equals(SuperfanTier.vip));
      expect(sub.monthlyPriceDollars, equals(9.99));

      // Cancel subscription
      manager.cancelSubscription(creatorId);
      expect(manager.isSuperfanOf(creatorId), isFalse);
    });

    test('Tiers contain expected pricing and badge perks', () {
      expect(SuperfanTier.fan.defaultPrice, equals(4.99));
      expect(SuperfanTier.vip.defaultPrice, equals(9.99));
      expect(SuperfanTier.founder.defaultPrice, equals(19.99));

      expect(SuperfanTier.fan.perks.any((p) => p.contains('Superfan Badge')), isTrue);
      expect(SuperfanTier.vip.perks.any((p) => p.contains('VIP')), isTrue);
      expect(SuperfanTier.founder.perks.any((p) => p.contains('Founder')), isTrue);
    });
  });

  group('Snapchat Suite (Streaks, View Once, Screenshot Alerts) Tests', () {
    late SnapManager snapManager;

    setUp(() {
      snapManager = SnapManager();
    });

    test('Snap streak counts and at-risk statuses are loaded', () {
      final streak1 = snapManager.getStreak('conv_direct_1');
      expect(streak1, isNotNull);
      expect(streak1!.streakDays, equals(14));
      expect(streak1.isAtRisk, isFalse);

      final streakAtRisk = snapManager.getStreak('conv_direct_3');
      expect(streakAtRisk, isNotNull);
      expect(streakAtRisk!.isAtRisk, isTrue);
      expect(streakAtRisk.streakDays, equals(21));
    });

    test('Sending a Snap increments the Snap streak count', () {
      const convId = 'conv_direct_1';
      final initialDays = snapManager.getStreak(convId)!.streakDays;

      snapManager.sendSnap(
        conversationId: convId,
        recipientUsername: 'elena_rostova',
        mediaUrl: 'https://example.com/snap.jpg',
        caption: 'Streak kept! 🔥',
        lens: SnapLensType.cyberpunk,
        isViewOnce: true,
        durationSeconds: 10.0,
      );

      final updatedStreak = snapManager.getStreak(convId);
      expect(updatedStreak!.streakDays, equals(initialDays + 1));
      expect(updatedStreak.isAtRisk, isFalse);
    });

    test('Screenshot detection records security alert', () {
      expect(snapManager.activeScreenshotAlert, isNull);

      snapManager.recordScreenshotAlert('marcus_chen');
      expect(snapManager.activeScreenshotAlert, isNotNull);
      expect(snapManager.activeScreenshotAlert!.contains('marcus_chen'), isTrue);

      snapManager.clearScreenshotAlert();
      expect(snapManager.activeScreenshotAlert, isNull);
    });

    test('View-once snap viewing and replay tracking', () {
      final snap = snapManager.getSnap('snap_incoming_1');
      expect(snap, isNotNull);
      expect(snap!.isViewed, isFalse);

      snapManager.markSnapViewed(snap.id);
      expect(snapManager.getSnap(snap.id)!.isViewed, isTrue);

      snapManager.replaySnap(snap.id);
      expect(snapManager.getSnap(snap.id)!.isReplayed, isTrue);
    });
  });
}
