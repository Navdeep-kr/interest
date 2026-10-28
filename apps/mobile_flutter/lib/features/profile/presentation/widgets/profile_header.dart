import 'package:flutter/material.dart';
import '../../../../core/media/optimized_network_image.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../monetization/domain/services/superfans_manager.dart';
import '../../../monetization/presentation/widgets/superfans_subscribe_sheet.dart';
import '../../domain/models/user_profile.dart';

class ProfileHeader extends StatelessWidget {
  final UserProfile profile;
  final bool isMe;
  final bool isFollowActionInProgress;
  final VoidCallback onFollowPressed;
  final VoidCallback onEditProfilePressed;

  const ProfileHeader({
    super.key,
    required this.profile,
    required this.isMe,
    required this.isFollowActionInProgress,
    required this.onFollowPressed,
    required this.onEditProfilePressed,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              // Avatar
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.primary, width: 2),
                  image: profile.avatarUrl != null && profile.avatarUrl!.isNotEmpty
                      ? DecorationImage(
                          image: appAvatarProvider(profile.avatarUrl)!,
                          fit: BoxFit.cover,
                        )
                      : null,
                  color: AppColors.surfaceElevated,
                ),
                child: profile.avatarUrl == null || profile.avatarUrl!.isEmpty
                    ? Center(
                        child: Text(
                          profile.displayName.isNotEmpty
                              ? profile.displayName.substring(0, 1).toUpperCase()
                              : '?',
                          style: const TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      )
                    : null,
              ),
              const SizedBox(width: 16),
              // Names & Badges
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            profile.displayName,
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: AppColors.textPrimary,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (profile.isPrivate) ...[
                          const SizedBox(width: 6),
                          const Icon(
                            Icons.lock_outline,
                            size: 16,
                            color: AppColors.textSecondary,
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '@${profile.username}',
                      style: const TextStyle(
                        fontSize: 14,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    // Snapchat-style Snap Score badge
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.amber.withOpacity(0.18),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.amber.withOpacity(0.6), width: 0.8),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text('🔥', style: TextStyle(fontSize: 10)),
                          SizedBox(width: 3),
                          Text(
                            'Snap Score: 24,850',
                            style: TextStyle(color: Colors.amber, fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),
                    if (profile.isRestricted) ...[
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.warning.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text(
                          'Restricted',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: AppColors.warning,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),

          // Bio (Strict Zero-Location sanitized)
          if (profile.bio != null && profile.bio!.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              profile.bio!,
              style: const TextStyle(
                fontSize: 14,
                color: AppColors.textPrimary,
                height: 1.4,
              ),
            ),
          ],

          // Social Links
          if (profile.links.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: profile.links.map((link) {
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceElevated,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.glassBorder),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.link, size: 14, color: AppColors.accentCyan),
                      const SizedBox(width: 4),
                      Text(
                        link.title,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.accentCyan,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ],

          const SizedBox(height: 16),

          // Action Button (Edit Profile or Follow / Requested / Following + Superfans)
          SizedBox(
            width: double.infinity,
            height: 40,
            child: isMe
                ? OutlinedButton(
                    onPressed: onEditProfilePressed,
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: AppColors.glassBorder),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: const Text(
                      'Edit Profile',
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  )
                : Row(
                    children: [
                      Expanded(
                        child: ElevatedButton(
                          onPressed: isFollowActionInProgress ? null : onFollowPressed,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: profile.isFollowing
                                ? AppColors.surfaceElevated
                                : profile.hasPendingRequest
                                    ? AppColors.surface
                                    : AppColors.primary,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                              side: profile.isFollowing || profile.hasPendingRequest
                                  ? const BorderSide(color: AppColors.glassBorder)
                                  : BorderSide.none,
                            ),
                          ),
                          child: isFollowActionInProgress
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: AppColors.textPrimary,
                                  ),
                                )
                              : Text(
                                  profile.isFollowing
                                      ? (profile.isMutual ? 'Mutuals' : 'Following')
                                      : profile.hasPendingRequest
                                          ? 'Requested'
                                          : 'Follow',
                                  style: TextStyle(
                                    color: profile.hasPendingRequest
                                        ? AppColors.textSecondary
                                        : AppColors.textPrimary,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      // Superfans Subscribe Button (Instagram-style Creator Subscription)
                      AnimatedBuilder(
                        animation: SuperfansManager(),
                        builder: (ctx, _) {
                          final isSuperfan = SuperfansManager().isSuperfanOf(profile.id);
                          return ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: isSuperfan ? const Color(0xFF581C87) : const Color(0xFF9333EA),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
                                side: BorderSide(color: isSuperfan ? Colors.amber : const Color(0xFFC084FC)),
                              ),
                            ),
                            icon: Icon(
                              isSuperfan ? Icons.workspace_premium : Icons.stars,
                              color: Colors.amber,
                              size: 16,
                            ),
                            label: Text(
                              isSuperfan ? 'Superfan 👑' : 'Superfans ⭐',
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                            ),
                            onPressed: () {
                              SuperfansSubscribeSheet.show(
                                context,
                                creatorId: profile.id,
                                creatorUsername: profile.username,
                                creatorAvatarUrl: profile.avatarUrl,
                              );
                            },
                          );
                        },
                      ),
                    ],
                  ),
          ),

          const SizedBox(height: 18),

          // Story Highlights Bar (Instagram / Snapchat feature)
          SizedBox(
            height: 90,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                if (isMe)
                  _buildHighlightItem(
                    context,
                    title: 'New',
                    icon: Icons.add,
                    isAdd: true,
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Create a new Story Highlight collection')),
                      );
                    },
                  ),
                _buildHighlightItem(
                  context,
                  title: '⚡ Best Reels',
                  icon: Icons.bolt,
                  imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200',
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Playing "Best Reels" Story Highlight')),
                    );
                  },
                ),
                _buildHighlightItem(
                  context,
                  title: '💡 Tech Tips',
                  icon: Icons.lightbulb_outline,
                  imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=200',
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Playing "Tech Tips" Story Highlight')),
                    );
                  },
                ),
                _buildHighlightItem(
                  context,
                  title: '🎨 UI Design',
                  icon: Icons.palette_outlined,
                  imageUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=200',
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Playing "UI Design" Story Highlight')),
                    );
                  },
                ),
                _buildHighlightItem(
                  context,
                  title: '🎙️ Podcasts',
                  icon: Icons.mic_none,
                  imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200',
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Playing "Podcasts" Story Highlight')),
                    );
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHighlightItem(
    BuildContext context, {
    required String title,
    required IconData icon,
    String? imageUrl,
    bool isAdd = false,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 70,
        margin: const EdgeInsets.only(right: 14),
        child: Column(
          children: [
            Container(
              width: 62,
              height: 62,
              padding: const EdgeInsets.all(2.5),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: isAdd ? AppColors.glassBorder : AppColors.primary,
                  width: 1.5,
                ),
              ),
              child: CircleAvatar(
                backgroundColor: AppColors.surfaceElevated,
                backgroundImage: appAvatarProvider(imageUrl),
                child: imageUrl == null
                    ? Icon(icon, color: isAdd ? AppColors.textPrimary : Colors.white, size: 24)
                    : null,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              title,
              style: const TextStyle(color: AppColors.textPrimary, fontSize: 11, fontWeight: FontWeight.w500),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
