import 'dart:ui';
import 'package:flutter/material.dart';
import 'superfans_subscribe_sheet.dart';

/// Frosted Glass Paywall Overlay Card for Superfan-Exclusive Reels & Posts.
class SuperfansPaywallCard extends StatelessWidget {
  final String creatorId;
  final String creatorUsername;
  final String? creatorAvatarUrl;
  final VoidCallback? onUnlocked;

  const SuperfansPaywallCard({
    super.key,
    required this.creatorId,
    required this.creatorUsername,
    this.creatorAvatarUrl,
    this.onUnlocked,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: Container(
          color: Colors.black.withOpacity(0.72),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Glowing Crown Icon
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: const LinearGradient(
                    colors: [Color(0xFF9333EA), Color(0xFFC084FC)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF9333EA).withOpacity(0.5),
                      blurRadius: 24,
                      spreadRadius: 4,
                    ),
                  ],
                ),
                child: const Icon(Icons.workspace_premium, color: Colors.amber, size: 44),
              ),
              const SizedBox(height: 18),

              // Title
              const Text(
                'Superfan Exclusive Content',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  letterSpacing: -0.5,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),

              // Description
              Text(
                'Only @$creatorUsername\'s subscribed Superfans have access to view this exclusive reel and future subscriber content.',
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 13,
                  height: 1.4,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),

              // Unlock CTA Button
              SizedBox(
                width: 250,
                height: 46,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF9333EA),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(23)),
                    elevation: 6,
                  ),
                  icon: const Icon(Icons.stars, color: Colors.amber, size: 18),
                  label: const Text(
                    'Subscribe to Unlock',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                  onPressed: () {
                    SuperfansSubscribeSheet.show(
                      context,
                      creatorId: creatorId,
                      creatorUsername: creatorUsername,
                      creatorAvatarUrl: creatorAvatarUrl,
                      onSubscribed: onUnlocked,
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
