import 'package:flutter/material.dart';
import '../../domain/models/creator_bounty_model.dart';
import '../../domain/services/superfans_manager.dart';

/// Modal bottom sheet to sponsor a new paid video challenge or fulfill existing bounties.
/// Zero-Location guaranteed.
class CreatorBountySheet extends StatefulWidget {
  final String creatorId;
  final String creatorUsername;

  const CreatorBountySheet({
    super.key,
    required this.creatorId,
    required this.creatorUsername,
  });

  static Future<void> show(
    BuildContext context, {
    required String creatorId,
    required String creatorUsername,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF13111C),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) => CreatorBountySheet(
        creatorId: creatorId,
        creatorUsername: creatorUsername,
      ),
    );
  }

  @override
  State<CreatorBountySheet> createState() => _CreatorBountySheetState();
}

class _CreatorBountySheetState extends State<CreatorBountySheet> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _descController = TextEditingController();
  double _selectedReward = 50.0;
  final List<double> _presetRewards = [15.0, 25.0, 50.0, 100.0];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _titleController.dispose();
    _descController.dispose();
    super.dispose();
  }

  void _submitBounty() {
    final title = _titleController.text.trim();
    final desc = _descController.text.trim();
    if (title.isEmpty || desc.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill in challenge title and description')),
      );
      return;
    }

    SuperfansManager().createBounty(
      creatorId: widget.creatorId,
      creatorUsername: widget.creatorUsername,
      sponsorUsername: 'you',
      title: title,
      description: desc,
      rewardAmount: _selectedReward,
    );

    _titleController.clear();
    _descController.clear();
    _tabController.animateTo(0);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('🎯 \$$_selectedReward Bounty posted for @${widget.creatorUsername}! Funds escrowed.'),
        backgroundColor: Colors.purpleAccent,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final manager = SuperfansManager();

    return AnimatedBuilder(
      animation: manager,
      builder: (ctx, _) {
        final bounties = manager.bounties;

        return Container(
          height: MediaQuery.of(context).size.height * 0.85,
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom + 16,
          ),
          child: Column(
            children: [
              // Handle
              Center(
                child: Container(
                  margin: const EdgeInsets.only(top: 12, bottom: 8),
                  width: 44,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),

              // Title & Creator Header
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Colors.purpleAccent, Colors.amberAccent],
                        ),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.stars, color: Colors.black, size: 22),
                    ),
                    const SizedBox(width: 12),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Creator Bounties & Challenges',
                          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                        Text(
                          'Paid requests for @${widget.creatorUsername}',
                          style: const TextStyle(color: Colors.white60, fontSize: 12),
                        ),
                      ],
                    ),
                    const Spacer(),
                    IconButton(
                      icon: const Icon(Icons.close, color: Colors.white70),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
              ),

              // Tabs: Active Bounties | Sponsor New Bounty
              TabBar(
                controller: _tabController,
                indicatorColor: Colors.purpleAccent,
                labelColor: Colors.purpleAccent,
                unselectedLabelColor: Colors.white60,
                tabs: [
                  Tab(text: 'Active Challenges (${bounties.length})'),
                  const Tab(text: '🎯 Sponsor Challenge'),
                ],
              ),

              Expanded(
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    // Tab 1: Active Challenges
                    bounties.isEmpty
                        ? const Center(
                            child: Text(
                              'No active challenges yet. Be the first to sponsor one!',
                              style: TextStyle(color: Colors.white54),
                            ),
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.all(16),
                            itemCount: bounties.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 12),
                            itemBuilder: (ctx, i) {
                              final bounty = bounties[i];
                              return _buildBountyCard(bounty, manager);
                            },
                          ),

                    // Tab 2: Sponsor New Bounty
                    SingleChildScrollView(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Select Bounty Reward',
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                          const SizedBox(height: 10),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: _presetRewards.map((amt) {
                              final isSelected = _selectedReward == amt;
                              return ChoiceChip(
                                label: Text(
                                  '\$${amt.toInt()}',
                                  style: TextStyle(
                                    color: isSelected ? Colors.black : Colors.white,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                selected: isSelected,
                                selectedColor: Colors.amberAccent,
                                backgroundColor: const Color(0xFF231E38),
                                onSelected: (sel) {
                                  if (sel) setState(() => _selectedReward = amt);
                                },
                              );
                            }).toList(),
                          ),
                          const SizedBox(height: 18),
                          const Text(
                            'Challenge Title',
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                          const SizedBox(height: 6),
                          TextField(
                            controller: _titleController,
                            style: const TextStyle(color: Colors.white),
                            decoration: InputDecoration(
                              hintText: 'e.g. 60s Breakdown of your audio setup',
                              hintStyle: const TextStyle(color: Colors.white38),
                              filled: true,
                              fillColor: const Color(0xFF1E1933),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: BorderSide.none,
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            'Detailed Requirements & Prompts',
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                          const SizedBox(height: 6),
                          TextField(
                            controller: _descController,
                            maxLines: 3,
                            style: const TextStyle(color: Colors.white),
                            decoration: InputDecoration(
                              hintText: 'Explain what you want to see in the Reel or Snap...',
                              hintStyle: const TextStyle(color: Colors.white38),
                              filled: true,
                              fillColor: const Color(0xFF1E1933),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: BorderSide.none,
                              ),
                            ),
                          ),
                          const SizedBox(height: 20),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.purple.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Colors.purpleAccent.withOpacity(0.3)),
                            ),
                            child: const Row(
                              children: [
                                Icon(Icons.shield_outlined, color: Colors.purpleAccent, size: 20),
                                SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'Funds are held securely in escrow and only released to the creator when the video challenge is fulfilled.',
                                    style: TextStyle(color: Colors.white70, fontSize: 11),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 20),
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.amberAccent,
                                foregroundColor: Colors.black,
                                padding: const EdgeInsets.symmetric(vertical: 14),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                              ),
                              icon: const Icon(Icons.bolt, size: 20),
                              label: Text(
                                'Deposit \$$_selectedReward & Post Bounty',
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                              ),
                              onPressed: _submitBounty,
                            ),
                          ),
                        ],
                      ),
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

  Widget _buildBountyCard(CreatorBounty bounty, SuperfansManager manager) {
    Color statusColor;
    switch (bounty.status) {
      case BountyStatus.open:
        statusColor = Colors.amber;
        break;
      case BountyStatus.inProgress:
        statusColor = Colors.cyanAccent;
        break;
      case BountyStatus.completed:
        statusColor = Colors.greenAccent;
        break;
      case BountyStatus.paidOut:
        statusColor = Colors.purpleAccent;
        break;
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1C1830),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.amberAccent.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '\$${bounty.rewardAmount.toInt()}',
                  style: const TextStyle(color: Colors.amberAccent, fontWeight: FontWeight.bold, fontSize: 14),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  bounty.status.label,
                  style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ),
              const Spacer(),
              Text(
                'by @${bounty.sponsorUsername}',
                style: const TextStyle(color: Colors.white54, fontSize: 11),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            bounty.title,
            style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(
            bounty.description,
            style: const TextStyle(color: Colors.white70, fontSize: 13),
          ),
          if (bounty.fulfillmentUrl != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.black38,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  const Icon(Icons.play_circle_fill, color: Colors.greenAccent, size: 16),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'Fulfilled: ${bounty.fulfillmentUrl}',
                      style: const TextStyle(color: Colors.greenAccent, fontSize: 11),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 12),
          // Actions based on state
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              if (bounty.status == BountyStatus.open)
                TextButton.icon(
                  icon: const Icon(Icons.videocam, size: 16),
                  label: const Text('Fulfill Challenge', style: TextStyle(fontWeight: FontWeight.bold)),
                  style: TextButton.styleFrom(foregroundColor: Colors.amberAccent),
                  onPressed: () {
                    manager.fulfillBounty(bounty.id, 'https://interest.app/reel/submission_${bounty.id}');
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('🎬 Video challenge fulfilled! Waiting for sponsor release.')),
                    );
                  },
                ),
              if (bounty.status == BountyStatus.completed)
                ElevatedButton.icon(
                  icon: const Icon(Icons.check_circle, size: 16),
                  label: const Text('Release Payout', style: TextStyle(fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.greenAccent,
                    foregroundColor: Colors.black,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: () {
                    manager.releaseBountyPayout(bounty.id);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('💰 \$$bounty.rewardAmount payout released to creator!')),
                    );
                  },
                ),
            ],
          ),
        ],
      ),
    );
  }
}
