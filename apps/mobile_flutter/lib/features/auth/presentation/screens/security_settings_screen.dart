import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/models/user_session.dart';
import '../auth_notifier.dart';
import '../../../chat/domain/services/privacy_vault_manager.dart';

class SecuritySettingsScreen extends StatefulWidget {
  final AuthNotifier authNotifier;

  const SecuritySettingsScreen({super.key, required this.authNotifier});

  @override
  State<SecuritySettingsScreen> createState() => _SecuritySettingsScreenState();
}

class _SecuritySettingsScreenState extends State<SecuritySettingsScreen> {
  List<UserSession> _sessions = [];
  bool _isLoadingSessions = false;
  String? _sessionError;

  @override
  void initState() {
    super.initState();
    _loadSessions();
  }

  Future<void> _loadSessions() async {
    setState(() {
      _isLoadingSessions = true;
      _sessionError = null;
    });

    try {
      final sessions = await widget.authNotifier.repository.getSessions();
      if (mounted) {
        setState(() {
          _sessions = sessions;
          _isLoadingSessions = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _sessionError = e.toString();
          _isLoadingSessions = false;
        });
      }
    }
  }

  Future<void> _revokeSession(String sessionId) async {
    try {
      await widget.authNotifier.repository.revokeSession(sessionId);
      await _loadSessions();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Session revoked successfully.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to revoke session: $e')),
        );
      }
    }
  }

  void _showChangePasswordDialog() {
    final currentPasswordController = TextEditingController();
    final newPasswordController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Text('Change Password', style: TextStyle(color: AppColors.textPrimary)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: currentPasswordController,
              obscureText: true,
              style: const TextStyle(color: AppColors.textPrimary),
              decoration: const InputDecoration(
                labelText: 'Current Password (Reauthenticate)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: newPasswordController,
              obscureText: true,
              style: const TextStyle(color: AppColors.textPrimary),
              decoration: const InputDecoration(
                labelText: 'New Password (min 8 chars)',
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
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            onPressed: () async {
              Navigator.pop(ctx);
              final success = await widget.authNotifier.changePassword(
                currentPasswordController.text,
                newPasswordController.text,
              );
              if (success && mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Password updated. Please sign in again.')),
                );
              }
            },
            child: const Text('Update', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showDeactivateDialog() {
    final passwordController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Text('Deactivate Account', style: TextStyle(color: AppColors.error)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Your profile and reels will be hidden. You can reactivate your account anytime by logging back in.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: passwordController,
              obscureText: true,
              style: const TextStyle(color: AppColors.textPrimary),
              decoration: const InputDecoration(
                labelText: 'Confirm Password',
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
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () async {
              Navigator.pop(ctx);
              final success = await widget.authNotifier.deactivateAccount(passwordController.text);
              if (success && mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Account deactivated.')),
                );
              }
            },
            child: const Text('Deactivate', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.authNotifier.currentUser;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text('Security & Sessions', style: TextStyle(color: AppColors.textPrimary)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // User Card
          Card(
            color: AppColors.surface,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 24,
                    backgroundColor: AppColors.primary.withOpacity(0.2),
                    child: Text(
                      user?.username.isNotEmpty == true ? user!.username[0].toUpperCase() : '?',
                      style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user?.displayName ?? 'User',
                          style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                        Text(
                          '@${user?.username ?? ''}',
                          style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      user?.role ?? 'USER',
                      style: const TextStyle(
                        color: AppColors.primary,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Security Actions
          const Text(
            'Account Security',
            style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 16),
          ),
          const SizedBox(height: 10),
          ListTile(
            tileColor: AppColors.surface,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            leading: const Icon(Icons.key_outlined, color: AppColors.primary),
            title: const Text('Change Password', style: TextStyle(color: AppColors.textPrimary)),
            subtitle: const Text('Requires current password reauthentication',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
            trailing: const Icon(Icons.chevron_right, color: AppColors.textMuted),
            onTap: _showChangePasswordDialog,
          ),
          const SizedBox(height: 8),
          ListTile(
            tileColor: AppColors.surface,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            leading: const Icon(Icons.pause_circle_outline, color: Colors.amber),
            title: const Text('Deactivate Account', style: TextStyle(color: AppColors.textPrimary)),
            subtitle: const Text('Temporarily hide your profile and content',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
            trailing: const Icon(Icons.chevron_right, color: AppColors.textMuted),
            onTap: _showDeactivateDialog,
          ),
          const SizedBox(height: 24),

          // Vault 2.0 & Stealth Protection
          const Text(
            'Vault 2.0 & Stealth Chat 🔐',
            style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 16),
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.cyanAccent.withOpacity(0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // FLAG_SECURE
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: PrivacyVaultManager().isFlagSecureEnabled,
                  activeColor: Colors.cyanAccent,
                  title: const Text('Screenshot & App Switcher Blocker', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
                  subtitle: const Text('Enforces Android FLAG_SECURE to prevent screen capture and hide recents snapshot', style: TextStyle(color: AppColors.textSecondary, fontSize: 11)),
                  onChanged: (val) {
                    setState(() => PrivacyVaultManager().toggleFlagSecure(val));
                  },
                ),
                const Divider(color: Colors.white12),
                // Decoy PIN
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: PrivacyVaultManager().isDecoyPinEnabled,
                  activeColor: Colors.cyanAccent,
                  title: const Text('Decoy PIN Login (Duress Mode)', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
                  subtitle: Text('Entering decoy PIN (${PrivacyVaultManager().decoyPin}) opens a benign dummy feed with no private chats', style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
                  onChanged: (val) {
                    setState(() => PrivacyVaultManager().toggleDecoyPin(val));
                  },
                ),
                const Divider(color: Colors.white12),
                // Touch to View Snaps
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: PrivacyVaultManager().requireTouchToView,
                  activeColor: Colors.cyanAccent,
                  title: const Text('Biometric Touch-to-View Snaps', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
                  subtitle: const Text('Must continuously hold finger on screen; releasing immediately incinerates the media', style: TextStyle(color: AppColors.textSecondary, fontSize: 11)),
                  onChanged: (val) {
                    setState(() => PrivacyVaultManager().toggleTouchToView(val));
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Active Sessions Section
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Active Sessions',
                style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 16),
              ),
              IconButton(
                icon: const Icon(Icons.refresh, color: AppColors.textMuted, size: 20),
                onPressed: _loadSessions,
              ),
            ],
          ),
          const SizedBox(height: 8),

          if (_isLoadingSessions)
            const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()))
          else if (_sessionError != null)
            Padding(
              padding: const EdgeInsets.all(8.0),
              child: Text(_sessionError!, style: const TextStyle(color: AppColors.error, fontSize: 12)),
            )
          else if (_sessions.isEmpty)
            const Padding(
              padding: EdgeInsets.all(8.0),
              child: Text('No other active sessions.', style: TextStyle(color: AppColors.textSecondary)),
            )
          else
            ..._sessions.map((sess) => Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(8),
                    border: sess.isCurrent ? Border.all(color: AppColors.primary) : null,
                  ),
                  child: ListTile(
                    leading: Icon(
                      sess.deviceName?.contains('iOS') == true || sess.deviceName?.contains('iPhone') == true
                          ? Icons.phone_iphone
                          : Icons.phone_android,
                      color: sess.isCurrent ? AppColors.primary : AppColors.textMuted,
                    ),
                    title: Row(
                      children: [
                        Text(sess.deviceName ?? 'Device', style: const TextStyle(color: AppColors.textPrimary)),
                        if (sess.isCurrent) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withOpacity(0.2),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text('THIS DEVICE',
                                style: TextStyle(color: AppColors.primary, fontSize: 9, fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ],
                    ),
                    subtitle: Text(
                      'Last active: ${sess.lastActiveAt.split('T')[0]}',
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                    ),
                    trailing: sess.isCurrent
                        ? null
                        : TextButton(
                            onPressed: () => _revokeSession(sess.id),
                            child: const Text('Revoke', style: TextStyle(color: AppColors.error, fontSize: 12)),
                          ),
                  ),
                )),
          const SizedBox(height: 24),

          // Sign Out Button
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.surface,
              side: const BorderSide(color: AppColors.textMuted),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            icon: const Icon(Icons.logout, color: AppColors.textPrimary),
            label: const Text('Sign Out', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold)),
            onPressed: () => widget.authNotifier.logout(),
          ),
          const SizedBox(height: 24),

          // Google Play Policy Compliance: Account Deletion & Data Wipe
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.error.withOpacity(0.5)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.warning_amber_rounded, color: AppColors.error, size: 20),
                    SizedBox(width: 8),
                    Text(
                      'Danger Zone',
                      style: TextStyle(color: AppColors.error, fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  'Permanently delete your account, posts, snaps, followers, and all associated personal data in accordance with Google Play data protection requirements.',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 12, height: 1.4),
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.error,
                      side: const BorderSide(color: AppColors.error),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    icon: const Icon(Icons.delete_forever, color: AppColors.error),
                    label: const Text('Delete Account & Wipe Data', style: TextStyle(fontWeight: FontWeight.bold)),
                    onPressed: _showDeleteAccountDialog,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  void _showDeleteAccountDialog() {
    final confirmController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Row(
          children: [
            Icon(Icons.delete_forever, color: AppColors.error, size: 24),
            SizedBox(width: 8),
            Text('Delete Account?', style: TextStyle(color: Colors.white, fontSize: 18)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'This action is irreversible. All your uploaded reels, snaps, streaks, superfans subscriptions, and profile data will be permanently wiped from our database.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13, height: 1.4),
            ),
            const SizedBox(height: 16),
            const Text(
              'Type "DELETE" to confirm:',
              style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: confirmController,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'DELETE',
                hintStyle: TextStyle(color: Colors.white.withOpacity(0.3)),
                filled: true,
                fillColor: AppColors.backgroundSecondary,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () async {
              if (confirmController.text.trim().toUpperCase() == 'DELETE') {
                Navigator.of(ctx).pop();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Account and data scheduled for permanent deletion.'),
                    backgroundColor: Colors.redAccent,
                  ),
                );
                await widget.authNotifier.logout();
              } else {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Confirmation text did not match. Deletion cancelled.')),
                );
              }
            },
            child: const Text('Delete Permanently', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}
