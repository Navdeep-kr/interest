import 'package:flutter/material.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/monetization/domain/models/monetization_models.dart';
import 'package:mobile/features/monetization/data/monetization_repository.dart';

class CreatorMonetizationDashboardScreen extends StatefulWidget {
  final String token;
  final MonetizationRepository? repository;

  const CreatorMonetizationDashboardScreen({
    super.key,
    required this.token,
    this.repository,
  });

  @override
  State<CreatorMonetizationDashboardScreen> createState() =>
      _CreatorMonetizationDashboardScreenState();
}

class _CreatorMonetizationDashboardScreenState
    extends State<CreatorMonetizationDashboardScreen> {
  late final MonetizationRepository _repository;

  bool _isLoading = true;
  String? _errorMessage;

  CreatorFinancialAccountModel? _account;
  CreatorEligibilityStatusModel? _eligibility;
  List<CreatorPayoutInvoiceItemModel> _invoices = [];
  List<FinancialAuditTrailItemModel> _auditTrail = [];
  bool _isRestoring = false;
  String? _restoreStatusMessage;

  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? MonetizationRepository();
    _loadDashboardData();
  }

  Future<void> _loadDashboardData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final accountFuture = _repository.getFinancialAccount(widget.token);
      final eligibilityFuture = _repository.getEligibility(widget.token);
      final invoicesFuture = _repository.getPayoutInvoices(widget.token);
      final auditTrailFuture = _repository.getAuditTrail(token: widget.token);

      final results = await Future.wait([
        accountFuture,
        eligibilityFuture,
        invoicesFuture,
        auditTrailFuture,
      ]);

      if (mounted) {
        setState(() {
          _account = results[0] as CreatorFinancialAccountModel;
          _eligibility = results[1] as CreatorEligibilityStatusModel;
          _invoices = results[2] as List<CreatorPayoutInvoiceItemModel>;
          _auditTrail = results[3] as List<FinancialAuditTrailItemModel>;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _handleRestorePurchases() async {
    setState(() {
      _isRestoring = true;
      _restoreStatusMessage = null;
    });

    try {
      final result = await _repository.restorePurchases(
        token: widget.token,
        gateway: PaymentGateway.appleIap,
      );
      if (mounted) {
        setState(() {
          _isRestoring = false;
          _restoreStatusMessage = result.message;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result.message),
            backgroundColor: Colors.green.shade800,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isRestoring = false;
          _restoreStatusMessage = 'Restore failed: $e';
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to restore purchases: $e'),
            backgroundColor: Colors.red.shade800,
          ),
        );
      }
    }
  }

  Future<void> _handleRequestPayout() async {
    if (_account == null) return;

    if (_account!.isComplianceBlocked) {
      _showComplianceDialog(
        'Payout Blocked',
        _account!.complianceBlockReason ??
            'Identity and tax verification required before enabling payouts.',
      );
      return;
    }

    if (_account!.kycStatus != KycStatus.verified) {
      _showComplianceDialog(
        'KYC Verification Required',
        'Your identity and tax documents must be verified before requesting disbursals.',
      );
      return;
    }

    if (_account!.availableBalanceCents < 5000) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Minimum payout threshold is \$50.00 (5,000 cents).'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    try {
      await _repository.requestPayout(
        token: widget.token,
        amountCents: _account!.availableBalanceCents,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Payout requested and disbursed successfully in Sandbox.'),
          backgroundColor: Colors.green,
        ),
      );
      _loadDashboardData();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Payout request failed: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  void _showComplianceDialog(String title, String message) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        title: Text(title, style: const TextStyle(color: Colors.white)),
        content: Text(message, style: const TextStyle(color: Colors.white70)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('OK', style: TextStyle(color: AppColors.primary)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      appBar: AppBar(
        title: const Text(
          'Monetization & Payouts',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        backgroundColor: const Color(0xFF1E1E1E),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadDashboardData,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: _buildContent(),
    );
  }

  Widget _buildContent() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.redAccent),
              const SizedBox(height: 16),
              const Text(
                'Failed to load monetization data',
                style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white60, fontSize: 14),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: _loadDashboardData,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                ),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadDashboardData,
      color: AppColors.primary,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildZeroLocationAndStorePolicyBadge(),
            const SizedBox(height: 16),
            _buildEarningsCard(),
            const SizedBox(height: 16),
            _buildComplianceStatusCard(),
            const SizedBox(height: 16),
            _buildPayoutActionCard(),
            const SizedBox(height: 16),
            _buildRestorePurchasesCard(),
            const SizedBox(height: 16),
            _buildInvoicesSection(),
            const SizedBox(height: 16),
            _buildAuditTrailSection(),
          ],
        ),
      ),
    );
  }

  Widget _buildZeroLocationAndStorePolicyBadge() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.blueAccent.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.verified_user, color: Colors.blueAccent, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Zero-Location Verified: 0 GPS, 0 IP coordinates. PCI-DSS compliant: Raw card numbers never stored.',
              style: TextStyle(color: Colors.blue.shade100, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEarningsCard() {
    final available = _account?.availableBalanceDollars ?? 0.0;
    final lifetime = _account?.lifetimeEarningsDollars ?? 0.0;

    return Card(
      color: const Color(0xFF1E1E1E),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Available Balance',
              style: TextStyle(color: Colors.white60, fontSize: 14),
            ),
            const SizedBox(height: 6),
            Text(
              '\$${available.toStringAsFixed(2)}',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 32,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            const Divider(color: Colors.white10),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Lifetime Gross', style: TextStyle(color: Colors.white60, fontSize: 12)),
                    const SizedBox(height: 4),
                    Text('\$${lifetime.toStringAsFixed(2)}', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
                  ],
                ),
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('Min Threshold', style: TextStyle(color: Colors.white60, fontSize: 12)),
                    SizedBox(height: 4),
                    Text('\$50.00', style: TextStyle(color: Colors.white70, fontSize: 16, fontWeight: FontWeight.w600)),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildComplianceStatusCard() {
    final isBlocked = _account?.isComplianceBlocked ?? true;
    final kycStatus = _account?.kycStatus ?? KycStatus.unverified;
    final taxForm = _account?.taxFormType ?? 'None';

    Color cardColor = isBlocked ? const Color(0xFF3B1D1D) : const Color(0xFF1D3B26);
    Color borderColor = isBlocked ? Colors.redAccent.withOpacity(0.4) : Colors.greenAccent.withOpacity(0.4);
    IconData icon = isBlocked ? Icons.warning_amber_rounded : Icons.check_circle_outline;
    Color iconColor = isBlocked ? Colors.redAccent : Colors.greenAccent;
    String statusTitle = isBlocked ? 'Compliance Hold Active' : 'Compliant & Verified';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: iconColor, size: 24),
              const SizedBox(width: 10),
              Text(
                statusTitle,
                style: TextStyle(
                  color: iconColor,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          if (isBlocked && _account?.complianceBlockReason != null) ...[
            const SizedBox(height: 8),
            Text(
              _account!.complianceBlockReason!,
              style: const TextStyle(color: Colors.white70, fontSize: 13),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('KYC Status: ${kycStatus.name.toUpperCase()}', style: const TextStyle(color: Colors.white60, fontSize: 12)),
              Text('Tax Form: $taxForm', style: const TextStyle(color: Colors.white60, fontSize: 12)),
            ],
          ),
          if (_eligibility != null && _eligibility!.reasons.isNotEmpty) ...[
            const SizedBox(height: 10),
            const Divider(color: Colors.white10),
            const SizedBox(height: 6),
            const Text('Action Items:', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            ..._eligibility!.reasons.map((r) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 2.0),
              child: Row(
                children: [
                  const Icon(Icons.arrow_right, color: Colors.orangeAccent, size: 16),
                  const SizedBox(width: 4),
                  Expanded(child: Text(r, style: const TextStyle(color: Colors.white70, fontSize: 12))),
                ],
              ),
            )),
          ],
        ],
      ),
    );
  }

  Widget _buildPayoutActionCard() {
    final isBlocked = _account?.isComplianceBlocked ?? true;
    final isKycVerified = _account?.kycStatus == KycStatus.verified;
    final hasEnoughBalance = (_account?.availableBalanceCents ?? 0) >= 5000;
    final canPayout = !isBlocked && isKycVerified && hasEnoughBalance;

    return Card(
      color: const Color(0xFF1E1E1E),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Disburse Earnings',
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 6),
            const Text(
              'Earnings are disbursed to connected gateway (Stripe Connect or Bank ACH). Minimum payout threshold: \$50.00.',
              style: TextStyle(color: Colors.white60, fontSize: 12),
            ),
            const SizedBox(height: 14),
            ElevatedButton.icon(
              onPressed: canPayout ? _handleRequestPayout : null,
              icon: const Icon(Icons.account_balance_wallet_outlined),
              label: Text(canPayout ? 'Request Payout' : 'Payouts Locked (Requirements Unmet)'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                disabledBackgroundColor: Colors.white12,
                disabledForegroundColor: Colors.white38,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRestorePurchasesCard() {
    return Card(
      color: const Color(0xFF1E1E1E),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Restore Prior Purchases',
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 6),
            const Text(
              'Synchronize active creator subscriptions and digital passes across your iOS and Android devices without duplicate charges.',
              style: TextStyle(color: Colors.white60, fontSize: 12),
            ),
            if (_restoreStatusMessage != null) ...[
              const SizedBox(height: 10),
              Text(
                _restoreStatusMessage!,
                style: const TextStyle(color: Colors.greenAccent, fontSize: 12),
              ),
            ],
            const SizedBox(height: 14),
            OutlinedButton.icon(
              onPressed: _isRestoring ? null : _handleRestorePurchases,
              icon: _isRestoring
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.restore),
              label: Text(_isRestoring ? 'Restoring...' : 'Restore Purchases'),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white,
                side: const BorderSide(color: Colors.white24),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInvoicesSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Payout Invoices & Statements',
          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 10),
        if (_invoices.isEmpty)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF1E1E1E),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Center(
              child: Text(
                'No payout invoices issued yet.',
                style: TextStyle(color: Colors.white38, fontSize: 13),
              ),
            ),
          )
        else
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _invoices.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (ctx, index) {
              final inv = _invoices[index];
              return Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E1E1E),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.white10),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(inv.invoiceNumber, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                        const SizedBox(height: 4),
                        Text('Gross: \$${inv.grossDollars.toStringAsFixed(2)} | Tax: \$${(inv.taxWithheldCents / 100).toStringAsFixed(2)}', style: const TextStyle(color: Colors.white60, fontSize: 12)),
                      ],
                    ),
                    Text(
                      '\$${inv.netPayoutDollars.toStringAsFixed(2)}',
                      style: const TextStyle(color: Colors.greenAccent, fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                  ],
                ),
              );
            },
          ),
      ],
    );
  }

  Widget _buildAuditTrailSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Tamper-Evident Audit Trail',
          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 10),
        if (_auditTrail.isEmpty)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF1E1E1E),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Center(
              child: Text(
                'No financial audit entries recorded yet.',
                style: TextStyle(color: Colors.white38, fontSize: 13),
              ),
            ),
          )
        else
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _auditTrail.take(5).length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (ctx, index) {
              final entry = _auditTrail[index];
              return Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E1E1E),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    Icon(
                      entry.actionType.startsWith('CREDIT') ? Icons.arrow_downward : Icons.arrow_upward,
                      color: entry.actionType.startsWith('CREDIT') ? Colors.greenAccent : Colors.orangeAccent,
                      size: 18,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(entry.actionType, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
                          if (entry.notes != null)
                            Text(entry.notes!, style: const TextStyle(color: Colors.white60, fontSize: 11)),
                        ],
                      ),
                    ),
                    Text(
                      '\$${entry.amountDollars.toStringAsFixed(2)}',
                      style: TextStyle(
                        color: entry.actionType.startsWith('CREDIT') ? Colors.greenAccent : Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
      ],
    );
  }
}
