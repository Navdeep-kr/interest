import 'dart:async';
import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import '../../domain/models/snap_models.dart';
import '../../domain/services/snap_manager.dart';
import '../../domain/services/privacy_vault_manager.dart';

/// Vault 2.0: Biometric Touch-to-View Ephemeral Snap Viewer.
/// Hold to reveal, release to incinerate & permanently destroy.
/// Zero-Location guaranteed.
class TouchToViewSnapViewer extends StatefulWidget {
  final EphemeralSnap snap;
  final VoidCallback onFinished;

  const TouchToViewSnapViewer({
    super.key,
    required this.snap,
    required this.onFinished,
  });

  static void show(BuildContext context, EphemeralSnap snap, {required VoidCallback onFinished}) {
    Navigator.push(
      context,
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => TouchToViewSnapViewer(snap: snap, onFinished: onFinished),
      ),
    );
  }

  @override
  State<TouchToViewSnapViewer> createState() => _TouchToViewSnapViewerState();
}

class _TouchToViewSnapViewerState extends State<TouchToViewSnapViewer> with SingleTickerProviderStateMixin {
  bool _isHolding = false;
  bool _hasStartedHolding = false;
  bool _isIncinerating = false;
  double _remainingSeconds = 10.0;
  Timer? _countdownTimer;
  late AnimationController _incinerateController;

  @override
  void initState() {
    super.initState();
    _remainingSeconds = widget.snap.durationSeconds;
    _incinerateController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _incinerateController.dispose();
    super.dispose();
  }

  void _onPointerDown() {
    if (_isIncinerating) return;
    setState(() {
      _isHolding = true;
      _hasStartedHolding = true;
    });

    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(milliseconds: 100), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() {
        _remainingSeconds -= 0.1;
        if (_remainingSeconds <= 0) {
          timer.cancel();
          _incinerateAndClose();
        }
      });
    });
  }

  void _onPointerUp() {
    if (!_hasStartedHolding || _isIncinerating) return;
    setState(() {
      _isHolding = false;
    });
    // Immediately incinerate snap upon release
    _incinerateAndClose();
  }

  void _incinerateAndClose() {
    setState(() => _isIncinerating = true);
    _countdownTimer?.cancel();
    _incinerateController.forward().then((_) {
      SnapManager().markSnapViewed(widget.snap.id);
      widget.onFinished();
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Row(
              children: [
                Text('🔥', style: TextStyle(fontSize: 16)),
                SizedBox(width: 8),
                Text('Snap vaporized permanently. 0 traces remain.'),
              ],
            ),
            backgroundColor: Colors.black87,
            duration: Duration(seconds: 2),
          ),
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final filter = widget.snap.lens.colorFilter;
    final progress = (_remainingSeconds / widget.snap.durationSeconds).clamp(0.0, 1.0);
    final vaultManager = PrivacyVaultManager();

    return Scaffold(
      backgroundColor: Colors.black,
      body: Listener(
        onPointerDown: (_) => _onPointerDown(),
        onPointerUp: (_) => _onPointerUp(),
        onPointerCancel: (_) => _onPointerUp(),
        child: Stack(
          fit: StackFit.expand,
          children: [
            // 1. Revealed Snap Media (only visible when actively holding)
            if (_isHolding)
              AnimatedOpacity(
                opacity: _isHolding ? 1.0 : 0.0,
                duration: const Duration(milliseconds: 150),
                child: ColorFiltered(
                  colorFilter: filter ?? const ColorFilter.mode(Colors.transparent, BlendMode.dst),
                  child: OptimizedNetworkImage(
                    imageUrl: widget.snap.mediaUrl,
                    fit: BoxFit.cover,
                  ),
                ),
              )
            else
              // Blackout Security Vault Screen when not holding
              Container(
                color: const Color(0xFF0D0B14),
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 90,
                        height: 90,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.cyanAccent.withOpacity(0.6), width: 2),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.cyanAccent.withOpacity(0.2),
                              blurRadius: 20,
                              spreadRadius: 4,
                            ),
                          ],
                        ),
                        child: const Icon(Icons.fingerprint, color: Colors.cyanAccent, size: 52),
                      ),
                      const SizedBox(height: 20),
                      const Text(
                        'HOLD TO REVEAL SNAP',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.2,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Releasing finger vaporizes & destroys snap instantly',
                        style: TextStyle(color: Colors.white54, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ),

            // 2. Caption Overlay (while holding)
            if (_isHolding && widget.snap.caption.isNotEmpty)
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

            // 3. Top Security Header Bar
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
                            ),
                          ),
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: Colors.cyanAccent.withOpacity(0.2),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Text(
                                  'Touch-to-View 🔐',
                                  style: TextStyle(color: Colors.cyanAccent, fontSize: 10, fontWeight: FontWeight.bold),
                                ),
                              ),
                              if (vaultManager.isFlagSecureEnabled) ...[
                                const SizedBox(width: 4),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: Colors.greenAccent.withOpacity(0.2),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Text(
                                    'FLAG_SECURE',
                                    style: TextStyle(color: Colors.greenAccent, fontSize: 10, fontWeight: FontWeight.bold),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),

                  // Timer indicator
                  Stack(
                    alignment: Alignment.center,
                    children: [
                      SizedBox(
                        width: 34,
                        height: 34,
                        child: CircularProgressIndicator(
                          value: progress,
                          backgroundColor: Colors.white24,
                          valueColor: const AlwaysStoppedAnimation<Color>(Colors.cyanAccent),
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
            ),

            // 4. Incinerate / Vaporize Effect when releasing
            if (_isIncinerating)
              FadeTransition(
                opacity: _incinerateController,
                child: Container(
                  color: Colors.black,
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.local_fire_department, color: Colors.deepOrangeAccent, size: 72),
                        const SizedBox(height: 12),
                        Text(
                          'INCINERATING SNAP...',
                          style: TextStyle(
                            color: Colors.deepOrangeAccent.shade100,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 2,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
