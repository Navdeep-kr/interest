import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/core/theme/app_colors.dart';
import '../../domain/models/learn_models.dart';
import '../learn_notifier.dart';
import 'lesson_player_screen.dart';

class SkillPathDetailScreen extends StatefulWidget {
  final String pathId;
  final LearnNotifier notifier;

  const SkillPathDetailScreen({
    super.key,
    required this.pathId,
    required this.notifier,
  });

  @override
  State<SkillPathDetailScreen> createState() => _SkillPathDetailScreenState();
}

class _SkillPathDetailScreenState extends State<SkillPathDetailScreen> {
  SkillPathModel? _path;
  UserPathProgressModel? _progress;
  bool _prerequisitesMet = true;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadDetails();
  }

  Future<void> _loadDetails() async {
    setState(() => _isLoading = true);
    final details = widget.notifier.paths.firstWhere(
      (p) => p.id == widget.pathId,
      orElse: () => widget.notifier.paths.first,
    );

    // Check if progress is tracked in notifier
    final progress = widget.notifier.resumePath?.id == widget.pathId
        ? widget.notifier.resumeProgress
        : null;

    setState(() {
      _path = details;
      _progress = progress;
      _prerequisitesMet = details.prerequisitePathIds.isEmpty;
      _isLoading = false;
    });
  }

  void _showDifficultyFeedbackSheet() {
    String selectedVote = 'JUST_RIGHT';
    int rating = 5;
    final commentController = TextEditingController();

    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return SafeArea(
              child: Padding(
                padding: EdgeInsets.only(
                  left: 20,
                  right: 20,
                  top: 20,
                  bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
                ),
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
                    const SizedBox(height: 16),
                    const Text(
                      'Difficulty Feedback',
                      style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Help us calibrate the pace and prerequisites of this skill path.',
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        _buildVoteOption('TOO_EASY', 'Too Easy', Icons.sentiment_satisfied, selectedVote, (v) {
                          setSheetState(() => selectedVote = v);
                        }),
                        const SizedBox(width: 8),
                        _buildVoteOption('JUST_RIGHT', 'Just Right', Icons.sentiment_very_satisfied, selectedVote, (v) {
                          setSheetState(() => selectedVote = v);
                        }),
                        const SizedBox(width: 8),
                        _buildVoteOption('TOO_HARD', 'Too Hard', Icons.sentiment_dissatisfied, selectedVote, (v) {
                          setSheetState(() => selectedVote = v);
                        }),
                      ],
                    ),
                    const SizedBox(height: 16),
                    const Text('Overall Rating', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(5, (index) {
                        final star = index + 1;
                        return IconButton(
                          icon: Icon(
                            star <= rating ? Icons.star : Icons.star_border,
                            color: AppColors.accentGold,
                            size: 32,
                          ),
                          onPressed: () => setSheetState(() => rating = star),
                        );
                      }),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: commentController,
                      style: const TextStyle(color: Colors.white),
                      decoration: InputDecoration(
                        hintText: 'Optional suggestions or feedback...',
                        hintStyle: const TextStyle(color: AppColors.textMuted),
                        filled: true,
                        fillColor: AppColors.surfaceElevated,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(color: AppColors.glassBorder),
                        ),
                      ),
                      maxLines: 2,
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: () async {
                          final messenger = ScaffoldMessenger.of(context);
                          Navigator.pop(ctx);
                          final ok = await widget.notifier.submitDifficultyFeedback(
                            pathId: widget.pathId,
                            feedback: selectedVote,
                            ratingScore: rating,
                            comments: commentController.text,
                          );
                          if (mounted && ok) {
                            messenger.showSnackBar(
                              const SnackBar(
                                content: Text('Thank you! Your feedback helps optimize the curriculum.'),
                                backgroundColor: AppColors.surfaceElevated,
                              ),
                            );
                          }
                        },
                        child: const Text('Submit Rating', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
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

  Widget _buildVoteOption(
    String value,
    String label,
    IconData icon,
    String currentValue,
    ValueChanged<String> onSelect,
  ) {
    final isSelected = value == currentValue;
    return Expanded(
      child: InkWell(
        onTap: () => onSelect(value),
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.primary.withOpacity(0.2) : AppColors.surfaceElevated,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: isSelected ? AppColors.primary : AppColors.glassBorder),
          ),
          child: Column(
            children: [
              Icon(icon, color: isSelected ? AppColors.primary : AppColors.textSecondary, size: 22),
              const SizedBox(height: 4),
              Text(
                label,
                style: TextStyle(
                  color: isSelected ? Colors.white : AppColors.textSecondary,
                  fontSize: 11,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading || _path == null) {
      return const Scaffold(
        backgroundColor: AppColors.background,
        body: Center(child: CircularProgressIndicator(color: AppColors.primary)),
      );
    }

    final path = _path!;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          path.title,
          style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.rate_review_outlined, color: AppColors.accentCyan),
            tooltip: 'Difficulty Feedback',
            onPressed: _showDifficultyFeedbackSheet,
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. Distinction Header
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: path.isVerifiedCredential
                      ? AppColors.accentGold.withOpacity(0.4)
                      : AppColors.glassBorder,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      if (path.isVerifiedCredential)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.accentGold.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: AppColors.accentGold.withOpacity(0.5)),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.verified, color: AppColors.accentGold, size: 14),
                              SizedBox(width: 4),
                              Text(
                                'OFFICIAL ACCREDITATION',
                                style: TextStyle(
                                  color: AppColors.accentGold,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        )
                      else
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.accentPink.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: AppColors.accentPink.withOpacity(0.5)),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.palette_outlined, color: AppColors.accentPink, size: 14),
                              SizedBox(width: 4),
                              Text(
                                'CREATOR PLAYLIST',
                                style: TextStyle(
                                  color: AppColors.accentPink,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceElevated,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          path.level,
                          style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    path.title,
                    style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    path.description,
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 14, height: 1.4),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 12,
                        backgroundColor: AppColors.surfaceElevated,
                        backgroundImage: appAvatarProvider(path.creatorAvatarUrl),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        path.isVerifiedCredential && path.issuingOrganization != null
                            ? path.issuingOrganization!
                            : path.creatorName,
                        style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // 2. Prerequisite Banner
            if (path.prerequisitePathIds.isNotEmpty) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _prerequisitesMet
                      ? AppColors.success.withOpacity(0.1)
                      : AppColors.warning.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: _prerequisitesMet
                        ? AppColors.success.withOpacity(0.3)
                        : AppColors.warning.withOpacity(0.3),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      _prerequisitesMet ? Icons.check_circle_outline : Icons.lock_clock,
                      color: _prerequisitesMet ? AppColors.success : AppColors.warning,
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _prerequisitesMet
                            ? 'Prerequisites met: Ready to study.'
                            : 'Prerequisite Required: Complete prerequisite courses first.',
                        style: TextStyle(
                          color: _prerequisitesMet ? AppColors.success : AppColors.warning,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],

            // 3. Syllabus
            const Text(
              'Course Syllabus',
              style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),

            ...path.lessons.map((lesson) {
              final isCompleted = _progress?.completedLessonIds.contains(lesson.id) ?? false;
              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: isCompleted
                        ? AppColors.success.withOpacity(0.3)
                        : AppColors.glassBorder,
                  ),
                ),
                child: ListTile(
                  leading: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: isCompleted
                          ? AppColors.success.withOpacity(0.2)
                          : AppColors.surfaceElevated,
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: isCompleted
                          ? const Icon(Icons.check, color: AppColors.success, size: 20)
                          : Text(
                              '${lesson.orderIndex}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                    ),
                  ),
                  title: Text(
                    lesson.title,
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                  subtitle: Text(
                    '${lesson.contentType} • ${(lesson.durationSeconds / 60).round()} mins',
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                  ),
                  trailing: const Icon(Icons.play_circle_outline, color: AppColors.primary),
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => LessonPlayerScreen(
                          path: path,
                          lesson: lesson,
                          notifier: widget.notifier,
                        ),
                      ),
                    ).then((_) => _loadDetails());
                  },
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}
