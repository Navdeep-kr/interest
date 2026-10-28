import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/core/theme/app_colors.dart';
import '../../domain/models/superfan_subscription_model.dart';
import '../../domain/services/superfans_manager.dart';

/// Instagram-style Creator Subscription Modal Sheet for Superfans.
class SuperfansSubscribeSheet extends StatefulWidget {
  final String creatorId;
  final String creatorUsername;
  final String? creatorAvatarUrl;
  final VoidCallback? onSubscribed;

  const SuperfansSubscribeSheet({
    super.key,
    required this.creatorId,
    required this.creatorUsername,
    this.creatorAvatarUrl,
    this.onSubscribed,
  });

  static void show(
    BuildContext context, {
    required String creatorId,
    required String creatorUsername,
    String? creatorAvatarUrl,
    VoidCallback? onSubscribed,
  }) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => SuperfansSubscribeSheet(
        creatorId: creatorId,
        creatorUsername: creatorUsername,
        creatorAvatarUrl: creatorAvatarUrl,
        onSubscribed: onSubscribed,
      ),
    );
  }

  @override
  State<SuperfansSubscribeSheet> createState() => _SuperfansSubscribeSheetState();
}

class _SuperfansSubscribeSheetState extends State<SuperfansSubscribeSheet> {
  SuperfanTier _selectedTier = SuperfanTier.fan;
  bool _isProcessing = false;

  void _handleSubscribe() async {
    setState(() => _isProcessing = true);
    await Future.delayed(const Duration(milliseconds: 600));

    SuperfansManager().subscribe(
      creatorId: widget.creatorId,
      creatorUsername: widget.creatorUsername,
      creatorAvatarUrl: widget.creatorAvatarUrl,
      tier: _selectedTier,
      price: _selectedTier.defaultPrice,
    );

    if (mounted) {
      setState(() => _isProcessing = false);
      Navigator.pop(context);
      widget.onSubscribed?.call();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.stars, color: AppColors.accentGold),
              const SizedBox(width: 8),
              Text('You are now a ${_selectedTier.title} of @${widget.creatorUsername}! 👑'),
            ],
          ),
          backgroundColor: const Color(0xFF6B21A8),
          duration: const Duration(seconds: 3),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Handle bar
            Container(
              width: 38,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.glassBorder,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 18),

            // Creator Header with Glowing Purple Ring & Crown
            Stack(
              alignment: Alignment.bottomRight,
              children: [
                Container(
                  padding: const EdgeInsets.all(3),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: const LinearGradient(
                      colors: [Color(0xFF9333EA), Color(0xFFC084FC), Color(0xFFF59E0B)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF9333EA).withOpacity(0.5),
                        blurRadius: 16,
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                  child: CircleAvatar(
                    radius: 36,
                    backgroundImage: widget.creatorAvatarUrl != null
                        ? appAvatarProvider(widget.creatorAvatarUrl)
                        : null,
                    backgroundColor: AppColors.surfaceElevated,
                    child: widget.creatorAvatarUrl == null
                        ? Text(
                            widget.creatorUsername.isNotEmpty ? widget.creatorUsername[0].toUpperCase() : '?',
                            style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                          )
                        : null,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(4),
                  decoration: const BoxDecoration(
                    color: Color(0xFF7E22CE),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.workspace_premium, color: Colors.amber, size: 20),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Title
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  'Subscribe to @${widget.creatorUsername}',
                  style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(width: 4),
                const Icon(Icons.verified, color: AppColors.accentCyan, size: 16),
              ],
            ),
            const SizedBox(height: 4),
            const Text(
              'Get exclusive content, badges, and closer access.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 18),

            // Tier selector tabs
            Row(
              children: SuperfanTier.values.map((tier) {
                final isSelected = _selectedTier == tier;
                return Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _selectedTier = tier),
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: isSelected ? const Color(0xFF7E22CE).withOpacity(0.3) : AppColors.surfaceElevated,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isSelected ? const Color(0xFFC084FC) : AppColors.glassBorder,
                          width: isSelected ? 1.5 : 1,
                        ),
                      ),
                      child: Column(
                        children: [
                          Text(
                            tier.title,
                            style: TextStyle(
                              color: isSelected ? Colors.white : AppColors.textSecondary,
                              fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                              fontSize: 12,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '\$${tier.defaultPrice.toStringAsFixed(2)}/mo',
                            style: TextStyle(
                              color: isSelected ? const Color(0xFFFACC15) : Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 16),

            // Perks Checklist for selected tier
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.surfaceElevated,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.glassBorder),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'INCLUDED PERKS',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.8),
                  ),
                  const SizedBox(height: 10),
                  ..._selectedTier.perks.map((perk) {
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 3.0),
                      child: Row(
                        children: [
                          const Icon(Icons.check_circle, color: Color(0xFFC084FC), size: 16),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              perk,
                              style: const TextStyle(color: Colors.white, fontSize: 12),
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Primary Subscribe CTA Button
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF9333EA),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(25)),
                  elevation: 6,
                  shadowColor: const Color(0xFF9333EA).withOpacity(0.6),
                ),
                onPressed: _isProcessing ? null : _handleSubscribe,
                child: _isProcessing
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                      )
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.stars, color: Colors.amber, size: 20),
                          const SizedBox(width: 8),
                          Text(
                            'Become a ${_selectedTier.title} • \$${_selectedTier.defaultPrice.toStringAsFixed(2)}/mo',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                          ),
                        ],
                      ),
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Recurring monthly charge. Cancel anytime in Settings > Subscriptions.',
              style: TextStyle(color: AppColors.textMuted, fontSize: 11),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
