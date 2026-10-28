import 'package:flutter/material.dart';
import 'package:mobile/core/theme/app_colors.dart';
import '../screens/sound_hub_screen.dart';

/// Instagram-style Audio Attribution Pill with animated equalizer & sound hub navigation.
class AudioAttributionPill extends StatelessWidget {
  final String audioTitle;
  final String creatorUsername;
  final String? audioCoverUrl;
  final VoidCallback? onUseAudio;

  const AudioAttributionPill({
    super.key,
    required this.audioTitle,
    required this.creatorUsername,
    this.audioCoverUrl,
    this.onUseAudio,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => SoundHubScreen(
              audioTitle: audioTitle,
              creatorUsername: creatorUsername,
              audioCoverUrl: audioCoverUrl,
              onUseAudio: onUseAudio,
            ),
          ),
        );
      },
      child: Container(
        margin: const EdgeInsets.only(top: 6),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: Colors.black.withOpacity(0.55),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white24, width: 0.8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.music_note, color: Colors.white, size: 14),
            const SizedBox(width: 5),
            Flexible(
              child: Text(
                '$audioTitle • @$creatorUsername',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  shadows: [Shadow(color: Colors.black87, blurRadius: 2)],
                ),
              ),
            ),
            const SizedBox(width: 6),
            // Equalizer animated dots
            Row(
              children: [
                _buildEqualizerBar(6, 12),
                const SizedBox(width: 2),
                _buildEqualizerBar(12, 6),
                const SizedBox(width: 2),
                _buildEqualizerBar(8, 14),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEqualizerBar(double h1, double h2) {
    return Container(
      width: 2.5,
      height: 10,
      decoration: BoxDecoration(
        color: AppColors.accentPink,
        borderRadius: BorderRadius.circular(2),
      ),
    );
  }
}
