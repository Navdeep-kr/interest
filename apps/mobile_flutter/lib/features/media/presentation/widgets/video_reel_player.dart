import 'dart:async';
import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/core/theme/app_colors.dart';
import '../controllers/video_playback_controller.dart';

class VideoReelPlayer extends StatefulWidget {
  final String videoUrl;
  final String? thumbnailUrl;
  final String? caption;
  final bool autoPlay;
  final VoidCallback? onDoubleTap;

  const VideoReelPlayer({
    super.key,
    required this.videoUrl,
    this.thumbnailUrl,
    this.caption,
    this.autoPlay = true,
    this.onDoubleTap,
  });

  @override
  State<VideoReelPlayer> createState() => _VideoReelPlayerState();
}

class _VideoReelPlayerState extends State<VideoReelPlayer> {
  late VideoPlaybackController _controller;
  bool _showPlayPauseOverlay = false;
  Timer? _overlayTimer;

  @override
  void initState() {
    super.initState();
    _controller = VideoPlaybackController(
      videoUrl: widget.videoUrl,
      thumbnailUrl: widget.thumbnailUrl,
      autoPlay: widget.autoPlay,
    );
    _controller.addListener(_onControllerUpdate);
  }

  @override
  void didUpdateWidget(covariant VideoReelPlayer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.videoUrl != widget.videoUrl) {
      _controller.dispose();
      _controller = VideoPlaybackController(
        videoUrl: widget.videoUrl,
        thumbnailUrl: widget.thumbnailUrl,
        autoPlay: widget.autoPlay,
      );
      _controller.addListener(_onControllerUpdate);
    }
  }

  @override
  void dispose() {
    _overlayTimer?.cancel();
    _controller.removeListener(_onControllerUpdate);
    _controller.dispose();
    super.dispose();
  }

  void _onControllerUpdate() {
    if (mounted) setState(() {});
  }

  void _handleTap() {
    _controller.togglePlayPause();
    setState(() {
      _showPlayPauseOverlay = true;
    });
    _overlayTimer?.cancel();
    _overlayTimer = Timer(const Duration(milliseconds: 600), () {
      if (mounted) {
        setState(() {
          _showPlayPauseOverlay = false;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _handleTap,
      onDoubleTap: widget.onDoubleTap,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Background poster image if provided
          if (widget.thumbnailUrl != null && widget.thumbnailUrl!.isNotEmpty)
            OptimizedNetworkImage(
              imageUrl: widget.thumbnailUrl!,
              fit: BoxFit.cover,
              targetCacheWidth: 720,
              targetCacheHeight: 1280,
              errorWidget: Container(color: Colors.black87),
            )
          else
            Container(color: Colors.black),

          // Video content layer
          Center(
            child: AspectRatio(
              aspectRatio: _controller.aspectRatio,
              child: Container(
                color: Colors.black,
                child: _buildPlaybackStateContent(),
              ),
            ),
          ),

          // Play / Pause animated icon overlay
          if (_showPlayPauseOverlay)
            Center(
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.black54,
                ),
                child: Icon(
                  _controller.state == PlaybackState.playing
                      ? Icons.play_arrow
                      : Icons.pause,
                  size: 48,
                  color: Colors.white,
                ),
              ),
            ),

          // Mute / Unmute button in top right
          Positioned(
            top: 50,
            right: 16,
            child: GestureDetector(
              onTap: _controller.toggleMute,
              child: Container(
                padding: const EdgeInsets.all(6),
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.black45,
                ),
                child: Icon(
                  _controller.isMuted ? Icons.volume_off : Icons.volume_up,
                  size: 20,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPlaybackStateContent() {
    switch (_controller.state) {
      case PlaybackState.buffering:
        return const Center(
          child: CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(AppColors.brandPrimary),
          ),
        );
      case PlaybackState.error:
        return Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 42, color: AppColors.accentRed),
              const SizedBox(height: 8),
              Text(
                _controller.errorMessage ?? 'Playback error',
                style: const TextStyle(color: Colors.white70, fontSize: 13),
              ),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: _controller.retry,
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.brandPrimary),
                child: const Text('Retry'),
              ),
            ],
          ),
        );
      case PlaybackState.uninitialized:
      case PlaybackState.paused:
      case PlaybackState.playing:
      case PlaybackState.completed:
        return const SizedBox();
    }
  }
}
