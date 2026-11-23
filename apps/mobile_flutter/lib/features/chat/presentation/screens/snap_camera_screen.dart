import 'dart:async';
import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import '../../domain/models/snap_models.dart';
import '../../domain/services/snap_manager.dart';
import '../../../reels/presentation/widgets/sound_picker_bottom_sheet.dart';

/// Snapchat-style Quick Snap Camera with AR Creative Color Lenses, Face Stickers, Speed & Timers.
class SnapCameraScreen extends StatefulWidget {
  final String? preselectedRecipient;
  final String? conversationId;

  const SnapCameraScreen({
    super.key,
    this.preselectedRecipient,
    this.conversationId,
  });

  @override
  State<SnapCameraScreen> createState() => _SnapCameraScreenState();
}

class _SnapCameraScreenState extends State<SnapCameraScreen> {
  SnapLensType _activeLens = SnapLensType.normal;
  final TextEditingController _captionController = TextEditingController();
  bool _isFrontCamera = false;
  bool _isFlashOn = false;
  bool _isViewOnce = true;
  final double _durationSeconds = 10.0;
  bool _isCaptured = false;

  // Creative Tools State
  int _timerDuration = 0; // 0 (off), 3, 10
  int? _countdownCurrent;
  double _playbackSpeed = 1.0; // 0.5, 1.0, 2.0, 3.0
  String? _selectedSound;
  String? _selectedFaceSticker; // '👑', '🐶', '🕶️', '✨'

  final List<String> _sampleBackgrounds = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1080',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1080',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1080',
  ];

  int _bgIndex = 0;

  void _cycleTimer() {
    setState(() {
      if (_timerDuration == 0) {
        _timerDuration = 3;
      } else if (_timerDuration == 3) {
        _timerDuration = 10;
      } else {
        _timerDuration = 0;
      }
    });
  }

  void _cycleSpeed() {
    setState(() {
      if (_playbackSpeed == 1.0) {
        _playbackSpeed = 2.0;
      } else if (_playbackSpeed == 2.0) {
        _playbackSpeed = 3.0;
      } else if (_playbackSpeed == 3.0) {
        _playbackSpeed = 0.5;
      } else {
        _playbackSpeed = 1.0;
      }
    });
  }

  void _cycleFaceSticker() {
    final stickers = [null, '👑', '🐶', '🕶️', '✨'];
    final currentIndex = stickers.indexOf(_selectedFaceSticker);
    final nextIndex = (currentIndex + 1) % stickers.length;
    setState(() {
      _selectedFaceSticker = stickers[nextIndex];
    });
  }

  void _takeSnap() {
    if (_timerDuration > 0) {
      setState(() => _countdownCurrent = _timerDuration);
      Timer.periodic(const Duration(seconds: 1), (timer) {
        if (!mounted) {
          timer.cancel();
          return;
        }
        if (_countdownCurrent! > 1) {
          setState(() => _countdownCurrent = _countdownCurrent! - 1);
        } else {
          timer.cancel();
          setState(() {
            _countdownCurrent = null;
            _isCaptured = true;
          });
        }
      });
    } else {
      setState(() {
        _isCaptured = true;
      });
    }
  }

  void _retakeSnap() {
    setState(() {
      _isCaptured = false;
    });
  }

  void _sendSnap() {
    final recipient = widget.preselectedRecipient ?? 'elena_rostova';
    final convId = widget.conversationId ?? 'conv_direct_1';

    SnapManager().sendSnap(
      conversationId: convId,
      recipientUsername: recipient,
      mediaUrl: _sampleBackgrounds[_bgIndex],
      caption: _captionController.text.trim(),
      lens: _activeLens,
      isViewOnce: _isViewOnce,
      durationSeconds: _durationSeconds,
    );

    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Text('🔥', style: TextStyle(fontSize: 16)),
            const SizedBox(width: 8),
            Text('Snap sent to @$recipient! Streak kept!'),
          ],
        ),
        backgroundColor: Colors.deepOrange,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  void dispose() {
    _captionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final filter = _activeLens.colorFilter;

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // 1. Camera Viewfinder with active color lens
          ColorFiltered(
            colorFilter: filter ?? const ColorFilter.mode(Colors.transparent, BlendMode.dst),
            child: OptimizedNetworkImage(
              imageUrl: _sampleBackgrounds[_bgIndex],
              fit: BoxFit.cover,
            ),
          ),

          // 2. AR Face Sticker Overlay (e.g. 👑, 🐶, 🕶️, ✨)
          if (_selectedFaceSticker != null)
            Positioned(
              top: MediaQuery.of(context).size.height * 0.28,
              left: 0,
              right: 0,
              child: Center(
                child: TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0.8, end: 1.0),
                  duration: const Duration(milliseconds: 300),
                  builder: (ctx, scale, child) => Transform.scale(
                    scale: scale,
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.amber.withOpacity(0.3),
                            blurRadius: 24,
                            spreadRadius: 4,
                          ),
                        ],
                      ),
                      child: Text(
                        _selectedFaceSticker!,
                        style: const TextStyle(fontSize: 72),
                      ),
                    ),
                  ),
                ),
              ),
            ),

          // 3. Countdown Overlay
          if (_countdownCurrent != null)
            Center(
              child: Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.7),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.amber, width: 4),
                ),
                child: Center(
                  child: Text(
                    '$_countdownCurrent',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 56,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ),
            ),

          // 4. Sound Pill at Top Center
          Positioned(
            top: MediaQuery.of(context).padding.top + 12,
            left: 70,
            right: 70,
            child: GestureDetector(
              onTap: () async {
                final track = await SoundPickerBottomSheet.show(context);
                if (track != null) {
                  setState(() => _selectedSound = track.title);
                }
              },
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.65),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.white24),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.music_note, color: Colors.amber, size: 14),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          _selectedSound ?? 'Add Sound',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),

          // 5. Translucent Text Caption Bar across the middle (Snapchat classic)
          Center(
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: Colors.black.withOpacity(0.55),
              child: TextField(
                controller: _captionController,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  shadows: [Shadow(color: Colors.black, blurRadius: 4)],
                ),
                decoration: const InputDecoration(
                  hintText: 'Tap to add a caption...',
                  hintStyle: TextStyle(color: Colors.white70, fontSize: 16),
                  border: InputBorder.none,
                ),
              ),
            ),
          ),

          // 6. Top Left Close Button
          Positioned(
            top: MediaQuery.of(context).padding.top + 8,
            left: 16,
            child: IconButton(
              icon: const Icon(Icons.close, color: Colors.white, size: 28),
              onPressed: () => Navigator.pop(context),
            ),
          ),

          // 7. Right Vertical Tool Palette (Snapchat Pro tools)
          Positioned(
            top: MediaQuery.of(context).padding.top + 60,
            right: 14,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.4),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: Colors.white12),
              ),
              child: Column(
                children: [
                  // Flip Camera
                  IconButton(
                    icon: const Icon(Icons.flip_camera_ios, color: Colors.white, size: 22),
                    tooltip: 'Flip Camera',
                    onPressed: () {
                      setState(() {
                        _isFrontCamera = !_isFrontCamera;
                        _bgIndex = (_bgIndex + 1) % _sampleBackgrounds.length;
                      });
                    },
                  ),
                  const SizedBox(height: 6),

                  // Flash
                  IconButton(
                    icon: Icon(
                      _isFlashOn ? Icons.flash_on : Icons.flash_off,
                      color: _isFlashOn ? Colors.amber : Colors.white,
                      size: 22,
                    ),
                    tooltip: 'Flash',
                    onPressed: () => setState(() => _isFlashOn = !_isFlashOn),
                  ),
                  const SizedBox(height: 6),

                  // Hands-Free Timer (0s, 3s, 10s)
                  GestureDetector(
                    onTap: _cycleTimer,
                    child: Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: Column(
                        children: [
                          Icon(
                            Icons.timer,
                            color: _timerDuration > 0 ? Colors.amber : Colors.white,
                            size: 22,
                          ),
                          Text(
                            _timerDuration == 0 ? 'Off' : '${_timerDuration}s',
                            style: TextStyle(
                              color: _timerDuration > 0 ? Colors.amber : Colors.white70,
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),

                  // Speed Control (0.5x, 1x, 2x, 3x)
                  GestureDetector(
                    onTap: _cycleSpeed,
                    child: Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: Column(
                        children: [
                          Icon(
                            Icons.speed,
                            color: _playbackSpeed != 1.0 ? Colors.amber : Colors.white,
                            size: 22,
                          ),
                          Text(
                            '${_playbackSpeed}x',
                            style: TextStyle(
                              color: _playbackSpeed != 1.0 ? Colors.amber : Colors.white70,
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),

                  // AR Face Sticker Toggle (👑, 🐶, 🕶️, ✨)
                  GestureDetector(
                    onTap: _cycleFaceSticker,
                    child: Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: Column(
                        children: [
                          Text(
                            _selectedFaceSticker ?? '🎭',
                            style: const TextStyle(fontSize: 18),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _selectedFaceSticker != null ? 'On' : 'Lens',
                            style: TextStyle(
                              color: _selectedFaceSticker != null ? Colors.amber : Colors.white70,
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),

                  // View-Once Toggle
                  GestureDetector(
                    onTap: () => setState(() => _isViewOnce = !_isViewOnce),
                    child: Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: Column(
                        children: [
                          Icon(
                            _isViewOnce ? Icons.looks_one : Icons.all_inclusive,
                            color: _isViewOnce ? Colors.amber : Colors.white,
                            size: 20,
                          ),
                          Text(
                            _isViewOnce ? '1x' : 'Loop',
                            style: TextStyle(
                              color: _isViewOnce ? Colors.amber : Colors.white70,
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // 8. Bottom Controls: Lenses Carousel & Shutter Button
          Positioned(
            bottom: 30,
            left: 0,
            right: 0,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Creative Lenses Carousel
                SizedBox(
                  height: 48,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    itemCount: SnapLensType.values.length,
                    itemBuilder: (ctx, i) {
                      final lens = SnapLensType.values[i];
                      final isSelected = _activeLens == lens;
                      return GestureDetector(
                        onTap: () => setState(() => _activeLens = lens),
                        child: Container(
                          margin: const EdgeInsets.symmetric(horizontal: 5),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: isSelected ? Colors.amber : Colors.black.withOpacity(0.6),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: isSelected ? Colors.amber : Colors.white24,
                              width: 1.2,
                            ),
                          ),
                          child: Center(
                            child: Text(
                              lens.displayName,
                              style: TextStyle(
                                color: isSelected ? Colors.black : Colors.white,
                                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                                fontSize: 12,
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 20),

                // Shutter / Send Button
                if (!_isCaptured)
                  GestureDetector(
                    onTap: _takeSnap,
                    child: Container(
                      width: 76,
                      height: 76,
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 4),
                      ),
                      child: Container(
                        decoration: const BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                  )
                else
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24.0),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // Retake
                        IconButton(
                          icon: const Icon(Icons.refresh, color: Colors.white, size: 32),
                          onPressed: _retakeSnap,
                        ),
                        // Send Button
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.amber,
                            foregroundColor: Colors.black,
                            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
                            elevation: 8,
                          ),
                          icon: const Icon(Icons.send, size: 20),
                          label: Text(
                            widget.preselectedRecipient != null
                                ? 'Send to @${widget.preselectedRecipient} 🔥'
                                : 'Send Snap 🔥',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                          ),
                          onPressed: _sendSnap,
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
