import 'package:flutter/material.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/notifications/data/notifications_repository.dart';
import 'package:mobile/features/notifications/domain/models/notification_models.dart';
import 'package:mobile/features/notifications/presentation/screens/notification_settings_screen.dart';
import 'package:mobile/features/notifications/presentation/screens/notifications_screen.dart';

class DeepLinkNavigator {
  /// Resolves deep link URL via backend authorization and navigates safely.
  /// Handles deleted/private content without crashing or leaking sensitive info.
  static Future<bool> handleDeepLink(
    BuildContext context,
    String url, {
    required NotificationsRepository repository,
  }) async {
    try {
      final resolution = await repository.resolveDeepLink(url);

      if (!context.mounted) return false;

      // 1. Content Not Found / Deleted
      if (resolution.targetScreen == DeepLinkTargetScreen.notFound || !resolution.isValid) {
        _showSafeDialog(
          context,
          title: 'Content Unavailable',
          message: resolution.fallbackReason == 'CONTENT_DELETED_OR_NOT_FOUND'
              ? 'This content has been deleted by the creator or is no longer available.'
              : 'The requested link is invalid or could not be found.',
          icon: Icons.search_off_outlined,
        );
        return false;
      }

      // 2. Private Content / Blocked
      if (resolution.targetScreen == DeepLinkTargetScreen.accessDenied || !resolution.accessGranted) {
        String message = 'This content is private or restricted.';
        if (resolution.fallbackReason == 'CREATOR_BLOCKED' || resolution.fallbackReason == 'USER_BLOCKED') {
          message = 'You cannot view this content because of an account block.';
        } else if (resolution.fallbackReason == 'PRIVATE_ACCOUNT_NOT_FOLLOWING') {
          message = 'This account is private. Follow this user to see their content.';
        } else if (resolution.fallbackReason == 'NOT_A_CONVERSATION_PARTICIPANT') {
          message = 'You are not a participant in this conversation.';
        }

        _showSafeDialog(
          context,
          title: 'Access Restricted',
          message: message,
          icon: Icons.lock_outline,
        );
        return false;
      }

      // 3. Authorized Navigation
      switch (resolution.targetScreen) {
        case DeepLinkTargetScreen.notificationCenter:
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => const NotificationsScreen(),
            ),
          );
          return true;

        case DeepLinkTargetScreen.settingsNotifications:
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => const NotificationSettingsScreen(),
            ),
          );
          return true;

        case DeepLinkTargetScreen.reel:
        case DeepLinkTargetScreen.profile:
        case DeepLinkTargetScreen.chatThread:
        case DeepLinkTargetScreen.topic:
          // In full app, navigates to respective screen with params.
          // Show confirmation banner for target screen:
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: AppColors.surfaceElevated,
              content: Row(
                children: [
                  const Icon(Icons.check_circle_outline, color: AppColors.success, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Navigating to ${resolution.title ?? resolution.targetScreen.name}...',
                      style: const TextStyle(color: Colors.white),
                    ),
                  ),
                ],
              ),
              duration: const Duration(seconds: 2),
            ),
          );
          return true;

        default:
          return false;
      }
    } catch (e) {
      if (context.mounted) {
        _showSafeDialog(
          context,
          title: 'Navigation Error',
          message: 'Unable to open link at this time.',
          icon: Icons.error_outline,
        );
      }
      return false;
    }
  }

  static void _showSafeDialog(
    BuildContext context, {
    required String title,
    required String message,
    required IconData icon,
  }) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: AppColors.glassBorder),
        ),
        title: Row(
          children: [
            Icon(icon, color: AppColors.accentGold, size: 24),
            const SizedBox(width: 10),
            Text(title, style: const TextStyle(color: AppColors.textPrimary, fontSize: 18)),
          ],
        ),
        content: Text(message, style: const TextStyle(color: AppColors.textSecondary, fontSize: 14)),
        actions: [
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            onPressed: () => Navigator.pop(ctx),
            child: const Text('OK', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }
}
