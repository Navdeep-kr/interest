import 'package:flutter/material.dart';
import 'package:mobile/core/media/media_preload_manager.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/reels/domain/models/reel_item_model.dart';
import 'package:mobile/features/reels/presentation/reels_notifier.dart';
import 'package:mobile/features/reels/presentation/reels_state.dart';
import 'package:mobile/features/reels/presentation/widgets/reel_card.dart';
import 'package:mobile/features/reels/presentation/widgets/comments_bottom_sheet.dart';
import 'package:mobile/features/media/presentation/screens/upload_video_screen.dart';
import 'package:mobile/features/stories/data/stories_repository.dart';
import 'package:mobile/features/stories/domain/models/story_models.dart';
import 'package:mobile/features/stories/presentation/stories_tray_notifier.dart';
import 'package:mobile/features/stories/presentation/widgets/stories_tray_widget.dart';
import 'package:mobile/features/stories/presentation/screens/story_player_screen.dart';
import 'package:mobile/features/stories/presentation/screens/story_composer_screen.dart';
import 'create_post_screen.dart';

class FeedScreen extends StatefulWidget {
  final ReelsNotifier notifier;
  final StoriesRepository? storiesRepository;
  final String? currentUserId;
  final String? authToken;

  const FeedScreen({
    super.key,
    required this.notifier,
    this.storiesRepository,
    this.currentUserId,
    this.authToken,
  });

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> with WidgetsBindingObserver {
  final PageController _pageController = PageController();
  int _currentPageIndex = 0;
  StoriesTrayNotifier? _storiesNotifier;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    widget.notifier.addListener(_onNotifierUpdate);
    widget.notifier.loadFeed();

    if (widget.storiesRepository != null) {
      _storiesNotifier = StoriesTrayNotifier(repository: widget.storiesRepository!);
      _storiesNotifier!.addListener(_onNotifierUpdate);
      _storiesNotifier!.loadTray(token: widget.authToken);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    widget.notifier.removeListener(_onNotifierUpdate);
    _storiesNotifier?.removeListener(_onNotifierUpdate);
    _storiesNotifier?.dispose();
    _pageController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState appState) {
    if (appState == AppLifecycleState.paused || appState == AppLifecycleState.inactive) {
      MediaPreloadManager().pause();
    } else if (appState == AppLifecycleState.resumed) {
      MediaPreloadManager().resume();
    }
  }

  void _onNotifierUpdate() {
    if (!mounted) return;
    setState(() {});
  }

  void _openStoryPlayer(CreatorStoryTrayModel creatorTray) {
    if (widget.storiesRepository == null) return;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => StoryPlayerScreen(
          stories: creatorTray.stories,
          initialIndex: 0,
          currentUserId: widget.currentUserId,
          authToken: widget.authToken,
          repository: widget.storiesRepository!,
          onFinished: () {
            _storiesNotifier?.loadTray(token: widget.authToken);
          },
        ),
      ),
    );
  }

  void _openStoryComposer() {
    if (widget.storiesRepository == null) return;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => StoryComposerScreen(
          repository: widget.storiesRepository!,
          authToken: widget.authToken,
          onStoryCreated: (newStory) {
            _storiesNotifier?.loadTray(token: widget.authToken);
          },
        ),
      ),
    );
  }

  void _showComments(ReelItemModel reel) {
    widget.notifier.loadComments(reel.id);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return AnimatedBuilder(
          animation: widget.notifier,
          builder: (context, _) {
            final detailState = widget.notifier.detailState;
            final comments = detailState is ReelDetailLoadedState ? detailState.comments : <dynamic>[];
            final isLoading = detailState is ReelDetailLoadedState ? detailState.isLoadingComments : false;

            return CommentsBottomSheet(
              reelId: reel.id,
              comments: comments.cast(),
              isLoading: isLoading,
              onPostComment: (text, parentId) {
                widget.notifier.postComment(reel.id, text, parentId: parentId);
              },
              onDeleteComment: (commentId) {
                widget.notifier.deleteComment(reel.id, commentId);
              },
            );
          },
        );
      },
    );
  }

  void _showShareSheet(ReelItemModel reel) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 16.0, horizontal: 16.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: AppColors.textMuted.withOpacity(0.4),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const Text(
                  'Share to Direct Message',
                  style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 14),
                // Quick send contacts row
                SizedBox(
                  height: 84,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: [
                      _buildQuickSendItem(ctx, 'Alex R.', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'),
                      _buildQuickSendItem(ctx, 'Sarah C.', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200'),
                      _buildQuickSendItem(ctx, 'Elena R.', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200'),
                      _buildQuickSendItem(ctx, 'David K.', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200'),
                    ],
                  ),
                ),
                const Divider(color: AppColors.glassBorder),
                ListTile(
                  leading: const Icon(Icons.link, color: AppColors.accentCyan),
                  title: const Text('Copy Post Link', style: TextStyle(color: Colors.white)),
                  onTap: () {
                    Navigator.pop(ctx);
                    widget.notifier.shareReel(reel.id);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Link copied to clipboard!')),
                    );
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.bolt, color: AppColors.accentPink),
                  title: const Text('Add to Your 24h Story', style: TextStyle(color: Colors.white)),
                  onTap: () {
                    Navigator.pop(ctx);
                    _openStoryComposer();
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildQuickSendItem(BuildContext ctx, String name, String avatarUrl) {
    return GestureDetector(
      onTap: () {
        Navigator.pop(ctx);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Sent post to $name via Direct Message!')),
        );
      },
      child: Container(
        width: 72,
        margin: const EdgeInsets.only(right: 12),
        child: Column(
          children: [
            CircleAvatar(
              radius: 25,
              backgroundImage: appAvatarProvider(avatarUrl),
            ),
            const SizedBox(height: 4),
            Text(
              name,
              style: const TextStyle(color: Colors.white, fontSize: 11),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  void _showMoreMenu(ReelItemModel reel) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.backgroundSecondary,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.thumb_down_outlined, color: AppColors.textPrimary),
                title: const Text('Not interested in this', style: TextStyle(color: AppColors.textPrimary)),
                subtitle: const Text(
                  'Tune feed recommendations to see fewer posts like this',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                ),
                onTap: () {
                  Navigator.of(ctx).pop();
                  widget.notifier.markNotInterested(reel.id, interestId: reel.primaryInterestId);
                },
              ),
              ListTile(
                leading: const Icon(Icons.visibility_off, color: AppColors.textPrimary),
                title: const Text('Hide this post', style: TextStyle(color: AppColors.textPrimary)),
                subtitle: const Text(
                  'Remove this specific post from your feed',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                ),
                onTap: () {
                  Navigator.of(ctx).pop();
                  widget.notifier.hideReel(reel.id);
                },
              ),
              ListTile(
                leading: Icon(
                  reel.isPinned ? Icons.push_pin_outlined : Icons.push_pin,
                  color: AppColors.accentGold,
                ),
                title: Text(
                  reel.isPinned ? 'Unpin post' : 'Pin to profile',
                  style: const TextStyle(color: AppColors.textPrimary),
                ),
                onTap: () {
                  Navigator.of(ctx).pop();
                  widget.notifier.togglePin(reel.id);
                },
              ),
              ListTile(
                leading: const Icon(Icons.tune_outlined, color: AppColors.textPrimary),
                title: const Text('Reset feed recommendations', style: TextStyle(color: AppColors.textPrimary)),
                subtitle: const Text(
                  'Clear negative feedback and reset interest weights',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                ),
                onTap: () {
                  Navigator.of(ctx).pop();
                  widget.notifier.resetPreferences();
                },
              ),
              ListTile(
                leading: const Icon(Icons.report_problem_outlined, color: AppColors.accentRed),
                title: const Text('Report post', style: TextStyle(color: AppColors.accentRed)),
                onTap: () {
                  Navigator.of(ctx).pop();
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Report submitted for review.')),
                  );
                },
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildModeTab(String label, IconData icon, String mode) {
    final isSelected = widget.notifier.currentFeedMode == mode;
    return GestureDetector(
      key: Key('feed_tab_$mode'),
      onTap: () {
        if (!isSelected) {
          widget.notifier.switchFeedMode(mode);
        }
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.brandPrimary : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 14,
              color: isSelected ? Colors.white : Colors.white70,
            ),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                color: isSelected ? Colors.white : Colors.white70,
                fontSize: 13,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.notifier.feedState;
    final topPadding = MediaQuery.of(context).padding.top;

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      body: Stack(
        children: [
          _buildBody(state),

          // Top Header Tabs: "Reels" | "Feed" | "Following"
          Positioned(
            top: topPadding + 8,
            left: 0,
            right: 0,
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.55),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.white12),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _buildModeTab('Reels', Icons.movie_outlined, 'FOR_YOU'),
                    const SizedBox(width: 4),
                    _buildModeTab('Feed', Icons.dynamic_feed_outlined, 'FEED'),
                    const SizedBox(width: 4),
                    _buildModeTab('Following', Icons.people_outline, 'FOLLOWING'),
                  ],
                ),
              ),
            ),
          ),

          // Banner notification for optimistic feedback or errors
          if (state is ReelsFeedLoadedState && state.bannerMessage != null)
            Positioned(
              top: topPadding + 56,
              left: 16,
              right: 16,
              child: Material(
                elevation: 6,
                borderRadius: BorderRadius.circular(8),
                color: state.isBannerError ? AppColors.accentRed : AppColors.brandPrimary,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  child: Row(
                    children: [
                      Icon(
                        state.isBannerError ? Icons.error_outline : Icons.check_circle_outline,
                        color: Colors.white,
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          state.bannerMessage!,
                          style: const TextStyle(color: Colors.white, fontSize: 13),
                        ),
                      ),
                      GestureDetector(
                        onTap: widget.notifier.clearBanner,
                        child: const Icon(Icons.close, color: Colors.white, size: 16),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        key: const Key('create_post_fab'),
        backgroundColor: AppColors.brandPrimary,
        child: const Icon(Icons.add, color: Colors.white),
        onPressed: () {
          showModalBottomSheet(
            context: context,
            backgroundColor: AppColors.backgroundSecondary,
            shape: const RoundedRectangleBorder(
              borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
            ),
            builder: (ctx) {
              return SafeArea(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    ListTile(
                      leading: const Icon(Icons.videocam_outlined, color: AppColors.brandPrimary),
                      title: const Text('Upload Video Reel', style: TextStyle(color: AppColors.textPrimary)),
                      subtitle: const Text('Resumable multipart upload with HLS transcoding', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                      onTap: () {
                        Navigator.of(ctx).pop();
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (c) => UploadVideoScreen(repository: widget.notifier.repository),
                          ),
                        );
                      },
                    ),
                    ListTile(
                      leading: const Icon(Icons.photo_library_outlined, color: AppColors.brandPrimary),
                      title: const Text('Create Photo Carousel Post', style: TextStyle(color: AppColors.textPrimary)),
                      subtitle: const Text('1 to 10 photos with interest tagging', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                      onTap: () {
                        Navigator.of(ctx).pop();
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (c) => CreatePostScreen(repository: widget.notifier.repository),
                          ),
                        );
                      },
                    ),
                    ListTile(
                      leading: const Icon(Icons.bolt_outlined, color: AppColors.accentPink),
                      title: const Text('Post 24h Story / Snap', style: TextStyle(color: AppColors.textPrimary)),
                      subtitle: const Text('Share temporary content with interactive stickers', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                      onTap: () {
                        Navigator.of(ctx).pop();
                        _openStoryComposer();
                      },
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildBody(ReelsFeedState state) {
    if (state is ReelsFeedLoadingState) {
      return const Center(child: CircularProgressIndicator(color: AppColors.brandPrimary));
    }

    if (state is ReelsFeedErrorState) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: AppColors.accentRed),
              const SizedBox(height: 12),
              Text(
                state.message,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => widget.notifier.loadFeed(refresh: true),
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.brandPrimary),
                child: const Text('Try Again'),
              ),
            ],
          ),
        ),
      );
    }

    if (state is ReelsFeedEmptyState) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.explore_off_outlined, size: 56, color: AppColors.textSecondary),
              const SizedBox(height: 16),
              Text(
                state.message,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.textPrimary, fontSize: 16),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => widget.notifier.loadFeed(refresh: true),
                child: const Text('Refresh'),
              ),
            ],
          ),
        ),
      );
    }

    if (state is ReelsFeedLoadedState) {
      // Classic Feed View: Stories Tray on top + Scrollable Post Cards (Instagram / Facebook Style)
      if (widget.notifier.currentFeedMode == 'FEED') {
        return _buildClassicFeedView(state);
      }

      // Vertical Reels View: Immersive Fullscreen (TikTok / Reels / Spotlight Style)
      return _buildVerticalReelsView(state);
    }

    return const SizedBox();
  }

  Widget _buildVerticalReelsView(ReelsFeedLoadedState state) {
    return RefreshIndicator(
      onRefresh: () => widget.notifier.loadFeed(refresh: true),
      child: PageView.builder(
        key: const Key('reels_page_view'),
        controller: _pageController,
        scrollDirection: Axis.vertical,
        itemCount: state.items.length,
        onPageChanged: (index) {
          setState(() {
            _currentPageIndex = index;
          });

          // Preload upcoming video reels
          final items = state.items;
          final preloadUrls = <String>[];
          if (index + 1 < items.length && items[index + 1].hlsMasterUrl.isNotEmpty) {
            preloadUrls.add(items[index + 1].hlsMasterUrl);
          }
          if (index + 2 < items.length && items[index + 2].hlsMasterUrl.isNotEmpty) {
            preloadUrls.add(items[index + 2].hlsMasterUrl);
          }
          if (preloadUrls.isNotEmpty) {
            MediaPreloadManager().queuePreload(preloadUrls);
          }

          if (index >= state.items.length - 2 && state.hasMore) {
            widget.notifier.loadMoreFeed();
          }
        },
        itemBuilder: (context, index) {
          final reel = state.items[index];
          return ReelCard(
            key: ValueKey('reel_card_${reel.id}'),
            reel: reel,
            isActive: index == _currentPageIndex,
            onLike: () => widget.notifier.toggleLike(reel.id),
            onComment: () => _showComments(reel),
            onSave: () => widget.notifier.toggleSave(reel.id),
            onShare: () => _showShareSheet(reel),
            onMore: () => _showMoreMenu(reel),
          );
        },
      ),
    );
  }

  Widget _buildClassicFeedView(ReelsFeedLoadedState state) {
    final topPadding = MediaQuery.of(context).padding.top;
    final stories = _storiesNotifier?.state.tray ?? [];
    final isStoriesLoading = _storiesNotifier?.state.isLoading ?? false;

    return RefreshIndicator(
      onRefresh: () async {
        await widget.notifier.loadFeed(refresh: true);
        await _storiesNotifier?.loadTray(token: widget.authToken);
      },
      child: ListView(
        padding: EdgeInsets.only(top: topPadding + 48, bottom: 80),
        children: [
          // 1. Stories Tray Widget (Instagram & Facebook signature feature)
          if (widget.storiesRepository != null)
            StoriesTrayWidget(
              tray: stories,
              currentUserId: widget.currentUserId,
              onStoryTap: _openStoryPlayer,
              onAddStoryTap: _openStoryComposer,
              isLoading: isStoriesLoading,
            ),

          const SizedBox(height: 8),

          // 2. Feed Post Cards
          ...state.items.map((reel) => _buildPostCard(reel)),
        ],
      ),
    );
  }

  Widget _buildPostCard(ReelItemModel reel) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 0),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.glassBorder, width: 0.8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Card Header: Creator info & more
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 18,
                  backgroundColor: AppColors.surfaceElevated,
                  backgroundImage: appAvatarProvider(reel.creator.avatarUrl),
                  child: reel.creator.avatarUrl == null
                      ? Text(
                          reel.creator.displayName.isNotEmpty ? reel.creator.displayName[0].toUpperCase() : '?',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                        )
                      : null,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              reel.creator.displayName.isNotEmpty ? reel.creator.displayName : reel.creator.username,
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Icon(Icons.verified, color: AppColors.accentCyan, size: 13),
                        ],
                      ),
                      Text(
                        '@${reel.creator.username}',
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                      ),
                    ],
                  ),
                ),
                if (reel.isPinned) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    margin: const EdgeInsets.only(right: 6),
                    decoration: BoxDecoration(
                      color: AppColors.accentGold.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text('PINNED', style: TextStyle(color: AppColors.accentGold, fontSize: 9, fontWeight: FontWeight.bold)),
                  ),
                ],
                IconButton(
                  icon: const Icon(Icons.more_horiz, color: Colors.white70),
                  onPressed: () => _showMoreMenu(reel),
                ),
              ],
            ),
          ),

          // Card Media: Double-tap to like with photo carousel or video
          GestureDetector(
            onDoubleTap: () => widget.notifier.toggleLike(reel.id),
            child: SizedBox(
              height: 380,
              width: double.infinity,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  OptimizedNetworkImage(
                    imageUrl: reel.thumbnailUrl.isNotEmpty ? reel.thumbnailUrl : (reel.imageUrls.isNotEmpty ? reel.imageUrls.first : ''),
                    fit: BoxFit.cover,
                    targetCacheWidth: 720,
                    targetCacheHeight: 720,
                    errorWidget: Container(
                      color: Colors.black54,
                      child: const Center(child: Icon(Icons.play_circle_outline, size: 54, color: Colors.white54)),
                    ),
                  ),
                  if (reel.mediaType == ReelMediaType.video)
                    const Center(
                      child: Icon(Icons.play_circle_fill, size: 54, color: Colors.white70),
                    ),
                ],
              ),
            ),
          ),

          // Card Action Bar (Like, Comment, Share, Bookmark)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              children: [
                IconButton(
                  icon: Icon(
                    reel.isLiked ? Icons.favorite : Icons.favorite_border,
                    color: reel.isLiked ? AppColors.accentRed : Colors.white,
                    size: 26,
                  ),
                  onPressed: () => widget.notifier.toggleLike(reel.id),
                ),
                IconButton(
                  icon: const Icon(Icons.chat_bubble_outline, color: Colors.white, size: 24),
                  onPressed: () => _showComments(reel),
                ),
                IconButton(
                  icon: const Icon(Icons.share, color: Colors.white, size: 24),
                  onPressed: () => _showShareSheet(reel),
                ),
                const Spacer(),
                IconButton(
                  icon: Icon(
                    reel.isSaved ? Icons.bookmark : Icons.bookmark_border,
                    color: reel.isSaved ? AppColors.brandPrimary : Colors.white,
                    size: 26,
                  ),
                  onPressed: () => widget.notifier.toggleSave(reel.id),
                ),
              ],
            ),
          ),

          // Likes Count & Interest Recommendation Reason
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${reel.likeCount} likes',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                ),
                const SizedBox(height: 6),

                // Recommendation Explainability Tag
                if (reel.explanation != null && reel.explanation!.isNotEmpty) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceElevated,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.brandPrimary.withOpacity(0.5)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.auto_awesome, size: 11, color: AppColors.brandPrimary),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            reel.explanation!,
                            style: const TextStyle(color: Colors.white70, fontSize: 11),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 6),
                ],

                // Caption
                RichText(
                  text: TextSpan(
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                    children: [
                      TextSpan(
                        text: '@${reel.creator.username} ',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      TextSpan(text: reel.title),
                      if (reel.caption != null && reel.caption!.isNotEmpty)
                        TextSpan(text: ' • ${reel.caption!}'),
                    ],
                  ),
                ),

                // View comments
                if (reel.commentCount > 0) ...[
                  const SizedBox(height: 6),
                  GestureDetector(
                    onTap: () => _showComments(reel),
                    child: Text(
                      'View all ${reel.commentCount} comments',
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                    ),
                  ),
                ],

                // Sound chip
                const SizedBox(height: 6),
                Row(
                  children: [
                    const Icon(Icons.music_note, size: 12, color: AppColors.textSecondary),
                    const SizedBox(width: 4),
                    Text(
                      'Original Audio • @${reel.creator.username}',
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
