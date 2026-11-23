import 'package:flutter/material.dart';
import '../utils/haptic_service.dart';

/// Interactive Pinch-to-Zoom Gesture Controller.
/// Enables seamless 2-finger zoom on any photo, story, or video reel,
/// smoothly springing back into place upon release.
class PinchToZoomOverlay extends StatefulWidget {
  final Widget child;
  final double maxScale;
  final VoidCallback? onZoomStart;
  final VoidCallback? onZoomEnd;

  const PinchToZoomOverlay({
    super.key,
    required this.child,
    this.maxScale = 3.5,
    this.onZoomStart,
    this.onZoomEnd,
  });

  @override
  State<PinchToZoomOverlay> createState() => _PinchToZoomOverlayState();
}

class _PinchToZoomOverlayState extends State<PinchToZoomOverlay> with SingleTickerProviderStateMixin {
  late TransformationController _transformationController;
  late AnimationController _animationController;
  Animation<Matrix4>? _resetAnimation;

  @override
  void initState() {
    super.initState();
    _transformationController = TransformationController();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 240),
    )..addListener(() {
        if (_resetAnimation != null) {
          _transformationController.value = _resetAnimation!.value;
        }
      });
  }

  @override
  void dispose() {
    _transformationController.dispose();
    _animationController.dispose();
    super.dispose();
  }

  void _onInteractionStart(ScaleStartDetails details) {
    if (details.pointerCount >= 2) {
      HapticService.selection();
      widget.onZoomStart?.call();
    }
  }

  void _onInteractionEnd(ScaleEndDetails details) {
    _resetAnimation = Matrix4Tween(
      begin: _transformationController.value,
      end: Matrix4.identity(),
    ).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: Curves.easeOutBack,
      ),
    );

    _animationController.forward(from: 0).then((_) {
      widget.onZoomEnd?.call();
    });
  }

  @override
  Widget build(BuildContext context) {
    return InteractiveViewer(
      transformationController: _transformationController,
      minScale: 1.0,
      maxScale: widget.maxScale,
      panEnabled: false,
      clipBehavior: Clip.none,
      onInteractionStart: _onInteractionStart,
      onInteractionEnd: _onInteractionEnd,
      child: widget.child,
    );
  }
}
