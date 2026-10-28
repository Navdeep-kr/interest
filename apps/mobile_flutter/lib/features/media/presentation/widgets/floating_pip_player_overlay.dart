import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/core/theme/app_colors.dart';
import '../controllers/floating_pip_controller.dart';

/// Draggable Floating Picture-in-Picture & Background Audio Player Bar.
/// Signature Snaptube feature allowing users to watch/listen while navigating anywhere in the app.
class FloatingPiPPlayerOverlay extends StatefulWidget {
  final FloatingPiPController controller;

  const FloatingPiPPlayerOverlay({
    super.key,
    required this.controller,
  });

  @override
  State<FloatingPiPPlayerOverlay> createState() => _FloatingPiPPlayerOverlayState();
}

class _FloatingPiPPlayerOverlayState extends State<FloatingPiPPlayerOverlay> {
  Offset _position = const Offset(16, 120);

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.controller,
      builder: (context, _) {
        if (!widget.controller.hasActivePlayer) {
          return const SizedBox.shrink();
        }

        final reel = widget.controller.activeReel!;
        final isAudioOnly = widget.controller.isAudioOnly;

        if (isAudioOnly) {
          return _buildAudioBottomBar(reel);
        }

        return _buildDraggableVideoPiP(reel);
      },
    );
  }

  Widget _buildAudioBottomBar(dynamic reel) {
    return Positioned(
      bottom: 60, // Above bottom nav
      left: 10,
      right: 10,
      child: Container(
        height: 64,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.black.withOpacity(0.92),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.accentPink.withOpacity(0.6), width: 1.2),
          boxShadow: [
            BoxShadow(
              color: AppColors.accentPink.withOpacity(0.25),
              blurRadius: 16,
              spreadRadius: 2,
            ),
          ],
        ),
        child: Row(
          children: [
            // Thumbnail / Equalizer indicator
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: SizedBox(
                width: 48,
                height: 48,
                child: OptimizedNetworkImage(
                  imageUrl: reel.thumbnailUrl,
                  fit: BoxFit.cover,
                ),
              ),
            ),
            const SizedBox(width: 10),
            // Track Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.music_note, color: AppColors.accentPink, size: 14),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          reel.title.isNotEmpty ? reel.title : 'Background Sound',
                          style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${widget.controller.formattedPosition} / ${widget.controller.formattedDuration} • @${reel.creator.username}',
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                  ),
                ],
              ),
            ),
            // Speed toggle
            TextButton(
              onPressed: widget.controller.cycleSpeed,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 6),
                minimumSize: const Size(36, 32),
              ),
              child: Text(
                '${widget.controller.playbackSpeed}x',
                style: const TextStyle(color: AppColors.accentCyan, fontSize: 11, fontWeight: FontWeight.bold),
              ),
            ),
            // Play / Pause
            IconButton(
              icon: Icon(
                widget.controller.isPlaying ? Icons.pause_circle_filled : Icons.play_circle_fill,
                color: Colors.white,
                size: 28,
              ),
              onPressed: widget.controller.togglePlayPause,
            ),
            // Switch back to Video PiP
            IconButton(
              icon: const Icon(Icons.picture_in_picture_alt, color: AppColors.textMuted, size: 20),
              tooltip: 'Switch to Video',
              onPressed: widget.controller.toggleAudioOnly,
            ),
            // Close
            IconButton(
              icon: const Icon(Icons.close, color: AppColors.textMuted, size: 18),
              onPressed: widget.controller.closePiP,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDraggableVideoPiP(dynamic reel) {
    final screenSize = MediaQuery.of(context).size;
    const width = 140.0;
    const height = 220.0;

    return Positioned(
      left: _position.dx.clamp(8.0, screenSize.width - width - 8.0),
      top: _position.dy.clamp(60.0, screenSize.height - height - 80.0),
      child: GestureDetector(
        onPanUpdate: (details) {
          setState(() {
            _position += details.delta;
          });
        },
        child: Material(
          elevation: 12,
          borderRadius: BorderRadius.circular(16),
          color: Colors.transparent,
          child: Container(
            width: width,
            height: height,
            decoration: BoxDecoration(
              color: Colors.black,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.primary, width: 1.5),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.6),
                  blurRadius: 16,
                  spreadRadius: 2,
                ),
              ],
            ),
            clipBehavior: Clip.antiAlias,
            child: Stack(
              children: [
                // Video thumbnail background
                Positioned.fill(
                  child: OptimizedNetworkImage(
                    imageUrl: reel.thumbnailUrl,
                    fit: BoxFit.cover,
                  ),
                ),
                // Overlay controls
                Container(
                  color: Colors.black.withOpacity(0.35),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Top mini bar: Close & Audio mode
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            GestureDetector(
                              onTap: widget.controller.toggleAudioOnly,
                              child: Container(
                                padding: const EdgeInsets.all(4),
                                decoration: BoxDecoration(
                                  color: Colors.black.withOpacity(0.6),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.headphones, color: AppColors.accentPink, size: 14),
                              ),
                            ),
                            GestureDetector(
                              onTap: widget.controller.closePiP,
                              child: Container(
                                padding: const EdgeInsets.all(4),
                                decoration: BoxDecoration(
                                  color: Colors.black.withOpacity(0.6),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.close, color: Colors.white, size: 14),
                              ),
                            ),
                          ],
                        ),
                      ),
                      // Center play/pause
                      GestureDetector(
                        onTap: widget.controller.togglePlayPause,
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.black.withOpacity(0.6),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            widget.controller.isPlaying ? Icons.pause : Icons.play_arrow,
                            color: Colors.white,
                            size: 24,
                          ),
                        ),
                      ),
                      // Bottom bar: Speed + Progress
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                        color: Colors.black.withOpacity(0.7),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              widget.controller.formattedPosition,
                              style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                            ),
                            GestureDetector(
                              onTap: widget.controller.cycleSpeed,
                              child: Text(
                                '${widget.controller.playbackSpeed}x',
                                style: const TextStyle(color: AppColors.accentCyan, fontSize: 10, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
