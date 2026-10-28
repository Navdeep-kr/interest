import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/features/communities/data/communities_repository.dart';
import 'package:mobile/features/communities/domain/models/community_models.dart';
import 'package:mobile/features/communities/presentation/community_detail_notifier.dart';
import 'package:mobile/features/communities/presentation/widgets/community_post_card.dart';

class CommunityDetailScreen extends StatefulWidget {
  final String identifier;
  final CommunitiesRepository repository;
  final String? authToken;
  final String? currentUserId;

  const CommunityDetailScreen({
    super.key,
    required this.identifier,
    required this.repository,
    this.authToken,
    this.currentUserId,
  });

  @override
  State<CommunityDetailScreen> createState() => _CommunityDetailScreenState();
}

class _CommunityDetailScreenState extends State<CommunityDetailScreen>
    with SingleTickerProviderStateMixin {
  late CommunityDetailNotifier _notifier;
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _notifier = CommunityDetailNotifier(
      repository: widget.repository,
      identifier: widget.identifier,
      authToken: widget.authToken,
    );
    _tabController = TabController(length: 4, vsync: this);
    _tabController.addListener(() {
      if (!_tabController.indexIsChanging) {
        _notifier.setTabIndex(_tabController.index);
      }
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _notifier.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _notifier,
      builder: (context, _) {
        final state = _notifier.state;
        final comm = state.community;

        if (state.isLoading && comm == null) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        if (state.errorMessage != null && comm == null) {
          return Scaffold(
            appBar: AppBar(title: const Text('Community')),
            body: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.lock_outline, size: 48, color: Colors.orangeAccent),
                    const SizedBox(height: 16),
                    Text(
                      state.errorMessage!,
                      style: const TextStyle(fontSize: 16),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () => Navigator.of(context).maybePop(),
                      child: const Text('Go Back'),
                    ),
                  ],
                ),
              ),
            ),
          );
        }

        if (comm == null) {
          return const Scaffold(
            body: Center(child: Text('Community not found')),
          );
        }

        final isStaff = comm.isStaff;

        return Scaffold(
          body: NestedScrollView(
            headerSliverBuilder: (context, innerBoxIsScrolled) {
              return [
                SliverAppBar(
                  expandedHeight: 180,
                  pinned: true,
                  flexibleSpace: FlexibleSpaceBar(
                    title: Text(
                      comm.name,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        shadows: [Shadow(color: Colors.black, blurRadius: 4)],
                      ),
                    ),
                    background: Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [Colors.blueGrey.shade900, Colors.black87],
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                        ),
                      ),
                      child: comm.bannerUrl != null
                          ? OptimizedNetworkImage(
                              imageUrl: comm.bannerUrl!,
                              fit: BoxFit.cover,
                              targetCacheWidth: 800,
                              targetCacheHeight: 450,
                            )
                          : null,
                    ),
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            CircleAvatar(
                              radius: 28,
                              backgroundColor: Colors.blueAccent.shade700,
                              backgroundImage: appAvatarProvider(comm.avatarUrl),
                              child: comm.avatarUrl == null
                                  ? Text(
                                      comm.name.isNotEmpty ? comm.name[0].toUpperCase() : 'C',
                                      style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white),
                                    )
                                  : null,
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      _buildVisibilityBadge(comm.visibility),
                                      const SizedBox(width: 8),
                                      Text(
                                        '${comm.membersCount} members',
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: Theme.of(context).textTheme.bodySmall?.color,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  _buildMembershipActionButton(comm),
                                ],
                              ),
                            ),
                          ],
                        ),
                        if (comm.description.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          Text(comm.description, style: const TextStyle(fontSize: 14)),
                        ],
                      ],
                    ),
                  ),
                ),
                SliverPersistentHeader(
                  pinned: true,
                  delegate: _SliverTabBarDelegate(
                    TabBar(
                      controller: _tabController,
                      indicatorColor: Colors.blueAccent,
                      tabs: [
                        const Tab(text: 'Discussions'),
                        const Tab(text: 'Collections'),
                        const Tab(text: 'Guidelines'),
                        Tab(text: isStaff ? 'Mod Queue' : 'Staff'),
                      ],
                    ),
                  ),
                ),
              ];
            },
            body: TabBarView(
              controller: _tabController,
              children: [
                // 1. Discussions
                _buildDiscussionsTab(state, isStaff),
                // 2. Collections
                _buildCollectionsTab(state),
                // 3. Guidelines
                _buildGuidelinesTab(comm),
                // 4. Mod Queue / Staff
                _buildModQueueTab(state, isStaff),
              ],
            ),
          ),
          floatingActionButton: comm.isJoined
              ? FloatingActionButton.extended(
                  onPressed: () => _showPostComposerDialog(context),
                  icon: const Icon(Icons.edit),
                  label: const Text('Post'),
                )
              : null,
        );
      },
    );
  }

  Widget _buildVisibilityBadge(CommunityVisibility visibility) {
    Color color = Colors.green;
    String label = 'Public';
    if (visibility == CommunityVisibility.restricted) {
      color = Colors.orange;
      label = 'Restricted';
    } else if (visibility == CommunityVisibility.private) {
      color = Colors.redAccent;
      label = 'Private';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color, width: 0.8),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.bold),
      ),
    );
  }

  Widget _buildMembershipActionButton(CommunityModel comm) {
    if (comm.userStatus == CommunityMemberStatus.banned) {
      return Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.red.shade900,
              borderRadius: BorderRadius.circular(6),
            ),
            child: const Text('Banned', style: TextStyle(color: Colors.white, fontSize: 12)),
          ),
          const SizedBox(width: 8),
          TextButton(
            onPressed: () => _showAppealDialog(context),
            child: const Text('Submit Appeal'),
          ),
        ],
      );
    }

    if (comm.userStatus == CommunityMemberStatus.pendingRequest) {
      return const OutlinedButton(
        onPressed: null,
        child: Text('Request Pending'),
      );
    }

    if (comm.isJoined) {
      return OutlinedButton.icon(
        onPressed: () => _notifier.leaveCommunity(),
        icon: const Icon(Icons.check, size: 16),
        label: const Text('Joined'),
      );
    }

    return ElevatedButton(
      onPressed: () => _notifier.joinCommunity(),
      child: Text(comm.visibility == CommunityVisibility.public ? 'Join' : 'Request to Join'),
    );
  }

  Widget _buildDiscussionsTab(CommunityDetailState state, bool isStaff) {
    if (state.posts.isEmpty) {
      return const Center(
        child: Text('No posts yet. Start the conversation!'),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: state.posts.length,
      itemBuilder: (context, index) {
        final post = state.posts[index];
        return CommunityPostCard(
          post: post,
          isStaff: isStaff,
          onTogglePin: () => _notifier.togglePinPost(post.id),
          onReport: () => _showReportDialog(context, 'POST', post.id),
        );
      },
    );
  }

  Widget _buildCollectionsTab(CommunityDetailState state) {
    if (state.collections.isEmpty) {
      return const Center(
        child: Text('No video collections yet in this community.'),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(12),
      itemCount: state.collections.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final col = state.collections[index];
        return Card(
          child: ListTile(
            leading: const Icon(Icons.video_library, color: Colors.blueAccent),
            title: Text(col.title, style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text('${col.itemsCount} shared reels • ${col.description}'),
          ),
        );
      },
    );
  }

  Widget _buildGuidelinesTab(CommunityModel comm) {
    if (comm.guidelines.isEmpty) {
      return const Center(
        child: Text('No community guidelines posted yet.'),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: comm.guidelines.length,
      separatorBuilder: (_, __) => const Divider(),
      itemBuilder: (context, index) {
        final rule = comm.guidelines[index];
        return ListTile(
          leading: CircleAvatar(
            radius: 14,
            child: Text('${index + 1}', style: const TextStyle(fontSize: 12)),
          ),
          title: Text(rule.title, style: const TextStyle(fontWeight: FontWeight.bold)),
          subtitle: Text(rule.description),
        );
      },
    );
  }

  Widget _buildModQueueTab(CommunityDetailState state, bool isStaff) {
    if (!isStaff) {
      return const Center(
        child: Text('Community moderation queue is accessible to staff only.'),
      );
    }

    if (state.modQueue.isEmpty) {
      return const Center(
        child: Text('Moderation queue is all clear! No pending reports.'),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(12),
      itemCount: state.modQueue.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final report = state.modQueue[index];
        return Card(
          color: Colors.grey.shade900,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Type: ${report.targetType}', style: const TextStyle(color: Colors.orangeAccent, fontWeight: FontWeight.bold)),
                    Text(report.reason, style: const TextStyle(color: Colors.white70, fontSize: 12)),
                  ],
                ),
                if (report.details != null) ...[
                  const SizedBox(height: 6),
                  Text(report.details!, style: const TextStyle(color: Colors.white)),
                ],
                const SizedBox(height: 10),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: () => _notifier.resolveReport(report.id, 'DISMISSED', 'NO_ACTION'),
                      child: const Text('Dismiss', style: TextStyle(color: Colors.white54)),
                    ),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
                      onPressed: () => _notifier.resolveReport(
                        report.id,
                        'RESOLVED',
                        report.targetType == 'POST' ? 'REMOVE_POST' : 'BAN_MEMBER',
                      ),
                      child: Text(report.targetType == 'POST' ? 'Remove Post' : 'Ban Member'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showPostComposerDialog(BuildContext context) {
    final titleController = TextEditingController();
    final bodyController = TextEditingController();
    CommunityPostType postType = CommunityPostType.discussion;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.grey.shade900,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) {
          return Padding(
            padding: EdgeInsets.only(
              bottom: MediaQuery.of(context).viewInsets.bottom,
              left: 16,
              right: 16,
              top: 16,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('Create Post', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
                const SizedBox(height: 12),
                Row(
                  children: [
                    ChoiceChip(
                      label: const Text('Discussion'),
                      selected: postType == CommunityPostType.discussion,
                      onSelected: (val) {
                        if (val) setModalState(() => postType = CommunityPostType.discussion);
                      },
                    ),
                    const SizedBox(width: 8),
                    ChoiceChip(
                      label: const Text('Collaborative'),
                      selected: postType == CommunityPostType.collaborative,
                      onSelected: (val) {
                        if (val) setModalState(() => postType = CommunityPostType.collaborative);
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: titleController,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(
                    hintText: 'Post title...',
                    hintStyle: TextStyle(color: Colors.white38),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: bodyController,
                  maxLines: 4,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(
                    hintText: 'Share your thoughts, findings, or questions...',
                    hintStyle: TextStyle(color: Colors.white38),
                  ),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () {
                    final title = titleController.text.trim();
                    final body = bodyController.text.trim();
                    if (title.isNotEmpty && body.isNotEmpty) {
                      Navigator.of(ctx).pop();
                      _notifier.createPost(title: title, body: body, postType: postType);
                    }
                  },
                  child: const Text('Publish Post'),
                ),
                const SizedBox(height: 16),
              ],
            ),
          );
        },
      ),
    );
  }

  void _showReportDialog(BuildContext context, String targetType, String targetId) {
    final reasonController = TextEditingController(text: 'COMMUNITY_RULE_VIOLATION');
    final detailsController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Report Content'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: reasonController,
              decoration: const InputDecoration(labelText: 'Reason'),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: detailsController,
              decoration: const InputDecoration(labelText: 'Details (optional)'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              _notifier.reportTarget(targetType, targetId, reasonController.text.trim(), detailsController.text.trim());
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Report submitted to community moderation queue.')),
              );
            },
            child: const Text('Submit Report'),
          ),
        ],
      ),
    );
  }

  void _showAppealDialog(BuildContext context) {
    final reasonController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Appeal Ban'),
        content: TextField(
          controller: reasonController,
          maxLines: 3,
          decoration: const InputDecoration(hintText: 'Explain why your ban should be reviewed...'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              widget.repository.submitAppeal(
                _notifier.state.community!.id,
                reasonController.text.trim(),
                token: widget.authToken,
              );
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Appeal submitted for moderator review.')),
              );
            },
            child: const Text('Submit Appeal'),
          ),
        ],
      ),
    );
  }
}

class _SliverTabBarDelegate extends SliverPersistentHeaderDelegate {
  final TabBar tabBar;

  _SliverTabBarDelegate(this.tabBar);

  @override
  double get minExtent => tabBar.preferredSize.height;
  @override
  double get maxExtent => tabBar.preferredSize.height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      color: Theme.of(context).scaffoldBackgroundColor,
      child: tabBar,
    );
  }

  @override
  bool shouldRebuild(_SliverTabBarDelegate oldDelegate) {
    return false;
  }
}
