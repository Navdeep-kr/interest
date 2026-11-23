import 'package:flutter/material.dart';
import 'package:mobile/core/theme/app_colors.dart';
import '../../domain/models/superfan_subscription_model.dart';
import '../../domain/services/superfans_manager.dart';

class CreatorGiftSheet extends StatefulWidget {
  final String creatorId;
  final String creatorUsername;
  final String? creatorAvatarUrl;

  const CreatorGiftSheet({
    super.key,
    required this.creatorId,
    required this.creatorUsername,
    this.creatorAvatarUrl,
  });

  static Future<void> show(
    BuildContext context, {
    required String creatorId,
    required String creatorUsername,
    String? creatorAvatarUrl,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => CreatorGiftSheet(
        creatorId: creatorId,
        creatorUsername: creatorUsername,
        creatorAvatarUrl: creatorAvatarUrl,
      ),
    );
  }

  @override
  State<CreatorGiftSheet> createState() => _CreatorGiftSheetState();
}

class _CreatorGiftSheetState extends State<CreatorGiftSheet> {
  CreatorGift _selectedGift = CreatorGift.availableGifts[0];
  bool _isSending = false;

  void _handleSendGift() async {
    setState(() => _isSending = true);
    await Future.delayed(const Duration(milliseconds: 300));

    SuperfansManager().sendGift(
      creatorId: widget.creatorId,
      creatorName: widget.creatorUsername,
      gift: _selectedGift,
    );

    if (!mounted) return;
    Navigator.of(context).pop();

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Text(_selectedGift.emoji, style: const TextStyle(fontSize: 22)),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Sent ${_selectedGift.name} (\$${_selectedGift.price}) to @${widget.creatorUsername}!',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
        backgroundColor: Colors.purple.shade900,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      decoration: BoxDecoration(
        color: AppColors.backgroundSecondary,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border.all(color: Colors.white12),
      ),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                CircleAvatar(
                  radius: 18,
                  backgroundColor: AppColors.primary,
                  backgroundImage: widget.creatorAvatarUrl != null
                      ? NetworkImage(widget.creatorAvatarUrl!)
                      : null,
                  child: widget.creatorAvatarUrl == null
                      ? Text(widget.creatorUsername[0].toUpperCase())
                      : null,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Send Gift to @${widget.creatorUsername}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const Text(
                        'Support your favorite creator with instant tips',
                        style: TextStyle(color: AppColors.textSecondary, fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Gift Options Grid
            Wrap(
              spacing: 10,
              runSpacing: 10,
              alignment: WrapAlignment.center,
              children: CreatorGift.availableGifts.map((gift) {
                final isSelected = _selectedGift.id == gift.id;
                return GestureDetector(
                  onTap: () => setState(() => _selectedGift = gift),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    width: 90,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: isSelected ? AppColors.primary.withOpacity(0.2) : AppColors.surface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: isSelected ? AppColors.primary : Colors.white12,
                        width: isSelected ? 2 : 1,
                      ),
                      boxShadow: isSelected
                          ? [
                              BoxShadow(
                                color: AppColors.primary.withOpacity(0.3),
                                blurRadius: 10,
                                spreadRadius: 1,
                              )
                            ]
                          : null,
                    ),
                    child: Column(
                      children: [
                        Text(gift.emoji, style: const TextStyle(fontSize: 28)),
                        const SizedBox(height: 4),
                        Text(
                          gift.name,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '\$${gift.price.toStringAsFixed(2)}',
                          style: const TextStyle(
                            color: AppColors.accentGold,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 24),

            // Send Button
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: _isSending ? null : _handleSendGift,
                child: _isSending
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(_selectedGift.emoji, style: const TextStyle(fontSize: 18)),
                          const SizedBox(width: 8),
                          Text(
                            'Send ${_selectedGift.name} (\$${_selectedGift.price.toStringAsFixed(2)})',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
