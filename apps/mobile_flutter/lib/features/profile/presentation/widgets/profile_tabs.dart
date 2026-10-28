import 'package:flutter/material.dart';
import '../../../../core/media/optimized_network_image.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/models/user_profile.dart';
import '../../domain/models/profile_reel_item.dart';

class ProfileTabs extends StatelessWidget {
  final UserProfile profile;
  final bool isMe;
  final String selectedTab;
  final List<ProfileReelItem> reels;
  final List<ProfileReelItem> likedReels;
  final bool isLoadingReels;
  final ValueChanged<String> onTabChanged;

  const ProfileTabs({
    super.key,
    required this.profile,
    required this.isMe,
    required this.selectedTab,
    required this.reels,
    required this.likedReels,
    required this.isLoadingReels,
    required this.onTabChanged,
  });

  Widget _buildTabButton({
    required IconData icon,
    required String label,
    required String tabKey,
  }) {
    final isSelected = selectedTab == tabKey;
    return Expanded(
      child: InkWell(
        onTap: () => onTabChanged(tabKey),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: isSelected ? AppColors.primary : Colors.transparent,
                width: 2,
              ),
            ),
          ),
          child: Icon(
            icon,
            size: 22,
            color: isSelected ? AppColors.primary : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }

  Widget _buildReelsGrid(List<ProfileReelItem> items, String emptyMessage) {
    if (isLoadingReels) {
      return const Padding(
        padding: EdgeInsets.all(32.0),
        child: Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
      );
    }

    if (items.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(48.0),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.movie_creation_outlined,
                size: 48,
                color: AppColors.textMuted,
              ),
              const SizedBox(height: 12),
              Text(
                emptyMessage,
                style: const TextStyle(
                  fontSize: 14,
                  color: AppColors.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    return GridView.builder(
      physics: const NeverScrollableScrollPhysics(),
      shrinkWrap: true,
      padding: const EdgeInsets.all(1),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 1.5,
        mainAxisSpacing: 1.5,
        childAspectRatio: 0.65,
      ),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final reel = items[index];
        return Container(
          decoration: BoxDecoration(
            color: AppColors.surfaceElevated,
            image: reel.thumbnailUrl != null && reel.thumbnailUrl!.isNotEmpty
                ? DecorationImage(
                    image: appAvatarProvider(reel.thumbnailUrl, targetWidth: 300, targetHeight: 450)!,
                    fit: BoxFit.cover,
                  )
                : null,
          ),
          child: Stack(
            children: [
              if (reel.thumbnailUrl == null || reel.thumbnailUrl!.isEmpty)
                Center(
                  child: Padding(
                    padding: const EdgeInsets.all(8.0),
                    child: Text(
                      reel.title,
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.textSecondary,
                      ),
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
              Positioned(
                bottom: 4,
                left: 4,
                child: Row(
                  children: [
                    const Icon(Icons.play_arrow, size: 14, color: Colors.white),
                    const SizedBox(width: 2),
                    Text(
                      '${reel.viewCount}',
                      style: const TextStyle(
                        fontSize: 11,
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildPrivateAccountGate() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32.0, vertical: 48.0),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.glassBorder, width: 2),
                color: AppColors.surfaceElevated,
              ),
              child: const Icon(
                Icons.lock_outline,
                size: 40,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'This Account is Private',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Follow this account to see their published reels and collections.',
              style: TextStyle(
                fontSize: 13,
                color: AppColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // If account is private and viewer is not owner and not following, display private gate
    final isGated = profile.isPrivate && !isMe && !profile.isFollowing;

    if (isGated) {
      return _buildPrivateAccountGate();
    }

    return Column(
      children: [
        // Tab Navigation Bar
        Container(
          decoration: const BoxDecoration(
            border: Border(
              bottom: BorderSide(color: AppColors.glassBorder),
            ),
          ),
          child: Row(
            children: [
              _buildTabButton(
                icon: Icons.movie_outlined,
                label: 'Reels',
                tabKey: 'reels',
              ),
              _buildTabButton(
                icon: Icons.grid_on,
                label: 'Posts',
                tabKey: 'posts',
              ),
              _buildTabButton(
                icon: Icons.bookmark_border,
                label: 'Saved',
                tabKey: 'saved',
              ),
              if (isMe)
                _buildTabButton(
                  icon: Icons.favorite_border,
                  label: 'Liked',
                  tabKey: 'liked',
                ),
            ],
          ),
        ),

        // Tab Content
        if (selectedTab == 'reels')
          _buildReelsGrid(reels, 'No reels published yet.')
        else if (selectedTab == 'posts')
          _buildReelsGrid(reels, 'No photo posts published yet.')
        else if (selectedTab == 'saved')
          const Padding(
            padding: EdgeInsets.all(48.0),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.collections_bookmark_outlined,
                    size: 44,
                    color: AppColors.textMuted,
                  ),
                  SizedBox(height: 12),
                  Text(
                    'Saved collections are organized privately.',
                    style: TextStyle(
                      fontSize: 14,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          )
        else if (selectedTab == 'liked')
          _buildReelsGrid(likedReels, 'No liked reels yet.'),
      ],
    );
  }
}
