import 'package:flutter/foundation.dart';
import 'package:mobile/core/error/failures.dart';
import 'package:mobile/features/notifications/data/notifications_repository.dart';
import 'package:mobile/features/notifications/domain/models/notification_models.dart';
import 'package:mobile/features/notifications/presentation/notifications_state.dart';

class NotificationsNotifier extends ChangeNotifier {
  final NotificationsRepository repository;

  NotificationsState _state = const NotificationsInitialState();
  NotificationsState get state => _state;

  String _activeFilter = 'ALL';
  String get activeFilter => _activeFilter;

  NotificationsNotifier({required this.repository});

  void _setState(NotificationsState newState) {
    _state = newState;
    notifyListeners();
  }

  /// Loads notifications for the in-app notification center.
  Future<void> loadNotifications({String? filterType, bool refresh = false}) async {
    if (filterType != null) {
      _activeFilter = filterType;
    }

    if (!refresh && _state is! NotificationsLoadedState) {
      _setState(const NotificationsLoadingState());
    } else if (refresh && _state is NotificationsLoadedState) {
      _setState((_state as NotificationsLoadedState).copyWith(isRefreshing: true));
    }

    try {
      final res = await repository.getNotifications(
        type: _activeFilter == 'ALL' ? null : _activeFilter,
        limit: 30,
        offset: 0,
      );

      final items = res['items'] as List<NotificationModel>;
      final unreadCount = res['unreadCount'] as int;

      _setState(NotificationsLoadedState(
        items: items,
        unreadCount: unreadCount,
        activeFilter: _activeFilter,
        hasMore: items.length >= 30,
        isRefreshing: false,
      ));
    } on Failure catch (e) {
      _setState(NotificationsErrorState(message: e.message));
    } catch (e) {
      _setState(NotificationsErrorState(message: 'Failed to load notifications: $e'));
    }
  }

  /// Changes active notification filter ('ALL', 'MENTION', 'COMMENT', 'FOLLOW', 'DM', 'INTEREST_DIGEST').
  void filterByType(String type) {
    if (_activeFilter == type && _state is NotificationsLoadedState) return;
    loadNotifications(filterType: type);
  }

  /// Optimistically marks a single notification as read and syncs with backend.
  Future<void> markAsRead(String notificationId) async {
    if (_state is NotificationsLoadedState) {
      final current = _state as NotificationsLoadedState;
      final target = current.items.firstWhere((n) => n.id == notificationId, orElse: () => current.items.first);
      if (target.isRead) return; // already read

      final updatedItems = current.items.map((n) {
        if (n.id == notificationId) {
          return n.copyWith(isRead: true);
        }
        return n;
      }).toList();

      final newUnread = (current.unreadCount - 1).clamp(0, 9999);
      _setState(current.copyWith(items: updatedItems, unreadCount: newUnread));

      try {
        await repository.markAsRead(notificationId);
      } catch (_) {}
    }
  }

  /// Optimistically marks all notifications as read and syncs with backend.
  Future<void> markAllAsRead() async {
    if (_state is NotificationsLoadedState) {
      final current = _state as NotificationsLoadedState;
      final updatedItems = current.items.map((n) => n.copyWith(isRead: true)).toList();
      _setState(current.copyWith(items: updatedItems, unreadCount: 0));

      try {
        await repository.markAllAsRead();
      } catch (_) {}
    }
  }

  /// Loads notification preferences & quiet hours.
  Future<void> loadPreferences() async {
    try {
      final prefs = await repository.getPreferences();
      _setState(NotificationPreferencesLoadedState(preferences: prefs));
    } on Failure catch (e) {
      _setState(NotificationsErrorState(message: e.message));
    } catch (e) {
      _setState(NotificationsErrorState(message: 'Failed to load notification preferences: $e'));
    }
  }

  /// Updates notification category preferences and quiet hours.
  Future<bool> updatePreferences(NotificationPreferencesModel preferences) async {
    if (_state is NotificationPreferencesLoadedState) {
      final current = _state as NotificationPreferencesLoadedState;
      _setState(current.copyWith(isSaving: true));
    }

    try {
      final updated = await repository.updatePreferences(preferences);
      _setState(NotificationPreferencesLoadedState(
        preferences: updated,
        isSaving: false,
        statusMessage: 'Preferences saved',
      ));
      return true;
    } on Failure catch (e) {
      _setState(NotificationsErrorState(message: e.message));
      return false;
    } catch (e) {
      _setState(NotificationsErrorState(message: 'Failed to save preferences: $e'));
      return false;
    }
  }

  /// Registers device token with platform metadata.
  Future<bool> registerDeviceToken({
    required String token,
    required String platform,
    String? deviceId,
    String? deviceName,
    String? appVersion,
    String? pushProvider,
  }) async {
    try {
      await repository.registerDeviceToken(
        token: token,
        platform: platform,
        deviceId: deviceId,
        deviceName: deviceName,
        appVersion: appVersion,
        pushProvider: pushProvider,
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Unregisters device token on logout or account switch.
  Future<bool> unregisterDeviceToken(String token) async {
    try {
      await repository.unregisterDeviceToken(token);
      return true;
    } catch (_) {
      return false;
    }
  }
}
