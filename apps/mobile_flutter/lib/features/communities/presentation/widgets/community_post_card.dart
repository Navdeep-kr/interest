import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/features/communities/domain/models/community_models.dart';

class CommunityPostCard extends StatelessWidget {
  final CommunityPostModel post;
  final bool isStaff;
  final VoidCallback? onTogglePin;
  final VoidCallback? onReport;

  const CommunityPostCard({
    super.key,
    required this.post,
    this.isStaff = false,
    this.onTogglePin,
    this.onReport,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: post.isPinned
            ? const BorderSide(color: Colors.blueAccent, width: 1.5)
            : BorderSide(color: Theme.of(context).dividerColor.withOpacity(0.1)),
      ),
      color: post.isAnnouncement
          ? const Color(0xFF1E2638)
          : Theme.of(context).cardColor,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Pinned Banner
            if (post.isPinned) ...[
              const Row(
                children: [
                  Icon(Icons.push_pin, size: 14, color: Colors.blueAccent),
                  SizedBox(width: 4),
                  Text(
                    'PINNED POST',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: Colors.blueAccent,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
            ],

            // Author Header
            Row(
              children: [
                CircleAvatar(
                  radius: 16,
                  backgroundColor: Colors.grey.shade700,
                  backgroundImage: appAvatarProvider(post.author.avatarUrl),
                  child: post.author.avatarUrl == null
                      ? Text(
                          post.author.displayName.isNotEmpty
                              ? post.author.displayName[0].toUpperCase()
                              : '?',
                          style: const TextStyle(fontSize: 12, color: Colors.white),
                        )
                      : null,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              post.author.displayName,
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (post.author.isVerified) ...[
                            const SizedBox(width: 4),
                            const Icon(Icons.verified, size: 13, color: Colors.blueAccent),
                          ],
                        ],
                      ),
                      Text(
                        '@${post.author.username}',
                        style: TextStyle(
                          fontSize: 11,
                          color: Theme.of(context).textTheme.bodySmall?.color,
                        ),
                      ),
                    ],
                  ),
                ),

                // Post Type Badge
                if (post.isAnnouncement)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.orange.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: Colors.orange, width: 0.8),
                    ),
                    child: const Text(
                      'Announcement',
                      style: TextStyle(fontSize: 10, color: Colors.orange, fontWeight: FontWeight.bold),
                    ),
                  )
                else if (post.postType == CommunityPostType.collaborative)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.purple.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: Colors.purpleAccent, width: 0.8),
                    ),
                    child: const Text(
                      'Collab',
                      style: TextStyle(fontSize: 10, color: Colors.purpleAccent, fontWeight: FontWeight.bold),
                    ),
                  ),

                // Popup menu
                PopupMenuButton<String>(
                  icon: const Icon(Icons.more_vert, size: 18),
                  onSelected: (val) {
                    if (val == 'pin') onTogglePin?.call();
                    if (val == 'report') onReport?.call();
                  },
                  itemBuilder: (context) => [
                    if (isStaff)
                      PopupMenuItem(
                        value: 'pin',
                        child: Text(post.isPinned ? 'Unpin Post' : 'Pin Post'),
                      ),
                    const PopupMenuItem(
                      value: 'report',
                      child: Text('Report Post'),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Title
            Text(
              post.title,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 6),

            // Body
            Text(
              post.body,
              style: const TextStyle(fontSize: 14, height: 1.3),
            ),
            const SizedBox(height: 10),

            // Collaborative Co-authors Pill
            if (post.collaborators.isNotEmpty) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: Theme.of(context).dividerColor.withOpacity(0.05),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.group, size: 14, color: Colors.purpleAccent),
                    const SizedBox(width: 6),
                    Text(
                      'Co-authored with: ${post.collaborators.map((c) => c.displayName).join(', ')}',
                      style: const TextStyle(fontSize: 11, color: Colors.purpleAccent),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
            ],

            // Engagement Bar
            Row(
              children: [
                const Icon(Icons.thumb_up_alt_outlined, size: 16, color: Colors.white54),
                const SizedBox(width: 4),
                Text('${post.likesCount}', style: const TextStyle(fontSize: 12, color: Colors.white54)),
                const SizedBox(width: 16),
                const Icon(Icons.chat_bubble_outline, size: 16, color: Colors.white54),
                const SizedBox(width: 4),
                Text('${post.commentsCount}', style: const TextStyle(fontSize: 12, color: Colors.white54)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
