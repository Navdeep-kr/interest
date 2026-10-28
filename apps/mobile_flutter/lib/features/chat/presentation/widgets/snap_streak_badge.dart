import 'package:flutter/material.dart';
import '../../domain/models/snap_models.dart';

/// Snapchat-style Snap Streak Badge (🔥 14 / ⏳).
class SnapStreakBadge extends StatelessWidget {
  final SnapStreak streak;

  const SnapStreakBadge({
    super.key,
    required this.streak,
  });

  @override
  Widget build(BuildContext context) {
    if (streak.streakDays <= 0) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: streak.isAtRisk
            ? Colors.amber.withOpacity(0.2)
            : Colors.deepOrange.withOpacity(0.18),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: streak.isAtRisk ? Colors.amber : Colors.deepOrange,
          width: 0.9,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (streak.isAtRisk) ...[
            const Text('⏳', style: TextStyle(fontSize: 11)),
            const SizedBox(width: 2),
          ],
          const Text('🔥', style: TextStyle(fontSize: 12)),
          const SizedBox(width: 2),
          Text(
            '${streak.streakDays}',
            style: TextStyle(
              color: streak.isAtRisk ? Colors.amber : Colors.deepOrangeAccent,
              fontSize: 11,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}
