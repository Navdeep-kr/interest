import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/core/theme/app_colors.dart';
import '../../domain/models/superfan_subscription_model.dart';
import '../../domain/services/superfans_manager.dart';

/// Creator Studio Dashboard for Superfans & Subscription Monetization.
class SuperfansDashboardScreen extends StatefulWidget {
  const SuperfansDashboardScreen({super.key});

  @override
  State<SuperfansDashboardScreen> createState() => _SuperfansDashboardScreenState();
}

class _SuperfansDashboardScreenState extends State<SuperfansDashboardScreen> {
  final SuperfansManager _manager = SuperfansManager();

  @override
  void initState() {
    super.initState();
    _manager.addListener(_onManagerUpdate);
  }

  @override
  void dispose() {
    _manager.removeListener(_onManagerUpdate);
    super.dispose();
  }

  void _onManagerUpdate() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        title: const Row(
          children: [
            Icon(Icons.workspace_premium, color: Color(0xFFC084FC)),
            SizedBox(width: 8),
            Text(
              'Superfans Studio',
              style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold),
            ),
          ],
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Revenue & Subscriber Metrics Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF581C87), Color(0xFF2E1065)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFC084FC).withOpacity(0.4)),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF9333EA).withOpacity(0.2),
                    blurRadius: 16,
                    spreadRadius: 2,
                  ),
                ],
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'MONTHLY RECURRING REVENUE',
                            style: TextStyle(color: Color(0xFFE9D5FF), fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.8),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            '\$${_manager.monthlyRecurringRevenue.toStringAsFixed(2)}',
                            style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w900),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.trending_up, color: Colors.greenAccent, size: 16),
                            SizedBox(width: 4),
                            Text('+18.4%', style: TextStyle(color: Colors.greenAccent, fontSize: 12, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const Divider(color: Colors.white24),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _buildMetricItem('Active Superfans', '${_manager.activeSuperfansCount}', Icons.stars),
                      _buildMetricItem('Avg. Retention', '94.2%', Icons.repeat),
                      _buildMetricItem('Next Payout', '1st Nov', Icons.account_balance_wallet),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Exclusive Publishing Shortcuts
            const Text(
              'EXCLUSIVE CONTENT ACTIONS',
              style: TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.8),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _buildActionCard(
                    icon: Icons.video_call,
                    title: 'Post Superfan Reel',
                    subtitle: 'Subscriber-only video',
                    color: const Color(0xFF9333EA),
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Upload camera ready in Superfan-Exclusive mode!')),
                      );
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildActionCard(
                    icon: Icons.bolt,
                    title: 'Exclusive Story',
                    subtitle: 'Purple crown ring',
                    color: Colors.amber,
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Story composer ready in Superfan-Exclusive mode!')),
                      );
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Tier Configuration Summary
            const Text(
              'ACTIVE SUBSCRIPTION TIERS',
              style: TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.8),
            ),
            const SizedBox(height: 10),
            ...SuperfanTier.values.map((tier) {
              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.glassBorder),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF9333EA).withOpacity(0.2),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.workspace_premium, color: Color(0xFFC084FC), size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(tier.title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                          Text('${tier.perks.length} active perks enabled', style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
                        ],
                      ),
                    ),
                    Text(
                      '\$${tier.defaultPrice.toStringAsFixed(2)}/mo',
                      style: const TextStyle(color: Color(0xFFFACC15), fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                  ],
                ),
              );
            }),
            const SizedBox(height: 24),

            // Recent Superfan Subscribers List
            const Text(
              'RECENT SUPERFANS',
              style: TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.8),
            ),
            const SizedBox(height: 10),
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _manager.recentSuperfans.length,
              itemBuilder: (ctx, i) {
                final member = _manager.recentSuperfans[i];
                return ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                  leading: CircleAvatar(
                    backgroundImage: appAvatarProvider(member.avatarUrl),
                    child: member.avatarUrl == null
                        ? Text(member.displayName[0], style: const TextStyle(color: Colors.white))
                        : null,
                  ),
                  title: Row(
                    children: [
                      Text(member.displayName, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFF7E22CE).withOpacity(0.3),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: const Color(0xFFC084FC), width: 0.8),
                        ),
                        child: Text(
                          member.tier.title,
                          style: const TextStyle(color: Color(0xFFC084FC), fontSize: 9, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  subtitle: Text('@${member.username}', style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
                  trailing: const Icon(Icons.stars, color: Colors.amber, size: 18),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricItem(String label, String value, IconData icon) {
    return Column(
      children: [
        Row(
          children: [
            Icon(icon, color: const Color(0xFFE9D5FF), size: 14),
            const SizedBox(width: 4),
            Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
          ],
        ),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(color: Color(0xFFE9D5FF), fontSize: 11)),
      ],
    );
  }

  Widget _buildActionCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withOpacity(0.4)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withOpacity(0.2),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(height: 10),
            Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 2),
            Text(subtitle, style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
          ],
        ),
      ),
    );
  }
}
