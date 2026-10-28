import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/features/safety/domain/models/safety_models.dart';
import 'package:mobile/features/safety/data/safety_repository.dart';

class SafetyCenterScreen extends StatefulWidget {
  final String token;
  final SafetyRepository? repository;

  const SafetyCenterScreen({
    super.key,
    required this.token,
    this.repository,
  });

  @override
  State<SafetyCenterScreen> createState() => _SafetyCenterScreenState();
}

class _SafetyCenterScreenState extends State<SafetyCenterScreen> {
  late final SafetyRepository _repository;

  bool _isLoading = true;
  String? _errorMessage;

  UserAccountSafetyStatus? _safetyStatus;
  List<CommunityGuidelineItem> _guidelines = [];
  List<BlockedUserItem> _blockedUsers = [];

  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? SafetyRepository();
    _loadSafetyData();
  }

  Future<void> _loadSafetyData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final statusFuture = _repository.getUserSafetyStatus(token: widget.token);
      final guidelinesFuture = _repository.getCommunityGuidelines();
      final blocksFuture = _repository.getBlockedUsers(token: widget.token);

      final results = await Future.wait([statusFuture, guidelinesFuture, blocksFuture]);

      if (!mounted) return;

      setState(() {
        _safetyStatus = results[0] as UserAccountSafetyStatus;
        _guidelines = results[1] as List<CommunityGuidelineItem>;
        _blockedUsers = results[2] as List<BlockedUserItem>;
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

  Future<void> _handleUnblock(String userId) async {
    try {
      await _repository.unblockUser(userId, token: widget.token);
      setState(() {
        _blockedUsers.removeWhere((u) => u.id == userId);
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('User unblocked.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to unblock: $e')),
      );
    }
  }

  void _showAppealDialog() {
    final statementCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Submit Safety Appeal'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Explain why you believe the action taken on your account was a mistake or false positive:',
              style: TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: statementCtrl,
              maxLines: 4,
              maxLength: 1000,
              decoration: const InputDecoration(
                hintText: 'Provide complete details and context...',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              final statement = statementCtrl.text.trim();
              if (statement.length < 10) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Please provide at least 10 characters.')),
                );
                return;
              }
              Navigator.of(ctx).pop();
              try {
                await _repository.submitAppeal(
                  CreateAppealRequest(
                    entityType: 'ACCOUNT_RESTRICTION',
                    entityId: _safetyStatus?.userId ?? '',
                    statement: statement,
                  ),
                  token: widget.token,
                );
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Appeal submitted successfully. Review within 24 hours.'),
                    backgroundColor: Colors.green,
                  ),
                );
              } catch (err) {
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Failed to submit appeal: $err')),
                );
              }
            },
            child: const Text('Submit Appeal'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Safety & Guidelines Center'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Account Standing'),
              Tab(text: 'Guidelines'),
              Tab(text: 'Blocked Users'),
            ],
          ),
        ),
        body: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _errorMessage != null
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(_errorMessage!, style: const TextStyle(color: Colors.red)),
                        const SizedBox(height: 12),
                        ElevatedButton(
                          onPressed: _loadSafetyData,
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  )
                : TabBarView(
                    children: [
                      _buildStandingTab(),
                      _buildGuidelinesTab(),
                      _buildBlockedUsersTab(),
                    ],
                  ),
      ),
    );
  }

  Widget _buildStandingTab() {
    final status = _safetyStatus;
    if (status == null) {
      return const Center(child: Text('Standing unavailable.'));
    }

    final isClean = !status.isRestricted && status.strikesCount == 0;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Standing Header Card
          Card(
            color: isClean ? Colors.green.shade900.withOpacity(0.2) : Colors.red.shade900.withOpacity(0.2),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(
                color: isClean ? Colors.green.shade400 : Colors.red.shade400,
                width: 1.5,
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Icon(
                    isClean ? Icons.check_circle_outline : Icons.warning_amber_rounded,
                    color: isClean ? Colors.green.shade400 : Colors.red.shade400,
                    size: 48,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    isClean ? 'Account in Good Standing' : 'Account Under Restriction / Warnings',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: isClean ? Colors.green.shade300 : Colors.red.shade300,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    isClean
                      ? 'You have 0 active policy strikes. Thank you for keeping Interest safe and creative!'
                      : 'Your account has accumulated ${status.strikesCount} strike(s). Community guideline violations result in progressive escalation.',
                    style: const TextStyle(fontSize: 13),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Active Penalties Details
          if (status.isRestricted || status.strikesCount > 0) ...[
            const Text(
              'Active Restrictions & Strikes',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            if (status.isSuspended)
              _buildRestrictionTile(
                icon: Icons.block,
                title: 'Account Suspended',
                subtitle: status.suspensionReason ?? 'Suspended for safety policy violations',
                expires: status.suspensionExpiresAt,
              ),
            if (status.isPostingRestricted)
              _buildRestrictionTile(
                icon: Icons.videocam_off,
                title: 'Publishing Restricted',
                subtitle: 'Posting reels, stories and posts temporarily disabled',
                expires: status.postingRestrictedUntil,
              ),
            if (status.isCommentingRestricted)
              _buildRestrictionTile(
                icon: Icons.comments_disabled,
                title: 'Comments Restricted',
                subtitle: 'Posting comments on content temporarily disabled',
                expires: status.commentingRestrictedUntil,
              ),
            if (status.isMessagingRestricted)
              _buildRestrictionTile(
                icon: Icons.speaker_notes_off,
                title: 'Messaging Restricted',
                subtitle: 'Sending direct and group messages temporarily disabled',
                expires: status.messagingRestrictedUntil,
              ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              key: const Key('appeal_button'),
              onPressed: _showAppealDialog,
              icon: const Icon(Icons.gavel),
              label: const Text('Appeal Restriction or Strike'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blue.shade700,
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ],

          const SizedBox(height: 24),
          const Text(
            '3-Strike Escalation Policy',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          const Text(
            '• Strike 1: Official Warning\n• Strike 2: 48-Hour Posting & Commenting Restriction\n• Strike 3: 7-Day Complete Account Suspension\n• Strike 4+: 30-Day Suspension or Permanent Ban Review',
            style: TextStyle(fontSize: 13, color: Colors.grey, height: 1.4),
          ),
        ],
      ),
    );
  }

  Widget _buildRestrictionTile({
    required IconData icon,
    required String title,
    required String subtitle,
    DateTime? expires,
  }) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(icon, color: Colors.red.shade300),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(subtitle, style: const TextStyle(fontSize: 12)),
            if (expires != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  'Expires: ${expires.toLocal().toString().substring(0, 16)}',
                  style: TextStyle(fontSize: 11, color: Colors.amber.shade400, fontWeight: FontWeight.w600),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildGuidelinesTab() {
    if (_guidelines.isEmpty) {
      return const Center(child: Text('No community guidelines loaded.'));
    }

    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: _guidelines.length,
      itemBuilder: (context, index) {
        final g = _guidelines[index];
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: ExpansionTile(
            title: Text(
              g.title,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
            ),
            subtitle: Text(
              'Category: ${g.category}',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade400),
            ),
            childrenPadding: const EdgeInsets.all(16),
            children: [
              Text(
                g.description,
                style: const TextStyle(fontSize: 13, height: 1.4),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.red.shade900.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(Icons.shield, color: Colors.red.shade300, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Enforcement: ${g.enforcementAction}',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.red.shade200),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildBlockedUsersTab() {
    if (_blockedUsers.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.person_off_outlined, size: 48, color: Colors.grey.shade600),
            const SizedBox(height: 12),
            const Text(
              'No Blocked Users',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            const Text(
              'When you block someone, they cannot view your content or message you.',
              style: TextStyle(fontSize: 12, color: Colors.grey),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(12),
      itemCount: _blockedUsers.length,
      separatorBuilder: (_, __) => const Divider(),
      itemBuilder: (context, index) {
        final user = _blockedUsers[index];
        return ListTile(
          leading: CircleAvatar(
            backgroundImage: appAvatarProvider(user.avatarUrl),
            child: user.avatarUrl == null ? Text(user.username.substring(0, 1).toUpperCase()) : null,
          ),
          title: Text(user.displayName, style: const TextStyle(fontWeight: FontWeight.bold)),
          subtitle: Text('@${user.username}'),
          trailing: OutlinedButton(
            onPressed: () => _handleUnblock(user.id),
            child: const Text('Unblock'),
          ),
        );
      },
    );
  }
}
