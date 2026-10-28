import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/notifications/data/notifications_api_client.dart';
import 'package:mobile/features/notifications/data/notifications_repository.dart';
import 'package:mobile/features/notifications/domain/models/notification_models.dart';
import 'package:mobile/features/notifications/presentation/notifications_notifier.dart';
import 'package:mobile/features/notifications/presentation/notifications_state.dart';
import 'package:mobile/features/notifications/presentation/screens/notification_settings_screen.dart';
import 'package:mobile/features/notifications/services/deep_link_navigator.dart';

class NotificationsScreen extends StatefulWidget {
  final NotificationsNotifier? notifier;

  const NotificationsScreen({super.key, this.notifier});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  late final NotificationsNotifier _notifier;
  late final bool _ownsNotifier;

  final List<Map<String, String>> _filters = [
    {'id': 'ALL', 'label': 'All'},
    {'id': 'MENTION', 'label': 'Mentions'},
    {'id': 'COMMENT', 'label': 'Comments'},
    {'id': 'FOLLOW', 'label': 'Follows'},
    {'id': 'DM', 'label': 'Messages'},
    {'id': 'CREATOR_MILESTONE', 'label': 'Milestones'},
  ];

  @override
  void initState() {
    super.initState();
    if (widget.notifier != null) {
      _notifier = widget.notifier!;
      _ownsNotifier = false;
    } else {
      _notifier = NotificationsNotifier(
        repository: NotificationsRepository(
          apiClient: NotificationsApiClient(),
          secureStorage: PlatformSecureStorageService(),
        ),
      );
      _ownsNotifier = true;
    }

    _notifier.loadNotifications();
  }

  @override
  void dispose() {
    if (_ownsNotifier) {
      _notifier.dispose();
    }
    super.dispose();
  }

  void _onNotificationTap(NotificationModel notification) {
    if (!notification.isRead) {
      _notifier.markAsRead(notification.id);
    }

    if (notification.deepLinkUrl != null && notification.deepLinkUrl!.isNotEmpty) {
      DeepLinkNavigator.handleDeepLink(
        context,
        notification.deepLinkUrl!,
        repository: _notifier.repository,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        title: AnimatedBuilder(
          animation: _notifier,
          builder: (context, _) {
            final unread = _notifier.state is NotificationsLoadedState
                ? (_notifier.state as NotificationsLoadedState).unreadCount
                : 0;
            return Row(
              children: [
                const Text(
                  'Notifications',
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
            icon: const Icon(Icons.done_all, color: AppColors.textSecondary),
            tooltip: 'Mark all as read',
            onPressed: () => _notifier.markAllAsRead(),
          ),
          IconButton(
            icon: const Icon(Icons.settings_outlined, color: AppColors.textPrimary),
            tooltip: 'Notification settings',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => NotificationSettingsScreen(notifier: _notifier),
                ),
              );
            },
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: Container(
            height: 48,
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: AppColors.glassBorder)),
            ),
            child: AnimatedBuilder(
              animation: _notifier,
              builder: (context, _) {
                final currentFilter = _notifier.activeFilter;
                return ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  itemCount: _filters.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (ctx, index) {
                    final item = _filters[index];
                    final isSelected = item['id'] == currentFilter;
                    return InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: () => _notifier.filterByType(item['id']!),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                        decoration: BoxDecoration(
                          color: isSelected ? AppColors.primary : AppColors.surfaceElevated,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: isSelected ? Colors.transparent : AppColors.glassBorder,
                          ),
                        ),
                        child: Text(
                          item['label']!,
                          style: TextStyle(
                            color: isSelected ? Colors.white : AppColors.textSecondary,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ),
      ),
      body: AnimatedBuilder(
        animation: _notifier,
        builder: (context, _) {
          final state = _notifier.state;

          if (state is NotificationsLoadingState) {
            return const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            );
          }

          if (state is NotificationsErrorState) {
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
                      onPressed: () => _notifier.loadNotifications(refresh: true),
                      child: const Text('Retry', style: TextStyle(color: Colors.white)),
                    ),
                  ],
                ),
              ),
            );
          }

          if (state is NotificationsLoadedState) {
            if (state.items.isEmpty) {
              return _buildEmptyState(state.activeFilter);
            }

            return RefreshIndicator(
              color: AppColors.primary,
              backgroundColor: AppColors.surface,
              onRefresh: () => _notifier.loadNotifications(refresh: true),
              child: ListView.separated(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(vertical: 8),
                itemCount: state.items.length,
                separatorBuilder: (ctx, i) => const Divider(
                  height: 1,
                  color: AppColors.glassBorder,
                  indent: 72,
                ),
                itemBuilder: (ctx, index) {
                  final notif = state.items[index];
                  return _buildNotificationTile(notif);
                },
              ),
            );
          }

          return const SizedBox.shrink();
        },
      ),
    );
  }

  Widget _buildEmptyState(String filter) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.notifications_none_outlined, size: 64, color: AppColors.textMuted),
            const SizedBox(height: 16),
            const Text(
              'No Notifications',
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              filter == 'ALL'
                  ? 'You are all caught up! When you receive likes, comments, or mentions, they will show up here.'
                  : 'No notifications in this category.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNotificationTile(NotificationModel notif) {
    final actor = notif.actors.isNotEmpty ? notif.actors.first : null;

    return Container(
      color: notif.isRead ? Colors.transparent : AppColors.primary.withOpacity(0.06),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        onTap: () => _onNotificationTap(notif),
        leading: Stack(
          clipBehavior: Clip.none,
          children: [
            CircleAvatar(
              radius: 22,
              backgroundColor: AppColors.surfaceElevated,
              backgroundImage: appAvatarProvider(actor?.avatarUrl),
              child: actor?.avatarUrl == null
                  ? Text(
                      actor != null && actor.displayName.isNotEmpty
                          ? actor.displayName[0].toUpperCase()
                          : '?',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                    )
                  : null,
            ),
            Positioned(
              bottom: -2,
              right: -2,
              child: Container(
                padding: const EdgeInsets.all(3),
                decoration: const BoxDecoration(
                  color: AppColors.surface,
                  shape: BoxShape.circle,
                ),
                child: _buildTypeBadgeIcon(notif.type),
              ),
            ),
          ],
        ),
        title: Row(
          children: [
            Expanded(
              child: Text(
                notif.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontWeight: notif.isRead ? FontWeight.normal : FontWeight.bold,
                  fontSize: 14.5,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              _formatDate(notif.createdAt),
              style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
            ),
          ],
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4.0),
          child: Text(
            notif.body,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: notif.isRead ? AppColors.textSecondary : AppColors.textPrimary.withOpacity(0.9),
              fontSize: 13,
            ),
          ),
        ),
        trailing: !notif.isRead
            ? Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
              )
            : null,
      ),
    );
  }

  Widget _buildTypeBadgeIcon(NotificationType type) {
    IconData icon;
    Color color;

    switch (type) {
      case NotificationType.like:
        icon = Icons.favorite;
        color = AppColors.accentPink;
        break;
      case NotificationType.comment:
        icon = Icons.chat_bubble;
        color = AppColors.primary;
        break;
      case NotificationType.mention:
        icon = Icons.alternate_email;
        color = AppColors.accentCyan;
        break;
      case NotificationType.follow:
        icon = Icons.person_add;
        color = AppColors.secondary;
        break;
      case NotificationType.dm:
        icon = Icons.send;
        color = AppColors.accentCyan;
        break;
      case NotificationType.creatorMilestone:
        icon = Icons.emoji_events;
        color = AppColors.accentGold;
        break;
      case NotificationType.securityAlert:
        icon = Icons.shield;
        color = AppColors.error;
        break;
      case NotificationType.interestDigest:
      case NotificationType.system:
      default:
        icon = Icons.notifications;
        color = AppColors.primary;
        break;
    }

    return Icon(icon, size: 12, color: color);
  }

  String _formatDate(String isoString) {
    if (isoString.isEmpty) return '';
    try {
      final date = DateTime.parse(isoString);
      final now = DateTime.now();
      final diff = now.difference(date);

      if (diff.inMinutes < 60) {
        return '${diff.inMinutes}m';
      } else if (diff.inHours < 24) {
        return '${diff.inHours}h';
      } else if (diff.inDays < 7) {
        return '${diff.inDays}d';
      } else {
        return '${date.day}/${date.month}';
      }
    } catch (_) {
      return '';
    }
  }
}
