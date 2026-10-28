import 'package:flutter/material.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/reels/domain/models/reel_item_model.dart';
import 'package:mobile/features/reels/presentation/reels_notifier.dart';
import 'package:mobile/features/reels/presentation/reels_state.dart';
import 'package:mobile/features/reels/presentation/widgets/reel_card.dart';
import 'package:mobile/features/reels/presentation/widgets/comments_bottom_sheet.dart';

class ReelDetailScreen extends StatefulWidget {
  final String reelId;
  final ReelsNotifier notifier;

  const ReelDetailScreen({
    super.key,
    required this.reelId,
    required this.notifier,
  });

  @override
  State<ReelDetailScreen> createState() => _ReelDetailScreenState();
}

class _ReelDetailScreenState extends State<ReelDetailScreen> {
  @override
  void initState() {
    super.initState();
    widget.notifier.addListener(_onNotifierUpdate);
    widget.notifier.loadReelDetail(widget.reelId);
  }

  @override
  void dispose() {
    widget.notifier.removeListener(_onNotifierUpdate);
    super.dispose();
  }

  void _onNotifierUpdate() {
    if (!mounted) return;
    setState(() {});
  }

  void _showComments(ReelItemModel reel) {
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

  @override
  Widget build(BuildContext context) {
    final state = widget.notifier.detailState;

    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        title: const Text('Post', style: TextStyle(color: AppColors.textPrimary)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _buildContent(state),
    );
  }

  Widget _buildContent(ReelDetailState state) {
    if (state is ReelDetailLoadingState) {
      return const Center(child: CircularProgressIndicator());
    }

    if (state is ReelDetailRemovedState) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.remove_circle_outline, size: 56, color: AppColors.textSecondary),
              const SizedBox(height: 16),
              Text(
                state.message,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.textPrimary, fontSize: 16),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Go Back'),
              ),
            ],
          ),
        ),
      );
    }

    if (state is ReelDetailErrorState) {
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
                onPressed: () => widget.notifier.loadReelDetail(widget.reelId),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (state is ReelDetailLoadedState) {
      final reel = state.reel;
      return ReelCard(
        reel: reel,
        onLike: () => widget.notifier.toggleLike(reel.id),
        onComment: () => _showComments(reel),
        onSave: () => widget.notifier.toggleSave(reel.id),
        onShare: () => widget.notifier.shareReel(reel.id),
      );
    }

    return const SizedBox();
  }
}
