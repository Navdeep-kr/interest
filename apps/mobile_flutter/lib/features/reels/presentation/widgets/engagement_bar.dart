import 'package:flutter/material.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/reels/domain/models/reel_item_model.dart';

class EngagementBar extends StatelessWidget {
  final ReelItemModel reel;
  final VoidCallback onLike;
  final VoidCallback onComment;
  final VoidCallback onSave;
  final VoidCallback onShare;
  final VoidCallback? onMore;
  final VoidCallback? onDownload;
  final VoidCallback? onPiP;
  final VoidCallback? onSaveLongPress;

  const EngagementBar({
    super.key,
    required this.reel,
    required this.onLike,
    required this.onComment,
    required this.onSave,
    required this.onShare,
    this.onMore,
    this.onDownload,
    this.onPiP,
    this.onSaveLongPress,
  });

  String _formatCount(int count) {
    if (count >= 1000000) {
      return '${(count / 1000000).toStringAsFixed(1)}M';
    }
    if (count >= 1000) {
      return '${(count / 1000).toStringAsFixed(1)}K';
    }
    return count.toString();
  }

  void _showReactionsPicker(BuildContext context) {
    final overlay = Overlay.of(context);
    late OverlayEntry entry;
    final RenderBox renderBox = context.findRenderObject() as RenderBox;
    final position = renderBox.localToGlobal(Offset.zero);

    final reactions = [
      {'emoji': '❤️', 'name': 'Love'},
      {'emoji': '🔥', 'name': 'Fire'},
      {'emoji': '👏', 'name': 'Bravo'},
      {'emoji': '🤯', 'name': 'Mindblown'},
      {'emoji': '💡', 'name': 'Insightful'},
      {'emoji': '😂', 'name': 'Haha'},
    ];

    entry = OverlayEntry(
      builder: (ctx) => Stack(
        children: [
          Positioned.fill(
            child: GestureDetector(
              behavior: HitTestBehavior.translucent,
              onTap: () => entry.remove(),
            ),
          ),
          Positioned(
            right: 50,
            top: (position.dy - 50).clamp(60.0, MediaQuery.of(context).size.height - 120),
            child: Material(
              color: Colors.transparent,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.85),
                  borderRadius: BorderRadius.circular(30),
                  border: Border.all(color: AppColors.primary.withOpacity(0.4), width: 1.2),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.6),
                      blurRadius: 16,
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: reactions.map((r) {
                    return GestureDetector(
                      onTap: () {
                        entry.remove();
                        onLike();
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Reacted with ${r['emoji']} ${r['name']}'),
                            duration: const Duration(seconds: 1),
                            backgroundColor: Colors.grey.shade900,
                          ),
                        );
                      },
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 6.0),
                        child: Text(
                          r['emoji']!,
                          style: const TextStyle(fontSize: 26),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
          ),
        ],
      ),
    );

    overlay.insert(entry);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        // Like button with single-tap and long-press Facebook-style reactions
        GestureDetector(
          onLongPress: () => _showReactionsPicker(context),
          child: _buildActionItem(
            icon: reel.isLiked ? Icons.favorite : Icons.favorite_border,
            color: reel.isLiked ? AppColors.accentRed : Colors.white,
            count: reel.likeCount,
            onTap: onLike,
            key: const Key('engagement_like_button'),
          ),
        ),
        const SizedBox(height: 14),

        // Comment button
        _buildActionItem(
          icon: Icons.chat_bubble_outline,
          color: Colors.white,
          count: reel.commentCount,
          onTap: onComment,
          key: const Key('engagement_comment_button'),
        ),
        const SizedBox(height: 14),

        // Save / Bookmark button (Tap = quick save, Long-press = save to collection)
        GestureDetector(
          onLongPress: onSaveLongPress,
          child: _buildActionItem(
            icon: reel.isSaved ? Icons.bookmark : Icons.bookmark_border,
            color: reel.isSaved ? AppColors.brandPrimary : Colors.white,
            count: reel.saveCount,
            onTap: onSave,
            key: const Key('engagement_save_button'),
          ),
        ),
        const SizedBox(height: 14),

        // Snaptube Media Downloader Button
        if (onDownload != null) ...[
          GestureDetector(
            onTap: onDownload,
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: AppColors.accentPink.withOpacity(0.2),
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.accentPink.withOpacity(0.5), width: 1),
                  ),
                  child: const Icon(Icons.download, color: AppColors.accentPink, size: 22),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Offline',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    shadows: [Shadow(color: Colors.black54, blurRadius: 4)],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
        ],

        // Floating PiP Player Button
        if (onPiP != null) ...[
          GestureDetector(
            onTap: onPiP,
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: AppColors.accentCyan.withOpacity(0.2),
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.accentCyan.withOpacity(0.5), width: 1),
                  ),
                  child: const Icon(Icons.picture_in_picture_alt, color: AppColors.accentCyan, size: 22),
                ),
                const SizedBox(height: 4),
                const Text(
                  'PiP',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    shadows: [Shadow(color: Colors.black54, blurRadius: 4)],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
        ],

        // Share button
        _buildActionItem(
          icon: Icons.share,
          color: Colors.white,
          count: reel.shareCount,
          onTap: onShare,
          key: const Key('engagement_share_button'),
        ),
        if (onMore != null) ...[
          const SizedBox(height: 12),
          IconButton(
            key: const Key('engagement_more_button'),
            icon: const Icon(Icons.more_vert, color: Colors.white),
            onPressed: onMore,
          ),
        ],
      ],
    );
  }

  Widget _buildActionItem({
    required IconData icon,
    required Color color,
    required int count,
    required VoidCallback onTap,
    required Key key,
  }) {
    return Column(
      children: [
        IconButton(
          key: key,
          icon: Icon(icon, color: color, size: 28),
          onPressed: onTap,
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(),
        ),
        const SizedBox(height: 4),
        Text(
          _formatCount(count),
          style: const TextStyle(
            color: Colors.white,
            fontSize: 12,
            fontWeight: FontWeight.w600,
            shadows: [
              Shadow(
                color: Colors.black54,
                blurRadius: 4,
              ),
            ],
          ),
        ),
      ],
    );
  }
}
