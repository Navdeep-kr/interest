import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/core/theme/app_colors.dart';
import '../../domain/models/live_models.dart';
import '../live_notifier.dart';
import 'live_stream_view_screen.dart';
import 'schedule_live_screen.dart';

class LiveEventsHubScreen extends StatefulWidget {
  final LiveNotifier notifier;

  const LiveEventsHubScreen({super.key, required this.notifier});

  @override
  State<LiveEventsHubScreen> createState() => _LiveEventsHubScreenState();
}

class _LiveEventsHubScreenState extends State<LiveEventsHubScreen> {
  @override
  void initState() {
    super.initState();
    widget.notifier.loadEvents();
  }

  void _openStream(LiveEventItemModel event) {
    widget.notifier.selectEvent(event.id);
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => LiveStreamViewScreen(
          notifier: widget.notifier,
          event: event,
        ),
      ),
    );
  }

  void _openSchedule() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ScheduleLiveScreen(notifier: widget.notifier),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.notifier,
      builder: (context, _) {
        final state = widget.notifier.state;

        return Scaffold(
          backgroundColor: AppColors.background,
          appBar: AppBar(
            backgroundColor: AppColors.background,
            elevation: 0,
            title: const Row(
              children: [
                Icon(Icons.sensors, color: AppColors.accentRed, size: 24),
                SizedBox(width: 8),
                Text(
                  'Live & Events',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.add_circle_outline, color: AppColors.accentCyan),
                tooltip: 'Schedule Live',
                onPressed: _openSchedule,
              ),
              IconButton(
                icon: const Icon(Icons.refresh, color: AppColors.textSecondary),
                tooltip: 'Refresh',
                onPressed: () => widget.notifier.loadEvents(),
              ),
            ],
          ),
          body: state.isLoading && state.liveNowEvents.isEmpty && state.scheduledEvents.isEmpty
              ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
              : RefreshIndicator(
                  color: AppColors.primary,
                  backgroundColor: AppColors.surface,
                  onRefresh: () => widget.notifier.loadEvents(),
                  child: ListView(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    children: [
                      // 1. Live Now Section
                      if (state.liveNowEvents.isNotEmpty) ...[
                        Row(
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: const BoxDecoration(
                                color: AppColors.accentRed,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 8),
                            const Text(
                              'LIVE NOW',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1.2,
                                color: AppColors.accentRed,
                              ),
                            ),
                            const Spacer(),
                            Text(
                              '${state.liveNowEvents.length} Active',
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        ...state.liveNowEvents.map((event) => _buildLiveNowCard(event)),
                        const SizedBox(height: 24),
                      ],

                      // 2. Upcoming Scheduled Events Section
                      Row(
                        children: [
                          const Icon(Icons.calendar_month, color: AppColors.accentCyan, size: 18),
                          const SizedBox(width: 8),
                          const Text(
                            'UPCOMING SCHEDULED',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.2,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const Spacer(),
                          Text(
                            '${state.scheduledEvents.length} Events',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      if (state.scheduledEvents.isEmpty)
                        _buildEmptyState()
                      else
                        ...state.scheduledEvents.map((event) => _buildScheduledCard(event)),
                      const SizedBox(height: 40),
                    ],
                  ),
                ),
        );
      },
    );
  }

  Widget _buildLiveNowCard(LiveEventItemModel event) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.accentRed.withOpacity(0.3), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: AppColors.accentRed.withOpacity(0.08),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => _openStream(event),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Cover with LIVE badge & viewer count
              Stack(
                children: [
                  ClipRRect(
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                    child: Container(
                      height: 160,
                      width: double.infinity,
                      color: AppColors.surfaceElevated,
                      child: event.coverImageUrl != null
                          ? OptimizedNetworkImage(
                              imageUrl: event.coverImageUrl!,
                              height: 160,
                              width: double.infinity,
                              fit: BoxFit.cover,
                              targetCacheWidth: 720,
                              targetCacheHeight: 360,
                              errorWidget: _buildPlaceholderGraphic(),
                            )
                          : _buildPlaceholderGraphic(),
                    ),
                  ),
                  Positioned(
                    top: 12,
                    left: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.accentRed,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.sensors, color: Colors.white, size: 14),
                          SizedBox(width: 4),
                          Text(
                            'LIVE',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.0,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  Positioned(
                    top: 12,
                    right: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.7),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.remove_red_eye, color: Colors.white70, size: 13),
                          const SizedBox(width: 4),
                          Text(
                            '${event.viewerCount}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 12,
                    left: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.surface.withOpacity(0.85),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        event.interestName,
                        style: const TextStyle(
                          color: AppColors.accentCyan,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      event.title,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      event.description,
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                        height: 1.3,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 14,
                          backgroundColor: AppColors.surfaceElevated,
                          backgroundImage: appAvatarProvider(event.hostAvatarUrl),
                          child: event.hostAvatarUrl == null
                              ? const Icon(Icons.person, size: 16, color: AppColors.textSecondary)
                              : null,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '@${event.hostUsername}',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const Spacer(),
                        ElevatedButton.icon(
                          onPressed: () => _openStream(event),
                          icon: const Icon(Icons.play_arrow, size: 16),
                          label: const Text('Watch'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.accentRed,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(20),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildScheduledCard(LiveEventItemModel event) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    event.interestName,
                    style: const TextStyle(
                      color: AppColors.primary,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                if (event.is18Plus) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.warning.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: AppColors.warning, width: 0.8),
                    ),
                    child: const Text(
                      '18+',
                      style: TextStyle(
                        color: AppColors.warning,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
                if (event.recordSession) ...[
                  const SizedBox(width: 8),
                  const Row(
                    children: [
                      Icon(Icons.album_outlined, size: 12, color: AppColors.textMuted),
                      SizedBox(width: 3),
                      Text(
                        '30d VOD',
                        style: TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 10,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ],
                const Spacer(),
                const Icon(Icons.schedule, size: 14, color: AppColors.textSecondary),
                const SizedBox(width: 4),
                Text(
                  _formatTime(event.scheduledStartTime),
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              event.title,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              event.description,
              style: const TextStyle(
                fontSize: 13,
                color: AppColors.textSecondary,
                height: 1.3,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                CircleAvatar(
                  radius: 12,
                  backgroundColor: AppColors.surfaceElevated,
                  backgroundImage: appAvatarProvider(event.hostAvatarUrl),
                  child: event.hostAvatarUrl == null
                      ? const Icon(Icons.person, size: 14, color: AppColors.textSecondary)
                      : null,
                ),
                const SizedBox(width: 8),
                Text(
                  '@${event.hostUsername}',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textSecondary,
                  ),
                ),
                const Spacer(),
                OutlinedButton.icon(
                  onPressed: () => widget.notifier.toggleReminder(event.id),
                  icon: Icon(
                    event.isReminderSet ? Icons.notifications_active : Icons.notifications_none,
                    size: 14,
                    color: event.isReminderSet ? AppColors.accentCyan : AppColors.textPrimary,
                  ),
                  label: Text(
                    event.isReminderSet ? 'Reminder Set' : 'Remind Me (${event.remindersCount})',
                    style: TextStyle(
                      fontSize: 12,
                      color: event.isReminderSet ? AppColors.accentCyan : AppColors.textPrimary,
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(
                      color: event.isReminderSet ? AppColors.accentCyan : AppColors.glassBorder,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlaceholderGraphic() {
    return Container(
      color: AppColors.surfaceElevated,
      child: const Center(
        child: Icon(Icons.videocam_outlined, size: 48, color: AppColors.textMuted),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: const Column(
        children: [
          Icon(Icons.event_busy, size: 40, color: AppColors.textMuted),
          SizedBox(height: 12),
          Text(
            'No upcoming events scheduled yet',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
          ),
          SizedBox(height: 4),
          Text(
            'Be the first to host an interactive masterclass!',
            style: TextStyle(
              fontSize: 12,
              color: AppColors.textMuted,
            ),
          ),
        ],
      ),
    );
  }

  String _formatTime(String isoString) {
    try {
      final date = DateTime.parse(isoString);
      return '${date.month}/${date.day} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return 'Upcoming';
    }
  }
}
