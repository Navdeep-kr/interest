import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import '../../domain/models/snap_models.dart';
import '../../domain/services/snap_manager.dart';

/// Snapchat-style Quick Snap Camera with AR Creative Color Lenses & Text Banners.
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

  final List<String> _sampleBackgrounds = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1080',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1080',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1080',
  ];

  int _bgIndex = 0;

  void _takeSnap() {
    setState(() {
      _isCaptured = true;
    });
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

          // 2. Translucent Text Caption Bar across the middle (Snapchat classic)
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

          // 3. Top Controls (Close, Flash, Flip Camera, View-Once toggle)
          Positioned(
            top: MediaQuery.of(context).padding.top + 10,
            left: 16,
            right: 16,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white, size: 28),
                  onPressed: () => Navigator.pop(context),
                ),
                Row(
                  children: [
                    IconButton(
                      icon: Icon(
                        _isFlashOn ? Icons.flash_on : Icons.flash_off,
                        color: _isFlashOn ? Colors.amber : Colors.white,
                      ),
                      onPressed: () => setState(() => _isFlashOn = !_isFlashOn),
                    ),
                    IconButton(
                      icon: const Icon(Icons.flip_camera_ios, color: Colors.white),
                      onPressed: () {
                        setState(() {
                          _isFrontCamera = !_isFrontCamera;
                          _bgIndex = (_bgIndex + 1) % _sampleBackgrounds.length;
                        });
                      },
                    ),
                    // View-Once toggle
                    GestureDetector(
                      onTap: () => setState(() => _isViewOnce = !_isViewOnce),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: _isViewOnce ? Colors.amber : Colors.white24,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              _isViewOnce ? Icons.looks_one : Icons.all_inclusive,
                              color: _isViewOnce ? Colors.black : Colors.white,
                              size: 16,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              _isViewOnce ? '1x View' : 'Repeat',
                              style: TextStyle(
                                color: _isViewOnce ? Colors.black : Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // 4. Bottom Controls: Lenses Carousel & Shutter Button
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
