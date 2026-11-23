import 'package:flutter/material.dart';
import '../../domain/models/interest_plus_model.dart';
import '../../domain/services/interest_plus_manager.dart';

class InterestPlusUpgradeSheet extends StatefulWidget {
  const InterestPlusUpgradeSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => const InterestPlusUpgradeSheet(),
    );
  }

  @override
  State<InterestPlusUpgradeSheet> createState() => _InterestPlusUpgradeSheetState();
}

class _InterestPlusUpgradeSheetState extends State<InterestPlusUpgradeSheet> {
  final InterestPlusManager _manager = InterestPlusManager();
  InterestPlusPlan _selectedPlan = InterestPlusPlan.annual;
  bool _isProcessing = false;

  final List<Map<String, String>> _perks = [
    {
      'icon': '❄️',
      'title': 'Streak Freeze & Protection',
      'desc': 'Never lose a 100-day streak! 2 free automatic streak freezes per month.',
    },
    {
      'icon': '👻',
      'title': 'Ghost View Mode',
      'desc': 'View friends\' snaps and stories anonymously without seen receipts.',
    },
    {
      'icon': '💖',
      'title': '#1 Best Friend Pinning',
      'desc': 'Pin your closest connection to the very top with custom badges.',
    },
    {
      'icon': '✨',
      'title': 'Holographic Profile Glow',
      'desc': 'Stand out in comment threads with an exclusive animated gradient badge.',
    },
    {
      'icon': '📱',
      'title': '12 Custom App Icons',
      'desc': 'Personalize your home screen with Midnight Gold, Cyber Neon & Stealth Black.',
    },
  ];

  void _handleSubscribe() async {
    setState(() => _isProcessing = true);
    await Future.delayed(const Duration(milliseconds: 350));

    _manager.subscribe(_selectedPlan);

    if (!mounted) return;
    Navigator.of(context).pop();

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Row(
          children: [
            Text('💎', style: TextStyle(fontSize: 22)),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                'Welcome to Interest+! All VIP perks unlocked.',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
        backgroundColor: Color(0xFF0284C7),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        border: Border.all(color: const Color(0xFF38BDF8).withOpacity(0.4)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0284C7).withOpacity(0.3),
            blurRadius: 30,
            spreadRadius: 4,
          ),
        ],
      ),
      child: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 12),
            Container(
              width: 44,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),

            // Header Banner
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0284C7).withOpacity(0.2),
                    shape: BoxShape.circle,
                  ),
                  child: const Text('💎', style: TextStyle(fontSize: 24)),
                ),
                const SizedBox(width: 10),
                const Text(
                  'INTEREST+',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.5,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            const Text(
              'Exclusive Superpowers & Elite Personalization',
              style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
            ),
            const SizedBox(height: 20),

            // Plan Options
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20.0),
              child: Row(
                children: [
                  Expanded(
                    child: _buildPlanCard(
                      plan: InterestPlusPlan.annual,
                      badge: 'SAVE 37%',
                      price: '\$29.99',
                      subtitle: '\$2.49 / month',
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildPlanCard(
                      plan: InterestPlusPlan.monthly,
                      badge: null,
                      price: '\$3.99',
                      subtitle: '/ month',
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Perks List
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                itemCount: _perks.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (ctx, i) {
                  final perk = _perks[i];
                  return Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: Colors.white10),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(perk['icon']!, style: const TextStyle(fontSize: 24)),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                perk['title']!,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                perk['desc']!,
                                style: const TextStyle(
                                  color: Color(0xFF94A3B8),
                                  fontSize: 12,
                                  height: 1.3,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),

            // Subscribe Button
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 10, 20, 14),
              child: SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0284C7),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    elevation: 6,
                  ),
                  onPressed: _isProcessing ? null : _handleSubscribe,
                  child: _isProcessing
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : Text(
                          _manager.isSubscribed
                              ? 'Manage Subscription'
                              : 'Upgrade to Interest+ • ${_selectedPlan == InterestPlusPlan.annual ? '\$29.99/yr' : '\$3.99/mo'}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlanCard({
    required InterestPlusPlan plan,
    required String? badge,
    required String price,
    required String subtitle,
  }) {
    final isSelected = _selectedPlan == plan;

    return GestureDetector(
      onTap: () => setState(() => _selectedPlan = plan),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF0284C7).withOpacity(0.2) : const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? const Color(0xFF38BDF8) : Colors.white12,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Column(
          children: [
            if (badge != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                margin: const EdgeInsets.only(bottom: 4),
                decoration: BoxDecoration(
                  color: Colors.amber.shade700,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  badge,
                  style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                ),
              )
            else
              const SizedBox(height: 18),
            Text(
              price,
              style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900),
            ),
            Text(
              subtitle,
              style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }
}
