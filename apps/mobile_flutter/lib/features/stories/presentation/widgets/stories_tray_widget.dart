import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/features/stories/domain/models/story_models.dart';

class StoriesTrayWidget extends StatelessWidget {
  final List<CreatorStoryTrayModel> tray;
  final String? currentUserId;
  final ValueChanged<CreatorStoryTrayModel> onStoryTap;
  final VoidCallback onAddStoryTap;
  final bool isLoading;

  const StoriesTrayWidget({
    super.key,
    required this.tray,
    this.currentUserId,
    required this.onStoryTap,
    required this.onAddStoryTap,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    if (isLoading && tray.isEmpty) {
      return Container(
        height: 106,
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: const Center(
          child: SizedBox(
            width: 24,
            height: 24,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );
    }

    // Determine if current user has an active story
    CreatorStoryTrayModel? currentUserTray;
    final otherTrays = <CreatorStoryTrayModel>[];

    for (final item in tray) {
      if (currentUserId != null && item.creatorId == currentUserId) {
        currentUserTray = item;
      } else {
        otherTrays.add(item);
      }
    }

    return Container(
      height: 106,
      padding: const EdgeInsets.symmetric(vertical: 6),
      decoration: BoxDecoration(
        color: Theme.of(context).scaffoldBackgroundColor,
        border: Border(
          bottom: BorderSide(
            color: Theme.of(context).dividerColor.withOpacity(0.1),
            width: 1,
          ),
        ),
      ),
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        scrollDirection: Axis.horizontal,
        itemCount: 1 + otherTrays.length,
        separatorBuilder: (context, index) => const SizedBox(width: 12),
        itemBuilder: (context, index) {
          if (index == 0) {
            return _buildCurrentUserStoryItem(context, currentUserTray);
          }
          final creatorItem = otherTrays[index - 1];
          return _buildCreatorStoryItem(context, creatorItem);
        },
      ),
    );
  }

  Widget _buildCurrentUserStoryItem(BuildContext context, CreatorStoryTrayModel? userTray) {
    final hasStories = userTray != null && userTray.stories.isNotEmpty;

    return GestureDetector(
      key: const Key('stories_tray_your_story'),
      onTap: () {
        if (hasStories) {
          onStoryTap(userTray);
        } else {
          onAddStoryTap();
        }
      },
      child: SizedBox(
        width: 72,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              alignment: Alignment.center,
              children: [
                _buildAvatarBorder(
                  hasUnviewed: hasStories && userTray.hasUnviewedStories,
                  isCloseFriends: false,
                  child: CircleAvatar(
                    radius: 28,
                    backgroundColor: Colors.grey.shade800,
                    backgroundImage: appAvatarProvider(userTray?.avatarUrl),
                    child: userTray?.avatarUrl == null
                        ? const Icon(Icons.person, color: Colors.white70, size: 28)
                        : null,
                  ),
                ),
                Positioned(
                  bottom: 0,
                  right: 0,
                  child: Container(
                    padding: const EdgeInsets.all(2),
                    decoration: BoxDecoration(
                      color: Theme.of(context).scaffoldBackgroundColor,
                      shape: BoxShape.circle,
                    ),
                    child: Container(
                      padding: const EdgeInsets.all(3),
                      decoration: const BoxDecoration(
                        color: Colors.blueAccent,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.add,
                        size: 14,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            const Text(
              'Your Story',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCreatorStoryItem(BuildContext context, CreatorStoryTrayModel item) {
    final isCloseFriends = item.stories.any((s) => s.audience == StoryAudience.closeFriends);

    return GestureDetector(
      key: Key('stories_tray_creator_${item.creatorId}'),
      onTap: () => onStoryTap(item),
      child: SizedBox(
        width: 72,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildAvatarBorder(
              hasUnviewed: item.hasUnviewedStories,
              isCloseFriends: isCloseFriends,
              child: CircleAvatar(
                radius: 28,
                backgroundColor: Colors.grey.shade800,
                backgroundImage: appAvatarProvider(item.avatarUrl),
                child: item.avatarUrl == null
                    ? Text(
                        item.displayName.isNotEmpty ? item.displayName[0].toUpperCase() : '?',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      )
                    : null,
              ),
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Flexible(
                  child: Text(
                    item.displayName.isNotEmpty ? item.displayName : item.username,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: item.hasUnviewedStories ? FontWeight.bold : FontWeight.normal,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                  ),
                ),
                if (item.isVerified) ...[
                  const SizedBox(width: 2),
                  const Icon(Icons.verified, size: 11, color: Colors.blue),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAvatarBorder({
    required bool hasUnviewed,
    required bool isCloseFriends,
    required Widget child,
  }) {
    if (!hasUnviewed) {
      return Container(
        padding: const EdgeInsets.all(2.5),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: Colors.grey.shade600, width: 1.5),
        ),
        child: child,
      );
    }

    if (isCloseFriends) {
      return Container(
        padding: const EdgeInsets.all(2.5),
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          gradient: LinearGradient(
            colors: [Color(0xFF00C853), Color(0xFF64DD17)],
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
          ),
        ),
        child: child,
      );
    }

    return Container(
      padding: const EdgeInsets.all(2.5),
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          colors: [
            Color(0xFF833AB4),
            Color(0xFFFD1D1D),
            Color(0xFFFCB045),
          ],
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
        ),
      ),
      child: child,
    );
  }
}
