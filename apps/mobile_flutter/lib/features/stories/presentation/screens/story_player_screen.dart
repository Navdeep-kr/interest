import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/features/stories/data/stories_repository.dart';
import 'package:mobile/features/stories/domain/models/story_models.dart';
import 'package:mobile/features/stories/presentation/story_player_notifier.dart';
import '../widgets/interactive_story_poll_widget.dart';

class StoryPlayerScreen extends StatefulWidget {
  final List<StoryModel> stories;
  final int initialIndex;
  final String? currentUserId;
  final String? authToken;
  final StoriesRepository repository;
  final VoidCallback? onFinished;

  const StoryPlayerScreen({
    super.key,
    required this.stories,
    this.initialIndex = 0,
    this.currentUserId,
    this.authToken,
    required this.repository,
    this.onFinished,
  });

  @override
  State<StoryPlayerScreen> createState() => _StoryPlayerScreenState();
}

class _StoryPlayerScreenState extends State<StoryPlayerScreen> {
  late StoryPlayerNotifier _notifier;
  final TextEditingController _replyController = TextEditingController();
  final FocusNode _replyFocusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _notifier = StoryPlayerNotifier(
      repository: widget.repository,
      stories: widget.stories,
      initialIndex: widget.initialIndex,
      authToken: widget.authToken,
      onCompletedAllStories: () {
        if (mounted) {
          widget.onFinished?.call();
          Navigator.of(context).maybePop();
        }
      },
    );

    _replyFocusNode.addListener(() {
      if (_replyFocusNode.hasFocus) {
        _notifier.pause();
      } else {
        _notifier.resume();
      }
    });
  }

  @override
  void dispose() {
    _replyController.dispose();
    _replyFocusNode.dispose();
    _notifier.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _notifier,
      builder: (context, _) {
        final state = _notifier.state;
        final currentStory = state.currentStory;

        if (currentStory == null || state.isFinished) {
          return const Scaffold(
            backgroundColor: Colors.black,
            body: Center(
              child: CircularProgressIndicator(color: Colors.white),
            ),
          );
        }

        final isOwnStory = widget.currentUserId != null && currentStory.creatorId == widget.currentUserId;

        return Scaffold(
          backgroundColor: Colors.black,
          body: SafeArea(
            child: GestureDetector(
              onLongPressStart: (_) => _notifier.pause(),
              onLongPressEnd: (_) => _notifier.resume(),
              onTapUp: (details) {
                if (_replyFocusNode.hasFocus) {
                  _replyFocusNode.unfocus();
                  return;
                }
                final screenWidth = MediaQuery.of(context).size.width;
                if (details.localPosition.dx < screenWidth * 0.3) {
                  _notifier.rewind();
                } else if (details.localPosition.dx > screenWidth * 0.7) {
                  _notifier.advance();
                }
              },
              child: Stack(
                fit: StackFit.expand,
                children: [
                  // 1. Media Background
                  _buildMediaBackground(currentStory),

                  // 2. Text Overlays
                  ..._buildTextOverlays(currentStory),

                  // Instagram Interactive Poll Sticker
                  const Positioned(
                    top: 240,
                    left: 20,
                    right: 20,
                    child: InteractiveStoryPollWidget(),
                  ),

                  // 3. Caption Overlay
                  if (currentStory.caption.isNotEmpty)
                    Positioned(
                      bottom: 84,
                      left: 16,
                      right: 16,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.65),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          currentStory.caption,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                          ),
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),

                  // 4. Top Segmented Progress Bar & Header
                  Positioned(
                    top: 8,
                    left: 8,
                    right: 8,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _buildSegmentedProgressBar(state),
                        const SizedBox(height: 10),
                        _buildHeader(currentStory, isOwnStory),
                      ],
                    ),
                  ),

                  // 5. Bottom Engagement Bar (Reactions & Reply)
                  Positioned(
                    bottom: 12,
                    left: 12,
                    right: 12,
                    child: _buildBottomBar(currentStory, isOwnStory),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildMediaBackground(StoryModel story) {
    if (story.mediaType == StoryMediaType.photo) {
      return Container(
        color: Colors.black,
        child: Center(
          child: OptimizedNetworkImage(
            imageUrl: story.mediaUrl,
            fit: BoxFit.contain,
            targetCacheWidth: 1080,
            targetCacheHeight: 1920,
          ),
        ),
      );
    } else {
      // Video representation
      return Container(
        color: Colors.black,
        child: Center(
          child: Stack(
            alignment: Alignment.center,
            children: [
              if (story.thumbnailUrl != null)
                OptimizedNetworkImage(
                  imageUrl: story.thumbnailUrl!,
                  fit: BoxFit.contain,
                  targetCacheWidth: 1080,
                  targetCacheHeight: 1920,
                ),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(50),
                ),
                child: const Icon(Icons.play_arrow, size: 48, color: Colors.white),
              ),
            ],
          ),
        ),
      );
    }
  }

  List<Widget> _buildTextOverlays(StoryModel story) {
    return story.textOverlays.map((overlay) {
      final leftPercent = (overlay.xPercent / 100.0).clamp(0.05, 0.85);
      final topPercent = (overlay.yPercent / 100.0).clamp(0.15, 0.85);

      Color textColor = Colors.white;
      try {
        if (overlay.color.startsWith('#')) {
          final hex = overlay.color.replaceAll('#', '');
          textColor = Color(int.parse('FF$hex', radix: 16));
        }
      } catch (_) {}

      return Positioned(
        left: MediaQuery.of(context).size.width * leftPercent,
        top: MediaQuery.of(context).size.height * topPercent,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(0.4),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(
            overlay.text,
            style: TextStyle(
              color: textColor,
              fontSize: overlay.fontSize,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      );
    }).toList();
  }

  Widget _buildSegmentedProgressBar(StoryPlayerState state) {
    return Row(
      children: List.generate(state.stories.length, (index) {
        double progress = 0.0;
        if (index < state.currentIndex) {
          progress = 1.0;
        } else if (index == state.currentIndex) {
          progress = state.currentProgress;
        }

        return Expanded(
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 2),
            height: 3,
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.3),
              borderRadius: BorderRadius.circular(2),
            ),
            child: FractionallySizedBox(
              alignment: Alignment.centerLeft,
              widthFactor: progress.clamp(0.0, 1.0),
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
          ),
        );
      }),
    );
  }

  Widget _buildHeader(StoryModel story, bool isOwnStory) {
    final isCloseFriends = story.audience == StoryAudience.closeFriends;

    return Row(
      children: [
        CircleAvatar(
          radius: 18,
          backgroundColor: Colors.grey.shade700,
          backgroundImage: appAvatarProvider(story.creator.avatarUrl),
          child: story.creator.avatarUrl == null
              ? Text(
                  story.creator.displayName.isNotEmpty
                      ? story.creator.displayName[0].toUpperCase()
                      : '?',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                )
              : null,
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Flexible(
                    child: Text(
                      story.creator.displayName.isNotEmpty
                          ? story.creator.displayName
                          : story.creator.username,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (story.creator.isVerified) ...[
                    const SizedBox(width: 4),
                    const Icon(Icons.verified, size: 14, color: Colors.blueAccent),
                  ],
                  const SizedBox(width: 6),
                  Text(
                    story.remainingTimeFormatted,
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
              if (isCloseFriends)
                Container(
                  margin: const EdgeInsets.only(top: 2),
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                  decoration: BoxDecoration(
                    color: const Color(0xFF00C853),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    'Close Friends',
                    style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                  ),
                ),
            ],
          ),
        ),
        // Screenshot Advisory / Privacy Button
        IconButton(
          icon: const Icon(Icons.shield_outlined, color: Colors.white70, size: 20),
          tooltip: 'Privacy Notice',
          onPressed: () {
            _notifier.pause();
            showDialog(
              context: context,
              builder: (ctx) => AlertDialog(
                backgroundColor: Colors.grey.shade900,
                title: const Row(
                  children: [
                    Icon(Icons.visibility_off, color: Colors.orangeAccent),
                    SizedBox(width: 8),
                    Text('Story Privacy', style: TextStyle(color: Colors.white)),
                  ],
                ),
                content: const Text(
                  'Stories expire 24 hours after creation.\n\n'
                  'Please note: Expiring content cannot prevent viewers from taking screenshots, screen recordings, or photos with another device.',
                  style: TextStyle(color: Colors.white70),
                ),
                actions: [
                  TextButton(
                    onPressed: () {
                      Navigator.of(ctx).pop();
                      _notifier.resume();
                    },
                    child: const Text('Understood', style: TextStyle(color: Colors.blueAccent)),
                  ),
                ],
              ),
            );
          },
        ),
        // Menu Options (Report or Delete)
        IconButton(
          icon: const Icon(Icons.more_vert, color: Colors.white, size: 22),
          onPressed: () => _showStoryOptionsModal(story, isOwnStory),
        ),
        IconButton(
          icon: const Icon(Icons.close, color: Colors.white, size: 24),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
      ],
    );
  }

  Widget _buildBottomBar(StoryModel story, bool isOwnStory) {
    if (isOwnStory) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.black.withOpacity(0.6),
          borderRadius: BorderRadius.circular(24),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                const Icon(Icons.visibility, color: Colors.white70, size: 18),
                const SizedBox(width: 6),
                Text(
                  '${story.viewsCount} views',
                  style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500),
                ),
              ],
            ),
            Row(
              children: [
                const Icon(Icons.favorite, color: Colors.redAccent, size: 18),
                const SizedBox(width: 6),
                Text(
                  '${story.reactionsCount} reactions',
                  style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ],
        ),
      );
    }

    // Viewer bottom bar with quick reactions and reply
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Quick Emoji Reaction Bar
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: ['❤️', '🔥', '😂', '👏', '😮', '😢'].map((emoji) {
            return GestureDetector(
              onTap: () {
                _notifier.sendReaction(emoji);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Sent $emoji to ${story.creator.displayName}'),
                    duration: const Duration(seconds: 1),
                    backgroundColor: Colors.grey.shade900,
                  ),
                );
              },
              child: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.5),
                  shape: BoxShape.circle,
                ),
                child: Text(emoji, style: const TextStyle(fontSize: 22)),
              ),
            );
          }).toList(),
        ),
        const SizedBox(height: 8),

        // Reply field
        if (story.allowReplies == StoryReplySetting.off)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 8),
            alignment: Alignment.center,
            child: const Text(
              'Replies are turned off for this story',
              style: TextStyle(color: Colors.white54, fontSize: 12),
            ),
          )
        else
          Row(
            children: [
              Expanded(
                child: Container(
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.6),
                    borderRadius: BorderRadius.circular(22),
                    border: Border.all(color: Colors.white24),
                  ),
                  child: TextField(
                    controller: _replyController,
                    focusNode: _replyFocusNode,
                    style: const TextStyle(color: Colors.white, fontSize: 14),
                    decoration: InputDecoration(
                      hintText: 'Send message to ${story.creator.displayName}...',
                      hintStyle: const TextStyle(color: Colors.white54, fontSize: 13),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                    onSubmitted: (text) => _submitReply(text),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                icon: const Icon(Icons.send, color: Colors.blueAccent),
                onPressed: () => _submitReply(_replyController.text),
              ),
            ],
          ),
      ],
    );
  }

  void _submitReply(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return;

    _replyController.clear();
    _replyFocusNode.unfocus();

    final success = await _notifier.sendReply(trimmed);
    if (mounted) {
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Reply sent!'),
            duration: Duration(seconds: 1),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not send reply.'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _showStoryOptionsModal(StoryModel story, bool isOwnStory) {
    _notifier.pause();
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.grey.shade900,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (isOwnStory) ...[
                ListTile(
                  leading: const Icon(Icons.delete, color: Colors.redAccent),
                  title: const Text('Delete Story', style: TextStyle(color: Colors.redAccent)),
                  onTap: () {
                    Navigator.of(ctx).pop();
                    _confirmDeleteStory();
                  },
                ),
              ] else ...[
                ListTile(
                  leading: const Icon(Icons.flag_outlined, color: Colors.orangeAccent),
                  title: const Text('Report Story', style: TextStyle(color: Colors.white)),
                  onTap: () {
                    Navigator.of(ctx).pop();
                    _showReportDialog(story);
                  },
                ),
              ],
            ],
          ),
        );
      },
    ).whenComplete(() {
      _notifier.resume();
    });
  }

  void _confirmDeleteStory() {
    _notifier.pause();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.grey.shade900,
        title: const Text('Delete Story?', style: TextStyle(color: Colors.white)),
        content: const Text(
          'This story will be removed permanently.',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              _notifier.resume();
            },
            child: const Text('Cancel', style: TextStyle(color: Colors.white54)),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              _notifier.deleteCurrentStory();
            },
            child: const Text('Delete', style: TextStyle(color: Colors.redAccent)),
          ),
        ],
      ),
    );
  }

  void _showReportDialog(StoryModel story) {
    _notifier.pause();
    String selectedReason = 'INAPPROPRIATE';
    final detailsController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          return AlertDialog(
            backgroundColor: Colors.grey.shade900,
            title: const Text('Report Story', style: TextStyle(color: Colors.white)),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButton<String>(
                  value: selectedReason,
                  dropdownColor: Colors.grey.shade800,
                  style: const TextStyle(color: Colors.white),
                  isExpanded: true,
                  items: const [
                    DropdownMenuItem(value: 'SPAM', child: Text('Spam or Scam')),
                    DropdownMenuItem(value: 'INAPPROPRIATE', child: Text('Inappropriate Content')),
                    DropdownMenuItem(value: 'HARASSMENT', child: Text('Harassment or Bullying')),
                    DropdownMenuItem(value: 'HATE_SPEECH', child: Text('Hate Speech')),
                    DropdownMenuItem(value: 'COPYRIGHT', child: Text('Copyright Violation')),
                  ],
                  onChanged: (val) {
                    if (val != null) {
                      setDialogState(() => selectedReason = val);
                    }
                  },
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: detailsController,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(
                    hintText: 'Additional details (optional)...',
                    hintStyle: TextStyle(color: Colors.white38),
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.of(ctx).pop();
                  _notifier.resume();
                },
                child: const Text('Cancel', style: TextStyle(color: Colors.white54)),
              ),
              TextButton(
                onPressed: () {
                  Navigator.of(ctx).pop();
                  _notifier.reportCurrentStory(selectedReason, detailsController.text.trim());
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Story reported. Thank you for keeping the community safe.')),
                  );
                },
                child: const Text('Report', style: TextStyle(color: Colors.redAccent)),
              ),
            ],
          );
        },
      ),
    );
  }
}
