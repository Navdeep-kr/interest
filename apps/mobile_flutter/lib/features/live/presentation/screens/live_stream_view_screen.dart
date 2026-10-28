import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/core/theme/app_colors.dart';
import '../../domain/models/live_models.dart';
import '../live_notifier.dart';

class LiveStreamViewScreen extends StatefulWidget {
  final LiveNotifier notifier;
  final LiveEventItemModel event;

  const LiveStreamViewScreen({
    super.key,
    required this.notifier,
    required this.event,
  });

  @override
  State<LiveStreamViewScreen> createState() => _LiveStreamViewScreenState();
}

class _LiveStreamViewScreenState extends State<LiveStreamViewScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _questionInputController = TextEditingController();
  bool _isQaOpen = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _questionInputController.dispose();
    super.dispose();
  }

  void _showReportDialog() {
    String selectedCategory = 'HARASSMENT';
    final reasonController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: AppColors.surface,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: const Row(
                children: [
                  Icon(Icons.shield_outlined, color: AppColors.accentRed, size: 20),
                  SizedBox(width: 8),
                  Text('Report Live Stream', style: TextStyle(color: AppColors.textPrimary, fontSize: 16)),
                ],
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Select violation category. Severe safety threats trigger automated moderation kill switch.',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: selectedCategory,
                    dropdownColor: AppColors.surfaceElevated,
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: AppColors.surfaceElevated,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: AppColors.glassBorder),
                      ),
                    ),
                    items: const [
                      DropdownMenuItem(value: 'HARASSMENT', child: Text('Harassment or Hate Speech')),
                      DropdownMenuItem(value: 'SPAM', child: Text('Spam or Commercial Misrepresentation')),
                      DropdownMenuItem(value: 'CRITICAL_SAFETY', child: Text('Critical Safety / Threat (Kill Switch)')),
                      DropdownMenuItem(value: 'COPYRIGHT', child: Text('Copyright Infringement')),
                    ],
                    onChanged: (val) {
                      if (val != null) setDialogState(() => selectedCategory = val);
                    },
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: reasonController,
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'Additional details (optional)...',
                      hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                      filled: true,
                      fillColor: AppColors.surfaceElevated,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: AppColors.glassBorder),
                      ),
                    ),
                    maxLines: 2,
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.accentRed,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  onPressed: () {
                    Navigator.of(context).pop();
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          selectedCategory == 'CRITICAL_SAFETY'
                              ? 'Critical safety report dispatched. Moderation emergency kill switch evaluated.'
                              : 'Report submitted. Our moderation team is reviewing this broadcast.',
                        ),
                        backgroundColor: AppColors.surfaceElevated,
                      ),
                    );
                  },
                  child: const Text('Submit Report', style: TextStyle(color: Colors.white)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _submitQuestion() {
    final text = _questionInputController.text.trim();
    if (text.isEmpty) return;
    widget.notifier.submitQuestion(widget.event.id, text);
    _questionInputController.clear();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Question submitted to moderator queue for approval.'),
        backgroundColor: AppColors.surfaceElevated,
        duration: Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.notifier,
      builder: (context, _) {
        final state = widget.notifier.state;
        final currentEvent = state.selectedEvent ?? widget.event;

        return Scaffold(
          backgroundColor: Colors.black,
          body: Stack(
            children: [
              // 1. Simulated Video Canvas / Stream
              Positioned.fill(
                child: _buildVideoCanvas(currentEvent),
              ),

              // 2. Stream Health HUD Badge (Top Left under Notch)
              Positioned(
                top: 50,
                left: 16,
                child: _buildHealthHud(currentEvent.health),
              ),

              // 3. Top Action Controls (Exit & Safety)
              Positioned(
                top: 46,
                right: 16,
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.shield_outlined, color: Colors.white70, size: 22),
                      tooltip: 'Report',
                      onPressed: _showReportDialog,
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: Colors.white, size: 26),
                      tooltip: 'Close Stream',
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),

              // 4. Host Profile & Live Info Overlay
              Positioned(
                top: 96,
                left: 16,
                right: 80,
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 18,
                      backgroundColor: AppColors.surfaceElevated,
                      backgroundImage: appAvatarProvider(currentEvent.hostAvatarUrl),
                      child: currentEvent.hostAvatarUrl == null
                          ? const Icon(Icons.person, size: 20, color: Colors.white70)
                          : null,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '@${currentEvent.hostUsername}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              shadows: [Shadow(color: Colors.black87, blurRadius: 4)],
                            ),
                          ),
                          Text(
                            currentEvent.title,
                            style: const TextStyle(
                              color: Colors.white70,
                              fontSize: 12,
                              shadows: [Shadow(color: Colors.black87, blurRadius: 4)],
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              // 5. Floating Reactions Canvas
              Positioned.fill(
                child: IgnorePointer(
                  child: Stack(
                    children: state.floatingReactions.map((r) {
                      return Positioned(
                        bottom: 120 + ((DateTime.now().difference(r.createdAt).inMilliseconds % 400).toDouble()),
                        left: MediaQuery.of(context).size.width * r.xOffset,
                        child: AnimatedOpacity(
                          duration: const Duration(milliseconds: 600),
                          opacity: 0.9,
                          child: Text(
                            _reactionEmoji(r.type),
                            style: const TextStyle(fontSize: 28),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ),

              // 6. Moderated Q&A Panel Drawer (Bottom Sheet or Overlay)
              if (_isQaOpen)
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 80,
                  height: 340,
                  child: _buildQaPanel(state.questions, currentEvent.id),
                ),

              // 7. Bottom Interaction Tray
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: _buildBottomTray(currentEvent.id),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildVideoCanvas(LiveEventItemModel event) {
    final bool hasCoHost = event.coHost != null && event.coHost?.status == 'ACCEPTED';

    if (hasCoHost) {
      // Split Screen Layout
      return Column(
        children: [
          Expanded(
            child: Container(
              color: const Color(0xFF111827),
              child: Stack(
                children: [
                  Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.person, size: 54, color: AppColors.accentCyan),
                        const SizedBox(height: 8),
                        Text(
                          'Host: @${event.hostUsername}',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                  Positioned(
                    top: 12,
                    left: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.black54,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text('HOST', style: TextStyle(color: Colors.white70, fontSize: 10)),
                    ),
                  ),
                ],
              ),
            ),
          ),
          Container(height: 2, color: AppColors.glassBorder),
          Expanded(
            child: Container(
              color: const Color(0xFF1E1B4B),
              child: Stack(
                children: [
                  Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.group, size: 54, color: AppColors.accentPink),
                        const SizedBox(height: 8),
                        Text(
                          'Co-Host: @${event.coHost?.username}',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                  Positioned(
                    top: 12,
                    left: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.black54,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text('CO-HOST (SPLIT-SCREEN)', style: TextStyle(color: Colors.white70, fontSize: 10)),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      );
    }

    // Single Broadcaster View Simulation
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF0F172A), Color(0xFF020617)],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      child: Stack(
        children: [
          Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 90,
                  height: 90,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.accentRed, width: 2),
                    color: AppColors.surfaceElevated,
                  ),
                  child: const Center(
                    child: Icon(Icons.videocam, size: 40, color: AppColors.accentRed),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  event.title,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'WebRTC Low-Latency Live Feed Active',
                  style: TextStyle(color: Colors.white54, fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHealthHud(StreamHealthModel health) {
    Color statusColor = AppColors.success;
    if (health.status == 'DEGRADED') statusColor = AppColors.warning;
    if (health.status == 'CRITICAL') statusColor = AppColors.accentRed;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.65),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: statusColor.withOpacity(0.6), width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(color: statusColor, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            '${health.fps} FPS · ${health.bitrateKbps} kbps · ${health.status}',
            style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }

  Widget _buildQaPanel(List<LiveQuestionModel> questions, String eventId) {
    final pinnedQuestion = questions.where((q) => q.isPinned).toList();
    final regularQuestions = questions.where((q) => !q.isPinned).toList();

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: AppColors.surface.withOpacity(0.95),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.glassBorder),
        boxShadow: const [BoxShadow(color: Colors.black54, blurRadius: 20)],
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                const Icon(Icons.help_outline, color: AppColors.accentCyan, size: 18),
                const SizedBox(width: 6),
                const Text(
                  'Moderated Q&A',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close, size: 18, color: Colors.white70),
                  onPressed: () => setState(() => _isQaOpen = false),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.glassBorder),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              children: [
                if (pinnedQuestion.isNotEmpty) ...[
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.primary.withOpacity(0.4)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.push_pin, size: 13, color: AppColors.accentCyan),
                            SizedBox(width: 4),
                            Text(
                              'PINNED BY HOST',
                              style: TextStyle(
                                color: AppColors.accentCyan,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          pinnedQuestion.first.question,
                          style: const TextStyle(color: Colors.white, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
                ...regularQuestions.map((q) => _buildQuestionItem(q, eventId)),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(8),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _questionInputController,
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'Ask host a question...',
                      hintStyle: const TextStyle(color: Colors.white54, fontSize: 12),
                      filled: true,
                      fillColor: AppColors.surfaceElevated,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(20),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.send, color: AppColors.primary, size: 20),
                  onPressed: _submitQuestion,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuestionItem(LiveQuestionModel q, String eventId) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.surfaceElevated,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '@${q.username}',
                  style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 2),
                Text(q.question, style: const TextStyle(color: Colors.white, fontSize: 12)),
              ],
            ),
          ),
          InkWell(
            onTap: () => widget.notifier.upvoteQuestion(eventId, q.id),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
              child: Row(
                children: [
                  Icon(
                    q.hasUpvoted ? Icons.thumb_up : Icons.thumb_up_alt_outlined,
                    size: 14,
                    color: q.hasUpvoted ? AppColors.accentCyan : Colors.white60,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '${q.upvotesCount}',
                    style: TextStyle(
                      color: q.hasUpvoted ? AppColors.accentCyan : Colors.white60,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomTray(String eventId) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.transparent, Colors.black.withOpacity(0.85)],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      child: Row(
        children: [
          // Q&A Toggle Pill Button
          ElevatedButton.icon(
            onPressed: () => setState(() => _isQaOpen = !_isQaOpen),
            icon: Icon(
              _isQaOpen ? Icons.chat_bubble : Icons.help_outline,
              size: 16,
              color: Colors.white,
            ),
            label: Text(_isQaOpen ? 'Chat' : 'Q&A'),
            style: ElevatedButton.styleFrom(
              backgroundColor: _isQaOpen ? AppColors.primary : AppColors.surfaceElevated,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            ),
          ),
          const Spacer(),
          // Reaction Buttons
          _buildReactionBtn('HEART', '❤️', eventId),
          const SizedBox(width: 8),
          _buildReactionBtn('FIRE', '🔥', eventId),
          const SizedBox(width: 8),
          _buildReactionBtn('CLAP', '👏', eventId),
          const SizedBox(width: 8),
          _buildReactionBtn('ROCKET', '🚀', eventId),
        ],
      ),
    );
  }

  Widget _buildReactionBtn(String type, String emoji, String eventId) {
    return InkWell(
      onTap: () => widget.notifier.sendReaction(eventId, type),
      borderRadius: BorderRadius.circular(20),
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: AppColors.surfaceElevated.withOpacity(0.8),
          shape: BoxShape.circle,
        ),
        child: Center(
          child: Text(emoji, style: const TextStyle(fontSize: 18)),
        ),
      ),
    );
  }

  String _reactionEmoji(String type) {
    switch (type) {
      case 'HEART':
        return '❤️';
      case 'FIRE':
        return '🔥';
      case 'CLAP':
        return '👏';
      case 'ROCKET':
        return '🚀';
      case 'STAR':
        return '⭐';
      default:
        return '❤️';
    }
  }
}
