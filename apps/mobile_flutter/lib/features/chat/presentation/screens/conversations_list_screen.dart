import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/chat/domain/models/chat_models.dart';
import 'package:mobile/features/chat/domain/models/snap_models.dart';
import 'package:mobile/features/chat/domain/services/snap_manager.dart';
import 'package:mobile/features/chat/presentation/widgets/snap_streak_badge.dart';
import 'package:mobile/features/chat/presentation/widgets/screenshot_alert_banner.dart';
import 'package:mobile/features/chat/presentation/screens/snap_camera_screen.dart';
import 'package:mobile/features/chat/presentation/chat_notifier.dart';
import 'package:mobile/features/chat/presentation/chat_state.dart';
import 'package:mobile/features/chat/presentation/screens/chat_thread_screen.dart';
import 'package:mobile/features/monetization/domain/services/interest_plus_manager.dart';
import 'package:mobile/features/monetization/presentation/widgets/interest_plus_upgrade_sheet.dart';
import '../widgets/view_once_snap_viewer.dart';
import '../widgets/touch_to_view_snap_viewer.dart';
import '../../domain/services/privacy_vault_manager.dart';

class ConversationsListScreen extends StatefulWidget {
  final ChatNotifier notifier;

  const ConversationsListScreen({super.key, required this.notifier});

  @override
  State<ConversationsListScreen> createState() => _ConversationsListScreenState();
}

class _ConversationsListScreenState extends State<ConversationsListScreen> {
  @override
  void initState() {
    super.initState();
    widget.notifier.loadConversations(folder: widget.notifier.activeFolder);
    PrivacyVaultManager().addListener(_onVaultUpdate);
  }

  @override
  void dispose() {
    PrivacyVaultManager().removeListener(_onVaultUpdate);
    super.dispose();
  }

  void _onVaultUpdate() {
    if (mounted) setState(() {});
  }

  final List<ConversationModel> _decoyConversations = [
    ConversationModel(
      id: 'decoy_1',
      title: 'Mom ❤️',
      lastMessagePreview: 'Have you eaten lunch yet? Let me know!',
      lastMessageAt: DateTime.now().subtract(const Duration(minutes: 25)).toIso8601String(),
      lastSeqNum: 1,
      status: ConversationStatus.active,
      unreadCount: 1,
      isMuted: false,
      type: ConversationType.direct,
    ),
    ConversationModel(
      id: 'decoy_2',
      title: 'CS Study Group 📚',
      lastMessagePreview: 'Marcus: Uploaded the notes for chapter 4.',
      lastMessageAt: DateTime.now().subtract(const Duration(hours: 2)).toIso8601String(),
      lastSeqNum: 1,
      status: ConversationStatus.active,
      unreadCount: 0,
      isMuted: false,
      type: ConversationType.group,
    ),
    ConversationModel(
      id: 'decoy_3',
      title: 'Fitness Club 🏋️',
      lastMessagePreview: 'Morning workout at 7:00 AM tomorrow.',
      lastMessageAt: DateTime.now().subtract(const Duration(hours: 5)).toIso8601String(),
      lastSeqNum: 1,
      status: ConversationStatus.active,
      unreadCount: 0,
      isMuted: false,
      type: ConversationType.group,
    ),
  ];

  void _onFolderChanged(String folder) {
    widget.notifier.switchFolder(folder);
  }

  void _openThread(ConversationModel conversation) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ChatThreadScreen(
          conversationId: conversation.id,
          initialTitle: conversation.title,
          isGroup: conversation.type == ConversationType.group,
          notifier: widget.notifier,
        ),
      ),
    ).then((_) {
      // Reload on return
      widget.notifier.loadConversations(folder: widget.notifier.activeFolder);
    });
  }

  void _showVaultPinDialog() {
    final pinController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Row(
          children: [
            Icon(Icons.shield_outlined, color: Colors.cyanAccent),
            SizedBox(width: 8),
            Text('Vault 2.0 Stealth Mode', style: TextStyle(color: Colors.white, fontSize: 16)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Enter PIN to toggle security vault.\nEnter 9999 for Decoy Safe Mode.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: pinController,
              autofocus: true,
              keyboardType: TextInputType.number,
              obscureText: true,
              style: const TextStyle(color: Colors.white, letterSpacing: 4),
              decoration: const InputDecoration(
                hintText: '••••',
                hintStyle: TextStyle(color: Colors.white38),
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.cyanAccent, foregroundColor: Colors.black),
            onPressed: () {
              final pin = pinController.text.trim();
              Navigator.pop(ctx);
              final unlocked = PrivacyVaultManager().unlockWithPin(pin);
              if (unlocked) {
                if (PrivacyVaultManager().isDecoyModeActive) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('🎭 Decoy Mode Unlocked. All sensitive chats cloaked.'),
                      backgroundColor: Colors.blueGrey,
                    ),
                  );
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('🔓 Primary Vault Active.'),
                      backgroundColor: Colors.green,
                    ),
                  );
                }
              } else {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('❌ Invalid PIN.'),
                    backgroundColor: Colors.redAccent,
                  ),
                );
              }
            },
            child: const Text('Authenticate', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _showNewConversationDialog() {
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
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 36,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: AppColors.textMuted.withOpacity(0.4),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                ListTile(
                  leading: const CircleAvatar(
                    backgroundColor: AppColors.surfaceElevated,
                    child: Icon(Icons.person_add_outlined, color: AppColors.primary),
                  ),
                  title: const Text('New Direct Message', style: TextStyle(color: AppColors.textPrimary)),
                  subtitle: const Text('Chat with a creator or friend', style: TextStyle(color: AppColors.textSecondary)),
                  onTap: () {
                    Navigator.pop(ctx);
                    _showCreateDirectDialog();
                  },
                ),
                const Divider(color: AppColors.glassBorder),
                ListTile(
                  leading: const CircleAvatar(
                    backgroundColor: AppColors.surfaceElevated,
                    child: Icon(Icons.group_add_outlined, color: AppColors.secondary),
                  ),
                  title: const Text('New Group Chat', style: TextStyle(color: AppColors.textPrimary)),
                  subtitle: const Text('Create a community discussion group', style: TextStyle(color: AppColors.textSecondary)),
                  onTap: () {
                    Navigator.pop(ctx);
                    _showCreateGroupDialog();
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showCreateDirectDialog() {
    final userIdController = TextEditingController();
    final messageController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Text('Start Direct Message', style: TextStyle(color: AppColors.textPrimary)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: userIdController,
              style: const TextStyle(color: AppColors.textPrimary),
              decoration: const InputDecoration(
                labelText: 'User ID or Username',
                labelStyle: TextStyle(color: AppColors.textSecondary),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: messageController,
              style: const TextStyle(color: AppColors.textPrimary),
              decoration: const InputDecoration(
                labelText: 'Initial message (optional)',
                labelStyle: TextStyle(color: AppColors.textSecondary),
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            onPressed: () async {
              final target = userIdController.text.trim();
              if (target.isEmpty) return;
              Navigator.pop(ctx);
              final initial = messageController.text.trim();
              final conv = await widget.notifier.createDirectChat(
                target,
                initialText: initial.isNotEmpty ? initial : null,
              );
              if (conv != null && mounted) {
                _openThread(conv);
              }
            },
            child: const Text('Chat', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showCreateGroupDialog() {
    final titleController = TextEditingController();
    final membersController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Text('Create Group Chat', style: TextStyle(color: AppColors.textPrimary)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: titleController,
              style: const TextStyle(color: AppColors.textPrimary),
              decoration: const InputDecoration(
                labelText: 'Group Title',
                labelStyle: TextStyle(color: AppColors.textSecondary),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: membersController,
              style: const TextStyle(color: AppColors.textPrimary),
              decoration: const InputDecoration(
                labelText: 'Member IDs (comma separated)',
                labelStyle: TextStyle(color: AppColors.textSecondary),
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            onPressed: () async {
              final title = titleController.text.trim();
              if (title.isEmpty) return;
              final members = membersController.text
                  .split(',')
                  .map((m) => m.trim())
                  .where((m) => m.isNotEmpty)
                  .toList();
              Navigator.pop(ctx);
              final conv = await widget.notifier.createGroupChat(
                title: title,
                participantUserIds: members,
              );
              if (conv != null && mounted) {
                _openThread(conv);
              }
            },
            child: const Text('Create', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        title: AnimatedBuilder(
          animation: widget.notifier,
          builder: (context, _) {
            final unread = widget.notifier.state is ConversationsLoadedState
                ? (widget.notifier.state as ConversationsLoadedState).globalUnreadCount
                : 0;
            return Row(
              children: [
                const Text(
                  'Messages',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.bold,
                    fontSize: 20,
                  ),
                ),
                if (unread > 0) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '$unread',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ],
            );
          },
        ),
        actions: [
          IconButton(
            icon: const Text('💎', style: TextStyle(fontSize: 18)),
            tooltip: 'Interest+ VIP Superpowers',
            onPressed: () => InterestPlusUpgradeSheet.show(context),
          ),
          IconButton(
            icon: const Icon(Icons.camera_alt_outlined, color: Colors.amber),
            tooltip: 'Quick Snap Camera',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const SnapCameraScreen()),
              );
            },
          ),
          IconButton(
            icon: Icon(
              PrivacyVaultManager().isDecoyModeActive ? Icons.lock_open : Icons.shield_outlined,
              color: PrivacyVaultManager().isDecoyModeActive ? Colors.cyanAccent : Colors.white70,
              size: 20,
            ),
            tooltip: PrivacyVaultManager().isDecoyModeActive ? 'Exit Decoy Mode' : 'Stealth Vault',
            onPressed: () {
              if (PrivacyVaultManager().isDecoyModeActive) {
                PrivacyVaultManager().exitDecoyMode();
              } else {
                _showVaultPinDialog();
              }
            },
          ),
          IconButton(
            icon: const Icon(Icons.edit_square, color: AppColors.textPrimary),
            tooltip: 'New conversation',
            onPressed: _showNewConversationDialog,
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: AnimatedBuilder(
            animation: widget.notifier,
            builder: (context, _) {
              final currentFolder = widget.notifier.activeFolder;
              return Container(
                decoration: const BoxDecoration(
                  border: Border(bottom: BorderSide(color: AppColors.glassBorder)),
                ),
                child: Row(
                  children: [
                    _buildTab('primary', 'Primary', currentFolder == 'primary'),
                    _buildTab('requests', 'Requests', currentFolder == 'requests'),
                    _buildTab('archived', 'Archived', currentFolder == 'archived'),
                  ],
                ),
              );
            },
          ),
        ),
      ),
      body: AnimatedBuilder(
        animation: widget.notifier,
        builder: (context, _) {
          final state = widget.notifier.state;

          if (state is ConversationsLoadingState) {
            return const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            );
          }

          if (state is ChatErrorState) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline, color: AppColors.error, size: 48),
                    const SizedBox(height: 12),
                    Text(
                      state.message,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                      onPressed: () => widget.notifier.loadConversations(folder: widget.notifier.activeFolder),
                      child: const Text('Retry', style: TextStyle(color: Colors.white)),
                    ),
                  ],
                ),
              ),
            );
          }

          if (state is ConversationsLoadedState) {
            if (state.conversations.isEmpty) {
              return _buildEmptyState(state.activeFolder);
            }

            return Column(
              children: [
                AnimatedBuilder(
                  animation: SnapManager(),
                  builder: (ctx, _) {
                    final alert = SnapManager().activeScreenshotAlert;
                    if (alert != null) {
                      return ScreenshotAlertBanner(
                        alertMessage: alert,
                        onDismiss: SnapManager().clearScreenshotAlert,
                      );
                    }
                    return const SizedBox.shrink();
                  },
                ),
                AnimatedBuilder(
                  animation: InterestPlusManager(),
                  builder: (ctx, _) {
                    final bff = InterestPlusManager().pinnedBffUsername;
                    if (bff == null) return const SizedBox.shrink();
                    return Container(
                      margin: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                        ),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFF38BDF8).withOpacity(0.5)),
                      ),
                      child: Row(
                        children: [
                          Text(InterestPlusManager().pinnedBffEmoji, style: const TextStyle(fontSize: 20)),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    const Text('#1 BEST FRIEND', style: TextStyle(color: Color(0xFF38BDF8), fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 0.8)),
                                    const SizedBox(width: 6),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                      decoration: BoxDecoration(color: const Color(0xFF0284C7).withOpacity(0.3), borderRadius: BorderRadius.circular(4)),
                                      child: const Text('Interest+', style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold)),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 2),
                                Text('@$bff', style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
                              ],
                            ),
                          ),
                          TextButton.icon(
                            style: TextButton.styleFrom(
                              backgroundColor: Colors.amber.withOpacity(0.15),
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                            icon: const Icon(Icons.ac_unit, color: Colors.amber, size: 14),
                            label: Text(
                              'Freeze (${InterestPlusManager().streakFreezesRemaining})',
                              style: const TextStyle(color: Colors.amber, fontSize: 11, fontWeight: FontWeight.bold),
                            ),
                            onPressed: () {
                              if (InterestPlusManager().useStreakFreeze()) {
                                SnapManager().freezeStreak('conv_direct_1');
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('❄️ Streak frozen! Your streak with @elena_rostova is protected.')),
                                );
                              } else {
                                InterestPlusUpgradeSheet.show(context);
                              }
                            },
                          ),
                        ],
                      ),
                    );
                  },
                ),
                if (PrivacyVaultManager().isDecoyModeActive)
                  Container(
                    margin: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [Colors.blueGrey.shade900, const Color(0xFF1E293B)],
                      ),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.cyanAccent.withOpacity(0.5)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.shield_outlined, color: Colors.cyanAccent, size: 20),
                        const SizedBox(width: 10),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('DECOY STEALTH MODE ACTIVE', style: TextStyle(color: Colors.cyanAccent, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 0.8)),
                              Text('Private conversations and snaps are cloaked', style: TextStyle(color: Colors.white70, fontSize: 11)),
                            ],
                          ),
                        ),
                        TextButton(
                          onPressed: () => PrivacyVaultManager().exitDecoyMode(),
                          child: const Text('Exit', style: TextStyle(color: Colors.cyanAccent, fontWeight: FontWeight.bold, fontSize: 12)),
                        ),
                      ],
                    ),
                  ),
                Expanded(
                  child: Builder(
                    builder: (ctx) {
                      final displayConversations = PrivacyVaultManager().isDecoyModeActive
                          ? _decoyConversations
                          : state.conversations;
                      return RefreshIndicator(
                        color: AppColors.primary,
                        backgroundColor: AppColors.surface,
                        onRefresh: () => widget.notifier.loadConversations(folder: state.activeFolder),
                        child: ListView.separated(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          itemCount: displayConversations.length,
                          separatorBuilder: (ctx, i) => const Divider(
                            height: 1,
                            color: AppColors.glassBorder,
                            indent: 72,
                          ),
                          itemBuilder: (ctx, index) {
                            final conv = displayConversations[index];
                            return _buildConversationTile(conv, state.activeFolder);
                          },
                        ),
                      );
                    },
                  ),
                ),
              ],
            );
          }

          return const SizedBox.shrink();
        },
      ),
    );
  }

  Widget _buildTab(String folder, String label, bool isSelected) {
    return Expanded(
      child: InkWell(
        onTap: () => _onFolderChanged(folder),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: isSelected ? AppColors.primary : Colors.transparent,
                width: 2,
              ),
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: isSelected ? AppColors.primary : AppColors.textSecondary,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              fontSize: 14,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState(String folder) {
    IconData icon;
    String title;
    String subtitle;

    switch (folder) {
      case 'requests':
        icon = Icons.mark_email_unread_outlined;
        title = 'No Message Requests';
        subtitle = 'Messages from people you do not follow will appear here.';
        break;
      case 'archived':
        icon = Icons.archive_outlined;
        title = 'No Archived Chats';
        subtitle = 'Archived conversations will be stored here.';
        break;
      case 'primary':
      default:
        icon = Icons.chat_bubble_outline;
        title = 'No Conversations';
        subtitle = 'Start a conversation with friends, creators, or communities.';
        break;
    }

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 64, color: AppColors.textMuted),
            const SizedBox(height: 16),
            Text(
              title,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildConversationTile(ConversationModel conv, String folder) {
    final hasUnread = conv.unreadCount > 0;

    return Dismissible(
      key: Key('conv_${conv.id}'),
      direction: DismissDirection.endToStart,
      background: Container(
        color: AppColors.error.withOpacity(0.8),
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: const Icon(Icons.delete_outline, color: Colors.white),
      ),
      confirmDismiss: (_) async {
        return await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            backgroundColor: AppColors.surface,
            title: const Text('Delete Conversation', style: TextStyle(color: AppColors.textPrimary)),
            content: const Text(
              'Are you sure you want to delete this conversation? This will remove it from your chat history.',
              style: TextStyle(color: AppColors.textSecondary),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Delete', style: TextStyle(color: Colors.white)),
              ),
            ],
          ),
        );
      },
      onDismissed: (_) {
        widget.notifier.deleteConversation(conv.id);
      },
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        onTap: () => _openThread(conv),
        leading: GestureDetector(
          onTap: () {
            final snap = SnapManager().getLatestSnap(conv.id) ??
                EphemeralSnap(
                  id: 'snap_${conv.id}',
                  senderUsername: conv.title,
                  mediaUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1080',
                  caption: 'Quick check-in snap ✨',
                  sentAt: DateTime.now(),
                );
            if (PrivacyVaultManager().requireTouchToView) {
              TouchToViewSnapViewer.show(context, snap, onFinished: () {
                setState(() {});
              });
            } else {
              ViewOnceSnapViewer.show(context, snap, onFinished: () {
                setState(() {});
              });
            }
          },
          child: Stack(
            children: [
              CircleAvatar(
                radius: 26,
                backgroundColor: AppColors.surfaceElevated,
                backgroundImage: appAvatarProvider(conv.avatarUrl),
                child: conv.avatarUrl == null
                    ? Icon(
                        conv.type == ConversationType.group ? Icons.group : Icons.person,
                        color: AppColors.textSecondary,
                      )
                    : null,
              ),
              if (conv.disappearingTtlSeconds != null && conv.disappearingTtlSeconds! > 0)
                Positioned(
                  bottom: 0,
                  right: 0,
                  child: Container(
                    padding: const EdgeInsets.all(2),
                    decoration: const BoxDecoration(
                      color: AppColors.surface,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.timer_outlined, size: 14, color: AppColors.accentCyan),
                  ),
                ),
            ],
          ),
        ),
        title: Row(
          children: [
            Expanded(
              child: Row(
                children: [
                  Flexible(
                    child: Text(
                      conv.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: hasUnread ? FontWeight.bold : FontWeight.w500,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  Builder(
                    builder: (ctx) {
                      final streak = SnapManager().getStreak(conv.id);
                      if (streak != null) {
                        return Padding(
                          padding: const EdgeInsets.only(left: 6.0),
                          child: SnapStreakBadge(streak: streak),
                        );
                      }
                      return const SizedBox.shrink();
                    },
                  ),
                ],
              ),
            ),
            if (conv.isMuted) ...[
              const SizedBox(width: 4),
              const Icon(Icons.notifications_off_outlined, size: 14, color: AppColors.textMuted),
            ],
            const SizedBox(width: 8),
            Text(
              _formatDate(conv.lastMessageAt),
              style: TextStyle(
                color: hasUnread ? AppColors.primary : AppColors.textMuted,
                fontSize: 12,
              ),
            ),
          ],
        ),
        subtitle: Row(
          children: [
            Expanded(
              child: Text(
                conv.lastMessagePreview ?? 'No messages yet',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: hasUnread ? AppColors.textPrimary : AppColors.textSecondary,
                  fontWeight: hasUnread ? FontWeight.w600 : FontWeight.normal,
                  fontSize: 14,
                ),
              ),
            ),
            if (folder == 'requests') ...[
              const SizedBox(width: 8),
              InkWell(
                onTap: () => widget.notifier.respondToRequest(conv.id, 'ACCEPT'),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text('Accept', style: TextStyle(color: Colors.white, fontSize: 12)),
                ),
              ),
              const SizedBox(width: 6),
              InkWell(
                onTap: () => widget.notifier.respondToRequest(conv.id, 'REJECT'),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceElevated,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text('Decline', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                ),
              ),
            ] else if (hasUnread) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
                child: Text(
                  '${conv.unreadCount}',
                  style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatDate(String isoString) {
    if (isoString.isEmpty) return '';
    try {
      final date = DateTime.parse(isoString);
      final now = DateTime.now();
      final diff = now.difference(date);

      if (diff.inDays == 0) {
        final hour = date.hour.toString().padLeft(2, '0');
        final min = date.minute.toString().padLeft(2, '0');
        return '$hour:$min';
      } else if (diff.inDays == 1) {
        return 'Yesterday';
      } else if (diff.inDays < 7) {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        return days[date.weekday - 1];
      } else {
        return '${date.day}/${date.month}';
      }
    } catch (_) {
      return '';
    }
  }
}
