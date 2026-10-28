import 'dart:async';
import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import '../../domain/models/story_highlight_model.dart';

/// Full-screen viewer for Story Highlights with segmented progress and hold-to-pause.
class HighlightViewerScreen extends StatefulWidget {
  final StoryHighlightModel highlight;

  const HighlightViewerScreen({
    super.key,
    required this.highlight,
  });

  @override
  State<HighlightViewerScreen> createState() => _HighlightViewerScreenState();
}

class _HighlightViewerScreenState extends State<HighlightViewerScreen> {
  int _currentIndex = 0;
  double _progress = 0.0;
  Timer? _timer;
  bool _isPaused = false;

  final List<String> _demoMedia = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=720',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=720',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=720',
  ];

  @override
  void initState() {
    super.initState();
    _startProgress();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startProgress() {
    _timer?.cancel();
    _progress = 0.0;
    _timer = Timer.periodic(const Duration(milliseconds: 50), (t) {
      if (!_isPaused) {
        setState(() {
          _progress += 0.01;
          if (_progress >= 1.0) {
            _nextStory();
          }
        });
      }
    });
  }

  void _nextStory() {
    if (_currentIndex < _demoMedia.length - 1) {
      setState(() {
        _currentIndex++;
        _progress = 0.0;
      });
    } else {
      _timer?.cancel();
      Navigator.pop(context);
    }
  }

  void _previousStory() {
    if (_currentIndex > 0) {
      setState(() {
        _currentIndex--;
        _progress = 0.0;
      });
    } else {
      setState(() {
        _progress = 0.0;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final mediaUrl = _demoMedia[_currentIndex % _demoMedia.length];

    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        onLongPressStart: (_) => setState(() => _isPaused = true),
        onLongPressEnd: (_) => setState(() => _isPaused = false),
        onTapUp: (details) {
          final width = MediaQuery.of(context).size.width;
          if (details.globalPosition.dx < width * 0.3) {
            _previousStory();
          } else {
            _nextStory();
          }
        },
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Media background
            OptimizedNetworkImage(
              imageUrl: mediaUrl,
              fit: BoxFit.cover,
            ),

            // Top gradient overlay
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              height: 120,
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black.withOpacity(0.7),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),

            // Segmented Progress Bar
            Positioned(
              top: MediaQuery.of(context).padding.top + 8,
              left: 12,
              right: 12,
              child: Row(
                children: List.generate(_demoMedia.length, (idx) {
                  double segmentProgress = 0.0;
                  if (idx < _currentIndex) {
                    segmentProgress = 1.0;
                  } else if (idx == _currentIndex) {
                    segmentProgress = _progress;
                  }
                  return Expanded(
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 2),
                      height: 3,
                      decoration: BoxDecoration(
                        color: Colors.white24,
                        borderRadius: BorderRadius.circular(2),
                      ),
                      child: FractionallySizedBox(
                        alignment: Alignment.centerLeft,
                        widthFactor: segmentProgress,
                        child: Container(
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                    ),
                  );
                }),
              ),
            ),

            // Header: Highlight Title & Close
            Positioned(
              top: MediaQuery.of(context).padding.top + 20,
              left: 16,
              right: 16,
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 16,
                    backgroundImage: NetworkImage(widget.highlight.coverUrl.isNotEmpty ? widget.highlight.coverUrl : mediaUrl),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    widget.highlight.title,
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white),
                    onPressed: () => Navigator.pop(context),
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
