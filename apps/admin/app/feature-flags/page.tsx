'use client';

import React, { useState } from 'react';
import {
  SlidersHorizontal,
  ShieldCheck,
  Check,
  X,
  RefreshCw,
  Sparkles,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { useAdminAuth, AdminPermission } from '../../lib/rbac';
import { auditManager } from '../../lib/audit';

interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  environment: 'PRODUCTION' | 'STAGING' | 'ALL';
  audience: 'ALL_USERS' | 'CREATORS_ONLY' | 'BETA_TESTERS';
  lastModifiedBy: string;
}

const mockFlags: FeatureFlag[] = [
  {
    key: 'STRICT_ZERO_LOCATION_CI',
    name: 'Strict Zero-Location Runtime Invariant',
    description: 'Enforces zero-location validation on feed candidate generation and analytics telemetry.',
    enabled: true,
    rolloutPercentage: 100,
    environment: 'ALL',
    audience: 'ALL_USERS',
    lastModifiedBy: 'Alex Rivera',
  },
  {
    key: 'CREATOR_FUND_V2',
    name: 'Watch-Time Creator Fund Engine',
    description: 'Enables daily and monthly pool payouts based on qualified watch time from interest audiences.',
    enabled: true,
    rolloutPercentage: 100,
    environment: 'PRODUCTION',
    audience: 'CREATORS_ONLY',
    lastModifiedBy: 'Marcus Vance',
  },
  {
    key: 'AI_TAG_AUTO_SUGGEST',
    name: 'AI Video Interest Tag Auto-Suggest',
    description: 'Automatically analyzes video transcripts with Gemini models to suggest 1-5 interest taxonomy nodes.',
    enabled: true,
    rolloutPercentage: 80,
    environment: 'PRODUCTION',
    audience: 'CREATORS_ONLY',
    lastModifiedBy: 'Sarah Chen',
  },
  {
    key: 'E2EE_GROUP_DMS',
    name: 'End-to-End Encrypted Group DMs',
    description: 'Multi-party Double Ratchet protocol for group chats and disappearing messages.',
    enabled: false,
    rolloutPercentage: 20,
    environment: 'STAGING',
    audience: 'BETA_TESTERS',
    lastModifiedBy: 'Alex Rivera',
  },
  {
    key: 'HLS_1080P_BITRATE',
    name: '1080p High-Bitrate HLS Transcoding',
    description: 'Generates 1080p adaptive bitrate streams for high-bandwidth devices.',
    enabled: true,
    rolloutPercentage: 100,
    environment: 'PRODUCTION',
    audience: 'ALL_USERS',
    lastModifiedBy: 'David Rao',
  },
  {
    key: 'PAID_COMMUNITIES',
    name: 'Paid Interest Micro-Communities',
    description: 'Allows creators to launch recurring or lifetime membership gated spaces around interests.',
    enabled: true,
    rolloutPercentage: 50,
    environment: 'PRODUCTION',
    audience: 'ALL_USERS',
    lastModifiedBy: 'Marcus Vance',
  },
];

export default function FeatureFlagsPage() {
  const { admin, hasPermission } = useAdminAuth();
  const [flags, setFlags] = useState<FeatureFlag[]>(mockFlags);

  const canManage = hasPermission(AdminPermission.MANAGE_FEATURE_FLAGS);

  const handleToggle = (key: string) => {
    if (!canManage) return;

    setFlags((prev) =>
      prev.map((f) => {
        if (f.key !== key) return f;
        const nextEnabled = !f.enabled;

        auditManager.recordLog({
          actorName: admin.name,
          actorRole: admin.role,
          action: 'FLAG_TOGGLED',
          targetEntity: `FeatureFlag: ${f.key}`,
          details: `Toggled state to ${nextEnabled ? 'ENABLED' : 'DISABLED'}.`,
          diff: { before: { enabled: f.enabled }, after: { enabled: nextEnabled } },
        });

        return {
          ...f,
          enabled: nextEnabled,
          lastModifiedBy: admin.name,
        };
      }),
    );
  };

  const handleRolloutChange = (key: string, newRollout: number) => {
    if (!canManage) return;

    setFlags((prev) =>
      prev.map((f) => {
        if (f.key !== key) return f;
        return {
          ...f,
          rolloutPercentage: newRollout,
          lastModifiedBy: admin.name,
        };
      }),
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Feature Flags & Rollouts</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Dynamically toggle system features, configure Canary rollouts, and govern platform capabilities in real time.
        </p>
      </div>

      {/* Flags List */}
      <div className="space-y-4">
        {flags.map((flag) => (
          <div
            key={flag.key}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-lg"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs font-bold text-rose-400 bg-rose-950/60 border border-rose-800/60 px-2 py-0.5 rounded">
                    {flag.key}
                  </span>
                  <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded font-mono">
                    {flag.environment}
                  </span>
                  <span className="text-xs bg-zinc-800 text-indigo-300 px-2 py-0.5 rounded font-mono">
                    {flag.audience}
                  </span>
                </div>
                <h3 className="font-bold text-white text-base mt-2">{flag.name}</h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-2xl">{flag.description}</p>
              </div>

              {/* Toggle Switch */}
              <div className="flex items-center space-x-3 shrink-0">
                <span
                  className={`text-xs font-bold uppercase tracking-wider ${
                    flag.enabled ? 'text-emerald-400' : 'text-zinc-500'
                  }`}
                >
                  {flag.enabled ? 'Active' : 'Disabled'}
                </span>
                <button
                  onClick={() => handleToggle(flag.key)}
                  disabled={!canManage}
                  className={`w-12 h-6 rounded-full transition relative p-0.5 ${
                    flag.enabled ? 'bg-emerald-600' : 'bg-zinc-700'
                  } ${!canManage ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition transform ${
                      flag.enabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Rollout Slider */}
            {flag.enabled && (
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400 font-semibold">Canary Rollout Percentage:</span>
                  <span className="font-mono font-bold text-white">{flag.rolloutPercentage}% of users</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={flag.rolloutPercentage}
                  onChange={(e) => handleRolloutChange(flag.key, parseInt(e.target.value, 10))}
                  disabled={!canManage}
                  className="w-full accent-rose-500 cursor-pointer disabled:cursor-not-allowed"
                />
              </div>
            )}

            <div className="text-[11px] text-zinc-500 font-mono">
              Last modified by: <span className="text-zinc-400">{flag.lastModifiedBy}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
