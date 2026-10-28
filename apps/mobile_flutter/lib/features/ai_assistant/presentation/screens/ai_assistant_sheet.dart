import 'package:flutter/material.dart';
import 'package:mobile/core/theme/app_colors.dart';
import '../../domain/models/ai_assistant_models.dart';
import '../ai_assistant_notifier.dart';

class AiAssistantSheet extends StatefulWidget {
  final AiAssistantNotifier notifier;

  const AiAssistantSheet({super.key, required this.notifier});

  static void show(BuildContext context, AiAssistantNotifier notifier) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.background,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => AiAssistantSheet(notifier: notifier),
    );
  }

  @override
  State<AiAssistantSheet> createState() => _AiAssistantSheetState();
}

class _AiAssistantSheetState extends State<AiAssistantSheet> {
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  final List<String> _starterPrompts = [
    'How do I master mobile design systems?',
    'Summarize high-throughput architectures',
    'Find cinematic video lighting tutorials',
    'Show accredited UI/UX certifications',
  ];

  @override
  void initState() {
    super.initState();
    widget.notifier.loadInitialStatus();
  }

  @override
  void dispose() {
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _submitQuery(String text) {
    if (text.trim().isEmpty) return;
    _textController.clear();
    widget.notifier.sendQuery(text);
    _scrollToBottom();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.notifier,
      builder: (context, _) {
        final notifier = widget.notifier;
        final status = notifier.status;
        final remaining = status?.queriesRemainingThisHour ?? 20;

        return Container(
          height: MediaQuery.of(context).size.height * 0.88,
          decoration: const BoxDecoration(
            color: AppColors.background,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              // 1. Sheet Grabber & Header
              Padding(
                padding: const EdgeInsets.only(top: 12, left: 16, right: 16, bottom: 8),
                child: Column(
                  children: [
                    Container(
                      width: 36,
                      height: 4,
                      decoration: BoxDecoration(
                        color: AppColors.glassBorder,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: const BoxDecoration(
                            gradient: AppColors.primaryGradient,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.auto_awesome, color: Colors.white, size: 18),
                        ),
                        const SizedBox(width: 10),
                        const Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'AI Interest Assistant',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                            Text(
                              'Grounded Discovery • Beta',
                              style: TextStyle(color: AppColors.textSecondary, fontSize: 11),
                            ),
                          ],
                        ),
                        const Spacer(),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceElevated,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.glassBorder),
                          ),
                          child: Text(
                            '$remaining left this hr',
                            style: const TextStyle(
                              color: AppColors.accentCyan,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        if (notifier.messages.isNotEmpty)
                          IconButton(
                            icon: const Icon(Icons.delete_sweep_outlined, color: AppColors.textMuted, size: 20),
                            tooltip: 'Clear Conversation',
                            onPressed: () => notifier.clearConversation(),
                          ),
                      ],
                    ),
                  ],
                ),
              ),

              const Divider(color: AppColors.glassBorder, height: 1),

              // 2. Chat Feed / Starters
              Expanded(
                child: notifier.messages.isEmpty
                    ? _buildStarterView()
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.all(16),
                        itemCount: notifier.messages.length + (notifier.isLoading ? 1 : 0),
                        itemBuilder: (ctx, idx) {
                          if (idx == notifier.messages.length) {
                            return _buildLoadingBubble();
                          }
                          return _buildMessageBubble(notifier.messages[idx]);
                        },
                      ),
              ),

              // 3. Bottom Prompt Input Bar
              Container(
                padding: EdgeInsets.only(
                  left: 16,
                  right: 16,
                  top: 10,
                  bottom: MediaQuery.of(context).viewInsets.bottom + 12,
                ),
                decoration: const BoxDecoration(
                  color: AppColors.surface,
                  border: Border(top: BorderSide(color: AppColors.glassBorder)),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _textController,
                            style: const TextStyle(color: Colors.white, fontSize: 14),
                            decoration: InputDecoration(
                              hintText: 'Ask about any skill, topic, or creator...',
                              hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                              filled: true,
                              fillColor: AppColors.surfaceElevated,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(20),
                                borderSide: BorderSide.none,
                              ),
                            ),
                            onSubmitted: _submitQuery,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          decoration: const BoxDecoration(
                            gradient: AppColors.primaryGradient,
                            shape: BoxShape.circle,
                          ),
                          child: IconButton(
                            icon: const Icon(Icons.arrow_upward, color: Colors.white, size: 20),
                            onPressed: () => _submitQuery(_textController.text),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Zero-Location Guarantee: Queries are sanitized of geographic metadata.',
                      style: TextStyle(color: AppColors.textMuted, fontSize: 10),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildStarterView() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  AppColors.primary.withOpacity(0.15),
                  AppColors.surfaceElevated,
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.primary.withOpacity(0.3)),
            ),
            child: const Row(
              children: [
                Icon(Icons.shield_outlined, color: AppColors.success, size: 28),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Server-Side Grounded AI',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'Answers are grounded exclusively in public platform content with source links. Private posts and location data are strictly protected.',
                        style: TextStyle(color: AppColors.textSecondary, fontSize: 11, height: 1.4),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'Suggested Inquiries',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
          ),
          const SizedBox(height: 10),
          ..._starterPrompts.map((prompt) => Container(
                margin: const EdgeInsets.only(bottom: 8),
                child: InkWell(
                  onTap: () => _submitQuery(prompt),
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.glassBorder),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.search, size: 16, color: AppColors.accentCyan),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            prompt,
                            style: const TextStyle(color: Colors.white, fontSize: 13),
                          ),
                        ),
                        const Icon(Icons.arrow_forward_ios, size: 12, color: AppColors.textMuted),
                      ],
                    ),
                  ),
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildLoadingBubble() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: const BoxDecoration(
              gradient: AppColors.primaryGradient,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.auto_awesome, color: Colors.white, size: 14),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.surfaceElevated,
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                ),
                SizedBox(width: 10),
                Text(
                  'Synthesizing verified interest paths...',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(AiAssistantMessageModel message) {
    final isUser = message.role == 'user';

    if (isUser) {
      return Align(
        alignment: Alignment.centerRight,
        child: Container(
          margin: const EdgeInsets.only(bottom: 12, left: 40),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            gradient: AppColors.primaryGradient,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Text(
            message.content,
            style: const TextStyle(color: Colors.white, fontSize: 14),
          ),
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(4),
                decoration: const BoxDecoration(
                  gradient: AppColors.primaryGradient,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.auto_awesome, color: Colors.white, size: 12),
              ),
              const SizedBox(width: 6),
              const Text(
                'Interest Assistant',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
              ),
              const Spacer(),
              if (message.isFallbackToSearch)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.warning.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    'Search Fallback',
                    style: TextStyle(color: AppColors.warning, fontSize: 9, fontWeight: FontWeight.bold),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.glassBorder),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  message.content,
                  style: const TextStyle(color: Colors.white, fontSize: 13, height: 1.45),
                ),

                // Grounded Source Cards
                if (message.groundedSources.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  const Text(
                    'Verified Sources & Citations:',
                    style: TextStyle(color: AppColors.accentCyan, fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 6),
                  ...message.groundedSources.map((source) => _buildSourceChip(source)),
                ],

                // Related Interests Pills
                if (message.relatedInterests.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: message.relatedInterests.map((interest) {
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceElevated,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.glassBorder),
                        ),
                        child: Text(
                          '#${interest.title}',
                          style: const TextStyle(color: AppColors.accentPink, fontSize: 11),
                        ),
                      );
                    }).toList(),
                  ),
                ],

                // Helpful feedback actions
                const Divider(color: AppColors.glassBorder, height: 20),
                Row(
                  children: [
                    const Text(
                      'Was this grounded and helpful?',
                      style: TextStyle(color: AppColors.textMuted, fontSize: 11),
                    ),
                    const Spacer(),
                    IconButton(
                      icon: Icon(
                        message.userHelpfulFeedback == true ? Icons.thumb_up : Icons.thumb_up_outlined,
                        size: 16,
                        color: message.userHelpfulFeedback == true ? AppColors.success : AppColors.textMuted,
                      ),
                      onPressed: () => widget.notifier.submitFeedback(message.id, true),
                    ),
                    IconButton(
                      icon: Icon(
                        message.userHelpfulFeedback == false ? Icons.thumb_down : Icons.thumb_down_outlined,
                        size: 16,
                        color: message.userHelpfulFeedback == false ? AppColors.error : AppColors.textMuted,
                      ),
                      onPressed: () => widget.notifier.submitFeedback(message.id, false, category: 'HALLUCINATION'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSourceChip(AiGroundedSourceModel source) {
    IconData icon;
    Color color;

    switch (source.type) {
      case 'LEARN_PATH':
        icon = Icons.school;
        color = AppColors.accentGold;
        break;
      case 'REEL':
        icon = Icons.movie;
        color = AppColors.primary;
        break;
      case 'COMMUNITY':
        icon = Icons.groups;
        color = AppColors.accentCyan;
        break;
      default:
        icon = Icons.link;
        color = AppColors.textSecondary;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.surfaceElevated,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  source.title,
                  style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  source.snippet,
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 10),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const Icon(Icons.open_in_new, size: 12, color: AppColors.textMuted),
        ],
      ),
    );
  }
}
