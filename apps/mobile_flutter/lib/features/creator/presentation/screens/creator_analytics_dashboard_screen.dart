import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/features/creator/data/creator_repository.dart';
import 'package:mobile/features/creator/domain/models/analytics_models.dart';

class CreatorAnalyticsDashboardScreen extends StatefulWidget {
  final CreatorRepository repository;

  const CreatorAnalyticsDashboardScreen({
    super.key,
    required this.repository,
  });

  @override
  State<CreatorAnalyticsDashboardScreen> createState() => _CreatorAnalyticsDashboardScreenState();
}

class _CreatorAnalyticsDashboardScreenState extends State<CreatorAnalyticsDashboardScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  String _selectedRange = '30d';
  bool _isLoading = true;
  String? _errorMessage;

  VerifiedCreatorAnalyticsModel? _analytics;
  List<ScheduledReelItemModel> _scheduledReels = [];
  bool _isLoadingScheduled = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      if (_tabController.index == 1 && _scheduledReels.isEmpty && !_isLoadingScheduled) {
        _loadScheduledReels();
      }
    });
    _loadAnalytics();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadAnalytics() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final analytics = await widget.repository.getVerifiedAnalytics(range: _selectedRange);
      if (mounted) {
        setState(() {
          _analytics = analytics;
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

  Future<void> _loadScheduledReels() async {
    setState(() => _isLoadingScheduled = true);
    try {
      final scheduled = await widget.repository.getScheduledReels();
      if (mounted) {
        setState(() {
          _scheduledReels = scheduled;
          _isLoadingScheduled = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isLoadingScheduled = false);
      }
    }
  }

  Future<void> _cancelSchedule(String reelId) async {
    try {
      await widget.repository.cancelScheduledReel(reelId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Scheduled publication cancelled.')),
        );
        _loadScheduledReels();
        _loadAnalytics();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to cancel: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F0F13),
      appBar: AppBar(
        title: const Text(
          'Creator Analytics & Studio',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        backgroundColor: const Color(0xFF16161E),
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFF6C5CE7),
          indicatorWeight: 3,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white60,
          tabs: const [
            Tab(icon: Icon(Icons.analytics_outlined), text: 'Verified Analytics'),
            Tab(icon: Icon(Icons.schedule_outlined), text: 'Scheduled Content'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              if (_tabController.index == 0) {
                _loadAnalytics();
              } else {
                _loadScheduledReels();
              }
            },
          ),
        ],
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildAnalyticsTab(),
          _buildScheduledTab(),
        ],
      ),
    );
  }

  Widget _buildAnalyticsTab() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF6C5CE7)));
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
              Text(
                'Failed to load verified analytics: $_errorMessage',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white70),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _loadAnalytics,
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6C5CE7)),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    final data = _analytics;
    if (data == null) {
      return const SizedBox.shrink();
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildTimeframeSelector(),
          const SizedBox(height: 12),
          _buildProcessingDelayBanner(data.timeframe),
          const SizedBox(height: 16),
          _buildZeroLocationBadge(data.zeroLocationGuarantee),
          const SizedBox(height: 16),
          _buildOverviewMetricsGrid(data),
          const SizedBox(height: 16),
          _buildFinancialReconciliationCard(data.earnings),
          const SizedBox(height: 20),
          _buildCountingRulesCard(data.countingRules),
          const SizedBox(height: 20),
          if (data.hasSufficientData) ...[
            _buildRetentionSection(data.retentionCurve),
            const SizedBox(height: 20),
            _buildDiscoverySourcesSection(data.discoverySources),
            const SizedBox(height: 20),
            _buildTopicPerformanceSection(data.topicPerformance),
            const SizedBox(height: 20),
            _buildTopReelsSection(data.topReels),
          ] else ...[
            _buildHonestEmptyState(),
          ],
        ],
      ),
    );
  }

  Widget _buildTimeframeSelector() {
    return Row(
      children: [
        const Text(
          'Date Range: ',
          style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w600),
        ),
        const Spacer(),
        Wrap(
          spacing: 8,
          children: ['7d', '30d', '90d'].map((range) {
            final isSelected = _selectedRange == range;
            return ChoiceChip(
              label: Text(range),
              selected: isSelected,
              selectedColor: const Color(0xFF6C5CE7),
              backgroundColor: const Color(0xFF22222E),
              labelStyle: TextStyle(
                color: isSelected ? Colors.white : Colors.white70,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
              onSelected: (selected) {
                if (selected && _selectedRange != range) {
                  setState(() => _selectedRange = range);
                  _loadAnalytics();
                }
              },
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildProcessingDelayBanner(AnalyticsTimeframeModel timeframe) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E2C),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.white12),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline, size: 18, color: Color(0xFFA29BFE)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Server-reconciled metrics (${timeframe.timezone}). Ingestion pipeline has a ~${timeframe.processingDelayMinutes} min verification window.',
              style: const TextStyle(color: Colors.white70, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildZeroLocationBadge(String guarantee) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF102820),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFF00B894).withOpacity(0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.verified_user_outlined, size: 20, color: Color(0xFF00B894)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              guarantee,
              style: const TextStyle(color: Color(0xFF55EFC4), fontSize: 11),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOverviewMetricsGrid(VerifiedCreatorAnalyticsModel data) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _buildMetricCard(
                title: 'Verified Views',
                value: data.totalViews.toString(),
                subtitle: '>= 1.5s qualified watch',
                icon: Icons.play_circle_filled,
                color: const Color(0xFF6C5CE7),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildMetricCard(
                title: 'Watch Hours',
                value: data.totalWatchHours.toStringAsFixed(1),
                subtitle: 'Total accumulated time',
                icon: Icons.timer,
                color: const Color(0xFF0984E3),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildMetricCard(
                title: 'Completion Rate',
                value: '${data.completionRate.toStringAsFixed(1)}%',
                subtitle: 'Watched >= 90%',
                icon: Icons.check_circle_outline,
                color: const Color(0xFF00B894),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildMetricCard(
                title: 'Engagement Rate',
                value: '${data.engagementRate.toStringAsFixed(1)}%',
                subtitle: '${data.totalLikes + data.totalComments + data.totalSaves + data.totalShares} interactions',
                icon: Icons.thumb_up_alt_outlined,
                color: const Color(0xFFE17055),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildMetricCard({
    required String title,
    required String value,
    required String subtitle,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A24),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: color),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(color: Colors.white60, fontSize: 12, fontWeight: FontWeight.w500),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: const TextStyle(color: Colors.white38, fontSize: 10),
          ),
        ],
      ),
    );
  }

  Widget _buildFinancialReconciliationCard(CreatorEarningsModel earnings) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [
            Color(0xFF231942),
            Color(0xFF1E1E2C),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFA29BFE).withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.account_balance_wallet, color: Color(0xFFFDCB6E), size: 20),
              const SizedBox(width: 8),
              const Text(
                'Authoritative Financial Records',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFF00B894).withOpacity(0.2),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text(
                  'Verified Ledger',
                  style: TextStyle(color: Color(0xFF55EFC4), fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Net Creator Earnings', style: TextStyle(color: Colors.white60, fontSize: 11)),
                    const SizedBox(height: 4),
                    Text(
                      earnings.netFormatted,
                      style: const TextStyle(color: Color(0xFF55EFC4), fontSize: 24, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Gross Revenue', style: TextStyle(color: Colors.white60, fontSize: 11)),
                    const SizedBox(height: 4),
                    Text(
                      earnings.grossFormatted,
                      style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const Divider(color: Colors.white12, height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Completed Tips: ${earnings.tipsCount}', style: const TextStyle(color: Colors.white70, fontSize: 12)),
              Text('Active Subscriptions: ${earnings.activeSubscriptionsCount}', style: const TextStyle(color: Colors.white70, fontSize: 12)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCountingRulesCard(ViewCountingRulesModel rules) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF161622),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.rule, color: Color(0xFFA29BFE), size: 16),
              SizedBox(width: 8),
              Text(
                'Documented View Counting Rules',
                style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            '• Qualifying View: Continuous watch >= ${rules.minWatchSecondsForView}s with >= 15% watch ratio.\n'
            '• Completed View: Watched >= ${(rules.completionRatioThreshold * 100).toInt()}% of video length.\n'
            '• Skips < ${rules.rapidSkipDurationLimitSeconds}s are discarded from view counts.\n'
            '• Deduplication window: ${rules.deduplicationWindowMinutes} minutes per session.\n'
            '• Anti-bot burst filtering: ${rules.botFilteringEnabled ? "Active (rapid repeat quarantine)" : "Disabled"}.',
            style: const TextStyle(color: Colors.white54, fontSize: 11, height: 1.5),
          ),
        ],
      ),
    );
  }

  Widget _buildRetentionSection(List<RetentionPointModel> retention) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Audience Retention Curve',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
        ),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF161622),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: retention.map((pt) {
                  return Column(
                    children: [
                      Container(
                        height: 70 * (pt.retentionPercent / 100.0),
                        width: 14,
                        decoration: BoxDecoration(
                          color: const Color(0xFF6C5CE7).withOpacity(0.85),
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '${pt.bucketPercent}%',
                        style: const TextStyle(color: Colors.white38, fontSize: 9),
                      ),
                    ],
                  );
                }).toList(),
              ),
              const SizedBox(height: 8),
              const Text(
                'Percent of viewers retained across duration',
                style: TextStyle(color: Colors.white54, fontSize: 11),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildDiscoverySourcesSection(List<DiscoverySourceBreakdownModel> sources) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Discovery Sources',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
        ),
        const SizedBox(height: 10),
        ...sources.map((s) => Padding(
          padding: const EdgeInsets.only(bottom: 8.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(s.displayName, style: const TextStyle(color: Colors.white70, fontSize: 12)),
                  Text('${s.percentage}% (${s.count} views)', style: const TextStyle(color: Colors.white38, fontSize: 11)),
                ],
              ),
              const SizedBox(height: 4),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: s.percentage / 100.0,
                  backgroundColor: const Color(0xFF222230),
                  color: const Color(0xFF6C5CE7),
                  minHeight: 6,
                ),
              ),
            ],
          ),
        )),
      ],
    );
  }

  Widget _buildTopicPerformanceSection(List<TopicPerformanceItemModel> topics) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Topic & Interest Performance',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
        ),
        const SizedBox(height: 10),
        ...topics.map((t) => Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFF161622),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      t.topicTitle,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${t.reelsCount} reels • ${t.viewsCount} views • ${t.watchTimeHours.toStringAsFixed(1)}h watch time',
                      style: const TextStyle(color: Colors.white54, fontSize: 11),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '${t.engagementRate.toStringAsFixed(1)}%',
                    style: const TextStyle(color: Color(0xFF00B894), fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  const Text('Eng. rate', style: TextStyle(color: Colors.white38, fontSize: 10)),
                ],
              ),
            ],
          ),
        )),
      ],
    );
  }

  Widget _buildTopReelsSection(List<CreatorTopReelModel> reels) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Top Content Performance',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
        ),
        const SizedBox(height: 10),
        ...reels.map((r) => Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFF161622),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 58,
                decoration: BoxDecoration(
                  color: const Color(0xFF252538),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: r.isDeleted
                    ? const Icon(Icons.delete_outline, color: Colors.white38, size: 24)
                    : (r.thumbnailUrl != null
                        ? ClipRRect(
                            borderRadius: BorderRadius.circular(6),
                            child: OptimizedNetworkImage(
                              imageUrl: r.thumbnailUrl!,
                              width: 44,
                              height: 58,
                              targetCacheWidth: 90,
                              targetCacheHeight: 120,
                              fit: BoxFit.cover,
                            ),
                          )
                        : const Icon(Icons.movie, color: Colors.white38)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      r.title,
                      style: TextStyle(
                        color: r.isDeleted ? Colors.white38 : Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        fontStyle: r.isDeleted ? FontStyle.italic : FontStyle.normal,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${r.viewCount} views • ${r.likeCount} likes • ${r.saveCount} saves',
                      style: const TextStyle(color: Colors.white54, fontSize: 11),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '${(r.avgCompletionRate * 100).toInt()}%',
                    style: const TextStyle(color: Color(0xFF6C5CE7), fontWeight: FontWeight.bold, fontSize: 12),
                  ),
                  const Text('Completion', style: TextStyle(color: Colors.white38, fontSize: 10)),
                ],
              ),
            ],
          ),
        )),
      ],
    );
  }

  Widget _buildHonestEmptyState() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: const Color(0xFF161622),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white10),
      ),
      child: const Column(
        children: [
          Icon(Icons.query_stats, size: 44, color: Colors.white24),
          SizedBox(height: 12),
          Text(
            'Zero Placeholder Guarantee',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
          ),
          SizedBox(height: 6),
          Text(
            'No qualifying playback sessions recorded during this date window yet.\nMetrics reflect strictly verified server telemetry.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white54, fontSize: 11, height: 1.4),
          ),
        ],
      ),
    );
  }

  Widget _buildScheduledTab() {
    if (_isLoadingScheduled) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF6C5CE7)));
    }

    if (_scheduledReels.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.schedule, size: 48, color: Colors.white24),
              SizedBox(height: 12),
              Text(
                'No Scheduled Publications',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
              ),
              SizedBox(height: 6),
              Text(
                'When you schedule content in Creator Studio, it appears here and publishes automatically.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white54, fontSize: 12),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _scheduledReels.length,
      itemBuilder: (context, index) {
        final item = _scheduledReels[index];
        return Card(
          color: const Color(0xFF161622),
          margin: const EdgeInsets.only(bottom: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                const Icon(Icons.event, color: Color(0xFF6C5CE7), size: 28),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.title,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Scheduled for: ${item.scheduledAt}',
                        style: const TextStyle(color: Color(0xFFFDCB6E), fontSize: 12),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.cancel_outlined, color: Colors.redAccent),
                  tooltip: 'Cancel scheduled publish',
                  onPressed: () => _cancelSchedule(item.id),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
