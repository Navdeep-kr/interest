import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/search/data/search_repository.dart';
import 'package:mobile/features/search/domain/models/search_models.dart';

class TopicPageScreen extends StatefulWidget {
  final String idOrSlug;
  final SearchRepository repository;

  const TopicPageScreen({
    super.key,
    required this.idOrSlug,
    required this.repository,
  });

  @override
  State<TopicPageScreen> createState() => _TopicPageScreenState();
}

class _TopicPageScreenState extends State<TopicPageScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  TopicPageDetailsModel? _topicPage;
  bool _isLoading = true;
  String? _errorMessage;
  bool _isActionInProgress = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadTopicPage();
  }

  Future<void> _loadTopicPage() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final details = await widget.repository.getTopicPage(widget.idOrSlug);
      if (mounted) {
        setState(() {
          _topicPage = details;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Failed to load topic: $e';
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _toggleFollow() async {
    if (_topicPage == null || _isActionInProgress) return;
    final current = _topicPage!;
    final nextState = !current.isFollowing;

    setState(() {
      _isActionInProgress = true;
      _topicPage = current.copyWith(
        isFollowing: nextState,
        followersCount: current.followersCount + (nextState ? 1 : -1),
      );
    });

    try {
      if (nextState) {
        await widget.repository.followTopic(current.id);
      } else {
        await widget.repository.unfollowTopic(current.id);
      }
    } catch (_) {
      // Revert on failure
      if (mounted) {
        setState(() {
          _topicPage = current;
        });
      }
    } finally {
      if (mounted) {
        setState(() => _isActionInProgress = false);
      }
    }
  }

  Future<void> _toggleMute() async {
    if (_topicPage == null || _isActionInProgress) return;
    final current = _topicPage!;
    final nextMuted = !current.isMuted;

    setState(() {
      _isActionInProgress = true;
      _topicPage = current.copyWith(isMuted: nextMuted);
    });

    try {
      await widget.repository.toggleMuteTopic(current.id, nextMuted);
    } catch (_) {
      if (mounted) {
        setState(() => _topicPage = current);
      }
    } finally {
      if (mounted) {
        setState(() => _isActionInProgress = false);
      }
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        title: Text(
          _topicPage?.title ?? 'Topic Page',
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          if (_topicPage != null)
            IconButton(
              icon: Icon(
                _topicPage!.isMuted ? Icons.volume_off : Icons.volume_up,
                color: _topicPage!.isMuted ? AppColors.accentPink : AppColors.textSecondary,
              ),
              tooltip: _topicPage!.isMuted ? 'Topic Muted from Feed' : 'Mute Topic',
              onPressed: _toggleMute,
            ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: AppColors.accentPink, size: 48),
              const SizedBox(height: 12),
              Text(
                _errorMessage!,
                style: const TextStyle(color: Colors.white, fontSize: 15),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _loadTopicPage,
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    final topic = _topicPage!;

    return NestedScrollView(
      headerSliverBuilder: (context, innerBoxIsScrolled) {
        return [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Breadcrumbs
                  if (topic.breadcrumbs.isNotEmpty)
                    _buildBreadcrumbs(topic.breadcrumbs),
                  const SizedBox(height: 16),

                  // Header with Icon & Title
                  Row(
                    children: [
                      Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(
                          color: AppColors.surfaceElevated,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.glassBorder),
                        ),
                        child: Center(
                          child: Text(
                            topic.icon ?? '💡',
                            style: const TextStyle(fontSize: 28),
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              topic.title,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${topic.followersCount} followers • ${topic.reelsCount} videos',
                              style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                      ElevatedButton(
                        onPressed: _toggleFollow,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: topic.isFollowing ? AppColors.surfaceElevated : AppColors.primary,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
                        ),
                        child: Text(topic.isFollowing ? 'Following' : 'Follow'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Description
                  if (topic.description.isNotEmpty)
                    Text(
                      topic.description,
                      style: const TextStyle(color: Colors.white70, fontSize: 14),
                    ),

                  // Muted Warning Banner
                  if (topic.isMuted)
                    Container(
                      margin: const EdgeInsets.only(top: 12),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppColors.accentPink.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.accentPink.withOpacity(0.3)),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.volume_off, color: AppColors.accentPink, size: 18),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'This topic is muted. Videos tagged with this topic will not appear in your personalized feed.',
                              style: TextStyle(color: AppColors.accentPink, fontSize: 12),
                            ),
                          ),
                        ],
                      ),
                    ),

                  const SizedBox(height: 16),

                  // Direct Subtopics Chips
                  if (topic.subtopics.isNotEmpty) ...[
                    const Text(
                      'Subtopics',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                    const SizedBox(height: 8),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: topic.subtopics.map((sub) {
                          return Padding(
                            padding: const EdgeInsets.only(right: 8.0),
                            child: ActionChip(
                              backgroundColor: AppColors.surfaceElevated,
                              side: const BorderSide(color: AppColors.glassBorder),
                              avatar: sub.icon != null ? Text(sub.icon!) : null,
                              label: Text(
                                '${sub.title} (${sub.reelsCount})',
                                style: const TextStyle(color: Colors.white, fontSize: 12),
                              ),
                              onPressed: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => TopicPageScreen(
                                      idOrSlug: sub.slug,
                                      repository: widget.repository,
                                    ),
                                  ),
                                );
                              },
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Related Interests ("More Like This")
                  if (topic.relatedInterests.isNotEmpty) ...[
                    const Text(
                      'More Like This',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                    const SizedBox(height: 8),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: topic.relatedInterests.map((rel) {
                          return Padding(
                            padding: const EdgeInsets.only(right: 8.0),
                            child: ActionChip(
                              backgroundColor: AppColors.surfaceElevated,
                              side: const BorderSide(color: AppColors.glassBorder),
                              label: Text(
                                '${rel.title} • ${(rel.similarityScore * 100).toInt()}% match',
                                style: const TextStyle(color: AppColors.secondary, fontSize: 12),
                              ),
                              onPressed: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => TopicPageScreen(
                                      idOrSlug: rel.slug,
                                      repository: widget.repository,
                                    ),
                                  ),
                                );
                              },
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          SliverPersistentHeader(
            pinned: true,
            delegate: _SliverAppBarDelegate(
              TabBar(
                controller: _tabController,
                indicatorColor: AppColors.primary,
                labelColor: Colors.white,
                unselectedLabelColor: AppColors.textSecondary,
                tabs: const [
                  Tab(text: 'Top Videos'),
                  Tab(text: 'Recent Videos'),
                ],
              ),
            ),
          ),
        ];
      },
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildReelsGrid(topic.topReels),
          _buildReelsGrid(topic.recentReels),
        ],
      ),
    );
  }

  Widget _buildBreadcrumbs(List<BreadcrumbItemModel> breadcrumbs) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: breadcrumbs.asMap().entries.map((entry) {
          final idx = entry.key;
          final crumb = entry.value;
          final isLast = idx == breadcrumbs.length - 1;

          return Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              GestureDetector(
                onTap: isLast
                    ? null
                    : () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => TopicPageScreen(
                              idOrSlug: crumb.slug,
                              repository: widget.repository,
                            ),
                          ),
                        );
                      },
                child: Text(
                  crumb.title,
                  style: TextStyle(
                    color: isLast ? Colors.white : AppColors.primary,
                    fontWeight: isLast ? FontWeight.bold : FontWeight.normal,
                    fontSize: 12,
                  ),
                ),
              ),
              if (!isLast)
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 6.0),
                  child: Icon(Icons.chevron_right, color: AppColors.textSecondary, size: 14),
                ),
            ],
          );
        }).toList(),
      ),
    );
  }

  Widget _buildReelsGrid(List<ReelSearchResultModel> reels) {
    if (reels.isEmpty) {
      return const Center(
        child: Text('No videos found under this topic.', style: TextStyle(color: AppColors.textSecondary)),
      );
    }

    return GridView.builder(
      padding: const EdgeInsets.all(12),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 0.65,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
      ),
      itemCount: reels.length,
      itemBuilder: (context, index) {
        final reel = reels[index];
        return ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Container(
            color: AppColors.surfaceElevated,
            child: Stack(
              fit: StackFit.expand,
              children: [
                OptimizedNetworkImage(
                  imageUrl: reel.thumbnailUrl,
                  fit: BoxFit.cover,
                  targetCacheWidth: 400,
                  targetCacheHeight: 600,
                ),
                Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Colors.transparent, Colors.black.withOpacity(0.8)],
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                    ),
                  ),
                ),
                Positioned(
                  bottom: 8,
                  left: 8,
                  right: 8,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        reel.title,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Icon(Icons.favorite, color: AppColors.accentPink, size: 12),
                          const SizedBox(width: 4),
                          Text(
                            '${reel.likeCount}',
                            style: const TextStyle(color: Colors.white70, fontSize: 11),
                          ),
                          const Spacer(),
                          Text(
                            '@${reel.creatorUsername}',
                            style: const TextStyle(color: AppColors.textSecondary, fontSize: 10),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _SliverAppBarDelegate extends SliverPersistentHeaderDelegate {
  final TabBar _tabBar;

  _SliverAppBarDelegate(this._tabBar);

  @override
  double get minExtent => _tabBar.preferredSize.height;
  @override
  double get maxExtent => _tabBar.preferredSize.height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      color: AppColors.surface,
      child: _tabBar,
    );
  }

  @override
  bool shouldRebuild(_SliverAppBarDelegate oldDelegate) {
    return false;
  }
}
