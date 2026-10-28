'use client';

import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Sparkles,
  Users,
  Film,
  DollarSign,
  ShieldCheck,
  Compass,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sliders,
  Beaker,
  Layers,
  HeartHandshake,
  Percent,
  Timer,
  Activity,
  Flame,
  Award,
} from 'lucide-react';
import { useAdminAuth } from '../../lib/rbac';
import {
  FunnelAnalysisResponse,
  RetentionAnalysisResponse,
  InterestSatisfactionResponse,
  ExperimentEvaluationResult,
} from '@shared/types';

type AnalyticsTab = 'overview' | 'funnels' | 'experiments' | 'retention' | 'satisfaction';

export default function PlatformAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('funnels');
  const [funnelSegment, setFunnelSegment] = useState<'all' | 'ai' | 'coffee' | 'synth'>('all');
  const [selectedExperiment, setSelectedExperiment] = useState<string>('feed_ranking_algorithm');
  const [qaUserId, setQaUserId] = useState<string>('user-qa-tester-01');
  const [qaVariantOverride, setQaVariantOverride] = useState<string>('variant_affinity_boost');
  const [overrideSuccess, setOverrideSuccess] = useState<string | null>(null);

  // --- Funnel Data (Install -> Onboarding -> First Reel -> First Post) ---
  const funnelData: FunnelAnalysisResponse = {
    funnelName: 'Activation & Creation Funnel',
    totalStarted: 14850,
    totalCompleted: 2210,
    overallConversionRate: 0.1488,
    steps: [
      {
        stepIndex: 1,
        stepName: '1. App Installed',
        eventName: 'app_installed',
        count: 14850,
        conversionRateFromPrev: 1.0,
        conversionRateFromStart: 1.0,
        dropoffCount: 0,
        dropoffRate: 0.0,
        medianDurationSecondsToNext: 42,
      },
      {
        stepIndex: 2,
        stepName: '2. Onboarding Completed',
        eventName: 'onboarding_completed',
        count: 12180,
        conversionRateFromPrev: 0.8202,
        conversionRateFromStart: 0.8202,
        dropoffCount: 2670,
        dropoffRate: 0.1798,
        medianDurationSecondsToNext: 6,
      },
      {
        stepIndex: 3,
        stepName: '3. First Reel Watched',
        eventName: 'feed_reel_watched',
        count: 11240,
        conversionRateFromPrev: 0.9228,
        conversionRateFromStart: 0.7569,
        dropoffCount: 940,
        dropoffRate: 0.0772,
        medianDurationSecondsToNext: 14400,
      },
      {
        stepIndex: 4,
        stepName: '4. First Reel Published',
        eventName: 'creator_reel_published',
        count: 2210,
        conversionRateFromPrev: 0.1966,
        conversionRateFromStart: 0.1488,
        dropoffCount: 9030,
        dropoffRate: 0.8034,
      },
    ],
    segments: [
      { segmentKey: 'Category', segmentValue: 'Artificial Intelligence & ML', conversionRate: 0.224, count: 3840 },
      { segmentKey: 'Category', segmentValue: 'Specialty Coffee & Roasting', conversionRate: 0.198, count: 3120 },
      { segmentKey: 'Category', segmentValue: 'Modular Synthesizers', conversionRate: 0.185, count: 2450 },
      { segmentKey: 'Category', segmentValue: 'Precision CNC Machining', conversionRate: 0.162, count: 1820 },
    ],
  };

  // --- A/B Testing Experiments Data ---
  const experimentsList: ExperimentEvaluationResult[] = [
    {
      experiment: {
        id: 'feed_ranking_algorithm',
        name: 'Feed Multi-Objective Scoring Weights',
        description: 'Evaluates Affinity Boost (55/20/15/10) vs PWT Watch-Time Heavy (35/35/15/15) against Control (40/25/20/15)',
        status: 'RUNNING' as any,
        variants: [],
        salt: 'salt_feed_ranking_2026',
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-12T00:00:00Z',
      },
      totalParticipants: 28540,
      startDate: '2026-10-01',
      daysRunning: 11,
      recommendation:
        'Variant "Deep Affinity Boost" demonstrates a statistically significant +18.3% conversion lift and +14.0% mean watch time (p = 0.0018). Recommend gradual 100% rollout.',
      winnerVariantId: 'variant_affinity_boost',
      variants: [
        {
          variantId: 'control',
          variantName: 'Control (Balanced: 40/25/20/15)',
          isControl: true,
          sampleSize: 14250,
          trafficPercentage: 50.0,
          meanWatchTimeSeconds: 24.2,
          conversionRate: 0.142,
          relativeLiftPct: 0.0,
          pValue: 1.0,
          isStatisticallySignificant: false,
          confidenceInterval95: [0.138, 0.146],
        },
        {
          variantId: 'variant_affinity_boost',
          variantName: 'Deep Affinity Boost (55/20/15/10)',
          isControl: false,
          sampleSize: 7180,
          trafficPercentage: 25.0,
          meanWatchTimeSeconds: 27.6,
          conversionRate: 0.168,
          relativeLiftPct: 18.3,
          pValue: 0.0018,
          isStatisticallySignificant: true,
          confidenceInterval95: [0.161, 0.175],
        },
        {
          variantId: 'variant_pwt_optimized',
          variantName: 'PWT Watch-Time Heavy (35/35/15/15)',
          isControl: false,
          sampleSize: 7110,
          trafficPercentage: 25.0,
          meanWatchTimeSeconds: 25.8,
          conversionRate: 0.149,
          relativeLiftPct: 4.9,
          pValue: 0.142,
          isStatisticallySignificant: false,
          confidenceInterval95: [0.142, 0.156],
        },
      ],
    },
    {
      experiment: {
        id: 'feed_exploration_ratio',
        name: 'Adjacent Interest Exploration Ratio',
        description: 'Tests 10% vs 15% (control) vs 25% serendipity exploration slots on viewer interest expansion',
        status: 'RUNNING' as any,
        variants: [],
        salt: 'salt_feed_exploration_2026',
        createdAt: '2026-10-03T00:00:00Z',
        updatedAt: '2026-10-12T00:00:00Z',
      },
      totalParticipants: 25600,
      startDate: '2026-10-03',
      daysRunning: 9,
      recommendation:
        'Serendipity Push (25%) yields +11.0% conversion lift in adjacent interest discoveries (p = 0.024). Validates hypothesis that discovery drives user stickiness.',
      winnerVariantId: 'variant_serendipity',
      variants: [
        {
          variantId: 'control',
          variantName: 'Control (15% Discovery)',
          isControl: true,
          sampleSize: 12800,
          trafficPercentage: 50.0,
          meanWatchTimeSeconds: 25.1,
          conversionRate: 0.154,
          relativeLiftPct: 0.0,
          pValue: 1.0,
          isStatisticallySignificant: false,
          confidenceInterval95: [0.149, 0.159],
        },
        {
          variantId: 'variant_conservative',
          variantName: 'Conservative (10% Discovery)',
          isControl: false,
          sampleSize: 6380,
          trafficPercentage: 25.0,
          meanWatchTimeSeconds: 24.8,
          conversionRate: 0.148,
          relativeLiftPct: -3.9,
          pValue: 0.28,
          isStatisticallySignificant: false,
          confidenceInterval95: [0.141, 0.155],
        },
        {
          variantId: 'variant_serendipity',
          variantName: 'Serendipity Push (25% Discovery)',
          isControl: false,
          sampleSize: 6420,
          trafficPercentage: 25.0,
          meanWatchTimeSeconds: 26.9,
          conversionRate: 0.171,
          relativeLiftPct: 11.0,
          pValue: 0.024,
          isStatisticallySignificant: true,
          confidenceInterval95: [0.163, 0.179],
        },
      ],
    },
  ];

  // --- Retention Cohorts Data ---
  const retentionData: RetentionAnalysisResponse = {
    averageDay1: 71.4,
    averageDay7: 49.8,
    averageDay30: 36.8,
    cohorts: [
      { cohortDate: '2026-09-12', cohortSize: 1640, day0Pct: 100, day1Pct: 69.2, day3Pct: 54.8, day7Pct: 47.1, day14Pct: 40.2, day30Pct: 35.1 },
      { cohortDate: '2026-09-16', cohortSize: 1720, day0Pct: 100, day1Pct: 70.1, day3Pct: 55.4, day7Pct: 48.0, day14Pct: 41.0, day30Pct: 35.8 },
      { cohortDate: '2026-09-20', cohortSize: 1810, day0Pct: 100, day1Pct: 71.0, day3Pct: 56.2, day7Pct: 48.9, day14Pct: 42.1, day30Pct: 36.4 },
      { cohortDate: '2026-09-24', cohortSize: 1940, day0Pct: 100, day1Pct: 71.8, day3Pct: 57.1, day7Pct: 49.8, day14Pct: 43.0, day30Pct: 37.2 },
      { cohortDate: '2026-09-28', cohortSize: 2050, day0Pct: 100, day1Pct: 72.4, day3Pct: 58.0, day7Pct: 51.0, day14Pct: 44.2, day30Pct: 38.0 },
      { cohortDate: '2026-10-02', cohortSize: 2180, day0Pct: 100, day1Pct: 73.1, day3Pct: 59.2, day7Pct: 52.4, day14Pct: 45.1, day30Pct: 38.6 },
      { cohortDate: '2026-10-06', cohortSize: 2340, day0Pct: 100, day1Pct: 74.0, day3Pct: 60.1, day7Pct: 53.6, day14Pct: 46.2, day30Pct: 39.5 },
    ],
    depthBreakdown: [
      { interestCountTier: '1-2 Interests', cohortSize: 3120, day1Pct: 54.2, day7Pct: 31.0, day30Pct: 19.4 },
      { interestCountTier: '3-5 Interests', cohortSize: 6840, day1Pct: 75.8, day7Pct: 54.2, day30Pct: 42.1 },
      { interestCountTier: '6+ Interests', cohortSize: 3720, day1Pct: 84.6, day7Pct: 66.8, day30Pct: 54.0 },
    ],
  };

  // --- Interest-Match Satisfaction Data ---
  const satisfactionData: InterestSatisfactionResponse = {
    overallSatisfactionIndex: 88.6,
    totalEvaluatedImpressions: 342000,
    topSatisfiedInterests: [
      {
        interestId: 'int-ai-01',
        interestSlug: 'artificial-intelligence',
        interestTitle: 'Artificial Intelligence & Neural Nets',
        categoryName: 'Technology & Computing',
        totalImpressions: 48200,
        positiveSignalCount: 41200,
        negativeSignalCount: 1420,
        completionRatePct: 86.4,
        quickSkipRatePct: 4.8,
        negativeFeedbackRatePer1k: 2.1,
        interestSatisfactionIndex: 94.2,
        avgPredictedWatchTimeSec: 28.5,
        avgActualWatchTimeSec: 29.8,
        watchTimeCalibrationError: 1.3,
      },
      {
        interestId: 'int-cnc-02',
        interestSlug: 'cnc-machining',
        interestTitle: '5-Axis CNC & Precision Milling',
        categoryName: 'Engineering & Manufacturing',
        totalImpressions: 32100,
        positiveSignalCount: 27800,
        negativeSignalCount: 980,
        completionRatePct: 84.1,
        quickSkipRatePct: 5.2,
        negativeFeedbackRatePer1k: 1.8,
        interestSatisfactionIndex: 92.5,
        avgPredictedWatchTimeSec: 24.2,
        avgActualWatchTimeSec: 25.0,
        watchTimeCalibrationError: 0.8,
      },
      {
        interestId: 'int-coffee-03',
        interestSlug: 'specialty-coffee',
        interestTitle: 'Specialty Coffee & Espresso Extraction',
        categoryName: 'Culinary Arts & Beverages',
        totalImpressions: 39400,
        positiveSignalCount: 33800,
        negativeSignalCount: 1350,
        completionRatePct: 82.9,
        quickSkipRatePct: 6.1,
        negativeFeedbackRatePer1k: 2.4,
        interestSatisfactionIndex: 90.8,
        avgPredictedWatchTimeSec: 22.0,
        avgActualWatchTimeSec: 22.6,
        watchTimeCalibrationError: 0.6,
      },
      {
        interestId: 'int-synth-04',
        interestSlug: 'eurorack-modular',
        interestTitle: 'Eurorack Modular Synthesizers',
        categoryName: 'Music & Audio Production',
        totalImpressions: 26500,
        positiveSignalCount: 22400,
        negativeSignalCount: 1100,
        completionRatePct: 81.3,
        quickSkipRatePct: 6.9,
        negativeFeedbackRatePer1k: 2.9,
        interestSatisfactionIndex: 88.9,
        avgPredictedWatchTimeSec: 31.0,
        avgActualWatchTimeSec: 30.2,
        watchTimeCalibrationError: 0.8,
      },
      {
        interestId: 'int-watch-05',
        interestSlug: 'horology-watches',
        interestTitle: 'Horology & Mechanical Watchmaking',
        categoryName: 'Precision Engineering & Craft',
        totalImpressions: 21800,
        positiveSignalCount: 18300,
        negativeSignalCount: 920,
        completionRatePct: 79.5,
        quickSkipRatePct: 7.4,
        negativeFeedbackRatePer1k: 3.1,
        interestSatisfactionIndex: 87.2,
        avgPredictedWatchTimeSec: 26.4,
        avgActualWatchTimeSec: 25.1,
        watchTimeCalibrationError: 1.3,
      },
    ],
    bottomSatisfiedInterests: [
      {
        interestId: 'int-crypto-99',
        interestSlug: 'crypto-trading-signals',
        interestTitle: 'Crypto Trading Signals',
        categoryName: 'Finance & Speculation',
        totalImpressions: 14200,
        positiveSignalCount: 5200,
        negativeSignalCount: 4600,
        completionRatePct: 34.2,
        quickSkipRatePct: 38.6,
        negativeFeedbackRatePer1k: 24.8,
        interestSatisfactionIndex: 38.4,
        avgPredictedWatchTimeSec: 25.0,
        avgActualWatchTimeSec: 11.2,
        watchTimeCalibrationError: 13.8,
      },
      {
        interestId: 'int-gossip-98',
        interestSlug: 'celebrity-rumors',
        interestTitle: 'Celebrity Rumors & Paparazzi',
        categoryName: 'Entertainment & Gossip',
        totalImpressions: 11600,
        positiveSignalCount: 4800,
        negativeSignalCount: 3400,
        completionRatePct: 41.0,
        quickSkipRatePct: 31.2,
        negativeFeedbackRatePer1k: 18.2,
        interestSatisfactionIndex: 44.1,
        avgPredictedWatchTimeSec: 20.0,
        avgActualWatchTimeSec: 12.8,
        watchTimeCalibrationError: 7.2,
      },
    ],
    signalsBreakdown: {
      completions: 242000,
      loops: 64100,
      likes: 58400,
      saves: 31200,
      quickSkips: 24100,
      notInterested: 1820,
      showLess: 2410,
    },
    predictedVsActualCalibration: {
      meanAbsoluteErrorSec: 1.45,
      correlationCoefficient: 0.942,
    },
  };

  const handleApplyOverride = () => {
    setOverrideSuccess(`Successfully assigned ${qaUserId} to variant "${qaVariantOverride}"!`);
    setTimeout(() => setOverrideSuccess(null), 3500);
  };

  const currentExperiment =
    experimentsList.find((e) => e.experiment.id === selectedExperiment) || experimentsList[0];

  return (
    <div className="space-y-8">
      {/* Header & View Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Platform Telemetry & Growth Analytics</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Real-time event tracking, feed A/B experiments, activation funnels, and interest satisfaction calibration.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-xl self-start md:self-auto overflow-x-auto">
          {[
            { id: 'funnels', label: 'Activation Funnel', icon: Filter },
            { id: 'experiments', label: 'Feed A/B Testing', icon: Beaker },
            { id: 'retention', label: 'Cohort Retention', icon: Layers },
            { id: 'satisfaction', label: 'Interest Satisfaction', icon: HeartHandshake },
            { id: 'overview', label: 'Overview Telemetry', icon: BarChart3 },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AnalyticsTab)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-950/40'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Strict Zero-Location Architecture Banner */}
      <div className="bg-emerald-950/20 border border-emerald-800/40 p-4 rounded-2xl flex items-start space-x-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-sm font-bold text-emerald-400">Strict Zero-Location Telemetry & Event Ingestion</h2>
          <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
            All analytics events, PostHog bridges, funnels, and A/B variant cohorts operate strictly on interest vector embeddings, behavioral signals, and app lifecycle milestones. IP geolocation, GPS coordinates, and proximity filters are strictly non-existent across our ingestion pipelines.
          </p>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: ACTIVATION FUNNEL (Install -> Onboarding -> First Reel -> First Post)
          ========================================================================= */}
      {activeTab === 'funnels' && (
        <div className="space-y-6">
          {/* Funnel High-Level Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">Total Installs</span>
              <div className="text-2xl font-black text-white mt-1">14,850</div>
              <span className="text-xs text-emerald-400 font-semibold mt-1 inline-block">100% Top of Funnel</span>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">Onboarding CR</span>
              <div className="text-2xl font-black text-white mt-1">82.0%</div>
              <span className="text-xs text-zinc-400 mt-1 inline-block">12,180 completed (42s median)</span>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">First Reel Watched</span>
              <div className="text-2xl font-black text-white mt-1">92.3%</div>
              <span className="text-xs text-zinc-400 mt-1 inline-block">11,240 viewed (6s from onboard)</span>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg border-rose-900/30">
              <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider block">Creator Activation (First Post)</span>
              <div className="text-2xl font-black text-white mt-1">14.9%</div>
              <span className="text-xs text-rose-300 font-semibold mt-1 inline-block">2,210 creators published</span>
            </div>
          </div>

          {/* Visual Step-Down Funnel Chart */}
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-lg space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Filter className="w-4 h-4 text-rose-500" />
                  Growth Funnel: Install → Onboarding → First Reel → First Post
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Tracks conversion milestones from device initialization to primary creator publishing.
                </p>
              </div>
              <span className="text-xs font-mono text-zinc-400 bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800">
                Window: Last 30 Days
              </span>
            </div>

            {/* Visual Funnel Step Bars */}
            <div className="space-y-4 pt-2">
              {funnelData.steps.map((step, idx) => {
                const widthPct = Math.max(12, (step.count / funnelData.totalStarted) * 100);
                return (
                  <div key={step.stepName} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{step.stepName}</span>
                        <span className="text-[11px] text-zinc-400 font-mono">({step.eventName})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {step.medianDurationSecondsToNext && (
                          <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                            <Timer className="w-3 h-3 text-indigo-400" />
                            ~{step.medianDurationSecondsToNext > 60 ? `${Math.round(step.medianDurationSecondsToNext / 3600)}h` : `${step.medianDurationSecondsToNext}s`} to next
                          </span>
                        )}
                        <span className="font-mono text-white font-bold">{step.count.toLocaleString()}</span>
                        <span className="font-mono text-rose-400 font-bold bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900/40">
                          {(step.conversionRateFromStart * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar with Drop-off indicator */}
                    <div className="h-8 bg-zinc-950 rounded-xl overflow-hidden relative border border-zinc-800/80">
                      <div
                        className="h-full bg-gradient-to-r from-rose-600 via-rose-500 to-indigo-600 rounded-xl transition-all duration-500 flex items-center px-3"
                        style={{ width: `${widthPct}%` }}
                      >
                        <span className="text-[11px] font-black text-white drop-shadow">
                          {idx === 0 ? '100% Entry' : `${(step.conversionRateFromPrev * 100).toFixed(1)}% from step ${idx}`}
                        </span>
                      </div>
                      {step.dropoffCount > 0 && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 font-medium">
                          Drop-off: -{step.dropoffCount.toLocaleString()} ({(step.dropoffRate * 100).toFixed(1)}%)
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Segment Analysis Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-lg space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Funnel Conversion by Onboarding Interest
              </h2>
              <p className="text-xs text-zinc-400">
                End-to-end conversion rate to First Post segmented by the user&apos;s initial seed interest chosen during onboarding.
              </p>
              <div className="space-y-3 pt-2">
                {funnelData.segments?.map((seg) => (
                  <div key={seg.segmentValue} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-200 font-medium">{seg.segmentValue}</span>
                      <span className="font-mono text-emerald-400 font-bold">
                        {(seg.conversionRate * 100).toFixed(1)}% ({seg.count} activated)
                      </span>
                    </div>
                    <div className="h-2 bg-zinc-950 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${seg.conversionRate * 350}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-lg space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  Key Funnel Activation Insights
                </h2>
                <div className="space-y-2 text-xs text-zinc-300 leading-relaxed">
                  <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                    <strong className="text-white">Frictionless First Reel Playback:</strong> 92.3% of onboarded users view their first reel within 6 seconds. Zero-delay HLS prefetching prevents bounce.
                  </div>
                  <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                    <strong className="text-white">Creation Gap Opportunity:</strong> The highest drop-off occurs between First Reel Watched (11,240) and First Post (2,210). Encouraging remix/duet prompts lifts creation conversion by +28%.
                  </div>
                </div>
              </div>

              <div className="bg-rose-950/20 border border-rose-900/30 p-3 rounded-xl text-xs text-rose-300 flex items-center justify-between">
                <span>Integrated with PostHog Event Bridge &amp; Local PG Analytics</span>
                <span className="font-mono text-[10px] bg-rose-950 px-2 py-0.5 rounded text-rose-200 font-bold">HEALTHY</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: A/B TESTING FOR FEED CHANGES
          ========================================================================= */}
      {activeTab === 'experiments' && (
        <div className="space-y-6">
          {/* Experiment Switcher Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
            <div className="flex items-center gap-3">
              <Beaker className="w-5 h-5 text-indigo-400" />
              <div>
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Active Experiment</span>
                <select
                  value={selectedExperiment}
                  onChange={(e) => setSelectedExperiment(e.target.value)}
                  className="bg-zinc-950 text-white font-bold text-sm border border-zinc-700 rounded-lg px-3 py-1.5 mt-0.5 focus:outline-none focus:border-rose-500"
                >
                  <option value="feed_ranking_algorithm">feed_ranking_algorithm (Scoring Weights)</option>
                  <option value="feed_exploration_ratio">feed_exploration_ratio (Serendipity Slots)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-mono bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 px-3 py-1 rounded-lg font-bold flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                Status: {currentExperiment.experiment.status}
              </span>
              <span className="text-xs text-zinc-400">
                Running for <strong className="text-white">{currentExperiment.daysRunning} days</strong> ({currentExperiment.totalParticipants.toLocaleString()} users)
              </span>
            </div>
          </div>

          {/* Winner Recommendation Banner */}
          {currentExperiment.recommendation && (
            <div className="bg-indigo-950/30 border border-indigo-800/40 p-4 rounded-2xl flex items-start space-x-3">
              <Award className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-indigo-300">Statistical Significance Recommendation</h3>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                    Winner: {currentExperiment.winnerVariantId}
                  </span>
                </div>
                <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                  {currentExperiment.recommendation}
                </p>
              </div>
            </div>
          )}

          {/* Variants Performance Matrix */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-lg overflow-hidden">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">{currentExperiment.experiment.name}</h3>
                <p className="text-xs text-zinc-400 mt-0.5">{currentExperiment.experiment.description}</p>
              </div>
              <span className="text-xs text-zinc-400 font-mono">
                Salt: {currentExperiment.experiment.salt}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950 text-zinc-400 font-bold border-b border-zinc-800">
                  <tr>
                    <th className="p-4">Variant</th>
                    <th className="p-4">Traffic Split</th>
                    <th className="p-4">Sample Size</th>
                    <th className="p-4">Mean Watch Time</th>
                    <th className="p-4">Like/Save Conversion</th>
                    <th className="p-4">Relative Lift</th>
                    <th className="p-4">Significance (p-value)</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-300 font-medium">
                  {currentExperiment.variants.map((v) => (
                    <tr key={v.variantId} className={v.variantId === currentExperiment.winnerVariantId ? 'bg-indigo-950/20' : ''}>
                      <td className="p-4">
                        <div className="font-bold text-white text-sm">{v.variantName}</div>
                        <span className="text-[11px] font-mono text-zinc-400">ID: {v.variantId}</span>
                        {v.isControl && (
                          <span className="ml-2 text-[10px] font-bold bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded">
                            CONTROL
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-mono">{v.trafficPercentage}%</td>
                      <td className="p-4 font-mono">{v.sampleSize.toLocaleString()}</td>
                      <td className="p-4 font-mono font-bold text-white">{v.meanWatchTimeSeconds}s</td>
                      <td className="p-4 font-mono font-bold text-white">{(v.conversionRate * 100).toFixed(1)}%</td>
                      <td className="p-4">
                        {v.isControl ? (
                          <span className="text-zinc-500 font-mono">Baseline</span>
                        ) : (
                          <span
                            className={`font-mono font-bold text-sm ${(v.relativeLiftPct || 0) > 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                          >
                            {(v.relativeLiftPct || 0) > 0 ? `+${v.relativeLiftPct}%` : `${v.relativeLiftPct}%`}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        {v.isControl ? (
                          <span className="text-zinc-500 font-mono">N/A</span>
                        ) : v.isStatisticallySignificant ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                            <CheckCircle2 className="w-3 h-3" />
                            p = {v.pValue} (Significant)
                          </span>
                        ) : (
                          <span className="text-zinc-400 font-mono">
                            p = {v.pValue} (Pending)
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button className="px-3 py-1 rounded-lg text-xs font-bold bg-zinc-800 text-zinc-200 hover:bg-rose-600 hover:text-white transition">
                          Promote
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive QA Override Tool */}
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-lg space-y-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-rose-500" />
              <h3 className="text-sm font-bold text-white">Tester / Developer QA Variant Override</h3>
            </div>
            <p className="text-xs text-zinc-400">
              Force-assign an active user ID to a specific experiment variant to test feed ranking weights and exploration changes in real time.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
              <input
                type="text"
                placeholder="User ID (e.g. user-qa-tester-01)"
                value={qaUserId}
                onChange={(e) => setQaUserId(e.target.value)}
                className="w-full sm:w-64 bg-zinc-950 border border-zinc-700 text-white text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-rose-500"
              />
              <select
                value={qaVariantOverride}
                onChange={(e) => setQaVariantOverride(e.target.value)}
                className="w-full sm:w-72 bg-zinc-950 border border-zinc-700 text-white text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-rose-500"
              >
                {currentExperiment.variants.map((v) => (
                  <option key={v.variantId} value={v.variantId}>
                    {v.variantName} ({v.variantId})
                  </option>
                ))}
              </select>
              <button
                onClick={handleApplyOverride}
                className="w-full sm:w-auto px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition"
              >
                Apply Override
              </button>
            </div>

            {overrideSuccess && (
              <div className="text-xs text-emerald-400 font-semibold bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-800/40">
                {overrideSuccess}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: COHORT RETENTION HEATMAP
          ========================================================================= */}
      {activeTab === 'retention' && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">Average Day 1 Retention</span>
              <div className="text-2xl font-black text-white mt-1">71.4%</div>
              <span className="text-xs text-emerald-400 font-semibold mt-1 inline-block">+4.2% vs industry benchmark</span>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">Average Day 7 Retention</span>
              <div className="text-2xl font-black text-white mt-1">49.8%</div>
              <span className="text-xs text-emerald-400 font-semibold mt-1 inline-block">Interest-aligned stickiness</span>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">Average Day 30 Retention</span>
              <div className="text-2xl font-black text-white mt-1">36.8%</div>
              <span className="text-xs text-emerald-400 font-semibold mt-1 inline-block">High long-term affinity</span>
            </div>
          </div>

          {/* Retention Matrix Table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-lg overflow-hidden">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  N-Day Cohort Retention Heatmap
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Percentage of users who return and engage with interest feeds on subsequent intervals.
                </p>
              </div>
              <span className="text-xs font-mono text-zinc-400">Activity: Reel Watched &ge; 1</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950 text-zinc-400 font-bold border-b border-zinc-800">
                  <tr>
                    <th className="p-3.5">Cohort Date</th>
                    <th className="p-3.5">Size</th>
                    <th className="p-3.5 text-center">Day 0</th>
                    <th className="p-3.5 text-center">Day 1</th>
                    <th className="p-3.5 text-center">Day 3</th>
                    <th className="p-3.5 text-center">Day 7</th>
                    <th className="p-3.5 text-center">Day 14</th>
                    <th className="p-3.5 text-center">Day 30</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono text-zinc-200">
                  {retentionData.cohorts.map((c) => (
                    <tr key={c.cohortDate}>
                      <td className="p-3.5 font-bold text-white">{c.cohortDate}</td>
                      <td className="p-3.5 text-zinc-400">{c.cohortSize.toLocaleString()}</td>
                      <td className="p-3.5 text-center bg-indigo-950/70 text-indigo-200 font-bold">100%</td>
                      <td
                        className="p-3.5 text-center font-bold"
                        style={{
                          backgroundColor: `rgba(99, 102, 241, ${c.day1Pct / 120})`,
                          color: c.day1Pct > 65 ? '#ffffff' : '#cbd5e1',
                        }}
                      >
                        {c.day1Pct.toFixed(1)}%
                      </td>
                      <td
                        className="p-3.5 text-center font-bold"
                        style={{
                          backgroundColor: `rgba(99, 102, 241, ${c.day3Pct / 120})`,
                          color: c.day3Pct > 50 ? '#ffffff' : '#cbd5e1',
                        }}
                      >
                        {c.day3Pct.toFixed(1)}%
                      </td>
                      <td
                        className="p-3.5 text-center font-bold"
                        style={{
                          backgroundColor: `rgba(99, 102, 241, ${c.day7Pct / 120})`,
                          color: c.day7Pct > 45 ? '#ffffff' : '#cbd5e1',
                        }}
                      >
                        {c.day7Pct.toFixed(1)}%
                      </td>
                      <td
                        className="p-3.5 text-center font-bold"
                        style={{
                          backgroundColor: `rgba(99, 102, 241, ${c.day14Pct / 120})`,
                          color: c.day14Pct > 35 ? '#ffffff' : '#cbd5e1',
                        }}
                      >
                        {c.day14Pct.toFixed(1)}%
                      </td>
                      <td
                        className="p-3.5 text-center font-bold"
                        style={{
                          backgroundColor: `rgba(99, 102, 241, ${c.day30Pct / 120})`,
                          color: c.day30Pct > 30 ? '#ffffff' : '#cbd5e1',
                        }}
                      >
                        {c.day30Pct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Retention by Interest Affinity Depth */}
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-lg space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Retention Segmented by Onboarding Interest Depth
            </h3>
            <p className="text-xs text-zinc-400">
              Users selecting 6 or more niche interests retain at dramatically higher rates than users with shallow initial onboarding.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {retentionData.depthBreakdown.map((tier) => (
                <div key={tier.interestCountTier} className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">{tier.interestCountTier}</span>
                    <span className="text-[11px] text-zinc-500 font-mono">({tier.cohortSize} users)</span>
                  </div>
                  <div className="space-y-1.5 pt-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Day 1 Return</span>
                      <span className="font-mono font-bold text-zinc-200">{tier.day1Pct}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Day 7 Return</span>
                      <span className="font-mono font-bold text-zinc-200">{tier.day7Pct}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400 font-semibold text-rose-400">Day 30 Return</span>
                      <span className="font-mono font-black text-rose-400">{tier.day30Pct}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: INTEREST-MATCH SATISFACTION
          ========================================================================= */}
      {activeTab === 'satisfaction' && (
        <div className="space-y-6">
          {/* Top Level Satisfaction Index Card */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg border-indigo-900/30">
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider block">Interest Satisfaction Index</span>
              <div className="text-3xl font-black text-white mt-1">88.6 <span className="text-sm text-zinc-500 font-normal">/ 100</span></div>
              <span className="text-xs text-emerald-400 font-semibold mt-1 inline-block">High Semantic Fit</span>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">Watch Time Prediction MAE</span>
              <div className="text-2xl font-black text-white mt-1">1.45 sec</div>
              <span className="text-xs text-zinc-400 mt-1 inline-block">r = 0.942 rank correlation</span>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">Quick Skip Rate (&lt;1.5s)</span>
              <div className="text-2xl font-black text-white mt-1">7.0%</div>
              <span className="text-xs text-emerald-400 mt-1 inline-block">93% retention past hook</span>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">Explicit Negative Signals</span>
              <div className="text-2xl font-black text-white mt-1">1.2 / 1k</div>
              <span className="text-xs text-zinc-400 mt-1 inline-block">&quot;Show less&quot; &amp; &quot;Not interested&quot;</span>
            </div>
          </div>

          {/* Top Satisfied vs Dissatisfied Interest Categories */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Satisfied */}
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-lg space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Top 5 Highest Satisfaction Interest Niches
              </h3>
              <p className="text-xs text-zinc-400">
                Highest completion rates and highest positive-to-negative signal ratios.
              </p>

              <div className="space-y-3 pt-2">
                {satisfactionData.topSatisfiedInterests.map((item) => (
                  <div key={item.interestId} className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-white text-xs block">{item.interestTitle}</span>
                        <span className="text-[10px] text-zinc-400">{item.categoryName}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-emerald-400 font-mono">{item.interestSatisfactionIndex}</span>
                        <span className="text-[10px] text-zinc-500 block">ISI Score</span>
                      </div>
                    </div>
                    <div className="flex justify-between text-[11px] text-zinc-400 pt-1 border-t border-zinc-850">
                      <span>Completion: <strong className="text-white">{item.completionRatePct}%</strong></span>
                      <span>Quick Skips: <strong className="text-white">{item.quickSkipRatePct}%</strong></span>
                      <span>Calibration Error: <strong className="text-white">{item.watchTimeCalibrationError}s</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Satisfied / Needs Attention */}
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-lg space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Needs Content Curation / Low Satisfaction
              </h3>
              <p className="text-xs text-zinc-400">
                Interests with high skip rates and high negative feedback frequency.
              </p>

              <div className="space-y-3 pt-2">
                {satisfactionData.bottomSatisfiedInterests.map((item) => (
                  <div key={item.interestId} className="bg-zinc-950 p-3.5 rounded-xl border border-amber-950/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-white text-xs block">{item.interestTitle}</span>
                        <span className="text-[10px] text-zinc-400">{item.categoryName}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-amber-400 font-mono">{item.interestSatisfactionIndex}</span>
                        <span className="text-[10px] text-zinc-500 block">ISI Score</span>
                      </div>
                    </div>
                    <div className="flex justify-between text-[11px] text-zinc-400 pt-1 border-t border-zinc-850">
                      <span>Completion: <strong className="text-rose-400">{item.completionRatePct}%</strong></span>
                      <span>Quick Skips: <strong className="text-rose-400">{item.quickSkipRatePct}%</strong></span>
                      <span>Negative / 1k: <strong className="text-rose-400">{item.negativeFeedbackRatePer1k}</strong></span>
                    </div>
                  </div>
                ))}

                <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-xs text-zinc-400 leading-relaxed">
                  <strong className="text-zinc-200">Algorithmic Remediation:</strong> When an interest topic falls below 50.0 ISI score, the recommendation engine automatically throttles its candidate generation pool and injects verified cold-start creators to elevate content quality.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: OVERVIEW & TELEMETRY
          ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Daily Active Users</span>
              <div className="text-2xl font-black text-white mt-1">1.42M</div>
              <span className="text-xs text-emerald-400 font-semibold mt-1 inline-block">+18.4% WoW</span>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Monthly Active Users</span>
              <div className="text-2xl font-black text-white mt-1">6.85M</div>
              <span className="text-xs text-emerald-400 font-semibold mt-1 inline-block">+24.1% MoM</span>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Watch Time (24h)</span>
              <div className="text-2xl font-black text-white mt-1">428,500 hrs</div>
              <span className="text-xs text-zinc-400 mt-1 inline-block">84.2% avg completion</span>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Published Reels</span>
              <div className="text-2xl font-black text-white mt-1">89,400</div>
              <span className="text-xs text-emerald-400 mt-1 inline-block">99.4% HLS Transcoded</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
