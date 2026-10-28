import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/core/theme/app_colors.dart';
import '../../domain/models/story_highlight_model.dart';
import '../screens/highlight_viewer_screen.dart';

/// Instagram-style Profile Story Highlights Tray.
class StoryHighlightsTray extends StatelessWidget {
  final List<StoryHighlightModel> highlights;
  final bool isMe;
  final VoidCallback? onAddHighlight;

  const StoryHighlightsTray({
    super.key,
    required this.highlights,
    this.isMe = true,
    this.onAddHighlight,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 96,
      margin: const EdgeInsets.symmetric(vertical: 8),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        itemCount: highlights.length + (isMe ? 1 : 0),
        itemBuilder: (ctx, index) {
          if (isMe && index == 0) {
            return _buildAddHighlightButton(context);
          }
          final highlightIndex = isMe ? index - 1 : index;
          final highlight = highlights[highlightIndex];
          return _buildHighlightItem(context, highlight);
        },
      ),
    );
  }

  Widget _buildAddHighlightButton(BuildContext context) {
    return GestureDetector(
      onTap: () {
        if (onAddHighlight != null) {
          onAddHighlight!();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Select archived stories to create a new Highlight!')),
          );
        }
      },
      child: Container(
        width: 72,
        margin: const EdgeInsets.only(right: 12),
        child: Column(
          children: [
            Container(
              width: 60,
              height: 60,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.glassBorder, width: 1.5),
                color: AppColors.surfaceElevated,
              ),
              child: const Icon(Icons.add, color: Colors.white, size: 24),
            ),
            const SizedBox(height: 6),
            const Text(
              'New',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 11),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHighlightItem(BuildContext context, StoryHighlightModel highlight) {
    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => HighlightViewerScreen(highlight: highlight),
          ),
        );
      },
      child: Container(
        width: 72,
        margin: const EdgeInsets.only(right: 12),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(2.5),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.primary, width: 1.8),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(30),
                child: SizedBox(
                  width: 54,
                  height: 54,
                  child: highlight.coverUrl.isNotEmpty
                      ? OptimizedNetworkImage(imageUrl: highlight.coverUrl, fit: BoxFit.cover)
                      : Container(
                          color: AppColors.surfaceElevated,
                          child: const Icon(Icons.auto_stories, color: Colors.white, size: 20),
                        ),
                ),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              highlight.title,
              style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
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
