import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/reels/domain/models/comment_item_model.dart';

class CommentsBottomSheet extends StatefulWidget {
  final String reelId;
  final List<CommentItemModel> comments;
  final bool isLoading;
  final Function(String text, String? parentId) onPostComment;
  final Function(String commentId) onDeleteComment;

  const CommentsBottomSheet({
    super.key,
    required this.reelId,
    required this.comments,
    this.isLoading = false,
    required this.onPostComment,
    required this.onDeleteComment,
  });

  @override
  State<CommentsBottomSheet> createState() => _CommentsBottomSheetState();
}

class _CommentsBottomSheetState extends State<CommentsBottomSheet> {
  final TextEditingController _commentController = TextEditingController();
  CommentItemModel? _replyingTo;

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  void _submitComment() {
    final text = _commentController.text.trim();
    if (text.isEmpty) return;

    widget.onPostComment(text, _replyingTo?.id);
    _commentController.clear();
    setState(() {
      _replyingTo = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.65,
      decoration: const BoxDecoration(
        color: AppColors.backgroundSecondary,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 10, bottom: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.divider,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Comments (${widget.comments.length})',
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: AppColors.textSecondary),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.divider),

          // Comments list
          Expanded(
            child: widget.isLoading
                ? const Center(child: CircularProgressIndicator())
                : widget.comments.isEmpty
                    ? const Center(
                        child: Text(
                          'No comments yet. Start the conversation!',
                          style: TextStyle(color: AppColors.textSecondary),
                        ),
                      )
                    : ListView.builder(
                        itemCount: widget.comments.length,
                        itemBuilder: (context, index) {
                          final comment = widget.comments[index];
                          return _buildCommentTile(comment);
                        },
                      ),
          ),

          // Replying banner if active
          if (_replyingTo != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              color: AppColors.backgroundCard,
              child: Row(
                children: [
                  Text(
                    'Replying to @${_replyingTo!.author.username}',
                    style: const TextStyle(
                      color: AppColors.brandPrimary,
                      fontSize: 13,
                    ),
                  ),
                  const Spacer(),
                  GestureDetector(
                    onTap: () => setState(() => _replyingTo = null),
                    child: const Icon(Icons.close, size: 16, color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),

          // Input bar
          Container(
            padding: EdgeInsets.only(
              left: 16,
              right: 8,
              top: 8,
              bottom: 8 + MediaQuery.of(context).viewInsets.bottom,
            ),
            decoration: const BoxDecoration(
              color: AppColors.backgroundPrimary,
              border: Border(top: BorderSide(color: AppColors.divider)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    key: const Key('comment_input_field'),
                    controller: _commentController,
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
                    decoration: InputDecoration(
                      hintText: _replyingTo != null
                          ? 'Reply to @${_replyingTo!.author.username}...'
                          : 'Add a comment...',
                      hintStyle: const TextStyle(color: AppColors.textSecondary),
                      border: InputBorder.none,
                      isDense: true,
                    ),
                  ),
                ),
                IconButton(
                  key: const Key('comment_submit_button'),
                  icon: const Icon(Icons.send, color: AppColors.brandPrimary),
                  onPressed: _submitComment,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCommentTile(CommentItemModel comment) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 16,
                backgroundColor: AppColors.backgroundCard,
                backgroundImage: appAvatarProvider(comment.author.avatarUrl),
                child: comment.author.avatarUrl == null
                    ? Text(
                        comment.author.displayName.isNotEmpty
                            ? comment.author.displayName[0].toUpperCase()
                            : '?',
                        style: const TextStyle(color: AppColors.textPrimary, fontSize: 12),
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
                        Text(
                          comment.author.displayName,
                          style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '@${comment.author.username}',
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 12,
                          ),
                        ),
                        if (comment.isPinned) ...[
                          const SizedBox(width: 6),
                          const Icon(Icons.push_pin, size: 12, color: AppColors.accentGold),
                          const Text(
                            ' Pinned',
                            style: TextStyle(
                              color: AppColors.accentGold,
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      comment.text,
                      style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        GestureDetector(
                          onTap: () {
                            setState(() {
                              _replyingTo = comment;
                            });
                          },
                          child: const Text(
                            'Reply',
                            style: TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                        if (comment.isAuthor) ...[
                          const SizedBox(width: 16),
                          GestureDetector(
                            onTap: () => widget.onDeleteComment(comment.id),
                            child: const Text(
                              'Delete',
                              style: TextStyle(
                                color: AppColors.accentRed,
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          // Threaded replies
          if (comment.replies.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(left: 42, top: 8),
              child: Column(
                children: comment.replies.map((reply) => _buildCommentTile(reply)).toList(),
              ),
            ),
        ],
      ),
    );
  }
}
