import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/chat/domain/models/chat_models.dart';
import 'package:mobile/features/chat/presentation/chat_notifier.dart';
import 'package:mobile/features/chat/presentation/chat_state.dart';

class ChatThreadScreen extends StatefulWidget {
  final String conversationId;
  final String initialTitle;
  final bool isGroup;
  final ChatNotifier notifier;

  const ChatThreadScreen({
    super.key,
    required this.conversationId,
    required this.initialTitle,
    this.isGroup = false,
    required this.notifier,
  });

  @override
  State<ChatThreadScreen> createState() => _ChatThreadScreenState();
}

class _ChatThreadScreenState extends State<ChatThreadScreen> {
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  bool _canSend = false;

  @override
  void initState() {
    super.initState();
    widget.notifier.loadThread(widget.conversationId);
    _textController.addListener(_onTextChanged);
  }

  @override
  void dispose() {
    _textController.removeListener(_onTextChanged);
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onTextChanged() {
    final can = _textController.text.trim().isNotEmpty;
    if (can != _canSend) {
      setState(() => _canSend = can);
    }
  }

  void _sendMessage({
    String? text,
    MessageType messageType = MessageType.text,
    String? mediaUrl,
    String? voiceUrl,
    double? voiceDurationSeconds,
    String? attachedReelId,
  }) {
    final toSend = text ?? _textController.text.trim();
    if (toSend.isEmpty && mediaUrl == null && voiceUrl == null && attachedReelId == null) {
      return;
    }

    widget.notifier.sendMessage(
      conversationId: widget.conversationId,
      text: toSend.isNotEmpty ? toSend : null,
      messageType: messageType,
      mediaUrl: mediaUrl,
      voiceUrl: voiceUrl,
      voiceDurationSeconds: voiceDurationSeconds,
      attachedReelId: attachedReelId,
    );

    _textController.clear();
  }

  void _showAttachmentMenu() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 16.0, horizontal: 20.0),
            child: Wrap(
              spacing: 20,
              runSpacing: 16,
              children: [
                _buildAttachmentOption(
                  icon: Icons.image_outlined,
                  label: 'Photo',
                  color: AppColors.primary,
                  onTap: () {
                    Navigator.pop(ctx);
                    _sendMessage(
                      text: 'Shared photo',
                      messageType: MessageType.image,
                      mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
                    );
                  },
                ),
                _buildAttachmentOption(
                  icon: Icons.mic_none_outlined,
                  label: 'Voice Note',
                  color: AppColors.accentCyan,
                  onTap: () {
                    Navigator.pop(ctx);
                    _sendMessage(
                      text: 'Voice note (0:14)',
                      messageType: MessageType.voice,
                      voiceUrl: 'https://example.com/voice_sample.m4a',
                      voiceDurationSeconds: 14.5,
                    );
                  },
                ),
                _buildAttachmentOption(
                  icon: Icons.videocam_outlined,
                  label: 'Video',
                  color: AppColors.secondary,
                  onTap: () {
                    Navigator.pop(ctx);
                    _sendMessage(
                      text: 'Shared video clip',
                      messageType: MessageType.video,
                      mediaUrl: 'https://example.com/video_sample.mp4',
                    );
                  },
                ),
                _buildAttachmentOption(
                  icon: Icons.movie_outlined,
                  label: 'Reel Share',
                  color: AppColors.accentPink,
                  onTap: () {
                    Navigator.pop(ctx);
                    _sendMessage(
                      text: 'Check out this Reel!',
                      messageType: MessageType.reel,
                      attachedReelId: 'reel_demo_101',
                    );
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildAttachmentOption({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: SizedBox(
        width: 72,
        child: Column(
          children: [
            CircleAvatar(
              radius: 28,
              backgroundColor: color.withOpacity(0.15),
              child: Icon(icon, color: color, size: 28),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }

  void _showMessageOptions(MessageModel message, bool isMe) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: AppColors.textMuted.withOpacity(0.4),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              if (message.text != null && message.text!.isNotEmpty)
                ListTile(
                  leading: const Icon(Icons.copy, color: AppColors.textPrimary),
                  title: const Text('Copy Text', style: TextStyle(color: AppColors.textPrimary)),
                  onTap: () {
                    Clipboard.setData(ClipboardData(text: message.text!));
                    Navigator.pop(ctx);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Message copied to clipboard')),
                    );
                  },
                ),
              if (isMe && !message.isDeletedForEveryone) ...[
                ListTile(
                  leading: const Icon(Icons.edit_outlined, color: AppColors.primary),
                  title: const Text('Edit Message', style: TextStyle(color: AppColors.textPrimary)),
                  onTap: () {
                    Navigator.pop(ctx);
                    _showEditDialog(message);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.delete_forever_outlined, color: AppColors.error),
                  title: const Text('Delete for Everyone', style: TextStyle(color: AppColors.error)),
                  onTap: () {
                    Navigator.pop(ctx);
                    widget.notifier.deleteMessage(message.id, true);
                  },
                ),
              ],
              ListTile(
                leading: const Icon(Icons.delete_outline, color: AppColors.textSecondary),
                title: const Text('Delete for Me', style: TextStyle(color: AppColors.textSecondary)),
                onTap: () {
                  Navigator.pop(ctx);
                  widget.notifier.deleteMessage(message.id, false);
                },
              ),
              if (!isMe)
                ListTile(
                  leading: const Icon(Icons.flag_outlined, color: AppColors.warning),
                  title: const Text('Report Message', style: TextStyle(color: AppColors.warning)),
                  onTap: () {
                    Navigator.pop(ctx);
                    _showReportDialog(message);
                  },
                ),
            ],
          ),
        );
      },
    );
  }

  void _showEditDialog(MessageModel message) {
    final controller = TextEditingController(text: message.text);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Text('Edit Message', style: TextStyle(color: AppColors.textPrimary)),
        content: TextField(
          controller: controller,
          style: const TextStyle(color: AppColors.textPrimary),
          maxLines: 3,
          decoration: const InputDecoration(
            border: OutlineInputBorder(),
            hintText: 'Edit message...',
            hintStyle: TextStyle(color: AppColors.textMuted),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            onPressed: () {
              final newText = controller.text.trim();
              if (newText.isNotEmpty && newText != message.text) {
                widget.notifier.editMessage(message.id, newText);
              }
              Navigator.pop(ctx);
            },
            child: const Text('Save', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showReportDialog(MessageModel message) {
    String selectedReason = 'HARASSMENT';
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          backgroundColor: AppColors.surface,
          title: const Text('Report Message', style: TextStyle(color: AppColors.textPrimary)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Help keep Interest safe. Why are you reporting this message?',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
              ),
              const SizedBox(height: 12),
              DropdownButton<String>(
                value: selectedReason,
                isExpanded: true,
                dropdownColor: AppColors.surfaceElevated,
                style: const TextStyle(color: AppColors.textPrimary),
                items: const [
                  DropdownMenuItem(value: 'HARASSMENT', child: Text('Harassment or bullying')),
                  DropdownMenuItem(value: 'SPAM', child: Text('Spam or fraud')),
                  DropdownMenuItem(value: 'HATE_SPEECH', child: Text('Hate speech')),
                  DropdownMenuItem(value: 'EXPLICIT_CONTENT', child: Text('Explicit content')),
                  DropdownMenuItem(value: 'VIOLENCE', child: Text('Violence or threat')),
                ],
                onChanged: (val) {
                  if (val != null) {
                    setDialogState(() => selectedReason = val);
                  }
                },
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.warning),
              onPressed: () async {
                Navigator.pop(ctx);
                final success = await widget.notifier.reportMessage(message.id, selectedReason);
                if (mounted && success) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Message reported to safety team.')),
                  );
                }
              },
              child: const Text('Report', style: TextStyle(color: Colors.black)),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.notifier,
      builder: (context, _) {
        final state = widget.notifier.state;
        ConversationModel? conv;
        List<MessageModel> messages = [];
        bool isSyncing = false;

        if (state is ThreadLoadedState) {
          conv = state.conversation;
          messages = state.messages;
          isSyncing = state.isSyncing;
        }

        final title = conv?.title ?? widget.initialTitle;
        final isMuted = conv?.isMuted ?? false;
        final ttlSeconds = conv?.disappearingTtlSeconds;

        return Scaffold(
          backgroundColor: AppColors.background,
          appBar: AppBar(
            backgroundColor: AppColors.surface,
            elevation: 0,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
              onPressed: () => Navigator.pop(context),
            ),
            title: Row(
              children: [
                CircleAvatar(
                  radius: 18,
                  backgroundColor: AppColors.surfaceElevated,
                  backgroundImage: appAvatarProvider(conv?.avatarUrl),
                  child: conv?.avatarUrl == null
                      ? Icon(
                          widget.isGroup ? Icons.group : Icons.person,
                          size: 18,
                          color: AppColors.textSecondary,
                        )
                      : null,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      if (ttlSeconds != null && ttlSeconds > 0)
                        Row(
                          children: [
                            const Icon(Icons.timer_outlined, size: 12, color: AppColors.accentCyan),
                            const SizedBox(width: 4),
                            Text(
                              'Disappearing (${ttlSeconds ~/ 60}m)',
                              style: const TextStyle(color: AppColors.accentCyan, fontSize: 11),
                            ),
                          ],
                        )
                      else if (widget.isGroup && conv != null)
                        Text(
                          '${conv.participants.length} members',
                          style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                        ),
                    ],
                  ),
                ),
              ],
            ),
            actions: [
              IconButton(
                icon: Icon(
                  isMuted ? Icons.notifications_off : Icons.notifications_outlined,
                  color: isMuted ? AppColors.accentGold : AppColors.textPrimary,
                ),
                tooltip: isMuted ? 'Unmute' : 'Mute',
                onPressed: () => widget.notifier.toggleMute(widget.conversationId, !isMuted),
              ),
              PopupMenuButton<String>(
                icon: const Icon(Icons.more_vert, color: AppColors.textPrimary),
                color: AppColors.surfaceElevated,
                onSelected: (val) {
                  if (val == 'sync') {
                    widget.notifier.syncThread(widget.conversationId);
                  } else if (val == 'archive') {
                    final isArchived = conv?.isArchived ?? false;
                    widget.notifier.toggleArchive(widget.conversationId, !isArchived);
                  } else if (val == 'delete') {
                    widget.notifier.deleteConversation(widget.conversationId);
                    Navigator.pop(context);
                  }
                },
                itemBuilder: (ctx) => [
                  const PopupMenuItem(
                    value: 'sync',
                    child: Row(
                      children: [
                        Icon(Icons.sync, color: AppColors.primary, size: 20),
                        SizedBox(width: 8),
                        Text('Sync Messages', style: TextStyle(color: AppColors.textPrimary)),
                      ],
                    ),
                  ),
                  PopupMenuItem(
                    value: 'archive',
                    child: Row(
                      children: [
                        const Icon(Icons.archive_outlined, color: AppColors.textSecondary, size: 20),
                        const SizedBox(width: 8),
                        Text(
                          conv?.isArchived == true ? 'Unarchive' : 'Archive',
                          style: const TextStyle(color: AppColors.textPrimary),
                        ),
                      ],
                    ),
                  ),
                  const PopupMenuItem(
                    value: 'delete',
                    child: Row(
                      children: [
                        Icon(Icons.delete_outline, color: AppColors.error, size: 20),
                        SizedBox(width: 8),
                        Text('Delete Chat', style: TextStyle(color: AppColors.error)),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
          body: Column(
            children: [
              if (isSyncing)
                Container(
                  color: AppColors.primary.withOpacity(0.15),
                  padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 16),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      SizedBox(
                        width: 12,
                        height: 12,
                        child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                      ),
                      SizedBox(width: 8),
                      Text(
                        'Catching up messages...',
                        style: TextStyle(color: AppColors.primary, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              Expanded(
                child: state is ThreadLoadingState
                    ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                    : messages.isEmpty
                        ? _buildEmptyThread()
                        : _buildMessagesList(messages.reversed.toList()),
              ),
              _buildInputBar(),
            ],
          ),
        );
      },
    );
  }

  Widget _buildEmptyThread() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.waving_hand_outlined, size: 56, color: AppColors.textMuted),
            const SizedBox(height: 16),
            const Text(
              'Say Hello!',
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Start your conversation with ${widget.initialTitle}. Messages are transmitted securely via TLS 1.3.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMessagesList(List<MessageModel> reversedMessages) {
    return ListView.builder(
      controller: _scrollController,
      reverse: true,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      itemCount: reversedMessages.length,
      itemBuilder: (ctx, index) {
        final message = reversedMessages[index];
        final isMe = message.senderId == 'me' || message.isSending;
        return _buildMessageBubble(message, isMe);
      },
    );
  }

  Widget _buildMessageBubble(MessageModel message, bool isMe) {
    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: GestureDetector(
        onLongPress: () => _showMessageOptions(message, isMe),
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 4),
          constraints: BoxConstraints(
            maxWidth: MediaQuery.of(context).size.width * 0.76,
          ),
          decoration: BoxDecoration(
            color: isMe ? AppColors.primary : AppColors.surfaceElevated,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(16),
              topRight: const Radius.circular(16),
              bottomLeft: Radius.circular(isMe ? 16 : 4),
              bottomRight: Radius.circular(isMe ? 4 : 16),
            ),
            border: Border.all(
              color: isMe ? Colors.transparent : AppColors.glassBorder,
              width: 1,
            ),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Column(
            crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
            children: [
              if (!isMe && widget.isGroup)
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(
                    message.senderDisplayName,
                    style: const TextStyle(
                      color: AppColors.secondary,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              if (message.isDeletedForEveryone)
                const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.block, size: 14, color: AppColors.textMuted),
                    SizedBox(width: 4),
                    Text(
                      'This message was deleted.',
                      style: TextStyle(
                        color: AppColors.textMuted,
                        fontStyle: FontStyle.italic,
                        fontSize: 13,
                      ),
                    ),
                  ],
                )
              else ...[
                if (message.mediaUrl != null && message.messageType == MessageType.image)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: OptimizedNetworkImage(
                      imageUrl: message.mediaUrl!,
                      fit: BoxFit.cover,
                      targetCacheWidth: 600,
                      targetCacheHeight: 600,
                    ),
                  ),
                if (message.messageType == MessageType.voice)
                  _buildVoiceNoteWidget(message, isMe),
                if (message.messageType == MessageType.reel)
                  _buildReelShareWidget(message),
                if (message.text != null && message.text!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      message.text!,
                      style: const TextStyle(color: Colors.white, fontSize: 14.5),
                    ),
                  ),
              ],
              const SizedBox(height: 4),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (message.isEdited)
                    const Padding(
                      padding: EdgeInsets.only(right: 4),
                      child: Text(
                        '(edited)',
                        style: TextStyle(color: AppColors.textMuted, fontSize: 10),
                      ),
                    ),
                  Text(
                    _formatTime(message.createdAt),
                    style: TextStyle(
                      color: isMe ? Colors.white.withOpacity(0.7) : AppColors.textMuted,
                      fontSize: 10,
                    ),
                  ),
                  if (isMe) ...[
                    const SizedBox(width: 4),
                    _buildStatusIcon(message),
                  ],
                ],
              ),
              if (message.hasFailed)
                GestureDetector(
                  onTap: () => widget.notifier.retrySendMessage(message),
                  child: const Padding(
                    padding: EdgeInsets.only(top: 4),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.refresh, size: 14, color: AppColors.error),
                        SizedBox(width: 4),
                        Text(
                          'Failed. Tap to retry',
                          style: TextStyle(color: AppColors.error, fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildVoiceNoteWidget(MessageModel message, bool isMe) {
    final dur = message.voiceDurationSeconds != null
        ? '${message.voiceDurationSeconds!.toInt()}s'
        : '0:15';
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 8),
      decoration: BoxDecoration(
        color: (isMe ? Colors.white : AppColors.surface).withOpacity(0.12),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircleAvatar(
            radius: 16,
            backgroundColor: isMe ? Colors.white : AppColors.primary,
            child: Icon(Icons.play_arrow, size: 18, color: isMe ? AppColors.primary : Colors.white),
          ),
          const SizedBox(width: 8),
          const Icon(Icons.graphic_eq, color: AppColors.textSecondary, size: 20),
          const SizedBox(width: 8),
          Text(dur, style: const TextStyle(color: Colors.white, fontSize: 12)),
        ],
      ),
    );
  }

  Widget _buildReelShareWidget(MessageModel message) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4),
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: AppColors.surfaceElevated,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 52,
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(6),
            ),
            child: const Icon(Icons.play_circle_outline, color: AppColors.accentPink),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  message.attachedReelTitle ?? 'Shared Reel',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 13),
                ),
                const SizedBox(height: 2),
                const Text(
                  'Watch on Interest',
                  style: TextStyle(color: AppColors.textMuted, fontSize: 11),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusIcon(MessageModel message) {
    if (message.isSending) {
      return const SizedBox(
        width: 10,
        height: 10,
        child: CircularProgressIndicator(strokeWidth: 1.5, color: Colors.white),
      );
    }
    if (message.hasFailed) {
      return const Icon(Icons.error, size: 12, color: AppColors.error);
    }
    if (message.status == MessageStatus.read || message.isRead) {
      return const Icon(Icons.done_all, size: 14, color: AppColors.accentCyan);
    }
    if (message.status == MessageStatus.delivered) {
      return Icon(Icons.done_all, size: 14, color: Colors.white.withOpacity(0.7));
    }
    return Icon(Icons.check, size: 14, color: Colors.white.withOpacity(0.7));
  }

  Widget _buildInputBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.glassBorder)),
      ),
      child: SafeArea(
        child: Row(
          children: [
            IconButton(
              icon: const Icon(Icons.add_circle_outline, color: AppColors.textSecondary),
              tooltip: 'Attach media or voice',
              onPressed: _showAttachmentMenu,
            ),
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.surfaceElevated,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.glassBorder),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: TextField(
                  controller: _textController,
                  style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
                  minLines: 1,
                  maxLines: 4,
                  decoration: const InputDecoration(
                    border: InputBorder.none,
                    hintText: 'Message...',
                    hintStyle: TextStyle(color: AppColors.textMuted),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 6),
            IconButton(
              icon: Icon(
                _canSend ? Icons.send : Icons.mic_none,
                color: _canSend ? AppColors.primary : AppColors.textSecondary,
              ),
              onPressed: _canSend
                  ? () => _sendMessage()
                  : () {
                      _sendMessage(
                        text: 'Voice note (0:08)',
                        messageType: MessageType.voice,
                        voiceUrl: 'https://example.com/voice_sample.m4a',
                        voiceDurationSeconds: 8.0,
                      );
                    },
            ),
          ],
        ),
      ),
    );
  }

  String _formatTime(String isoString) {
    try {
      final date = DateTime.parse(isoString);
      final hour = date.hour.toString().padLeft(2, '0');
      final min = date.minute.toString().padLeft(2, '0');
      return '$hour:$min';
    } catch (_) {
      return '';
    }
  }
}
