import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/reels/domain/models/reel_item_model.dart';
import 'package:mobile/features/media/presentation/widgets/video_reel_player.dart';
import 'package:mobile/features/media/presentation/controllers/floating_pip_controller.dart';
import 'package:mobile/features/media/presentation/widgets/reel_download_bottom_sheet.dart';
import 'package:mobile/features/monetization/domain/services/superfans_manager.dart';
import 'package:mobile/features/monetization/presentation/widgets/superfans_paywall_card.dart';
import 'audio_attribution_pill.dart';
import 'save_to_collection_sheet.dart';
import 'engagement_bar.dart';

class ReelCard extends StatefulWidget {
  final ReelItemModel reel;
  final bool isActive;
  final VoidCallback onLike;
  final VoidCallback onComment;
  final VoidCallback onSave;
  final VoidCallback onShare;
  final VoidCallback? onMore;
  final VoidCallback? onCreatorTap;

  const ReelCard({
    super.key,
    required this.reel,
    this.isActive = true,
    required this.onLike,
    required this.onComment,
    required this.onSave,
    required this.onShare,
    this.onMore,
    this.onCreatorTap,
  });

  @override
  State<ReelCard> createState() => _ReelCardState();
}

class _ReelCardState extends State<ReelCard> with SingleTickerProviderStateMixin {
  int _currentImageIndex = 0;
  bool _showHeartBurst = false;

  void _triggerHeartBurst() {
    setState(() => _showHeartBurst = true);
    widget.onLike();
    Future.delayed(const Duration(milliseconds: 900), () {
      if (mounted) setState(() => _showHeartBurst = false);
    });
  }

  void _showRecommendationDetails(BuildContext context, ReelItemModel reel) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: AppColors.textMuted.withOpacity(0.4),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const Row(
                children: [
                  Icon(Icons.auto_awesome, color: AppColors.primary, size: 22),
                  SizedBox(width: 8),
                  Text(
                    'Transparent Interest Matching',
                    style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                reel.explanation ?? 'This post matches your engagement affinity with #${reel.primaryInterestId}.',
                style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.4),
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.surfaceElevated,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.glassBorder),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.shield_outlined, color: AppColors.accentCyan, size: 20),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Zero-Location Invariant Enforced: Recommendations are pure semantic affinity. We never access GPS or location telemetry.',
                        style: TextStyle(color: AppColors.textSecondary, fontSize: 11),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                  child: const Text('Understood', style: TextStyle(color: Colors.white)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final reel = widget.reel;
    final isSuperfanLocked = reel.isSuperfanOnly && !SuperfansManager().isSuperfanOf(reel.creatorId);

    return Stack(
      fit: StackFit.expand,
      children: [
        // Media background with double-tap heart burst
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onDoubleTap: _triggerHeartBurst,
          child: isSuperfanLocked
              ? Stack(
                  fit: StackFit.expand,
                  children: [
                    OptimizedNetworkImage(imageUrl: reel.thumbnailUrl, fit: BoxFit.cover),
                    SuperfansPaywallCard(
                      creatorId: reel.creatorId,
                      creatorUsername: reel.creator.username,
                      creatorAvatarUrl: reel.creator.avatarUrl,
                      onUnlocked: () => setState(() {}),
                    ),
                  ],
                )
              : reel.mediaType == ReelMediaType.image && reel.imageUrls.isNotEmpty
                  ? _buildImageCarousel(reel.imageUrls)
                  : _buildVideoPlayer(reel),
        ),

        // Gradient overlay for readability
        IgnorePointer(
          child: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.black.withOpacity(0.3),
                  Colors.transparent,
                  Colors.transparent,
                  Colors.black.withOpacity(0.8),
                ],
                stops: const [0.0, 0.2, 0.6, 1.0],
              ),
            ),
          ),
        ),

        // Heart Burst Animation in Center
        if (_showHeartBurst)
          IgnorePointer(
            child: Center(
              child: TweenAnimationBuilder<double>(
                tween: Tween(begin: 0.2, end: 1.2),
                duration: const Duration(milliseconds: 400),
                curve: Curves.elasticOut,
                builder: (context, scale, child) {
                  return Transform.scale(
                    scale: scale,
                    child: const Icon(
                      Icons.favorite,
                      size: 110,
                      color: AppColors.accentRed,
                      shadows: [
                        Shadow(color: Colors.black54, blurRadius: 20),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),

        // Right side: Vertical Engagement Bar with Snaptube Downloader & Floating PiP
        Positioned(
          right: 12,
          bottom: 40,
          child: EngagementBar(
            reel: reel,
            onLike: widget.onLike,
            onComment: widget.onComment,
            onSave: widget.onSave,
            onSaveLongPress: () {
              SaveToCollectionSheet.show(
                context,
                reel: reel,
                onCollectionSelected: (collectionName) {
                  widget.onSave();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Saved to "$collectionName" collection!')),
                  );
                },
              );
            },
            onShare: widget.onShare,
            onMore: widget.onMore,
            onDownload: () => ReelDownloadBottomSheet.show(context, reel),
            onPiP: () {
              FloatingPiPController().startPiP(reel: reel);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Playing in Floating Picture-in-Picture!')),
              );
            },
          ),
        ),

        // Bottom left: Creator Info, Title, Caption, Hashtags
        Positioned(
          left: 16,
          right: 80,
          bottom: 32,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Recommendation explanation tag (Clickable for full algorithmic transparency)
              if (reel.explanation != null && reel.explanation!.isNotEmpty) ...[
                GestureDetector(
                  onTap: () => _showRecommendationDetails(context, reel),
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.65),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: AppColors.brandPrimary.withOpacity(0.8),
                        width: 0.9,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.auto_awesome,
                          size: 11,
                          color: AppColors.brandPrimary,
                        ),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            reel.explanation!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                              shadows: [Shadow(color: Colors.black87, blurRadius: 2)],
                            ),
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Icon(Icons.info_outline, size: 10, color: Colors.white70),
                      ],
                    ),
                  ),
                ),
              ],

              // Creator handle & avatar
              GestureDetector(
                onTap: widget.onCreatorTap,
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 18,
                      backgroundColor: AppColors.backgroundCard,
                      backgroundImage: appAvatarProvider(reel.creator.avatarUrl),
                      child: reel.creator.avatarUrl == null
                          ? Text(
                              reel.creator.displayName.isNotEmpty
                                  ? reel.creator.displayName[0].toUpperCase()
                                  : '?',
                              style: const TextStyle(
                                color: AppColors.textPrimary,
                                fontWeight: FontWeight.bold,
                              ),
                            )
                          : null,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '@${reel.creator.username}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        shadows: [Shadow(color: Colors.black87, blurRadius: 4)],
                      ),
                    ),
                    if (reel.isPinned) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.accentGold.withOpacity(0.3),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: AppColors.accentGold, width: 0.8),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.push_pin, size: 10, color: AppColors.accentGold),
                            SizedBox(width: 2),
                            Text(
                              'PINNED',
                              style: TextStyle(
                                color: AppColors.accentGold,
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    if (reel.isSuperfanOnly) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(colors: [Color(0xFF9333EA), Color(0xFFC084FC)]),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.workspace_premium, size: 10, color: Colors.amber),
                            SizedBox(width: 2),
                            Text(
                              'SUPERFANS',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 8),

              // Title
              Text(
                reel.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  shadows: [Shadow(color: Colors.black87, blurRadius: 4)],
                ),
              ),

              // Caption
              if (reel.caption != null && reel.caption!.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  reel.caption!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 13,
                    shadows: [Shadow(color: Colors.black87, blurRadius: 4)],
                  ),
                ),
              ],

              // Hashtags
              if (reel.hashtags.isNotEmpty) ...[
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  children: reel.hashtags.map((tag) {
                    final cleanTag = tag.startsWith('#') ? tag : '#$tag';
                    return Text(
                      cleanTag,
                      style: const TextStyle(
                        color: AppColors.brandPrimary,
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        shadows: [Shadow(color: Colors.black87, blurRadius: 4)],
                      ),
                    );
                  }).toList(),
                ),
              ],

              // Dynamic Audio Attribution Pill with Equalizer & Sound Hub
              AudioAttributionPill(
                audioTitle: reel.title.isNotEmpty ? 'Original Audio' : 'Trending Sound',
                creatorUsername: reel.creator.username,
                audioCoverUrl: reel.thumbnailUrl,
              ),
            ],
          ),
        ),

        // Carousel indicator dots if multiple images
        if (reel.mediaType == ReelMediaType.image && reel.imageUrls.length > 1)
          Positioned(
            top: 60,
            left: 0,
            right: 0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(
                reel.imageUrls.length,
                (i) => Container(
                  width: 6,
                  height: 6,
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _currentImageIndex == i ? AppColors.brandPrimary : Colors.white38,
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildImageCarousel(List<String> imageUrls) {
    return PageView.builder(
      itemCount: imageUrls.length,
      onPageChanged: (index) {
        setState(() => _currentImageIndex = index);
      },
      itemBuilder: (context, index) {
        return OptimizedNetworkImage(
          imageUrl: imageUrls[index],
          fit: BoxFit.cover,
          targetCacheWidth: 720,
          targetCacheHeight: 1280,
          errorWidget: Container(
            color: AppColors.backgroundCard,
            child: const Center(
              child: Icon(Icons.broken_image, size: 48, color: AppColors.textSecondary),
            ),
          ),
        );
      },
    );
  }

  Widget _buildVideoPlayer(ReelItemModel reel) {
    if (reel.hlsMasterUrl.isNotEmpty) {
      if (!widget.isActive) {
        // Virtualization: When scrolled offscreen, render poster image to release hardware video decoder
        return _buildVideoPlaceholder(reel);
      }
      return VideoReelPlayer(
        videoUrl: reel.hlsMasterUrl,
        thumbnailUrl: reel.thumbnailUrl,
        caption: reel.caption,
        autoPlay: widget.isActive,
        onDoubleTap: widget.onLike,
      );
    }
    return _buildVideoPlaceholder(reel);
  }

  Widget _buildVideoPlaceholder(ReelItemModel reel) {
    if (reel.thumbnailUrl.isNotEmpty) {
      return OptimizedNetworkImage(
        imageUrl: reel.thumbnailUrl,
        fit: BoxFit.cover,
        targetCacheWidth: 720,
        targetCacheHeight: 1280,
        errorWidget: _fallbackMediaContainer(),
      );
    }
    return _fallbackMediaContainer();
  }

  Widget _fallbackMediaContainer() {
    return Container(
      color: Colors.black87,
      child: const Center(
        child: Icon(Icons.play_circle_outline, size: 64, color: Colors.white54),
      ),
    );
  }
}
