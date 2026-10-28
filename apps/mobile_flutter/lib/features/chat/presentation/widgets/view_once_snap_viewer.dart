import 'dart:async';
import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import '../../domain/models/snap_models.dart';
import '../../domain/services/snap_manager.dart';

/// Fullscreen View-Once Ephemeral Snap Player with countdown and screenshot detection.
class ViewOnceSnapViewer extends StatefulWidget {
  final EphemeralSnap snap;
  final VoidCallback onFinished;

  const ViewOnceSnapViewer({
    super.key,
    required this.snap,
    required this.onFinished,
  });

  static void show(BuildContext context, EphemeralSnap snap, {required VoidCallback onFinished}) {
    Navigator.push(
      context,
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => ViewOnceSnapViewer(snap: snap, onFinished: onFinished),
      ),
    );
  }

  @override
  State<ViewOnceSnapViewer> createState() => _ViewOnceSnapViewerState();
}

class _ViewOnceSnapViewerState extends State<ViewOnceSnapViewer> {
  late double _remainingSeconds;
  Timer? _timer;
  bool _isPaused = false;

  @override
  void initState() {
    super.initState();
    _remainingSeconds = widget.snap.durationSeconds;
    _startCountdown();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startCountdown() {
    _timer = Timer.periodic(const Duration(milliseconds: 100), (t) {
      if (!_isPaused) {
        setState(() {
          _remainingSeconds -= 0.1;
          if (_remainingSeconds <= 0) {
            _timer?.cancel();
            SnapManager().markSnapViewed(widget.snap.id);
            widget.onFinished();
            Navigator.pop(context);
          }
        });
      }
    });
  }

  void _simulateScreenshot() {
    SnapManager().recordScreenshotAlert('alex_architect');
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Row(
          children: [
            Icon(Icons.warning_amber, color: Colors.amber),
            SizedBox(width: 8),
            Text('⚠️ Screenshot recorded! Sender has been notified.'),
          ],
        ),
        backgroundColor: Colors.black87,
        duration: Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final progress = (_remainingSeconds / widget.snap.durationSeconds).clamp(0.0, 1.0);
    final filter = widget.snap.lens.colorFilter;

    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        onLongPressStart: (_) => setState(() => _isPaused = true),
        onLongPressEnd: (_) => setState(() => _isPaused = false),
        onTap: () {
          // Tap to dismiss snap early
          _timer?.cancel();
          SnapManager().markSnapViewed(widget.snap.id);
          widget.onFinished();
          Navigator.pop(context);
        },
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Media with Lens Filter
            ColorFiltered(
              colorFilter: filter ?? const ColorFilter.mode(Colors.transparent, BlendMode.dst),
              child: OptimizedNetworkImage(
                imageUrl: widget.snap.mediaUrl,
                fit: BoxFit.cover,
              ),
            ),

            // Caption overlay
            if (widget.snap.caption.isNotEmpty)
              Center(
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  color: Colors.black.withOpacity(0.6),
                  child: Text(
                    widget.snap.caption,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      shadows: [Shadow(color: Colors.black, blurRadius: 4)],
                    ),
                  ),
                ),
              ),

            // Top Header: Sender avatar & Countdown circle
            Positioned(
              top: MediaQuery.of(context).padding.top + 10,
              left: 16,
              right: 16,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 18,
                        backgroundImage: widget.snap.senderAvatarUrl != null
                            ? NetworkImage(widget.snap.senderAvatarUrl!)
                            : null,
                        child: widget.snap.senderAvatarUrl == null
                            ? Text(widget.snap.senderUsername[0].toUpperCase())
                            : null,
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '@${widget.snap.senderUsername}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                              shadows: [Shadow(color: Colors.black, blurRadius: 4)],
                            ),
                          ),
                          const Text(
                            'View-Once Snap',
                            style: TextStyle(color: Colors.amber, fontSize: 11, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ],
                  ),

                  // Countdown circle & Screenshot test button
                  Row(
                    children: [
                      // Screenshot button to test Snapchat alert
                      IconButton(
                        icon: const Icon(Icons.camera_alt_outlined, color: Colors.white70),
                        tooltip: 'Simulate Screenshot',
                        onPressed: _simulateScreenshot,
                      ),
                      const SizedBox(width: 6),
                      // Circular progress countdown
                      Stack(
                        alignment: Alignment.center,
                        children: [
                          SizedBox(
                            width: 32,
                            height: 32,
                            child: CircularProgressIndicator(
                              value: progress,
                              backgroundColor: Colors.white24,
                              valueColor: const AlwaysStoppedAnimation<Color>(Colors.amber),
                              strokeWidth: 3,
                            ),
                          ),
                          Text(
                            '${_remainingSeconds.ceil()}',
                            style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
