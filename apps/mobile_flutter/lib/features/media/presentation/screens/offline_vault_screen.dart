import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/core/theme/app_colors.dart';
import '../../domain/models/offline_media_item.dart';
import '../../domain/services/offline_download_manager.dart';
import '../controllers/floating_pip_controller.dart';
import 'package:mobile/features/reels/domain/models/reel_item_model.dart';

/// Snaptube-style Offline Media Hub & Secret Vault Screen.
class OfflineVaultScreen extends StatefulWidget {
  const OfflineVaultScreen({super.key});

  @override
  State<OfflineVaultScreen> createState() => _OfflineVaultScreenState();
}

class _OfflineVaultScreenState extends State<OfflineVaultScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final TextEditingController _pinController = TextEditingController();
  final OfflineDownloadManager _manager = OfflineDownloadManager();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _manager.addListener(_onManagerUpdate);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _pinController.dispose();
    _manager.removeListener(_onManagerUpdate);
    super.dispose();
  }

  void _onManagerUpdate() {
    if (mounted) setState(() {});
  }

  void _showUnlockDialog() {
    _pinController.clear();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.lock, color: AppColors.accentPink),
            SizedBox(width: 8),
            Text('Unlock Secret Vault', style: TextStyle(color: Colors.white, fontSize: 16)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Enter your 4-digit security PIN to access protected media files (Default: 1234):',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _pinController,
              obscureText: true,
              keyboardType: TextInputType.number,
              maxLength: 4,
              style: const TextStyle(color: Colors.white, fontSize: 20, letterSpacing: 8),
              textAlign: TextAlign.center,
              decoration: InputDecoration(
                filled: true,
                fillColor: AppColors.surfaceElevated,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                counterText: '',
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
            onPressed: () {
              final ok = _manager.unlockVault(_pinController.text.trim());
              Navigator.pop(ctx);
              if (ok) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Vault Unlocked successfully!')),
                );
              } else {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Incorrect PIN! Try 1234.')),
                );
              }
            },
            child: const Text('Unlock', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _playMediaOffline(OfflineMediaItem item) {
    // Wrap in dummy ReelItemModel to stream into Floating PiP / Background audio
    final dummyReel = ReelItemModel(
      id: item.originalReelId,
      creatorId: 'creator_offline',
      creator: ReelCreatorModel(
        id: 'creator_offline',
        username: item.creatorUsername,
        displayName: item.creatorUsername,
        avatarUrl: item.creatorAvatarUrl,
      ),
      title: item.title,
      hlsMasterUrl: item.mediaUrl,
      thumbnailUrl: item.thumbnailUrl,
      durationSeconds: item.durationSeconds,
      primaryInterestId: 'offline',
      interestTags: const ['offline', 'saved'],
      viewCount: 1,
      likeCount: 0,
      commentCount: 0,
      saveCount: 1,
      shareCount: 0,
      isLiked: false,
      isSaved: true,
      isFollowing: false,
      isPinned: false,
      mediaType: item.format.isAudio ? ReelMediaType.video : ReelMediaType.video,
      imageUrls: const [],
      visibility: ReelItemVisibility.public,
      hashtags: const ['offline'],
      createdAt: DateTime.now().toIso8601String(),
    );

    FloatingPiPController().startPiP(
      reel: dummyReel,
      audioOnly: item.format.isAudio,
    );

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Playing "${item.title}" in offline ${item.format.isAudio ? 'Audio Player' : 'Floating PiP'}!'),
        duration: const Duration(seconds: 2),
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
        title: const Row(
          children: [
            Icon(Icons.download_done, color: AppColors.accentPink),
            SizedBox(width: 8),
            Text('Offline Media & Vault', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 17)),
          ],
        ),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.accentPink,
          labelColor: Colors.white,
          unselectedLabelColor: AppColors.textMuted,
          labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          tabs: [
            Tab(text: 'Videos (${_manager.videoDownloads.length})'),
            Tab(text: 'MP3s (${_manager.audioDownloads.length})'),
            Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.lock, size: 14),
                  const SizedBox(width: 4),
                  Text('Vault (${_manager.vaultedItems.length})'),
                ],
              ),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          // Storage optimizer bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: AppColors.surfaceElevated,
            child: Row(
              children: [
                const Icon(Icons.cleaning_services, color: AppColors.accentCyan, size: 18),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Storage Used: ${_manager.formattedTotalStorageUsage} • Fast Offline Playback',
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                  ),
                ),
                GestureDetector(
                  onTap: () {
                    _manager.cleanStorageCache();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Temporary Cache cleaned! Freed storage space.')),
                    );
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.accentCyan.withOpacity(0.18),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.accentCyan.withOpacity(0.4)),
                    ),
                    child: const Text('Clean Cache', style: TextStyle(color: AppColors.accentCyan, fontSize: 11, fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ),

          // Tab views
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildMediaList(_manager.videoDownloads, isVaultTab: false),
                _buildMediaList(_manager.audioDownloads, isVaultTab: false),
                _buildVaultTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVaultTab() {
    if (!_manager.isVaultUnlocked) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppColors.accentPink.withOpacity(0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.lock_outline, size: 48, color: AppColors.accentPink),
              ),
              const SizedBox(height: 16),
              const Text(
                'Secret Private Vault',
                style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'Protect your private videos and downloaded files with biometric & PIN encryption.',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                ),
                icon: const Icon(Icons.lock_open, color: Colors.white, size: 18),
                label: const Text('Unlock Vault (PIN: 1234)', style: TextStyle(color: Colors.white)),
                onPressed: _showUnlockDialog,
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          color: AppColors.primary.withOpacity(0.12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.lock_open, color: AppColors.primary, size: 16),
                  SizedBox(width: 6),
                  Text('Vault is Unlocked', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                ],
              ),
              TextButton(
                onPressed: _manager.lockVault,
                child: const Text('Lock Vault Now', style: TextStyle(color: AppColors.accentRed, fontSize: 11, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
        Expanded(
          child: _buildMediaList(_manager.vaultedItems, isVaultTab: true),
        ),
      ],
    );
  }

  Widget _buildMediaList(List<OfflineMediaItem> list, {required bool isVaultTab}) {
    if (list.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_download_outlined, size: 48, color: AppColors.textMuted),
              const SizedBox(height: 12),
              Text(
                isVaultTab ? 'No vaulted private files yet' : 'No offline downloads yet',
                style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              const Text(
                'Tap the Download button on any Reel or Feed post to save for offline watching.',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      itemCount: list.length,
      itemBuilder: (ctx, index) {
        final item = list[index];
        return Card(
          color: AppColors.surface,
          margin: const EdgeInsets.only(bottom: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: const BorderSide(color: AppColors.glassBorder),
          ),
          child: InkWell(
            onTap: () => _playMediaOffline(item),
            borderRadius: BorderRadius.circular(14),
            child: Padding(
              padding: const EdgeInsets.all(12.0),
              child: Row(
                children: [
                  // Thumbnail preview with play badge
                  Stack(
                    alignment: Alignment.center,
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: SizedBox(
                          width: 64,
                          height: 64,
                          child: OptimizedNetworkImage(
                            imageUrl: item.thumbnailUrl,
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.65),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          item.format.isAudio ? Icons.music_note : Icons.play_arrow,
                          color: Colors.white,
                          size: 18,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(width: 12),

                  // Info
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.title,
                          style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: item.format.isAudio
                                    ? AppColors.accentPink.withOpacity(0.2)
                                    : AppColors.primary.withOpacity(0.2),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                item.format.shortTag,
                                style: TextStyle(
                                  color: item.format.isAudio ? AppColors.accentPink : AppColors.accentCyan,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              '${item.formattedFileSize} • ${item.formattedDuration}',
                              style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '@${item.creatorUsername}',
                          style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                        ),
                      ],
                    ),
                  ),

                  // Actions: Toggle Vault & Delete
                  IconButton(
                    icon: Icon(
                      item.isVaulted ? Icons.lock : Icons.lock_outline,
                      color: item.isVaulted ? AppColors.accentPink : AppColors.textMuted,
                      size: 20,
                    ),
                    tooltip: item.isVaulted ? 'Remove from Secret Vault' : 'Move to Secret Vault',
                    onPressed: () {
                      _manager.toggleVault(item.id);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(item.isVaulted
                              ? 'Moved out of Secret Vault'
                              : 'Moved into PIN-protected Secret Vault!'),
                        ),
                      );
                    },
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete_outline, color: AppColors.accentRed, size: 20),
                    tooltip: 'Delete download',
                    onPressed: () {
                      _manager.deleteDownload(item.id);
                    },
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
