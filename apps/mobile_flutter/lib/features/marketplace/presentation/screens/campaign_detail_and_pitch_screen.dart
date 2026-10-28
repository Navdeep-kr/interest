import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/core/theme/app_colors.dart';
import '../../domain/models/marketplace_models.dart';
import '../marketplace_notifier.dart';

class CampaignDetailAndPitchScreen extends StatefulWidget {
  final MarketplaceNotifier notifier;
  final BrandCampaignModel campaign;

  const CampaignDetailAndPitchScreen({
    super.key,
    required this.notifier,
    required this.campaign,
  });

  @override
  State<CampaignDetailAndPitchScreen> createState() => _CampaignDetailAndPitchScreenState();
}

class _CampaignDetailAndPitchScreenState extends State<CampaignDetailAndPitchScreen> {
  final _formKey = GlobalKey<FormState>();
  final _rateController = TextEditingController();
  final _pitchController = TextEditingController();
  final _sampleLinkController = TextEditingController();

  bool _isPitching = false;

  @override
  void initState() {
    super.initState();
    final defaultDollars = ((widget.campaign.budgetMinCents + widget.campaign.budgetMaxCents) ~/ 200).toString();
    _rateController.text = defaultDollars;
  }

  @override
  void dispose() {
    _rateController.dispose();
    _pitchController.dispose();
    _sampleLinkController.dispose();
    super.dispose();
  }

  Future<void> _submitPitch() async {
    if (!_formKey.currentState!.validate()) return;

    final dollars = int.tryParse(_rateController.text.trim()) ?? 500;
    final rateCents = dollars * 100;

    final samples = _sampleLinkController.text.trim().isNotEmpty
        ? [_sampleLinkController.text.trim()]
        : <String>[];

    final success = await widget.notifier.submitApplication(
      campaignId: widget.campaign.id,
      proposedRateCents: rateCents,
      pitchNote: _pitchController.text.trim(),
      portfolioSampleLinks: samples,
    );

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Pitch submitted successfully! The brand will review your proposal.'),
          backgroundColor: AppColors.surfaceElevated,
        ),
      );
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final campaign = widget.campaign;
    final minDollars = (campaign.budgetMinCents / 100).toStringAsFixed(0);
    final maxDollars = (campaign.budgetMaxCents / 100).toStringAsFixed(0);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        title: const Text('Campaign Brief & Pitch', style: TextStyle(color: Colors.white, fontSize: 17)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // 1. Brand Header
          Row(
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: AppColors.surfaceElevated,
                backgroundImage: appAvatarProvider(campaign.brandLogoUrl),
                child: campaign.brandLogoUrl == null
                    ? const Icon(Icons.business, size: 18, color: AppColors.textSecondary)
                    : null,
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    campaign.brandName,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    campaign.interestName,
                    style: const TextStyle(
                      color: AppColors.accentCyan,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.success.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '\$$minDollars - \$$maxDollars',
                  style: const TextStyle(
                    color: AppColors.success,
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // 2. Title & Description
          Text(
            campaign.title,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            campaign.description,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 14,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 20),

          // 3. Deliverables Checklist
          const Text(
            'REQUIRED DELIVERABLES',
            style: TextStyle(
              color: AppColors.textSecondary,
              fontSize: 11,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.0,
            ),
          ),
          const SizedBox(height: 8),
          ...campaign.requiredDeliverables.map(
            (d) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.check_circle, color: AppColors.primary, size: 16),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(d, style: const TextStyle(color: Colors.white, fontSize: 13)),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // 4. Regulatory Disclosure Banner
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surfaceElevated,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.glassBorder),
            ),
            child: const Row(
              children: [
                Icon(Icons.gavel, color: AppColors.accentGold, size: 18),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Mandatory FTC Compliance: Deliverables must include prominent #sponsored or #ad disclosure tags.',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // 5. Pitch Submission Form Toggle
          if (!_isPitching)
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () => setState(() => _isPitching = true),
              child: const Text('Pitch to this Campaign', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
            )
          else
            _buildPitchForm(),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildPitchForm() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withOpacity(0.3)),
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.edit_note, color: AppColors.primary, size: 20),
                SizedBox(width: 8),
                Text(
                  'Your Creator Pitch',
                  style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // Rate Input
            const Text('PROPOSED RATE (USD)', style: TextStyle(color: AppColors.textSecondary, fontSize: 11, fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            TextFormField(
              controller: _rateController,
              keyboardType: TextInputType.number,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                prefixText: '\$ ',
                prefixStyle: const TextStyle(color: Colors.white70),
                filled: true,
                fillColor: AppColors.surfaceElevated,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppColors.glassBorder)),
              ),
              validator: (val) => val == null || val.trim().isEmpty ? 'Enter proposed rate' : null,
            ),
            const SizedBox(height: 12),

            // Pitch Note
            const Text('WHY YOU ARE A FIT', style: TextStyle(color: AppColors.textSecondary, fontSize: 11, fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            TextFormField(
              controller: _pitchController,
              maxLines: 3,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'Describe your creative approach and how your audience aligns with this brief...',
                hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                filled: true,
                fillColor: AppColors.surfaceElevated,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppColors.glassBorder)),
              ),
              validator: (val) => val == null || val.trim().length < 10 ? 'Pitch must be at least 10 characters.' : null,
            ),
            const SizedBox(height: 12),

            // Portfolio Link
            const Text('PORTFOLIO SAMPLE LINK (OPTIONAL)', style: TextStyle(color: AppColors.textSecondary, fontSize: 11, fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            TextFormField(
              controller: _sampleLinkController,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'https://interest.app/reel/sample_01',
                hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                filled: true,
                fillColor: AppColors.surfaceElevated,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppColors.glassBorder)),
              ),
            ),
            const SizedBox(height: 18),

            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => setState(() => _isPitching = false),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: AppColors.glassBorder),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _submitPitch,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    child: const Text('Send Pitch', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
