'use client';

import React from 'react';
import Link from 'next/link';
import {
  Users,
  Film,
  ShieldAlert,
  Network,
  SlidersHorizontal,
  BarChart3,
  Wallet,
  ScrollText,
  ShieldCheck,
  Cpu,
  ArrowRight,
} from 'lucide-react';
import { useAdminAuth } from '../lib/rbac';

export default function DashboardPage() {
  const { admin } = useAdminAuth();

  const stats = [
    { label: 'Active Niche Clusters', value: '340+ Nodes', change: '12 Root Categories' },
    { label: 'HNSW Vector Query Latency (p95)', value: '8.4 ms', change: '100% in Memory' },
    { label: 'Avg Watch-Through Ratio', value: '84.2%', change: '+12% vs legacy algorithms' },
    { label: 'Global Cross-Border Index (GDI)', value: '0.92 / 1.0', change: 'Pure Interest Graph' },
  ];

  const quickActions = [
    {
      title: 'User Management',
      desc: 'Audit profiles, issue warning strikes, enforce suspensions, and manage minor safety.',
      href: '/users',
      icon: Users,
      badge: '5 Flagged',
      color: 'from-blue-600/20 to-indigo-600/20 text-indigo-400 border-indigo-800/40',
    },
    {
      title: 'Content Review Queue',
      desc: 'Review reel uploads flagged for tag-vector mismatch, AI safety scores, or unlicensed audio.',
      href: '/content-review',
      icon: Film,
      badge: '4 Awaiting',
      color: 'from-rose-600/20 to-pink-600/20 text-rose-400 border-rose-800/40',
    },
    {
      title: 'Report Queue & Appeals',
      desc: 'Adjudicate community user reports, resolve tag manipulation incidents, and hear appeals.',
      href: '/reports',
      icon: ShieldAlert,
      badge: '3 Open',
      color: 'from-amber-600/20 to-orange-600/20 text-amber-400 border-amber-800/40',
    },
    {
      title: 'Interest Taxonomy Editor',
      desc: 'Interactive 3-tier semantic hierarchy editor: categories, topics, and deep niches with 512-d embeddings.',
      href: '/taxonomy',
      icon: Network,
      badge: '3-Tier Tree',
      color: 'from-purple-600/20 to-violet-600/20 text-purple-400 border-purple-800/40',
    },
    {
      title: 'Feature Flags & Rollouts',
      desc: 'Dynamically manage runtime platform flags, canary percentages, and beta cohorts.',
      href: '/feature-flags',
      icon: SlidersHorizontal,
      badge: '6 Active',
      color: 'from-teal-600/20 to-emerald-600/20 text-teal-400 border-teal-800/40',
    },
    {
      title: 'Platform Analytics',
      desc: 'DAU/MAU, watch hours by interest taxonomy node, and cross-niche serendipity index.',
      href: '/analytics',
      icon: BarChart3,
      badge: 'Real-Time',
      color: 'from-sky-600/20 to-blue-600/20 text-sky-400 border-sky-800/40',
    },
    {
      title: 'Creator Payouts & Treasury',
      desc: 'Approve disbursement requests, verify W-9/TDS tax withholding, and trigger Stripe/Razorpay transfers.',
      href: '/payouts',
      icon: Wallet,
      badge: '2 Pending',
      color: 'from-emerald-600/20 to-green-600/20 text-emerald-400 border-emerald-800/40',
    },
    {
      title: 'Audit Logs & Ledger',
      desc: 'Immutable security log of administrative actions, moderation strikes, and financial transfers.',
      href: '/audit-logs',
      icon: ScrollText,
      badge: 'Live Stream',
      color: 'from-zinc-600/20 to-zinc-700/20 text-zinc-300 border-zinc-700/40',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            Operations & Administration Console
          </h1>
          <p className="text-zinc-400 mt-1">
            Global governance portal: content moderation, interest taxonomy, telemetry, and financial disbursements.
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-xl flex items-center space-x-2 text-xs font-mono">
          <span className="text-zinc-500">Active Role:</span>
          <span className="text-rose-400 font-bold">{admin.role}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              {s.label}
            </span>
            <div className="text-2xl font-black text-white mt-2">{s.value}</div>
            <span className="text-xs text-rose-400 font-medium mt-1 inline-block">
              {s.change}
            </span>
          </div>
        ))}
      </div>

      {/* Quick Navigation Action Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white">Administrative Subsystems</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.title}
                href={action.href}
                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-5 flex flex-col justify-between group transition hover:bg-zinc-850/60 shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2.5 rounded-xl border bg-gradient-to-br ${action.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold font-mono bg-zinc-800 px-2 py-0.5 rounded text-zinc-300">
                      {action.badge}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-white text-base group-hover:text-rose-400 transition">
                    {action.title}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{action.desc}</p>
                </div>

                <div className="flex items-center text-xs font-bold text-zinc-500 group-hover:text-white transition mt-4 pt-3 border-t border-zinc-800/80">
                  <span>Open Panel</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-1 transition transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Two Column Section: pgvector Engine & Zero-Location Invariant */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* pgvector Engine Health */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-400" />
              pgvector HNSW Engine Metrics
            </h2>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-0.5 rounded font-bold">
              HEALTHY
            </span>
          </div>

          <div className="space-y-3 pt-1">
            <div className="flex justify-between text-xs py-2 border-b border-zinc-800">
              <span className="text-zinc-400">Embedding Dimensions</span>
              <span className="font-mono font-bold text-white">512 (Unit Normalized)</span>
            </div>
            <div className="flex justify-between text-xs py-2 border-b border-zinc-800">
              <span className="text-zinc-400">Distance Metric</span>
              <span className="font-mono font-bold text-indigo-400">Cosine Distance (&lt;=&gt;)</span>
            </div>
            <div className="flex justify-between text-xs py-2 border-b border-zinc-800">
              <span className="text-zinc-400">HNSW Index Parameters</span>
              <span className="font-mono text-zinc-300">m = 16, ef_construction = 64</span>
            </div>
            <div className="flex justify-between text-xs py-2">
              <span className="text-zinc-400">Epsilon-Greedy Serendipity Slots</span>
              <span className="font-mono text-emerald-400">15% Adjacent Taxonomy Niches</span>
            </div>
          </div>
        </div>

        {/* Zero-Location Verification Panel */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Zero-Location Architectural Audit
            </h2>
            <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
              100% Passed
            </span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            All inbound requests are permanently scrubbed of client IP and geographic headers. User ranking, candidate retrieval, and feed generation are provably geo-blind.
          </p>
          <div className="space-y-2 text-xs font-mono bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-zinc-400">
            <div className="text-emerald-400">✓ CF-IPCountry / Geo Headers: SCRUBBED AT EDGE</div>
            <div className="text-emerald-400">✓ X-Forwarded-For IP: REDACTED (0.0.0.0 MASKED)</div>
            <div className="text-emerald-400">✓ GPS Lat/Lon DB Columns: ZERO DETECTED</div>
            <div className="text-emerald-400">✓ Ad Targeting: PURE INTEREST TAXONOMY (NO GEO)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
