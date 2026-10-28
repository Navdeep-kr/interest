import 'package:flutter/material.dart';
import 'package:mobile/features/privacy/data/privacy_compliance_repository.dart';
import 'package:mobile/features/privacy/domain/models/privacy_compliance_models.dart';

class PrivacyAndDataSettingsScreen extends StatefulWidget {
  final String token;
  final PrivacyComplianceRepository? repository;

  const PrivacyAndDataSettingsScreen({
    super.key,
    required this.token,
    this.repository,
  });

  @override
  State<PrivacyAndDataSettingsScreen> createState() => _PrivacyAndDataSettingsScreenState();
}

class _PrivacyAndDataSettingsScreenState extends State<PrivacyAndDataSettingsScreen> {
  late final PrivacyComplianceRepository _repository;

  bool _isLoading = true;
  String? _errorMessage;

  PrivacySettingsModel? _privacySettings;
  List<UserSessionModel> _sessions = [];
  AccountDeletionRequestModel? _deletionRequest;

  // Local accessibility preferences
  bool _closedCaptionsEnabled = true;
  bool _highContrastEnabled = false;

  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? PrivacyComplianceRepository();
    _loadPrivacyData();
  }

  Future<void> _loadPrivacyData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final settingsFuture = _repository.getPrivacySettings(token: widget.token);
      final sessionsFuture = _repository.getUserSessions(token: widget.token);

      final results = await Future.wait([settingsFuture, sessionsFuture]);

      if (!mounted) return;
      setState(() {
        _privacySettings = results[0] as PrivacySettingsModel;
        _sessions = results[1] as List<UserSessionModel>;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.toString().replaceFirst('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  Future<void> _updateSettings(PrivacySettingsModel updated) async {
    setState(() => _isLoading = true);
    try {
      final saved = await _repository.updatePrivacySettings(updated, token: widget.token);
      if (!mounted) return;
      setState(() {
        _privacySettings = saved;
        _isLoading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Privacy settings updated.')),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to update: $e')),
      );
    }
  }

  Future<void> _revokeSession(String sessionId) async {
    try {
      await _repository.revokeSession(sessionId, token: widget.token);
      setState(() {
        _sessions.removeWhere((s) => s.id == sessionId);
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Device session revoked.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to revoke session: $e')),
      );
    }
  }

  Future<void> _revokeAllOtherSessions() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign out all other devices?'),
        content: const Text(
          'This will terminate all active logins across other phones, tablets, and web browsers. Your current session will remain active.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sign Out Others'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      final count = await _repository.revokeAllOtherSessions(token: widget.token);
      setState(() {
        _sessions.removeWhere((s) => !s.isCurrentSession);
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Successfully signed out $count other session(s).')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to revoke sessions: $e')),
      );
    }
  }

  Future<void> _requestDataExport() async {
    try {
      final exportReq = await _repository.requestDataExport(token: widget.token);
      if (!mounted) return;
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Data Export Initiated'),
          content: Text(
            'Your data export package (Request ID: ${exportReq.id}) is being assembled. '
            'In accordance with DPDP and GDPR requirements, a secure download link will be delivered to your verified email within 48 hours.',
          ),
          actions: [
            ElevatedButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Dismiss'),
            ),
          ],
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Data export failed: $e')),
      );
    }
  }

  void _showDeleteAccountDialog() {
    final reasonController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Request Account Deletion'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Are you sure you want to delete your account? Please review the following effects:',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 10),
              const Text(
                '• 30-Day Grace Period: Your account will be deactivated and hidden immediately. You can cancel deletion anytime within 30 days by signing in.\n'
                '• Content Cascade: All reels, drafts, likes, comments, and saves will be permanently purged after 30 days.\n'
                '• Direct Messages: Your username will be replaced with [Deleted User] in preserved chat threads.\n'
                '• Community Handover: Communities you own will be transferred to active moderators, or archived.\n'
                '• Rolling Backups: Live databases and media keys are purged immediately; encrypted offline backups cycle out over a 90-day rolling purge window.\n'
                '• Financial Records: Statutory tax and payment invoices are retained for 7 years under statutory law, with your user identity crypto-shredded.',
                style: TextStyle(fontSize: 12, height: 1.4),
              ),
              const SizedBox(height: 16),
              const Text(
                'Reason for leaving (optional):',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: reasonController,
                maxLines: 2,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  hintText: 'Tell us why you are leaving...',
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Keep Account'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red.shade700,
              foregroundColor: Colors.white,
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              await _executeAccountDeletion(reasonController.text.trim());
            },
            child: const Text('Confirm Deletion'),
          ),
        ],
      ),
    );
  }

  Future<void> _executeAccountDeletion(String reason) async {
    setState(() => _isLoading = true);
    try {
      final req = await _repository.requestAccountDeletion(
        reason: reason.isEmpty ? null : reason,
        token: widget.token,
      );
      if (!mounted) return;
      setState(() {
        _deletionRequest = req;
        _isLoading = false;
      });
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Deletion Scheduled'),
          content: Text(
            'Your account is now deactivated and queued for deletion. '
            'You have until ${req.gracePeriodEndsAt.toLocal().toString().split('.').first} to cancel this request before data is permanently purged.',
          ),
          actions: [
            ElevatedButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('OK'),
            ),
          ],
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Deletion request failed: $e')),
      );
    }
  }

  Future<void> _cancelAccountDeletion() async {
    setState(() => _isLoading = true);
    try {
      await _repository.cancelAccountDeletion(token: widget.token);
      if (!mounted) return;
      setState(() {
        _deletionRequest = null;
        _isLoading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Account deletion cancelled. Your account is restored.')),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to cancel deletion: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final systemReducedMotion = MediaQuery.disableAnimationsOf(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Privacy, Data & Accessibility'),
        elevation: 0,
      ),
      body: _isLoading
          ? Center(
              child: Semantics(
                label: 'Loading privacy settings',
                child: const CircularProgressIndicator(),
              ),
            )
          : _errorMessage != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.error_outline, size: 48, color: Colors.red),
                        const SizedBox(height: 16),
                        Text(_errorMessage!, textAlign: TextAlign.center),
                        const SizedBox(height: 16),
                        ConstrainedBox(
                          constraints: const BoxConstraints(minHeight: 48, minWidth: 120),
                          child: ElevatedButton(
                            onPressed: _loadPrivacyData,
                            child: const Text('Retry'),
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              : FocusTraversalGroup(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (_deletionRequest != null) _buildPendingDeletionBanner(),
                        _buildSectionHeader('Account Privacy'),
                        _buildPrivacyControls(),
                        const Divider(height: 32),
                        _buildSectionHeader('Interactions & Permissions'),
                        _buildInteractionControls(),
                        const Divider(height: 32),
                        _buildSectionHeader('Accessibility & Display'),
                        _buildAccessibilityControls(systemReducedMotion),
                        const Divider(height: 32),
                        _buildSectionHeader('Active Logged-in Devices'),
                        _buildSessionsSection(),
                        const Divider(height: 32),
                        _buildSectionHeader('Data Management & Compliance'),
                        _buildDataExportAndDeletionSection(),
                        const SizedBox(height: 48),
                      ],
                    ),
                  ),
                ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Semantics(
      header: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8.0),
        child: Text(
          title,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            letterSpacing: -0.3,
          ),
        ),
      ),
    );
  }

  Widget _buildPendingDeletionBanner() {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.amber.shade100,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.amber.shade600),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: Colors.amber.shade900),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Account Deletion Scheduled',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Colors.amber.shade900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'Your account is in its 30-day grace period. Content is hidden from other users. You can restore your account now.',
            style: TextStyle(fontSize: 13),
          ),
          const SizedBox(height: 12),
          ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 48),
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.amber.shade800,
                foregroundColor: Colors.white,
              ),
              onPressed: _cancelAccountDeletion,
              child: const Text('Cancel Deletion & Restore Account'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPrivacyControls() {
    final settings = _privacySettings!;
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: Colors.grey.shade300),
      ),
      child: Column(
        children: [
          Semantics(
            label: 'Private Account Toggle',
            hint: 'When enabled, only approved followers can see your profile and reels',
            toggled: settings.isPrivateAccount,
            child: SwitchListTile(
              title: const Text('Private Account', style: TextStyle(fontWeight: FontWeight.w600)),
              subtitle: const Text('Only approved followers can view your reels and social profile'),
              value: settings.isPrivateAccount,
              onChanged: (val) {
                _updateSettings(settings.copyWith(isPrivateAccount: val));
              },
            ),
          ),
          const Divider(height: 1),
          Semantics(
            label: 'Search Discoverability Toggle',
            hint: 'Allow other users to discover your profile in search results and suggestions',
            toggled: settings.allowSearchDiscovery,
            child: SwitchListTile(
              title: const Text('Search & Suggestion Discovery', style: TextStyle(fontWeight: FontWeight.w600)),
              subtitle: const Text('Allow your profile to appear in search queries and topic suggestions'),
              value: settings.allowSearchDiscovery,
              onChanged: (val) {
                _updateSettings(settings.copyWith(allowSearchDiscovery: val));
              },
            ),
          ),
          const Divider(height: 1),
          Semantics(
            label: 'Activity Status Toggle',
            hint: 'Shows when you were last active to mutual connections',
            toggled: settings.activityStatusVisible,
            child: SwitchListTile(
              title: const Text('Activity Status', style: TextStyle(fontWeight: FontWeight.w600)),
              subtitle: const Text('Show when you are active to mutual followers'),
              value: settings.activityStatusVisible,
              onChanged: (val) {
                _updateSettings(settings.copyWith(activityStatusVisible: val));
              },
            ),
          ),
          const Divider(height: 1),
          Semantics(
            label: 'Personalized Ads Consent Toggle',
            hint: settings.isMinor
                ? 'Disabled for minor accounts under COPPA and DPDP safety rules'
                : 'Allow interest-based ads',
            toggled: settings.personalizedAdsConsent,
            child: SwitchListTile(
              title: const Text('Personalized Ads Consent', style: TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text(
                settings.isMinor
                    ? 'Strictly disabled for minor accounts in compliance with COPPA and DPDP rules.'
                    : 'Permit personalized ads based on your public interests.',
                style: TextStyle(
                  color: settings.isMinor ? Colors.red.shade700 : null,
                ),
              ),
              value: settings.personalizedAdsConsent,
              onChanged: settings.isMinor
                  ? null
                  : (val) {
                      _updateSettings(settings.copyWith(personalizedAdsConsent: val));
                    },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInteractionControls() {
    final settings = _privacySettings!;
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: Colors.grey.shade300),
      ),
      child: Column(
        children: [
          Semantics(
            label: 'Direct Messaging Permission',
            hint: 'Select who is permitted to send you direct messages',
            child: ListTile(
              title: const Text('Who can send direct messages', style: TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text(settings.messagingPermission),
              trailing: DropdownButton<String>(
                value: settings.messagingPermission,
                underline: const SizedBox(),
                items: const [
                  DropdownMenuItem(value: 'EVERYONE', child: Text('Everyone')),
                  DropdownMenuItem(value: 'FOLLOWERS_ONLY', child: Text('Followers Only')),
                  DropdownMenuItem(value: 'NOBODY', child: Text('Nobody')),
                ],
                onChanged: (val) {
                  if (val != null) {
                    _updateSettings(settings.copyWith(messagingPermission: val));
                  }
                },
              ),
            ),
          ),
          const Divider(height: 1),
          Semantics(
            label: 'Commenting Permission',
            hint: 'Select who is permitted to comment on your content',
            child: ListTile(
              title: const Text('Who can comment on your posts', style: TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text(settings.commentingPermission),
              trailing: DropdownButton<String>(
                value: settings.commentingPermission,
                underline: const SizedBox(),
                items: const [
                  DropdownMenuItem(value: 'EVERYONE', child: Text('Everyone')),
                  DropdownMenuItem(value: 'FOLLOWERS_ONLY', child: Text('Followers Only')),
                  DropdownMenuItem(value: 'OFF', child: Text('Turned Off')),
                ],
                onChanged: (val) {
                  if (val != null) {
                    _updateSettings(settings.copyWith(commentingPermission: val));
                  }
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAccessibilityControls(bool systemReducedMotion) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: Colors.grey.shade300),
      ),
      child: Column(
        children: [
          Semantics(
            label: 'Closed Captions Toggle',
            hint: 'Display subtitles and closed captions on reels and video feeds whenever available',
            toggled: _closedCaptionsEnabled,
            child: SwitchListTile(
              title: const Text('Always Show Captions', style: TextStyle(fontWeight: FontWeight.w600)),
              subtitle: const Text('Display automated or creator-provided subtitles across all reels'),
              value: _closedCaptionsEnabled,
              onChanged: (val) {
                setState(() => _closedCaptionsEnabled = val);
              },
            ),
          ),
          const Divider(height: 1),
          Semantics(
            label: 'High Contrast Text Toggle',
            hint: 'Increase text border and foreground contrast for improved readability',
            toggled: _highContrastEnabled,
            child: SwitchListTile(
              title: const Text('High Contrast Text', style: TextStyle(fontWeight: FontWeight.w600)),
              subtitle: const Text('Enforce WCAG 2.1 AAA high-contrast color styling across UI elements'),
              value: _highContrastEnabled,
              onChanged: (val) {
                setState(() => _highContrastEnabled = val);
              },
            ),
          ),
          const Divider(height: 1),
          ListTile(
            title: const Text('System Reduced Motion', style: TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text(
              systemReducedMotion
                  ? 'Active: Animations and autoplay transitions are minimized to reduce motion sensitivity.'
                  : 'Inactive: Standard animated transitions enabled. You can toggle this in system settings.',
            ),
            trailing: Icon(
              systemReducedMotion ? Icons.motion_photos_off : Icons.motion_photos_on,
              color: systemReducedMotion ? Colors.green : Colors.grey,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSessionsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                'Active sessions (${_sessions.length})',
                style: const TextStyle(fontWeight: FontWeight.w500, color: Colors.black87),
              ),
            ),
            if (_sessions.any((s) => !s.isCurrentSession))
              ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 48),
                child: OutlinedButton(
                  onPressed: _revokeAllOtherSessions,
                  child: const Text('Sign Out Others'),
                ),
              ),
          ],
        ),
        const SizedBox(height: 8),
        if (_sessions.isEmpty)
          const Padding(
            padding: EdgeInsets.all(12.0),
            child: Text('No active sessions found.'),
          )
        else
          ..._sessions.map((session) => Card(
                elevation: 0,
                margin: const EdgeInsets.only(bottom: 8),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                  side: BorderSide(
                    color: session.isCurrentSession ? Colors.blue.shade300 : Colors.grey.shade300,
                  ),
                ),
                child: ListTile(
                  leading: Icon(
                    session.isCurrentSession ? Icons.phone_android : Icons.devices,
                    color: session.isCurrentSession ? Colors.blue : Colors.grey.shade700,
                  ),
                  title: Row(
                    children: [
                      Flexible(
                        child: Text(
                          session.deviceName,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (session.isCurrentSession) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.blue.shade100,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text(
                            'This Device',
                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.blue),
                          ),
                        ),
                      ],
                    ],
                  ),
                  subtitle: Text(
                    'Last active: ${session.lastActiveAt.toLocal().toString().split('.').first}',
                    style: const TextStyle(fontSize: 12),
                  ),
                  trailing: session.isCurrentSession
                      ? null
                      : Semantics(
                          label: 'Revoke session for ${session.deviceName}',
                          button: true,
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
                            child: IconButton(
                              icon: const Icon(Icons.delete_outline, color: Colors.red),
                              onPressed: () => _revokeSession(session.id),
                            ),
                          ),
                        ),
                ),
              )),
      ],
    );
  }

  Widget _buildDataExportAndDeletionSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
            side: BorderSide(color: Colors.grey.shade300),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Download Your Data',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Request a portable JSON bundle containing your profile, reels metadata, comments, likes, saves, and interaction history. Ready within 48 hours.',
                  style: TextStyle(fontSize: 13, height: 1.3),
                ),
                const SizedBox(height: 12),
                ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: 48, minWidth: double.infinity),
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.download_rounded),
                    label: const Text('Request Data Export Archive'),
                    onPressed: _requestDataExport,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
            side: BorderSide(color: Colors.red.shade200),
          ),
          color: Colors.red.shade50,
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Delete Account & Personal Data',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: Colors.red.shade900,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Initiates permanent account deletion with a 30-day grace period. '
                  'Purges all profile details, posts, and interaction histories. '
                  'Encrypted rolling backup snapshots are purged within 90 days. '
                  'Statutory tax and financial records are preserved for 7 years with crypto-shredded identities.',
                  style: TextStyle(fontSize: 12, height: 1.4, color: Colors.red.shade900),
                ),
                const SizedBox(height: 14),
                ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: 48, minWidth: double.infinity),
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red.shade700,
                      foregroundColor: Colors.white,
                    ),
                    onPressed: _showDeleteAccountDialog,
                    child: const Text('Request Account Deletion'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
