import 'package:mobile/features/notifications/domain/models/notification_models.dart';

abstract class NotificationsState {
  const NotificationsState();
}

class NotificationsInitialState extends NotificationsState {
  const NotificationsInitialState();
}

class NotificationsLoadingState extends NotificationsState {
  const NotificationsLoadingState();
}

class NotificationsLoadedState extends NotificationsState {
  final List<NotificationModel> items;
  final int unreadCount;
  final String activeFilter; // 'ALL' | 'MENTION' | 'COMMENT' | 'FOLLOW' | 'DM' | 'INTEREST_DIGEST'
  final bool hasMore;
  final bool isRefreshing;

  const NotificationsLoadedState({
    required this.items,
    this.unreadCount = 0,
    this.activeFilter = 'ALL',
    this.hasMore = false,
    this.isRefreshing = false,
  });

  NotificationsLoadedState copyWith({
    List<NotificationModel>? items,
    int? unreadCount,
    String? activeFilter,
    bool? hasMore,
    bool? isRefreshing,
  }) {
    return NotificationsLoadedState(
      items: items ?? this.items,
      unreadCount: unreadCount ?? this.unreadCount,
      activeFilter: activeFilter ?? this.activeFilter,
      hasMore: hasMore ?? this.hasMore,
      isRefreshing: isRefreshing ?? this.isRefreshing,
    );
  }
}

class NotificationPreferencesLoadedState extends NotificationsState {
  final NotificationPreferencesModel preferences;
  final bool isSaving;
  final String? statusMessage;

  const NotificationPreferencesLoadedState({
    required this.preferences,
    this.isSaving = false,
    this.statusMessage,
  });

  NotificationPreferencesLoadedState copyWith({
    NotificationPreferencesModel? preferences,
    bool? isSaving,
    String? statusMessage,
  }) {
    return NotificationPreferencesLoadedState(
      preferences: preferences ?? this.preferences,
      isSaving: isSaving ?? this.isSaving,
      statusMessage: statusMessage,
    );
  }
}

class NotificationsErrorState extends NotificationsState {
  final String message;
  const NotificationsErrorState({required this.message});
}
