import 'package:flutter/material.dart';
import 'package:mobile/core/theme/app_colors.dart';

/// Instagram-style Interactive Story Poll Sticker with live percentage animation.
class InteractiveStoryPollWidget extends StatefulWidget {
  final String question;
  final String optionA;
  final String optionB;
  final int initialVotesA;
  final int initialVotesB;

  const InteractiveStoryPollWidget({
    super.key,
    this.question = 'Ready for Google Play Store launch? 🚀',
    this.optionA = 'YES! Launch 🔥',
    this.optionB = 'Looks Amazing! ✨',
    this.initialVotesA = 78,
    this.initialVotesB = 22,
  });

  @override
  State<InteractiveStoryPollWidget> createState() => _InteractiveStoryPollWidgetState();
}

class _InteractiveStoryPollWidgetState extends State<InteractiveStoryPollWidget> {
  int? _votedOption; // 0 for A, 1 for B
  late int _votesA;
  late int _votesB;

  @override
  void initState() {
    super.initState();
    _votesA = widget.initialVotesA;
    _votesB = widget.initialVotesB;
  }

  void _vote(int option) {
    if (_votedOption != null) return;
    setState(() {
      _votedOption = option;
      if (option == 0) {
        _votesA++;
      } else {
        _votesB++;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final total = _votesA + _votesB;
    final percentA = total > 0 ? ((_votesA / total) * 100).round() : 50;
    final percentB = total > 0 ? 100 - percentA : 50;

    return Center(
      child: Container(
        width: 260,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.35),
              blurRadius: 16,
              spreadRadius: 2,
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              widget.question,
              style: const TextStyle(
                color: Colors.black87,
                fontSize: 14,
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _buildPollOption(
                    label: widget.optionA,
                    percent: percentA,
                    isVoted: _votedOption == 0,
                    onTap: () => _vote(0),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _buildPollOption(
                    label: widget.optionB,
                    percent: percentB,
                    isVoted: _votedOption == 1,
                    onTap: () => _vote(1),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPollOption({
    required String label,
    required int percent,
    required bool isVoted,
    required VoidCallback onTap,
  }) {
    final hasVoted = _votedOption != null;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 44,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: Colors.grey.shade100,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isVoted ? AppColors.accentPink : Colors.grey.shade300,
            width: isVoted ? 2 : 1,
          ),
        ),
        child: Stack(
          alignment: Alignment.center,
          children: [
            if (hasVoted)
              Positioned.fill(
                child: FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: percent / 100.0,
                  child: Container(
                    color: isVoted
                        ? AppColors.accentPink.withOpacity(0.35)
                        : Colors.grey.shade300,
                  ),
                ),
              ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Flexible(
                    child: Text(
                      label,
                      style: TextStyle(
                        color: Colors.black87,
                        fontSize: 11,
                        fontWeight: isVoted ? FontWeight.bold : FontWeight.w600,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (hasVoted)
                    Text(
                      '$percent%',
                      style: const TextStyle(
                        color: Colors.black87,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
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
