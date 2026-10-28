import 'package:flutter/material.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/creator/data/creator_api_client.dart';
import 'package:mobile/features/creator/data/creator_repository.dart';
import 'package:mobile/features/creator/domain/models/creator_models.dart';
import 'package:mobile/features/creator/presentation/creator_studio_notifier.dart';
import 'package:mobile/features/creator/presentation/creator_studio_state.dart';

class CreatorStudioScreen extends StatefulWidget {
  final CreatorStudioNotifier? notifier;
  final CreatorDraftModel? initialDraft;

  const CreatorStudioScreen({
    super.key,
    this.notifier,
    this.initialDraft,
  });

  @override
  State<CreatorStudioScreen> createState() => _CreatorStudioScreenState();
}

class _CreatorStudioScreenState extends State<CreatorStudioScreen> {
  late final CreatorStudioNotifier _notifier;
  late final bool _ownsNotifier;

  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _captionController = TextEditingController();
  final TextEditingController _textOverlayController = TextEditingController();
  final TextEditingController _subtitleController = TextEditingController();

  @override
  void initState() {
    super.initState();
    if (widget.notifier != null) {
      _notifier = widget.notifier!;
      _ownsNotifier = false;
    } else {
      _notifier = CreatorStudioNotifier(
        repository: CreatorRepository(
          apiClient: CreatorApiClient(),
          secureStorage: PlatformSecureStorageService(),
        ),
        initialDraft: widget.initialDraft,
      );
      _ownsNotifier = true;
    }

    _titleController.text = _notifier.state.title;
    _captionController.text = _notifier.state.caption;
  }

  @override
  void dispose() {
    _titleController.dispose();
    _captionController.dispose();
    _textOverlayController.dispose();
    _subtitleController.dispose();
    if (_ownsNotifier) {
      _notifier.dispose();
    }
    super.dispose();
  }

  void _onSaveDraft() async {
    _notifier.setTitleAndCaption(
      _titleController.text.trim(),
      _captionController.text.trim(),
      _notifier.state.hashtags,
    );
    final success = await _notifier.saveDraft();
    if (mounted && success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: AppColors.surfaceElevated,
          content: Row(
            children: [
              Icon(Icons.check_circle, color: AppColors.success, size: 20),
              SizedBox(width: 8),
              Text('Draft saved safely', style: TextStyle(color: Colors.white)),
            ],
          ),
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  void _onPublish() async {
    _notifier.setTitleAndCaption(
      _titleController.text.trim(),
      _captionController.text.trim(),
      _notifier.state.hashtags,
    );
    final ok = await _notifier.publish();
    if (mounted && ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.surfaceElevated,
          content: Text(
            _notifier.state.scheduledAt != null
                ? 'Reel scheduled successfully!'
                : 'Reel published successfully!',
            style: const TextStyle(color: Colors.white),
          ),
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _notifier,
      builder: (context, _) {
        final state = _notifier.state;

        return Scaffold(
          backgroundColor: Colors.black,
          appBar: AppBar(
            backgroundColor: AppColors.surface,
            elevation: 0,
            leading: IconButton(
              icon: const Icon(Icons.close, color: AppColors.textPrimary),
              onPressed: () => Navigator.maybePop(context),
            ),
            title: const Text(
              'Creator Studio',
              style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 18),
            ),
            actions: [
              // Save Draft Button
              TextButton.icon(
                onPressed: state.isPublishing ? null : _onSaveDraft,
                icon: const Icon(Icons.bookmark_outline, size: 18, color: AppColors.primary),
                label: const Text('Save Draft', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
              ),
              // Next / Publish Button
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                  ),
                  onPressed: state.isPublishing ? null : _onPublish,
                  child: Text(
                    state.scheduledAt != null ? 'Schedule' : 'Publish',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            ],
          ),
          body: Stack(
            children: [
              Column(
                children: [
                  // 1. Live Preview Canvas (Aspect Ratio Framing & Overlays)
                  Expanded(
                    child: _buildPreviewCanvas(state),
                  ),

                  // 2. Error Banner if present
                  if (state.errorMessage != null)
                    Container(
                      color: AppColors.error.withOpacity(0.9),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline, color: Colors.white, size: 20),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              state.errorMessage!,
                              style: const TextStyle(color: Colors.white, fontSize: 13),
                            ),
                          ),
                          if (state.isPublishing)
                            TextButton(
                              onPressed: () => _notifier.retryUpload(),
                              child: const Text('Retry', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                            ),
                        ],
                      ),
                    ),

                  // 3. Active Tool Panel
                  _buildToolPanel(state),

                  // 4. Bottom Toolbar Tabs
                  _buildToolbarTabs(state),
                ],
              ),

              // 5. Upload / Publish Progress Overlay
              if (state.isPublishing || state.isUploading)
                _buildPublishingProgressOverlay(state),
            ],
          ),
        );
      },
    );
  }

  Widget _buildPreviewCanvas(CreatorStudioState state) {
    return Center(
      child: AspectRatio(
        aspectRatio: state.aspectRatio.ratio,
        child: Container(
          decoration: BoxDecoration(
            color: const Color(0xFF1E1E2C),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.glassBorder),
          ),
          child: Stack(
            fit: StackFit.expand,
            children: [
              // Media Placeholder or Video Indicator
              Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      state.videoUri != null ? Icons.movie_outlined : Icons.add_photo_alternate_outlined,
                      size: 64,
                      color: AppColors.textMuted,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      state.videoUri != null
                          ? 'Video Loaded (${(state.trimEndMs - state.trimStartMs) ~/ 1000}s)'
                          : 'Tap to pick video from gallery or camera',
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                    ),
                    if (state.videoUri == null) ...[
                      const SizedBox(height: 12),
                      ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                        onPressed: () {
                          // Simulate picking gallery media for editor test & real use
                          _notifier.pickMedia(
                            uri: 'mock://media/video_reel_tokyo.mp4',
                            fileSizeBytes: 14 * 1024 * 1024,
                            durationMs: 15000,
                          );
                        },
                        icon: const Icon(Icons.file_upload_outlined, size: 18),
                        label: const Text('Select Media'),
                      ),
                    ],
                  ],
                ),
              ),

              // Selected Sound Badge
              if (state.selectedSound != null)
                Positioned(
                  top: 12,
                  left: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.7),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.music_note, color: AppColors.accentCyan, size: 16),
                        const SizedBox(width: 4),
                        Text(
                          '${state.selectedSound!.title} - ${state.selectedSound!.artist}',
                          style: const TextStyle(color: Colors.white, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ),

              // Text Overlays Rendering
              for (final overlay in state.textOverlays)
                Positioned(
                  top: overlay.yPercent * 3.0,
                  left: 20,
                  right: 20,
                  child: Text(
                    overlay.text,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: overlay.fontSize,
                      fontWeight: FontWeight.bold,
                      shadows: const [Shadow(blurRadius: 4, color: Colors.black)],
                    ),
                  ),
                ),

              // Subtitles Rendering
              if (state.subtitles.isNotEmpty)
                Positioned(
                  bottom: 24,
                  left: 16,
                  right: 16,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.7),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      state.subtitles.first.text,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: AppColors.accentGold,
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildToolbarTabs(CreatorStudioState state) {
    final tabs = [
      {'id': 'PREVIEW', 'icon': Icons.play_arrow_outlined, 'label': 'Preview'},
      {'id': 'TRIM', 'icon': Icons.content_cut_outlined, 'label': 'Trim'},
      {'id': 'RATIO', 'icon': Icons.aspect_ratio_outlined, 'label': 'Crop'},
      {'id': 'TEXT', 'icon': Icons.title_outlined, 'label': 'Text'},
      {'id': 'SUBTITLES', 'icon': Icons.subtitles_outlined, 'label': 'Subtitles'},
      {'id': 'SOUNDS', 'icon': Icons.library_music_outlined, 'label': 'Sounds'},
      {'id': 'AUDIO_MIX', 'icon': Icons.volume_up_outlined, 'label': 'Audio'},
      {'id': 'SETTINGS', 'icon': Icons.tune_outlined, 'label': 'Settings'},
    ];

    return Container(
      color: AppColors.surface,
      height: 60,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: tabs.length,
        itemBuilder: (context, index) {
          final tab = tabs[index];
          final isSelected = state.activeToolTab == tab['id'];

          return InkWell(
            onTap: () => _notifier.switchTab(tab['id'] as String),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              color: isSelected ? AppColors.surfaceElevated : Colors.transparent,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    tab['icon'] as IconData,
                    color: isSelected ? AppColors.primary : AppColors.textSecondary,
                    size: 20,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    tab['label'] as String,
                    style: TextStyle(
                      color: isSelected ? AppColors.primary : AppColors.textMuted,
                      fontSize: 10,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildToolPanel(CreatorStudioState state) {
    switch (state.activeToolTab) {
      case 'TRIM':
        return _buildTrimPanel(state);
      case 'RATIO':
        return _buildAspectRatioPanel(state);
      case 'TEXT':
        return _buildTextOverlayPanel(state);
      case 'SUBTITLES':
        return _buildSubtitlesPanel(state);
      case 'SOUNDS':
        return _buildSoundsPanel(state);
      case 'AUDIO_MIX':
        return _buildAudioMixPanel(state);
      case 'SETTINGS':
        return _buildSettingsPanel(state);
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildTrimPanel(CreatorStudioState state) {
    return Container(
      color: AppColors.surfaceElevated,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Trim Clip', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
              Text(
                '${(state.trimStartMs / 1000).toStringAsFixed(1)}s - ${(state.trimEndMs / 1000).toStringAsFixed(1)}s',
                style: const TextStyle(color: AppColors.accentCyan, fontSize: 13),
              ),
            ],
          ),
          RangeSlider(
            values: RangeValues(
              state.trimStartMs.toDouble(),
              state.trimEndMs.toDouble().clamp(0.0, state.totalDurationMs.toDouble()),
            ),
            min: 0.0,
            max: state.totalDurationMs.toDouble(),
            activeColor: AppColors.primary,
            inactiveColor: AppColors.glassBorder,
            onChanged: (values) {
              _notifier.setTrim(values.start.toInt(), values.end.toInt());
            },
          ),
        ],
      ),
    );
  }

  Widget _buildAspectRatioPanel(CreatorStudioState state) {
    final ratios = [
      {'preset': AspectRatioPreset.vertical916, 'label': '9:16 (Reel)'},
      {'preset': AspectRatioPreset.square11, 'label': '1:1 (Square)'},
      {'preset': AspectRatioPreset.landscape169, 'label': '16:9 (Wide)'},
      {'preset': AspectRatioPreset.portrait45, 'label': '4:5 (Portrait)'},
    ];

    return Container(
      color: AppColors.surfaceElevated,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: ratios.map((r) {
            final preset = r['preset'] as AspectRatioPreset;
            final isSelected = state.aspectRatio == preset;

            return Padding(
              padding: const EdgeInsets.only(right: 8.0),
              child: ChoiceChip(
                label: Text(r['label'] as String),
                selected: isSelected,
                selectedColor: AppColors.primary,
                onSelected: (_) => _notifier.setAspectRatio(preset),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildTextOverlayPanel(CreatorStudioState state) {
    return Container(
      color: AppColors.surfaceElevated,
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _textOverlayController,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(
                    hintText: 'Enter text overlay...',
                    hintStyle: TextStyle(color: AppColors.textMuted),
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                onPressed: () {
                  final text = _textOverlayController.text.trim();
                  if (text.isNotEmpty) {
                    _notifier.addTextOverlay(
                      TextOverlayModel(
                        id: 'txt_${DateTime.now().millisecondsSinceEpoch}',
                        text: text,
                      ),
                    );
                    _textOverlayController.clear();
                  }
                },
                child: const Text('Add Text'),
              ),
            ],
          ),
          if (state.textOverlays.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: state.textOverlays.map((t) {
                return Chip(
                  label: Text(t.text, style: const TextStyle(color: Colors.white, fontSize: 12)),
                  backgroundColor: AppColors.surface,
                  onDeleted: () => _notifier.removeTextOverlay(t.id),
                );
              }).toList(),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSubtitlesPanel(CreatorStudioState state) {
    return Container(
      color: AppColors.surfaceElevated,
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _subtitleController,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(
                    hintText: 'Add subtitle cue...',
                    hintStyle: TextStyle(color: AppColors.textMuted),
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                onPressed: () {
                  final text = _subtitleController.text.trim();
                  if (text.isNotEmpty) {
                    _notifier.addSubtitle(
                      SubtitleCueModel(
                        id: 'sub_${DateTime.now().millisecondsSinceEpoch}',
                        startTimeMs: 0,
                        endTimeMs: 4000,
                        text: text,
                      ),
                    );
                    _subtitleController.clear();
                  }
                },
                child: const Text('Add Subtitle'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(foregroundColor: AppColors.accentGold),
            onPressed: () => _notifier.generateAutoSubtitles(),
            icon: const Icon(Icons.auto_awesome, size: 16),
            label: const Text('Auto-Generate Subtitles'),
          ),
        ],
      ),
    );
  }

  Widget _buildSoundsPanel(CreatorStudioState state) {
    return Container(
      color: AppColors.surfaceElevated,
      height: 180,
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Licensed Sounds Library', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
          const SizedBox(height: 8),
          Expanded(
            child: state.soundsLibrary.isEmpty
                ? const Center(child: Text('No sounds available', style: TextStyle(color: AppColors.textMuted)))
                : ListView.builder(
                    itemCount: state.soundsLibrary.length,
                    itemBuilder: (context, index) {
                      final sound = state.soundsLibrary[index];
                      final isSelected = state.selectedSound?.id == sound.id;

                      return ListTile(
                        dense: true,
                        leading: const Icon(Icons.music_note, color: AppColors.accentCyan),
                        title: Text(sound.title, style: const TextStyle(color: Colors.white, fontSize: 13)),
                        subtitle: Text('${sound.artist} • ${sound.genre ?? 'Original'}', style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
                        trailing: isSelected
                            ? IconButton(
                                icon: const Icon(Icons.check_circle, color: AppColors.success),
                                onPressed: () => _notifier.removeSound(),
                              )
                            : ElevatedButton(
                                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, padding: const EdgeInsets.symmetric(horizontal: 10)),
                                onPressed: () => _notifier.selectSound(sound),
                                child: const Text('Select', style: TextStyle(fontSize: 11)),
                              ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildAudioMixPanel(CreatorStudioState state) {
    return Container(
      color: AppColors.surfaceElevated,
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Row(
            children: [
              const Text('Original Audio', style: TextStyle(color: Colors.white, fontSize: 13)),
              Expanded(
                child: Slider(
                  value: state.audioControls.originalVolume,
                  min: 0.0,
                  max: 1.0,
                  activeColor: AppColors.primary,
                  onChanged: (v) {
                    _notifier.setAudioControls(state.audioControls.copyWith(originalVolume: v));
                  },
                ),
              ),
              Text('${(state.audioControls.originalVolume * 100).toInt()}%', style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
            ],
          ),
          Row(
            children: [
              const Text('Added Sound', style: TextStyle(color: Colors.white, fontSize: 13)),
              Expanded(
                child: Slider(
                  value: state.audioControls.soundVolume,
                  min: 0.0,
                  max: 1.0,
                  activeColor: AppColors.accentCyan,
                  onChanged: (v) {
                    _notifier.setAudioControls(state.audioControls.copyWith(soundVolume: v));
                  },
                ),
              ),
              Text('${(state.audioControls.soundVolume * 100).toInt()}%', style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSettingsPanel(CreatorStudioState state) {
    return Container(
      color: AppColors.surfaceElevated,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: _titleController,
            style: const TextStyle(color: Colors.white),
            decoration: const InputDecoration(
              labelText: 'Title',
              labelStyle: TextStyle(color: AppColors.textMuted),
              isDense: true,
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _captionController,
            style: const TextStyle(color: Colors.white),
            decoration: const InputDecoration(
              labelText: 'Caption & Hashtags',
              labelStyle: TextStyle(color: AppColors.textMuted),
              isDense: true,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Visibility', style: TextStyle(color: Colors.white, fontSize: 13)),
              DropdownButton<String>(
                value: state.audience.visibility,
                dropdownColor: AppColors.surface,
                style: const TextStyle(color: Colors.white),
                items: const [
                  DropdownMenuItem(value: 'PUBLIC', child: Text('Public')),
                  DropdownMenuItem(value: 'FOLLOWERS_ONLY', child: Text('Followers Only')),
                  DropdownMenuItem(value: 'PRIVATE', child: Text('Private')),
                ],
                onChanged: (val) {
                  if (val != null) {
                    _notifier.setAudienceControls(state.audience.copyWith(visibility: val));
                  }
                },
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                state.scheduledAt == null
                    ? 'Publish Immediately'
                    : 'Scheduled for ${state.scheduledAt!.toLocal().toString().substring(0, 16)}',
                style: const TextStyle(color: AppColors.accentCyan, fontSize: 13),
              ),
              TextButton(
                onPressed: () async {
                  if (state.scheduledAt != null) {
                    _notifier.setScheduledAt(null);
                  } else {
                    final date = await showDatePicker(
                      context: context,
                      initialDate: DateTime.now().add(const Duration(hours: 2)),
                      firstDate: DateTime.now(),
                      lastDate: DateTime.now().add(const Duration(days: 30)),
                    );
                    if (date != null) {
                      _notifier.setScheduledAt(date.add(const Duration(hours: 12)));
                    }
                  }
                },
                child: Text(state.scheduledAt == null ? 'Schedule Time' : 'Clear Schedule'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPublishingProgressOverlay(CreatorStudioState state) {
    return Container(
      color: Colors.black.withOpacity(0.85),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const CircularProgressIndicator(color: AppColors.primary),
              const SizedBox(height: 20),
              Text(
                state.scheduledAt != null
                    ? 'Scheduling Reel (${state.uploadProgressPercent.toInt()}%)...'
                    : 'Publishing Reel (${state.uploadProgressPercent.toInt()}%)...',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
              ),
              const SizedBox(height: 8),
              const Text(
                'Heavy media transcoding and audio mixing are safely processed on the backend.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
                onPressed: () => _notifier.cancelUpload(),
                child: const Text('Cancel Upload'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
