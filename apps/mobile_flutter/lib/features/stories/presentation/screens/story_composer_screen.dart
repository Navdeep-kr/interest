import 'package:flutter/material.dart';
import 'package:mobile/features/stories/data/stories_repository.dart';
import 'package:mobile/features/stories/domain/models/story_models.dart';

class StoryComposerScreen extends StatefulWidget {
  final StoriesRepository repository;
  final String? authToken;
  final ValueChanged<StoryModel>? onStoryCreated;

  const StoryComposerScreen({
    super.key,
    required this.repository,
    this.authToken,
    this.onStoryCreated,
  });

  @override
  State<StoryComposerScreen> createState() => _StoryComposerScreenState();
}

class _StoryComposerScreenState extends State<StoryComposerScreen> {
  final TextEditingController _mediaUrlController = TextEditingController(
    text: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800',
  );
  final TextEditingController _captionController = TextEditingController();
  final TextEditingController _overlayTextController = TextEditingController();

  StoryMediaType _mediaType = StoryMediaType.photo;
  StoryAudience _audience = StoryAudience.public;
  StoryReplySetting _allowReplies = StoryReplySetting.all;
  double _durationSeconds = 5.0;
  bool _isPublishing = false;
  String? _errorMessage;

  final List<StoryOverlayModel> _overlays = [];

  @override
  void dispose() {
    _mediaUrlController.dispose();
    _captionController.dispose();
    _overlayTextController.dispose();
    super.dispose();
  }

  void _addOverlay() {
    final text = _overlayTextController.text.trim();
    if (text.isEmpty) return;

    setState(() {
      _overlays.add(StoryOverlayModel(
        id: 'overlay_${DateTime.now().millisecondsSinceEpoch}',
        text: text,
        fontSize: 22.0,
        xPercent: 50.0,
        yPercent: 40.0 + (_overlays.length * 10.0),
        startTimeSeconds: 0.0,
        endTimeSeconds: _durationSeconds,
      ));
      _overlayTextController.clear();
    });
  }

  Future<void> _publishStory() async {
    final mediaUrl = _mediaUrlController.text.trim();
    if (mediaUrl.isEmpty) {
      setState(() => _errorMessage = 'Media URL is required');
      return;
    }

    setState(() {
      _isPublishing = true;
      _errorMessage = null;
    });

    try {
      final request = CreateStoryRequest(
        mediaType: _mediaType,
        mediaUrl: mediaUrl,
        durationSeconds: _durationSeconds,
        caption: _captionController.text.trim().isEmpty ? null : _captionController.text.trim(),
        textOverlays: _overlays.isEmpty ? null : _overlays,
        audience: _audience,
        allowReplies: _allowReplies,
      );

      final story = await widget.repository.createStory(request, token: widget.authToken);

      if (mounted) {
        widget.onStoryCreated?.call(story);
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Story published! Active for 24 hours.')),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isPublishing = false;
          _errorMessage = 'Failed to publish story: $e';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        title: const Text('New Story', style: TextStyle(color: Colors.white)),
        actions: [
          TextButton(
            onPressed: _isPublishing ? null : _publishStory,
            child: _isPublishing
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.blueAccent),
                  )
                : const Text('Share', style: TextStyle(color: Colors.blueAccent, fontWeight: FontWeight.bold, fontSize: 16)),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_errorMessage != null)
              Container(
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: Colors.red.shade900.withOpacity(0.5),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(_errorMessage!, style: const TextStyle(color: Colors.white)),
              ),

            // Screenshot Transparency Info Card
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.grey.shade900,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.white12),
              ),
              child: const Row(
                children: [
                  Icon(Icons.info_outline, color: Colors.orangeAccent, size: 20),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Stories expire automatically in 24 hours. However, recipients can take screenshots or screen recordings.',
                      style: TextStyle(color: Colors.white70, fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Media Type Selection
            const Text('Media Type', style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Row(
              children: [
                ChoiceChip(
                  label: const Text('Photo'),
                  selected: _mediaType == StoryMediaType.photo,
                  onSelected: (selected) {
                    if (selected) setState(() => _mediaType = StoryMediaType.photo);
                  },
                ),
                const SizedBox(width: 8),
                ChoiceChip(
                  label: const Text('Video'),
                  selected: _mediaType == StoryMediaType.video,
                  onSelected: (selected) {
                    if (selected) {
                      setState(() {
                        _mediaType = StoryMediaType.video;
                        _durationSeconds = 15.0;
                      });
                    }
                  },
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Media URL Field
            TextField(
              controller: _mediaUrlController,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(
                labelText: 'Media URL',
                labelStyle: TextStyle(color: Colors.white54),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),

            // Caption Field
            TextField(
              controller: _captionController,
              style: const TextStyle(color: Colors.white),
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Caption (optional)',
                labelStyle: TextStyle(color: Colors.white54),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),

            // Text Overlays
            const Text('Text Overlays', style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _overlayTextController,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(
                      hintText: 'Add text overlay...',
                      hintStyle: TextStyle(color: Colors.white38),
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: _addOverlay,
                  child: const Text('Add'),
                ),
              ],
            ),
            if (_overlays.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: _overlays.map((o) {
                  return Chip(
                    label: Text(o.text),
                    onDeleted: () {
                      setState(() => _overlays.remove(o));
                    },
                  );
                }).toList(),
              ),
            ],
            const SizedBox(height: 20),

            // Audience Selection
            const Text('Audience Selection', style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            DropdownButtonFormField<StoryAudience>(
              value: _audience,
              dropdownColor: Colors.grey.shade900,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(border: OutlineInputBorder()),
              items: const [
                DropdownMenuItem(
                  value: StoryAudience.public,
                  child: Text('Public (Everyone)'),
                ),
                DropdownMenuItem(
                  value: StoryAudience.followersOnly,
                  child: Text('Followers Only'),
                ),
                DropdownMenuItem(
                  value: StoryAudience.closeFriends,
                  child: Text('Close Friends Only (Green ring)'),
                ),
              ],
              onChanged: (val) {
                if (val != null) setState(() => _audience = val);
              },
            ),
            const SizedBox(height: 16),

            // Reply Settings
            const Text('Allow Replies', style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            DropdownButtonFormField<StoryReplySetting>(
              value: _allowReplies,
              dropdownColor: Colors.grey.shade900,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(border: OutlineInputBorder()),
              items: const [
                DropdownMenuItem(
                  value: StoryReplySetting.all,
                  child: Text('Everyone'),
                ),
                DropdownMenuItem(
                  value: StoryReplySetting.followers,
                  child: Text('Followers Only'),
                ),
                DropdownMenuItem(
                  value: StoryReplySetting.off,
                  child: Text('Off (No replies)'),
                ),
              ],
              onChanged: (val) {
                if (val != null) setState(() => _allowReplies = val);
              },
            ),
          ],
        ),
      ),
    );
  }
}
