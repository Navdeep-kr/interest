import 'package:flutter/material.dart';
import '../performance/data_saver_manager.dart';

/// Non-intrusive floating status indicator for Data Saver Mode & Offline Playback.
class OfflineBannerPill extends StatelessWidget {
  const OfflineBannerPill({super.key});

  @override
  Widget build(BuildContext context) {
    final manager = DataSaverManager();

    return AnimatedBuilder(
      animation: manager,
      builder: (ctx, _) {
        if (!manager.isDataSaverEnabled && !manager.isOffline) {
          return const SizedBox.shrink();
        }

        final isOffline = manager.isOffline;
        final icon = isOffline ? Icons.airplanemode_active : Icons.data_saver_on;
        final text = isOffline
            ? 'Offline Mode • Playing Cached Media'
            : 'Data Saver Active • 70% Less Cellular Data';
        final color = isOffline ? Colors.amberAccent : Colors.cyanAccent;

        return Positioned(
          top: MediaQuery.of(context).padding.top + 6,
          left: 60,
          right: 60,
          child: Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.75),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: color.withOpacity(0.5), width: 1.0),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.4),
                    blurRadius: 8,
                  ),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(icon, color: color, size: 13),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      text,
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.9),
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
