import 'package:flutter/material.dart';
import 'package:mobile/core/theme/app_colors.dart';

class SoundTrack {
  final String id;
  final String title;
  final String artist;
  final String duration;
  final String category;
  final String? coverUrl;

  const SoundTrack({
    required this.id,
    required this.title,
    required this.artist,
    required this.duration,
    required this.category,
    this.coverUrl,
  });

  static const List<SoundTrack> trendingSounds = [
    SoundTrack(
      id: 'sound_1',
      title: 'Cyberpunk Neon Drive',
      artist: 'SynthWave Labs',
      duration: '0:30',
      category: 'Electronic',
      coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=100',
    ),
    SoundTrack(
      id: 'sound_2',
      title: 'Golden Sunset Chill',
      artist: 'Lo-Fi Lounge',
      duration: '0:45',
      category: 'Lo-Fi',
      coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=100',
    ),
    SoundTrack(
      id: 'sound_3',
      title: '90s Vinyl Nostalgia',
      artist: 'Retro Beats',
      duration: '0:28',
      category: 'Vintage',
      coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100',
    ),
    SoundTrack(
      id: 'sound_4',
      title: 'Deep House Euphoria',
      artist: 'Club Resonance',
      duration: '0:35',
      category: 'Dance',
      coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100',
    ),
    SoundTrack(
      id: 'sound_5',
      title: 'Acoustic Morning Breeze',
      artist: 'Elena Strings',
      duration: '0:40',
      category: 'Acoustic',
      coverUrl: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=100',
    ),
  ];
}

class SoundPickerBottomSheet extends StatefulWidget {
  final Function(SoundTrack) onSoundSelected;

  const SoundPickerBottomSheet({super.key, required this.onSoundSelected});

  static Future<SoundTrack?> show(BuildContext context) {
    return showModalBottomSheet<SoundTrack>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => SoundPickerBottomSheet(
        onSoundSelected: (track) => Navigator.of(ctx).pop(track),
      ),
    );
  }

  @override
  State<SoundPickerBottomSheet> createState() => _SoundPickerBottomSheetState();
}

class _SoundPickerBottomSheetState extends State<SoundPickerBottomSheet> {
  String? _playingId;
  String _searchQuery = '';

  @override
  Widget build(BuildContext context) {
    final filtered = SoundTrack.trendingSounds.where((s) {
      return s.title.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          s.artist.toLowerCase().contains(_searchQuery.toLowerCase());
    }).toList();

    return Container(
      height: MediaQuery.of(context).size.height * 0.7,
      decoration: BoxDecoration(
        color: AppColors.backgroundSecondary,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        border: Border.all(color: Colors.white12),
      ),
      child: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 12),
            Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 14),
            const Text(
              'Sounds & Music',
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 14),

            // Search Bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: TextField(
                style: const TextStyle(color: Colors.white, fontSize: 14),
                decoration: InputDecoration(
                  hintText: 'Search songs, artists, genres...',
                  hintStyle: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                  prefixIcon: const Icon(Icons.search, color: AppColors.textSecondary, size: 20),
                  filled: true,
                  fillColor: AppColors.surface,
                  contentPadding: const EdgeInsets.symmetric(vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                ),
                onChanged: (val) => setState(() => _searchQuery = val),
              ),
            ),
            const SizedBox(height: 12),

            Expanded(
              child: ListView.builder(
                itemCount: filtered.length,
                itemBuilder: (ctx, i) {
                  final track = filtered[i];
                  final isPlaying = _playingId == track.id;

                  return ListTile(
                    leading: Stack(
                      alignment: Alignment.center,
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Container(
                            width: 48,
                            height: 48,
                            color: AppColors.surface,
                            child: const Icon(Icons.music_note, color: AppColors.primary),
                          ),
                        ),
                        IconButton(
                          icon: Icon(
                            isPlaying ? Icons.pause_circle_filled : Icons.play_circle_filled,
                            color: Colors.white,
                            size: 30,
                          ),
                          onPressed: () {
                            setState(() {
                              _playingId = isPlaying ? null : track.id;
                            });
                          },
                        ),
                      ],
                    ),
                    title: Text(
                      track.title,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                    subtitle: Text(
                      '${track.artist} • ${track.duration}',
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                    ),
                    trailing: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: () => widget.onSoundSelected(track),
                      child: const Text('Use', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
