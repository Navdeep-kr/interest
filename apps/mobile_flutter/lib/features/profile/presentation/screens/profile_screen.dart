import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import 'package:mobile/features/stories/domain/models/story_highlight_model.dart';
import 'package:mobile/features/stories/presentation/widgets/story_highlights_tray.dart';
import 'package:mobile/features/media/presentation/screens/offline_vault_screen.dart';
import 'saved_collections_screen.dart';
import '../profile_notifier.dart';
import '../profile_state.dart';
import '../widgets/profile_header.dart';
import '../widgets/profile_stats.dart';
import '../widgets/profile_tabs.dart';
import 'edit_profile_screen.dart';
import 'follow_requests_screen.dart';

class ProfileScreen extends StatefulWidget {
  final ProfileNotifier notifier;
  final String identifier;
  final bool isMe;

  const ProfileScreen({
    super.key,
    required this.notifier,
    required this.identifier,
    this.isMe = false,
  });

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  @override
  void initState() {
    super.initState();
    widget.notifier.loadProfile(widget.identifier, isMe: widget.isMe);
  }

  void _showProfileOptionsMenu(BuildContext context, ProfileLoadedState state) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                margin: const EdgeInsets.only(top: 8, bottom: 8),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.glassBorder,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              if (widget.isMe) ...[
                ListTile(
                  leading: const Icon(Icons.person_add_outlined, color: AppColors.textPrimary),
                  title: const Text('Follow Requests', style: TextStyle(color: AppColors.textPrimary)),
                  onTap: () {
                    Navigator.pop(ctx);
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => FollowRequestsScreen(
                          repository: widget.notifier.repository,
                        ),
                      ),
                    );
                  },
                ),
              ] else ...[
                ListTile(
                  leading: Icon(
                    state.profile.isRestricted
                        ? Icons.remove_circle_outline
                        : Icons.block_outlined,
                    color: AppColors.warning,
                  ),
                  title: Text(
                    state.profile.isRestricted ? 'Unrestrict User' : 'Restrict User',
                    style: const TextStyle(color: AppColors.textPrimary),
                  ),
                  subtitle: const Text(
                    'Shadow limits interactions without alerting the user',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                  ),
                  onTap: () async {
                    Navigator.pop(ctx);
                    final messenger = ScaffoldMessenger.of(context);
                    await widget.notifier.toggleRestrict();
                    if (!mounted) return;
                    messenger.showSnackBar(
                      SnackBar(
                        content: Text(
                          state.profile.isRestricted
                              ? 'User unrestricted'
                              : 'User restricted silently',
                        ),
                        backgroundColor: AppColors.surfaceElevated,
                      ),
                    );
                  },
                ),
              ],
              ListTile(
                leading: const Icon(Icons.download_done, color: AppColors.accentPink),
                title: const Text('Offline Media & Secret Vault', style: TextStyle(color: AppColors.textPrimary)),
                subtitle: const Text('Access offline downloaded reels, MP3s and PIN vault', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                onTap: () {
                  Navigator.pop(ctx);
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const OfflineVaultScreen()));
                },
              ),
              ListTile(
                leading: const Icon(Icons.bookmark_outline, color: AppColors.brandPrimary),
                title: const Text('Saved Collections', style: TextStyle(color: AppColors.textPrimary)),
                subtitle: const Text('Organized folders of bookmarked reels and posts', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                onTap: () {
                  Navigator.pop(ctx);
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const SavedCollectionsScreen()));
                },
              ),
              ListTile(
                leading: const Icon(Icons.share_outlined, color: AppColors.textPrimary),
                title: const Text('Share Profile', style: TextStyle(color: AppColors.textPrimary)),
                onTap: () {
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Profile link copied to clipboard'),
                      backgroundColor: AppColors.surfaceElevated,
                    ),
                  );
                },
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.notifier,
      builder: (context, _) {
        final state = widget.notifier.state;

        return Scaffold(
          backgroundColor: AppColors.background,
          appBar: AppBar(
            backgroundColor: AppColors.background,
            elevation: 0,
            leading: Navigator.canPop(context)
                ? IconButton(
                    icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
                    onPressed: () => Navigator.pop(context),
                  )
                : null,
            title: Text(
              state is ProfileLoadedState ? '@${state.profile.username}' : 'Profile',
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.bold,
                fontSize: 18,
              ),
            ),
            actions: [
              if (state is ProfileLoadedState)
                IconButton(
                  icon: const Icon(Icons.more_vert, color: AppColors.textPrimary),
                  onPressed: () => _showProfileOptionsMenu(context, state),
                ),
            ],
          ),
          body: _buildBody(state),
        );
      },
    );
  }

  Widget _buildBody(ProfileState state) {
    if (state is ProfileLoadingState) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      );
    }

    if (state is ProfileErrorState) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                state.isNotFound ? Icons.person_off_outlined : Icons.error_outline,
                size: 56,
                color: AppColors.error,
              ),
              const SizedBox(height: 16),
              Text(
                state.isNotFound ? 'User Not Found' : 'Something went wrong',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                state.message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 14,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () => widget.notifier.refresh(),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                ),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (state is ProfileLoadedState) {
      final profile = state.profile;

      return RefreshIndicator(
        color: AppColors.primary,
        backgroundColor: AppColors.surface,
        onRefresh: () => widget.notifier.refresh(),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            children: [
              ProfileHeader(
                profile: profile,
                isMe: widget.isMe,
                isFollowActionInProgress: state.isFollowActionInProgress,
                onFollowPressed: () => widget.notifier.toggleFollow(),
                onEditProfilePressed: () async {
                  final result = await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => EditProfileScreen(
                        profile: profile,
                        notifier: widget.notifier,
                      ),
                    ),
                  );
                  if (result == true) {
                    widget.notifier.refresh();
                  }
                },
              ),
              ProfileStats(profile: profile),
              const SizedBox(height: 8),
              StoryHighlightsTray(
                isMe: widget.isMe,
                highlights: [
                  StoryHighlightModel(
                    id: 'hl_1',
                    title: 'Design 🎨',
                    coverUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=200',
                    storyIds: const ['s1', 's2'],
                    storyCount: 2,
                    createdAt: DateTime.now(),
                  ),
                  StoryHighlightModel(
                    id: 'hl_2',
                    title: 'Tech 💻',
                    coverUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=200',
                    storyIds: const ['s3', 's4'],
                    storyCount: 2,
                    createdAt: DateTime.now(),
                  ),
                  StoryHighlightModel(
                    id: 'hl_3',
                    title: 'Vlogs ✈️',
                    coverUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
                    storyIds: const ['s5'],
                    storyCount: 1,
                    createdAt: DateTime.now(),
                  ),
                  StoryHighlightModel(
                    id: 'hl_4',
                    title: 'Tips 💡',
                    coverUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
                    storyIds: const ['s6'],
                    storyCount: 1,
                    createdAt: DateTime.now(),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              ProfileTabs(
                profile: profile,
                isMe: widget.isMe,
                selectedTab: state.selectedTab,
                reels: state.reels,
                likedReels: state.likedReels,
                isLoadingReels: state.isLoadingReels,
                onTabChanged: (tab) => widget.notifier.switchTab(tab),
              ),
            ],
          ),
        ),
      );
    }

    return const SizedBox.shrink();
  }
}
