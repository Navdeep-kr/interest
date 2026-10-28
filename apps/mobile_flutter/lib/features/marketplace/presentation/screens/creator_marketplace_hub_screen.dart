import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/core/theme/app_colors.dart';
import '../../domain/models/marketplace_models.dart';
import '../marketplace_notifier.dart';
import 'campaign_detail_and_pitch_screen.dart';

class CreatorMarketplaceHubScreen extends StatefulWidget {
  final MarketplaceNotifier notifier;

  const CreatorMarketplaceHubScreen({super.key, required this.notifier});

  @override
  State<CreatorMarketplaceHubScreen> createState() => _CreatorMarketplaceHubScreenState();
}

class _CreatorMarketplaceHubScreenState extends State<CreatorMarketplaceHubScreen> {
  @override
  void initState() {
    super.initState();
    widget.notifier.loadMarketplaceData();
  }

  void _openCampaignDetails(BrandCampaignModel campaign) {
    widget.notifier.selectCampaign(campaign.id);
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CampaignDetailAndPitchScreen(
          notifier: widget.notifier,
          campaign: campaign,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.notifier,
      builder: (context, _) {
        final state = widget.notifier.state;
        final metrics = state.demandMetrics;
        final eligibility = state.eligibility;

        return Scaffold(
          backgroundColor: AppColors.background,
          appBar: AppBar(
            backgroundColor: AppColors.background,
            elevation: 0,
            title: const Row(
              children: [
                Icon(Icons.storefront_outlined, color: AppColors.primary, size: 22),
                SizedBox(width: 8),
                Text(
                  'Creator Marketplace',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.refresh, color: AppColors.textSecondary),
                tooltip: 'Refresh',
                onPressed: () => widget.notifier.loadMarketplaceData(),
              ),
            ],
          ),
          body: state.isLoading && state.campaigns.isEmpty
              ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
              : RefreshIndicator(
                  color: AppColors.primary,
                  backgroundColor: AppColors.surface,
                  onRefresh: () => widget.notifier.loadMarketplaceData(),
                  child: ListView(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    children: [
                      // 1. Demand & Governance Banner
                      _buildGovernanceBanner(metrics),
                      const SizedBox(height: 16),

                      // 2. Creator Eligibility Card
                      if (eligibility != null) ...[
                        _buildEligibilityCard(eligibility),
                        const SizedBox(height: 20),
                      ],

                      // 3. Section Title & Category Filter
                      Row(
                        children: [
                          const Icon(Icons.campaign, color: AppColors.accentCyan, size: 18),
                          const SizedBox(width: 8),
                          const Text(
                            'OPEN BRAND CAMPAIGNS',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.1,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const Spacer(),
                          Text(
                            '${state.campaigns.length} Briefs',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      // 4. Campaign Cards
                      if (state.campaigns.isEmpty)
                        _buildEmptyState()
                      else
                        ...state.campaigns.map((c) => _buildCampaignCard(c)),
                      const SizedBox(height: 32),
                    ],
                  ),
                ),
        );
      },
    );
  }

  Widget _buildGovernanceBanner(MarketplaceDemandMetricsModel? metrics) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.glassBorder),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withOpacity(0.06),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
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
                child: const Text(
                  'PILOT COMPLIANCE ARCHITECTURE',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.8,
                  ),
                ),
              ),
              const Spacer(),
              const Icon(Icons.verified_user_outlined, size: 16, color: AppColors.success),
            ],
          ),
          const SizedBox(height: 10),
          const Text(
            'Zero Platform Custody · Direct Invoicing',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Interest facilitates brand briefs, creator deliverables, and mandatory FTC #sponsored disclosures. Funds transfer directly between brand and merchant via Stripe Direct without platform escrow.',
            style: TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 12),
          const Divider(height: 1, color: AppColors.glassBorder),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildMetricStat('Campaigns', '${metrics?.totalBrandCampaignsCount ?? 0} Active'),
              _buildMetricStat('Applications', '${metrics?.totalCreatorApplicationsCount ?? 0} Pitches'),
              _buildMetricStat('Volume', '\$${((metrics?.activeContractVolumeCents ?? 0) / 100).toStringAsFixed(0)}'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMetricStat(String label, String value) {
    return Column(
      children: [
        Text(
          value,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: AppColors.accentCyan,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            color: AppColors.textMuted,
          ),
        ),
      ],
    );
  }

  Widget _buildEligibilityCard(MarketplaceEligibilityModel eligibility) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: eligibility.isEligible
            ? AppColors.success.withOpacity(0.08)
            : AppColors.warning.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: eligibility.isEligible
              ? AppColors.success.withOpacity(0.3)
              : AppColors.warning.withOpacity(0.3),
        ),
      ),
      child: Row(
        children: [
          Icon(
            eligibility.isEligible ? Icons.check_circle_outline : Icons.info_outline,
            color: eligibility.isEligible ? AppColors.success : AppColors.warning,
            size: 20,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  eligibility.isEligible
                      ? 'Creator Eligibility Verified'
                      : 'Marketplace Requirements',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: eligibility.isEligible ? AppColors.success : AppColors.warning,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  eligibility.isEligible
                      ? '${eligibility.followersCount} followers · 0 safety strikes · Direct Stripe Connect ready'
                      : eligibility.ineligibilityReasons.join(' · '),
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCampaignCard(BrandCampaignModel campaign) {
    final minDollars = (campaign.budgetMinCents / 100).toStringAsFixed(0);
    final maxDollars = (campaign.budgetMaxCents / 100).toStringAsFixed(0);

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => _openCampaignDetails(campaign),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      radius: 14,
                      backgroundColor: AppColors.surfaceElevated,
                      backgroundImage: appAvatarProvider(campaign.brandLogoUrl),
                      child: campaign.brandLogoUrl == null
                          ? const Icon(Icons.business, size: 14, color: AppColors.textSecondary)
                          : null,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      campaign.brandName,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.success.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '\$$minDollars - \$$maxDollars',
                        style: const TextStyle(
                          color: AppColors.success,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  campaign.title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  campaign.description,
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
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceElevated,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        campaign.interestName,
                        style: const TextStyle(
                          color: AppColors.accentCyan,
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Icon(Icons.assignment_turned_in, size: 14, color: AppColors.textMuted),
                    const SizedBox(width: 4),
                    Text(
                      '${campaign.requiredDeliverables.length} Deliverables',
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.textMuted,
                      ),
                    ),
                    const Spacer(),
                    ElevatedButton(
                      onPressed: () => _openCampaignDetails(campaign),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      child: const Text('View Brief', style: TextStyle(fontSize: 12)),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
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
          Icon(Icons.work_off_outlined, size: 40, color: AppColors.textMuted),
          SizedBox(height: 12),
          Text(
            'No active brand briefs at this moment',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
          ),
          SizedBox(height: 4),
          Text(
            'New technical and creative campaigns are posted weekly.',
            style: TextStyle(
              fontSize: 12,
              color: AppColors.textMuted,
            ),
          ),
        ],
      ),
    );
  }
}
