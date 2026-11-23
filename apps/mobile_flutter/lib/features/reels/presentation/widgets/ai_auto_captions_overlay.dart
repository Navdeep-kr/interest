import 'dart:async';
import 'package:flutter/material.dart';

class AiAutoCaptionsOverlay extends StatefulWidget {
  final String caption;
  final bool isVisible;

  const AiAutoCaptionsOverlay({
    super.key,
    required this.caption,
    this.isVisible = true,
  });

  @override
  State<AiAutoCaptionsOverlay> createState() => _AiAutoCaptionsOverlayState();
}

class _AiAutoCaptionsOverlayState extends State<AiAutoCaptionsOverlay> {
  late List<String> _words;
  int _activeWordIndex = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _initWords();
    _startAnimation();
  }

  void _initWords() {
    final clean = widget.caption.replaceAll(RegExp(r'#\w+'), '').trim();
    if (clean.isEmpty) {
      _words = ['Create.', 'Engage.', 'Monetize.', 'Interest.'];
    } else {
      _words = clean.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
    }
  }

  void _startAnimation() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(milliseconds: 380), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      setState(() {
        _activeWordIndex = (_activeWordIndex + 1) % _words.length;
      });
    });
  }

  @override
  void didUpdateWidget(AiAutoCaptionsOverlay oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.caption != widget.caption) {
      _initWords();
      _activeWordIndex = 0;
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.isVisible || _words.isEmpty) return const SizedBox.shrink();

    // Show a sliding 3-word window centered around the active word
    final start = (_activeWordIndex - 1).clamp(0, _words.length - 1);
    final end = (_activeWordIndex + 2).clamp(0, _words.length);
    final currentWindow = _words.sublist(start, end);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.65),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.amber.withOpacity(0.5), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.4),
            blurRadius: 8,
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: currentWindow.map((word) {
          final isCurrent = word == _words[_activeWordIndex];
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4.0),
            child: AnimatedDefaultTextStyle(
              duration: const Duration(milliseconds: 150),
              style: TextStyle(
                color: isCurrent ? const Color(0xFFFACC15) : Colors.white,
                fontSize: isCurrent ? 17 : 14,
                fontWeight: isCurrent ? FontWeight.w900 : FontWeight.bold,
                shadows: [
                  Shadow(
                    color: isCurrent ? Colors.amber : Colors.black,
                    blurRadius: isCurrent ? 8 : 2,
                  ),
                ],
              ),
              child: Text(word.toUpperCase()),
            ),
          );
        }).toList(),
      ),
    );
  }
}
