import 'package:flutter/material.dart';
import '../../../../core/media/optimized_network_image.dart';
import '../../../../core/theme/app_colors.dart';
import '../../data/profile_repository.dart';
import '../../domain/models/follow_request_item.dart';

class FollowRequestsScreen extends StatefulWidget {
  final ProfileRepository repository;

  const FollowRequestsScreen({
    super.key,
    required this.repository,
  });

  @override
  State<FollowRequestsScreen> createState() => _FollowRequestsScreenState();
}

class _FollowRequestsScreenState extends State<FollowRequestsScreen> {
  bool _isLoading = true;
  String? _errorMessage;
  List<FollowRequestItem> _requests = [];
  final Set<String> _processingIds = {};

  @override
  void initState() {
    super.initState();
    _fetchRequests();
  }

  Future<void> _fetchRequests() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final items = await widget.repository.getPendingFollowRequests();
      setState(() {
        _requests = items;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = 'Failed to load follow requests: $e';
      });
    }
  }

  Future<void> _respond(String requestId, String action) async {
    setState(() {
      _processingIds.add(requestId);
    });

    try {
      await widget.repository.respondFollowRequest(requestId, action);
      setState(() {
        _requests.removeWhere((r) => r.id == requestId);
        _processingIds.remove(requestId);
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(action == 'ACCEPT' ? 'Follow request accepted' : 'Follow request deleted'),
            backgroundColor: AppColors.surfaceElevated,
          ),
        );
      }
    } catch (e) {
      setState(() {
        _processingIds.remove(requestId);
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to process request: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        title: const Text(
          'Follow Requests',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: AppColors.error, size: 48),
              const SizedBox(height: 12),
              Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _fetchRequests,
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (_requests.isEmpty) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.person_add_disabled_outlined, size: 48, color: AppColors.textMuted),
            SizedBox(height: 12),
            Text(
              'No pending follow requests',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 15),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: AppColors.primary,
      backgroundColor: AppColors.surface,
      onRefresh: _fetchRequests,
      child: ListView.separated(
        padding: const EdgeInsets.all(16.0),
        itemCount: _requests.length,
        separatorBuilder: (_, __) => const Divider(color: AppColors.glassBorder),
        itemBuilder: (context, index) {
          final req = _requests[index];
          final isProcessing = _processingIds.contains(req.id);

          return ListTile(
            contentPadding: EdgeInsets.zero,
            leading: CircleAvatar(
              radius: 22,
              backgroundColor: AppColors.surfaceElevated,
              backgroundImage: appAvatarProvider(req.avatarUrl),
              child: req.avatarUrl == null || req.avatarUrl!.isEmpty
                  ? Text(
                      req.displayName.isNotEmpty
                          ? req.displayName.substring(0, 1).toUpperCase()
                          : '?',
                      style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold),
                    )
                  : null,
            ),
            title: Text(
              req.displayName,
              style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold),
            ),
            subtitle: Text(
              '@${req.username}',
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
            trailing: isProcessing
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                  )
                : Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      ElevatedButton(
                        onPressed: () => _respond(req.id, 'ACCEPT'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                        ),
                        child: const Text('Confirm', style: TextStyle(fontSize: 12)),
                      ),
                      const SizedBox(width: 8),
                      OutlinedButton(
                        onPressed: () => _respond(req.id, 'REJECT'),
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: AppColors.glassBorder),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                        ),
                        child: const Text('Delete', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                      ),
                    ],
                  ),
          );
        },
      ),
    );
  }
}
