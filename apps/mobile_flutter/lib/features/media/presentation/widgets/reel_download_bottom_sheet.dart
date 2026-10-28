import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/reels/domain/models/reel_item_model.dart';
import '../../domain/models/offline_media_item.dart';
import '../../domain/services/offline_download_manager.dart';
import '../screens/offline_vault_screen.dart';

/// Snaptube-grade Universal Media Downloader & Audio Extractor Sheet.
class ReelDownloadBottomSheet extends StatefulWidget {
  final ReelItemModel reel;

  const ReelDownloadBottomSheet({
    super.key,
    required this.reel,
  });

  static void show(BuildContext context, ReelItemModel reel) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => ReelDownloadBottomSheet(reel: reel),
    );
  }

  @override
  State<ReelDownloadBottomSheet> createState() => _ReelDownloadBottomSheetState();
}

class _ReelDownloadBottomSheetState extends State<ReelDownloadBottomSheet> {
  bool _isDownloading = false;
  double _currentProgress = 0.0;
  OfflineMediaFormat? _selectedFormat;
  bool _isFinished = false;

  void _triggerDownload(OfflineMediaFormat format) async {
    setState(() {
      _isDownloading = true;
      _selectedFormat = format;
      _currentProgress = 0.05;
    });

    await OfflineDownloadManager().startDownload(
      reel: widget.reel,
      format: format,
      onProgress: (p) {
        if (mounted) {
          setState(() {
            _currentProgress = p;
          });
        }
      },
    );

    if (mounted) {
      setState(() {
        _isDownloading = false;
        _isFinished = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle bar
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.glassBorder,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Header info with Thumbnail preview
            Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: SizedBox(
                    width: 52,
                    height: 52,
                    child: OptimizedNetworkImage(
                      imageUrl: widget.reel.thumbnailUrl,
                      fit: BoxFit.cover,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.downloading_outlined, color: AppColors.accentPink, size: 18),
                          SizedBox(width: 6),
                          Text(
                            'Snaptube Media Downloader',
                            style: TextStyle(color: AppColors.accentPink, fontSize: 13, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        widget.reel.title.isNotEmpty ? widget.reel.title : 'Reel by @${widget.reel.creator.username}',
                        style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Divider(color: AppColors.glassBorder),

            // Active Progress or Finished state
            if (_isDownloading) ...[
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Downloading ${_selectedFormat?.label ?? 'Media'}...',
                    style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                  Text(
                    '${(_currentProgress * 100).toInt()}%',
                    style: const TextStyle(color: AppColors.accentPink, fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: _currentProgress,
                  backgroundColor: AppColors.surfaceElevated,
                  valueColor: const AlwaysStoppedAnimation<Color>(AppColors.accentPink),
                  minHeight: 6,
                ),
              ),
              const SizedBox(height: 16),
            ] else if (_isFinished) ...[
              Container(
                margin: const EdgeInsets.symmetric(vertical: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.success.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.success.withOpacity(0.4)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.check_circle, color: AppColors.success, size: 24),
                    const SizedBox(width: 10),
                    const Expanded(
                      child: Text(
                        'Saved to Offline Vault! You can play this offline without internet anytime.',
                        style: TextStyle(color: Colors.white, fontSize: 12),
                      ),
                    ),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      ),
                      onPressed: () {
                        Navigator.pop(context);
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const OfflineVaultScreen()),
                        );
                      },
                      child: const Text('Open Vault', style: TextStyle(fontSize: 11, color: Colors.white)),
                    ),
                  ],
                ),
              ),
            ] else ...[
              // Section 1: Video Resolutions
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 6.0),
                child: Text(
                  'VIDEO QUALITY (MP4)',
                  style: TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.8),
                ),
              ),
              _buildOptionTile(
                icon: Icons.hd,
                title: '1080p Full HD Video',
                sizeLabel: '~22.5 MB',
                badgeText: 'Highest Quality',
                badgeColor: AppColors.primary,
                onTap: () => _triggerDownload(OfflineMediaFormat.video1080p),
              ),
              _buildOptionTile(
                icon: Icons.video_file_outlined,
                title: '720p HD Video',
                sizeLabel: '~12.0 MB',
                badgeText: 'Recommended',
                badgeColor: AppColors.accentCyan,
                onTap: () => _triggerDownload(OfflineMediaFormat.video720p),
              ),
              _buildOptionTile(
                icon: Icons.sd,
                title: '480p Fast Download',
                sizeLabel: '~6.0 MB',
                badgeText: 'Data Saver',
                badgeColor: AppColors.accentGold,
                onTap: () => _triggerDownload(OfflineMediaFormat.video480p),
              ),

              const SizedBox(height: 10),
              // Section 2: Audio Only
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 6.0),
                child: Text(
                  'EXTRACT AUDIO (MP3)',
                  style: TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.8),
                ),
              ),
              _buildOptionTile(
                icon: Icons.audiotrack,
                title: 'Extract MP3 Audio',
                sizeLabel: '~3.5 MB',
                badgeText: '320 kbps High Res',
                badgeColor: AppColors.accentPink,
                onTap: () => _triggerDownload(OfflineMediaFormat.audioMp3),
              ),
            ],

            const SizedBox(height: 12),
            // Bottom Action: Direct Status & WhatsApp share
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surfaceElevated,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.glassBorder),
              ),
              child: Row(
                children: [
                  const Icon(Icons.share, color: AppColors.accentCyan, size: 20),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Text(
                      'Share as WhatsApp Status or Story with attribution',
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                    ),
                  ),
                  TextButton(
                    onPressed: () {
                      Navigator.pop(context);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Exported media ready to share to WhatsApp / Social status!')),
                      );
                    },
                    child: const Text('Export', style: TextStyle(color: AppColors.accentCyan, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOptionTile({
    required IconData icon,
    required String title,
    required String sizeLabel,
    required String badgeText,
    required Color badgeColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.surfaceElevated,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.glassBorder),
        ),
        child: Row(
          children: [
            Icon(icon, color: Colors.white, size: 22),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 2),
                  Text(sizeLabel, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: badgeColor.withOpacity(0.18),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: badgeColor.withOpacity(0.4)),
              ),
              child: Text(
                badgeText,
                style: TextStyle(color: badgeColor, fontSize: 10, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(width: 8),
            const Icon(Icons.arrow_forward_ios, color: AppColors.textMuted, size: 12),
          ],
        ),
      ),
    );
  }
}
