import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/core/theme/app_colors.dart';
import '../../domain/models/learn_models.dart';
import '../learn_notifier.dart';
import 'skill_path_detail_screen.dart';
import 'lesson_player_screen.dart';

class LearnHubScreen extends StatefulWidget {
  final LearnNotifier notifier;

  const LearnHubScreen({super.key, required this.notifier});

  @override
  State<LearnHubScreen> createState() => _LearnHubScreenState();
}

class _LearnHubScreenState extends State<LearnHubScreen> {
  @override
  void initState() {
    super.initState();
    widget.notifier.loadInitialData();
  }

  void _showReminderSettingsModal() {
    final reminder = widget.notifier.reminderSettings;
    bool enabled = reminder?.enabled ?? false;
    String selectedTime = reminder?.reminderTime ?? '19:00';
    String selectedChannel = reminder?.channel ?? 'IN_APP';

    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 36,
                        height: 4,
                        decoration: BoxDecoration(
                          color: AppColors.glassBorder,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const Row(
                      children: [
                        Icon(Icons.alarm_on, color: AppColors.accentCyan),
                        SizedBox(width: 8),
                        Text(
                          'Study Schedule & Reminders',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Build a habit with personalized learning notifications. You control the timing and frequency.',
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                    ),
                    const SizedBox(height: 16),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Daily Study Reminders',
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                      subtitle: const Text('Notify when it is time to practice',
                          style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
                      value: enabled,
                      activeColor: AppColors.primary,
                      onChanged: (val) {
                        setModalState(() => enabled = val);
                      },
                    ),
                    if (enabled) ...[
                      const Divider(color: AppColors.glassBorder),
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.schedule, color: AppColors.primary),
                        title: const Text('Reminder Time', style: TextStyle(color: Colors.white)),
                        trailing: DropdownButton<String>(
                          value: selectedTime,
                          dropdownColor: AppColors.surfaceElevated,
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                          items: ['08:00', '12:30', '18:00', '19:00', '20:30', '21:00']
                              .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                              .toList(),
                          onChanged: (val) {
                            if (val != null) setModalState(() => selectedTime = val);
                          },
                        ),
                      ),
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.notifications_active_outlined, color: AppColors.accentPink),
                        title: const Text('Notification Channel', style: TextStyle(color: Colors.white)),
                        trailing: DropdownButton<String>(
                          value: selectedChannel,
                          dropdownColor: AppColors.surfaceElevated,
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                          items: const [
                            DropdownMenuItem(value: 'IN_APP', child: Text('In-App Only')),
                            DropdownMenuItem(value: 'PUSH', child: Text('Push Notification')),
                          ],
                          onChanged: (val) {
                            if (val != null) setModalState(() => selectedChannel = val);
                          },
                        ),
                      ),
                    ],
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceElevated,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.glassBorder),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.lock_outline, color: AppColors.success, size: 18),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Zero-Location Guarantee: Reminders are scheduled purely by your device clock without tracking location.',
                              style: TextStyle(color: AppColors.textSecondary, fontSize: 11),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: () {
                          widget.notifier.updateReminders(
                            enabled: enabled,
                            reminderTime: selectedTime,
                            daysOfWeek: [1, 2, 3, 4, 5],
                            channel: selectedChannel,
                            targetSkillPathId: widget.notifier.resumePath?.id,
                          );
                          Navigator.pop(ctx);
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Study reminder preferences saved.'),
                              backgroundColor: AppColors.surfaceElevated,
                            ),
                          );
                        },
                        child: const Text('Save Preferences', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.notifier,
      builder: (context, _) {
        final notifier = widget.notifier;

        return Scaffold(
          backgroundColor: AppColors.background,
          appBar: AppBar(
            backgroundColor: AppColors.surface,
            elevation: 0,
            title: const Row(
              children: [
                Icon(Icons.school, color: AppColors.primary, size: 24),
                SizedBox(width: 10),
                Text(
                  'Learn Mode',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 18,
                  ),
                ),
              ],
            ),
            actions: [
              IconButton(
                icon: Icon(
                  notifier.reminderSettings?.enabled == true
                      ? Icons.alarm_on
                      : Icons.alarm_add_outlined,
                  color: notifier.reminderSettings?.enabled == true
                      ? AppColors.accentCyan
                      : Colors.white,
                ),
                tooltip: 'Study Schedule & Reminders',
                onPressed: _showReminderSettingsModal,
              ),
            ],
          ),
          body: notifier.isLoading
              ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
              : RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: () => notifier.loadInitialData(),
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // 1. Resume Progress Card
                        if (notifier.resumePath != null) _buildResumeCard(notifier),

                        const SizedBox(height: 20),

                        // 2. Filter Pills: Levels (Beginner, Intermediate, Advanced)
                        _buildLevelFilters(notifier),

                        const SizedBox(height: 12),

                        // 3. Filter Tabs: Verified Credentials vs Creator Playlists
                        _buildCredentialTypeFilters(notifier),

                        const SizedBox(height: 20),

                        // 4. Skill Paths List
                        Text(
                          notifier.credentialFilter == 'VERIFIED'
                              ? 'Verified Institutional Credentials (${notifier.filteredPaths.length})'
                              : notifier.credentialFilter == 'CREATOR'
                                  ? 'Creator Playlists & Masterclasses (${notifier.filteredPaths.length})'
                                  : 'All Skill Paths (${notifier.filteredPaths.length})',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 12),

                        if (notifier.filteredPaths.isEmpty)
                          const Center(
                            child: Padding(
                              padding: EdgeInsets.symmetric(vertical: 40),
                              child: Text(
                                'No skill paths match your selected filters.',
                                style: TextStyle(color: AppColors.textSecondary),
                              ),
                            ),
                          )
                        else
                          ...notifier.filteredPaths.map((path) => _buildPathCard(path)),
                      ],
                    ),
                  ),
                ),
        );
      },
    );
  }

  Widget _buildResumeCard(LearnNotifier notifier) {
    final path = notifier.resumePath!;
    final lesson = notifier.resumeLesson;
    final progress = notifier.resumeProgress;
    final percent = progress?.percentComplete ?? 0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.primary.withOpacity(0.2),
            AppColors.secondary.withOpacity(0.1),
            AppColors.surfaceElevated,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.3),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.play_circle_fill, color: AppColors.accentCyan, size: 14),
                    SizedBox(width: 4),
                    Text(
                      'RESUME LEARNING',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                '$percent% Completed',
                style: const TextStyle(
                  color: AppColors.accentCyan,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            path.title,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          if (lesson != null) ...[
            const SizedBox(height: 4),
            Text(
              'Current: ${lesson.title}',
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: percent / 100,
              backgroundColor: AppColors.glassBorder,
              valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
              minHeight: 6,
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              icon: const Icon(Icons.arrow_forward, color: Colors.white, size: 18),
              label: const Text('Continue Lesson', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              onPressed: () {
                if (lesson != null) {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => LessonPlayerScreen(
                        path: path,
                        lesson: lesson,
                        notifier: notifier,
                      ),
                    ),
                  );
                } else {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => SkillPathDetailScreen(
                        pathId: path.id,
                        notifier: notifier,
                      ),
                    ),
                  );
                }
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLevelFilters(LearnNotifier notifier) {
    const levels = ['ALL', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: levels.map((lvl) {
          final isSelected = notifier.selectedLevel == lvl;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: FilterChip(
              label: Text(
                lvl == 'ALL' ? 'All Levels' : lvl[0] + lvl.substring(1).toLowerCase(),
                style: TextStyle(
                  color: isSelected ? Colors.white : AppColors.textSecondary,
                  fontSize: 12,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                ),
              ),
              selected: isSelected,
              backgroundColor: AppColors.surface,
              selectedColor: AppColors.primary,
              checkmarkColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
                side: BorderSide(
                  color: isSelected ? AppColors.primary : AppColors.glassBorder,
                ),
              ),
              onSelected: (_) => notifier.setLevelFilter(lvl),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildCredentialTypeFilters(LearnNotifier notifier) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.glassBorder),
      ),
      padding: const EdgeInsets.all(4),
      child: Row(
        children: [
          Expanded(
            child: _buildFilterTab(
              title: 'All Paths',
              icon: Icons.grid_view,
              isSelected: notifier.credentialFilter == 'ALL',
              onTap: () => notifier.setCredentialFilter('ALL'),
            ),
          ),
          Expanded(
            child: _buildFilterTab(
              title: 'Verified',
              icon: Icons.verified,
              color: AppColors.accentGold,
              isSelected: notifier.credentialFilter == 'VERIFIED',
              onTap: () => notifier.setCredentialFilter('VERIFIED'),
            ),
          ),
          Expanded(
            child: _buildFilterTab(
              title: 'Creator Tips',
              icon: Icons.auto_awesome,
              color: AppColors.accentPink,
              isSelected: notifier.credentialFilter == 'CREATOR',
              onTap: () => notifier.setCredentialFilter('CREATOR'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterTab({
    required String title,
    required IconData icon,
    Color? color,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.surfaceElevated : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 14, color: isSelected ? (color ?? Colors.white) : AppColors.textMuted),
            const SizedBox(width: 4),
            Text(
              title,
              style: TextStyle(
                color: isSelected ? Colors.white : AppColors.textMuted,
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPathCard(SkillPathModel path) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: path.isVerifiedCredential
              ? AppColors.accentGold.withOpacity(0.3)
              : AppColors.glassBorder,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => SkillPathDetailScreen(
                pathId: path.id,
                notifier: widget.notifier,
              ),
            ),
          );
        },
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Badge distinguishing Verified Credential vs Informal Creator Tip
              Row(
                children: [
                  if (path.isVerifiedCredential)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.accentGold.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: AppColors.accentGold.withOpacity(0.4)),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.verified, color: AppColors.accentGold, size: 13),
                          SizedBox(width: 4),
                          Text(
                            'VERIFIED CREDENTIAL',
                            style: TextStyle(
                              color: AppColors.accentGold,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.accentPink.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: AppColors.accentPink.withOpacity(0.4)),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.palette_outlined, color: AppColors.accentPink, size: 13),
                          SizedBox(width: 4),
                          Text(
                            'CREATOR PLAYLIST',
                            style: TextStyle(
                              color: AppColors.accentPink,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceElevated,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      path.level,
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                path.title,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                path.description,
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 12),
              // Organization / Creator Attribution
              Row(
                children: [
                  CircleAvatar(
                    radius: 10,
                    backgroundColor: AppColors.surfaceElevated,
                    backgroundImage: appAvatarProvider(path.creatorAvatarUrl),
                    child: path.creatorAvatarUrl == null
                        ? const Icon(Icons.person, size: 12, color: Colors.white)
                        : null,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      path.isVerifiedCredential && path.issuingOrganization != null
                          ? path.issuingOrganization!
                          : path.creatorName,
                      style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const Icon(Icons.star, color: AppColors.accentGold, size: 14),
                  const SizedBox(width: 2),
                  Text(
                    path.rating.toStringAsFixed(1),
                    style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              const Divider(color: AppColors.glassBorder, height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.play_lesson_outlined, color: AppColors.textSecondary, size: 15),
                      const SizedBox(width: 4),
                      Text('${path.lessonCount} Lessons', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                      const SizedBox(width: 12),
                      const Icon(Icons.schedule, color: AppColors.textSecondary, size: 15),
                      const SizedBox(width: 4),
                      Text('${path.estimatedDurationMinutes} mins', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                    ],
                  ),
                  const Icon(Icons.chevron_right, color: AppColors.textMuted),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
