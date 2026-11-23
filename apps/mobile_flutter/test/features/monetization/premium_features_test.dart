import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/monetization/domain/models/interest_plus_model.dart';
import 'package:mobile/features/monetization/domain/services/interest_plus_manager.dart';
import 'package:mobile/features/monetization/domain/models/creator_bounty_model.dart';
import 'package:mobile/features/monetization/domain/services/superfans_manager.dart';
import 'package:mobile/features/chat/domain/services/privacy_vault_manager.dart';
import 'package:mobile/features/reels/domain/models/shoppable_product_model.dart';

void main() {
  group('💎 Suite 1: Interest+ Subscription & Perks Tests', () {
    test('InterestPlusManager initializes and handles subscriptions', () {
      final manager = InterestPlusManager();
      expect(manager.isSubscribed, isFalse);

      manager.subscribe(InterestPlusPlan.monthly);
      expect(manager.isSubscribed, isTrue);
      expect(manager.streakFreezesRemaining, equals(2));

      // Test streak freeze
      final freezeUsed = manager.useStreakFreeze();
      expect(freezeUsed, isTrue);
      expect(manager.streakFreezesRemaining, equals(1));

      // Test ghost mode
      manager.toggleGhostMode(true);
      expect(manager.isGhostModeEnabled, isTrue);

      // Test pinning best friend
      manager.pinBestFriend('elena_rostova', emoji: '💖');
      expect(manager.pinnedBffUsername, equals('elena_rostova'));
      expect(manager.pinnedBffEmoji, equals('💖'));

      // Test custom app icons
      manager.setCustomAppIcon('neon_cyber');
      expect(manager.activeCustomAppIcon, equals('neon_cyber'));
    });
  });

  group('🎙️ Suite 3: Superfans Live Backstage & Bounties Tests', () {
    test('SuperfansManager handles creator bounties & payouts correctly', () {
      final manager = SuperfansManager();
      final initialBountiesCount = manager.bounties.length;
      expect(initialBountiesCount, greaterThan(0));

      // Create new bounty
      manager.createBounty(
        creatorId: 'c_synth_dev',
        creatorUsername: 'synth_coder',
        sponsorUsername: 'mobile_dev_fan',
        title: 'Review Impeller Engine Vulkan backend',
        description: 'Deep dive into 60fps frame rendering on Android',
        rewardAmount: 60.0,
      );

      expect(manager.bounties.length, equals(initialBountiesCount + 1));
      final created = manager.bounties.first;
      expect(created.title, equals('Review Impeller Engine Vulkan backend'));
      expect(created.status, equals(BountyStatus.open));

      // Fulfill bounty
      manager.fulfillBounty(created.id, 'https://interest.app/reel/submission_123');
      final fulfilled = manager.bounties.firstWhere((b) => b.id == created.id);
      expect(fulfilled.status, equals(BountyStatus.completed));
      expect(fulfilled.fulfillmentUrl, equals('https://interest.app/reel/submission_123'));

      // Release payout
      final initialBalance = manager.availableBalance;
      manager.releaseBountyPayout(created.id);
      final paid = manager.bounties.firstWhere((b) => b.id == created.id);
      expect(paid.status, equals(BountyStatus.paidOut));
      expect(manager.availableBalance, equals(initialBalance + (60.0 * 0.90)));
    });
  });

  group('🔐 Suite 4: Vault 2.0 & Privacy Stealth Chat Tests', () {
    test('PrivacyVaultManager correctly handles primary and decoy duress PINs', () {
      final vault = PrivacyVaultManager();
      expect(vault.isDecoyModeActive, isFalse);
      expect(vault.isFlagSecureEnabled, isTrue);

      // Test primary PIN
      final unlockPrimary = vault.unlockWithPin('1234');
      expect(unlockPrimary, isTrue);
      expect(vault.isDecoyModeActive, isFalse);

      // Test decoy PIN (Duress Mode)
      final unlockDecoy = vault.unlockWithPin('9999');
      expect(unlockDecoy, isTrue);
      expect(vault.isDecoyModeActive, isTrue);

      // Exit decoy mode
      vault.exitDecoyMode();
      expect(vault.isDecoyModeActive, isFalse);

      // Test invalid PIN
      final unlockInvalid = vault.unlockWithPin('0000');
      expect(unlockInvalid, isFalse);

      // Test FLAG_SECURE toggle
      vault.toggleFlagSecure(false);
      expect(vault.isFlagSecureEnabled, isFalse);
      vault.toggleFlagSecure(true);
      expect(vault.isFlagSecureEnabled, isTrue);
    });
  });

  group('🛍️ Suite 5: Shoppable Reels & Exclusive Drops Tests', () {
    test('ShoppableProduct correctly serializes and deserializes', () {
      const product = ShoppableProduct(
        id: 'prod_test_1',
        title: 'Cyberpunk LED Visor Pro',
        price: 49.99,
        originalPrice: 79.99,
        imageUrl: 'https://example.com/visor.png',
        merchantName: 'SynthWave Gear',
        rating: 4.9,
        reviewCount: 320,
        inStock: true,
        isSuperfanExclusiveDrop: true,
        dropEarlyAccessHours: 24,
        pinX: 0.25,
        pinY: 0.65,
      );

      final json = product.toJson();
      final fromJson = ShoppableProduct.fromJson(json);

      expect(fromJson.id, equals('prod_test_1'));
      expect(fromJson.title, equals('Cyberpunk LED Visor Pro'));
      expect(fromJson.price, equals(49.99));
      expect(fromJson.originalPrice, equals(79.99));
      expect(fromJson.isSuperfanExclusiveDrop, isTrue);
      expect(fromJson.dropEarlyAccessHours, equals(24));
    });
  });
}
