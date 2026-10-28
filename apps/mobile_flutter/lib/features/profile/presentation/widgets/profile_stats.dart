import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/models/user_profile.dart';

class ProfileStats extends StatelessWidget {
  final UserProfile profile;

  const ProfileStats({
    super.key,
    required this.profile,
  });

  String _formatNumber(int count) {
    if (count < 0) return '–';
    if (count >= 1000000) {
      return '${(count / 1000000).toStringAsFixed(1)}M';
    }
    if (count >= 1000) {
      return '${(count / 1000).toStringAsFixed(1)}K';
    }
    return count.toString();
  }

  Widget _buildStatColumn(String label, String value) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          value,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            color: AppColors.textSecondary,
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12.0),
      margin: const EdgeInsets.symmetric(horizontal: 16.0),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _buildStatColumn('Reels', _formatNumber(profile.reelsCount)),
          Container(
            height: 24,
            width: 1,
            color: AppColors.glassBorder,
          ),
          _buildStatColumn('Followers', _formatNumber(profile.followersCount)),
          Container(
            height: 24,
            width: 1,
            color: AppColors.glassBorder,
          ),
          _buildStatColumn('Following', _formatNumber(profile.followingCount)),
        ],
      ),
    );
  }
}
