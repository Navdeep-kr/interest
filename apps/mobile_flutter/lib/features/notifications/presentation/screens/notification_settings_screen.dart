import 'package:flutter/material.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/notifications/data/notifications_api_client.dart';
import 'package:mobile/features/notifications/data/notifications_repository.dart';
import 'package:mobile/features/notifications/domain/models/notification_models.dart';
import 'package:mobile/features/notifications/presentation/notifications_notifier.dart';
import 'package:mobile/features/notifications/presentation/notifications_state.dart';

class NotificationSettingsScreen extends StatefulWidget {
  final NotificationsNotifier? notifier;

  const NotificationSettingsScreen({super.key, this.notifier});

  @override
  State<NotificationSettingsScreen> createState() => _NotificationSettingsScreenState();
}

class _NotificationSettingsScreenState extends State<NotificationSettingsScreen> {
  late final NotificationsNotifier _notifier;
  late final bool _ownsNotifier;
  NotificationPreferencesModel? _currentPrefs;

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

    _notifier.loadPreferences();
  }

  @override
  void dispose() {
    if (_ownsNotifier) {
      _notifier.dispose();
    }
    super.dispose();
  }

  Future<void> _selectTime(bool isStart) async {
    if (_currentPrefs == null) return;
    final currentTimeStr = isStart ? _currentPrefs!.quietHoursStart : _currentPrefs!.quietHoursEnd;
    final parts = currentTimeStr.split(':');
    final initialTime = TimeOfDay(
      hour: int.tryParse(parts[0]) ?? (isStart ? 22 : 8),
      minute: parts.length > 1 ? (int.tryParse(parts[1]) ?? 0) : 0,
    );

    final picked = await showTimePicker(
      context: context,
      initialTime: initialTime,
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.dark(
              primary: AppColors.primary,
              surface: AppColors.surface,
              onSurface: AppColors.textPrimary,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      final formatted = '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
      setState(() {
        if (isStart) {
          _currentPrefs = _currentPrefs!.copyWith(quietHoursStart: formatted);
        } else {
          _currentPrefs = _currentPrefs!.copyWith(quietHoursEnd: formatted);
        }
      });
    }
  }

  void _savePreferences() async {
    if (_currentPrefs == null) return;
    final success = await _notifier.updatePreferences(_currentPrefs!);
    if (mounted && success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: AppColors.surfaceElevated,
          content: Row(
            children: [
              Icon(Icons.check_circle, color: AppColors.success, size: 20),
              SizedBox(width: 8),
              Text('Notification settings saved', style: TextStyle(color: Colors.white)),
            ],
          ),
        ),
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
        title: const Text(
          'Notification Settings',
          style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          TextButton(
            onPressed: _currentPrefs != null ? _savePreferences : null,
            child: const Text('Save', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
      body: AnimatedBuilder(
        animation: _notifier,
        builder: (context, _) {
          final state = _notifier.state;

          if (state is NotificationsLoadingState && _currentPrefs == null) {
            return const Center(child: CircularProgressIndicator(color: AppColors.primary));
          }

          if (state is NotificationPreferencesLoadedState && _currentPrefs == null) {
            _currentPrefs = state.preferences;
          }

          if (_currentPrefs == null) {
            return const Center(child: CircularProgressIndicator(color: AppColors.primary));
          }

          final prefs = _currentPrefs!;

          return ListView(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
            children: [
              // 1. Privacy Previews Section
              _buildSectionHeader('Preview Privacy'),
              _buildCard([
                SwitchListTile(
                  title: const Text('Hide notification previews', style: TextStyle(color: AppColors.textPrimary, fontSize: 15)),
                  subtitle: const Text(
                    'Protect your privacy on lock screens by hiding message previews and sender details.',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                  ),
                  value: prefs.hideNotificationPreviews,
                  activeColor: AppColors.primary,
                  onChanged: (val) {
                    setState(() => _currentPrefs = prefs.copyWith(hideNotificationPreviews: val));
                  },
                ),
              ]),
              const SizedBox(height: 24),

              // 2. Quiet Hours Section
              _buildSectionHeader('Quiet Hours Schedule'),
              _buildCard([
                SwitchListTile(
                  title: const Text('Enable Quiet Hours', style: TextStyle(color: AppColors.textPrimary, fontSize: 15)),
                  subtitle: const Text(
                    'Silence push notifications during your scheduled hours. Urgent security alerts will still be delivered.',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                  ),
                  value: prefs.quietHoursEnabled,
                  activeColor: AppColors.primary,
                  onChanged: (val) {
                    setState(() => _currentPrefs = prefs.copyWith(quietHoursEnabled: val));
                  },
                ),
                if (prefs.quietHoursEnabled) ...[
                  const Divider(color: AppColors.glassBorder),
                  ListTile(
                    title: const Text('Start Time', style: TextStyle(color: AppColors.textPrimary, fontSize: 14)),
                    trailing: Text(
                      prefs.quietHoursStart,
                      style: const TextStyle(color: AppColors.accentCyan, fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                    onTap: () => _selectTime(true),
                  ),
                  const Divider(color: AppColors.glassBorder),
                  ListTile(
                    title: const Text('End Time', style: TextStyle(color: AppColors.textPrimary, fontSize: 14)),
                    trailing: Text(
                      prefs.quietHoursEnd,
                      style: const TextStyle(color: AppColors.accentCyan, fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                    onTap: () => _selectTime(false),
                  ),
                ],
                const Divider(color: AppColors.glassBorder),
                Padding(
                  padding: const EdgeInsets.all(14.0),
                  child: Row(
                    children: [
                      const Icon(Icons.shield_outlined, size: 16, color: AppColors.success),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Quiet hours are evaluated strictly using your device clock offset (${prefs.clientTimezoneOffsetMinutes >= 0 ? '+' : ''}${prefs.clientTimezoneOffsetMinutes}m). Zero GPS or IP geolocation is used.',
                          style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                        ),
                      ),
                    ],
                  ),
                ),
              ]),
              const SizedBox(height: 24),

              // 3. Push Notifications Preferences
              _buildSectionHeader('Push Notifications'),
              _buildCard([
                _buildToggleRow('Likes on your content', prefs.pushLikes, (v) => _currentPrefs = prefs.copyWith(pushLikes: v)),
                const Divider(color: AppColors.glassBorder),
                _buildToggleRow('Comments & replies', prefs.pushComments, (v) => _currentPrefs = prefs.copyWith(pushComments: v)),
                const Divider(color: AppColors.glassBorder),
                _buildToggleRow('Mentions & tags', prefs.pushMentions, (v) => _currentPrefs = prefs.copyWith(pushMentions: v)),
                const Divider(color: AppColors.glassBorder),
                _buildToggleRow('New followers', prefs.pushFollows, (v) => _currentPrefs = prefs.copyWith(pushFollows: v)),
                const Divider(color: AppColors.glassBorder),
                _buildToggleRow('Direct messages', prefs.pushDms, (v) => _currentPrefs = prefs.copyWith(pushDms: v)),
                const Divider(color: AppColors.glassBorder),
                _buildToggleRow('Creator milestones', prefs.pushMilestones, (v) => _currentPrefs = prefs.copyWith(pushMilestones: v)),
              ]),
              const SizedBox(height: 24),

              // 4. In-App Notifications Preferences
              _buildSectionHeader('In-App Notification Center'),
              _buildCard([
                _buildToggleRow('Likes', prefs.inAppLikes, (v) => _currentPrefs = prefs.copyWith(inAppLikes: v)),
                const Divider(color: AppColors.glassBorder),
                _buildToggleRow('Comments', prefs.inAppComments, (v) => _currentPrefs = prefs.copyWith(inAppComments: v)),
                const Divider(color: AppColors.glassBorder),
                _buildToggleRow('Mentions', prefs.inAppMentions, (v) => _currentPrefs = prefs.copyWith(inAppMentions: v)),
                const Divider(color: AppColors.glassBorder),
                _buildToggleRow('Follows', prefs.inAppFollows, (v) => _currentPrefs = prefs.copyWith(inAppFollows: v)),
                const Divider(color: AppColors.glassBorder),
                _buildToggleRow('Messages', prefs.inAppDms, (v) => _currentPrefs = prefs.copyWith(inAppDms: v)),
                const Divider(color: AppColors.glassBorder),
                _buildToggleRow('Interest Digests', prefs.inAppInterests, (v) => _currentPrefs = prefs.copyWith(inAppInterests: v)),
              ]),
              const SizedBox(height: 32),
            ],
          );
        },
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        title,
        style: const TextStyle(
          color: AppColors.textPrimary,
          fontSize: 14,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.2,
        ),
      ),
    );
  }

  Widget _buildCard(List<Widget> children) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: children,
      ),
    );
  }

  Widget _buildToggleRow(String title, bool value, Function(bool) onChanged) {
    return SwitchListTile(
      title: Text(title, style: const TextStyle(color: AppColors.textPrimary, fontSize: 14.5)),
      value: value,
      activeColor: AppColors.primary,
      onChanged: (v) {
        setState(() => onChanged(v));
      },
    );
  }
}
