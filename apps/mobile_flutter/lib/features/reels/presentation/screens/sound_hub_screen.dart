import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/core/theme/app_colors.dart';

/// Instagram-style Sound Hub Screen showing audio waveform, usage stats, and "Use Audio" action.
class SoundHubScreen extends StatefulWidget {
  final String audioTitle;
  final String creatorUsername;
  final String? audioCoverUrl;
  final VoidCallback? onUseAudio;

  const SoundHubScreen({
    super.key,
    required this.audioTitle,
    required this.creatorUsername,
    this.audioCoverUrl,
    this.onUseAudio,
  });

  @override
  State<SoundHubScreen> createState() => _SoundHubScreenState();
}

class _SoundHubScreenState extends State<SoundHubScreen> {
  bool _isPlayingSample = false;
  bool _isSavedAudio = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        title: const Text('Sound Details', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: Icon(_isSavedAudio ? Icons.bookmark : Icons.bookmark_border, color: Colors.white),
            tooltip: 'Save Sound to Audio Library',
            onPressed: () {
              setState(() => _isSavedAudio = !_isSavedAudio);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(_isSavedAudio ? 'Sound saved to your audio library!' : 'Sound removed from saved audio.'),
                ),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.share, color: Colors.white),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Audio link copied to clipboard!')),
              );
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            // Sound Artwork & Vinyl Record effect
            Center(
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Container(
                    width: 140,
                    height: 140,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.black,
                      border: Border.all(color: AppColors.glassBorder, width: 6),
                    ),
                  ),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(60),
                    child: SizedBox(
                      width: 110,
                      height: 110,
                      child: widget.audioCoverUrl != null
                          ? OptimizedNetworkImage(
                              imageUrl: widget.audioCoverUrl!,
                              fit: BoxFit.cover,
                            )
                          : Container(
                              color: AppColors.primary,
                              child: const Icon(Icons.music_note, color: Colors.white, size: 48),
                            ),
                    ),
                  ),
                  GestureDetector(
                    onTap: () {
                      setState(() => _isPlayingSample = !_isPlayingSample);
                    },
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.7),
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                      ),
                      child: Icon(
                        _isPlayingSample ? Icons.pause : Icons.play_arrow,
                        color: Colors.white,
                        size: 28,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Titles
            Text(
              widget.audioTitle,
              style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 6),
            Text(
              'Original Audio by @${widget.creatorUsername}',
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
            ),
            const SizedBox(height: 6),
            const Text(
              '🔥 14.2K Reels created with this sound',
              style: TextStyle(color: AppColors.accentGold, fontSize: 13, fontWeight: FontWeight.w600),
            ),

            const SizedBox(height: 24),
            // "Use Audio" Primary Action (Instagram's famous CTA)
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                ),
                icon: const Icon(Icons.video_call, color: Colors.white),
                label: const Text(
                  'Use this Audio in Reel',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                ),
                onPressed: () {
                  Navigator.pop(context);
                  widget.onUseAudio?.call();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Audio "${widget.audioTitle}" attached to camera! Recording ready.'),
                    ),
                  );
                },
              ),
            ),

            const SizedBox(height: 28),
            // Grid of reels using this sound
            const Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Top Reels with this Audio',
                style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(height: 12),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                crossAxisSpacing: 6,
                mainAxisSpacing: 6,
                childAspectRatio: 0.65,
              ),
              itemCount: 6,
              itemBuilder: (ctx, i) {
                final demoImages = [
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
                  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400',
                  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400',
                  'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400',
                  'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400',
                  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
                ];
                return Stack(
                  children: [
                    Positioned.fill(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: OptimizedNetworkImage(
                          imageUrl: demoImages[i % demoImages.length],
                          fit: BoxFit.cover,
                        ),
                      ),
                    ),
                    Positioned(
                      bottom: 6,
                      left: 6,
                      child: Row(
                        children: [
                          const Icon(Icons.play_arrow, color: Colors.white, size: 12),
                          const SizedBox(width: 2),
                          Text(
                            '${(i + 1) * 3}.4K',
                            style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
