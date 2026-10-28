'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCcw,
  MessageSquare,
  Film,
  User,
  Gavel,
} from 'lucide-react';
import { useAdminAuth, AdminPermission } from '../../lib/rbac';
import { auditManager } from '../../lib/audit';

interface ReportItem {
  id: string;
  entityType: 'REEL' | 'COMMENT' | 'USER' | 'MESSAGE';
  entitySummary: string;
  creatorHandle: string;
  reporterHandle: string;
  reason: 'TAG_MANIPULATION' | 'SPAM' | 'NUDITY' | 'HATE_SPEECH' | 'COPYRIGHT' | 'HARASSMENT';
  details: string;
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  reportedAt: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface AppealItem {
  id: string;
  appellantHandle: string;
  entityType: string;
  entitySummary: string;
  strikeReason: string;
  appealStatement: string;
  status: 'PENDING' | 'GRANTED' | 'DENIED';
  submittedAt: string;
}

const mockReports: ReportItem[] = [
  {
    id: 'rep_101',
    entityType: 'REEL',
    entitySummary: 'Dropshipping Hacks in Tokyo [Reel #8812]',
    creatorHandle: '@fast_dropship',
    reporterHandle: '@curator_fan',
    reason: 'TAG_MANIPULATION',
    details: 'Video tags Astrophysics & Rocketry despite being an Amazon FBA affiliate advertisement.',
    status: 'OPEN',
    reportedAt: '15 mins ago',
    severity: 'HIGH',
  },
  {
    id: 'rep_102',
    entityType: 'COMMENT',
    entitySummary: 'Comment: "Check bio for 1000% crypto multiplier" [Reel #4210]',
    creatorHandle: '@bot_army_02',
    reporterHandle: '@synth_nerd',
    reason: 'SPAM',
    details: 'Coordinated bot network comment flood on synthesizer tutorial reels.',
    status: 'OPEN',
    reportedAt: '35 mins ago',
    severity: 'HIGH',
  },
  {
    id: 'rep_103',
    entityType: 'REEL',
    entitySummary: 'High-Power Laser Diode Burning Wood [Reel #9100]',
    creatorHandle: '@maker_lab',
    reporterHandle: '@safety_first',
    reason: 'HARASSMENT',
    details: 'User claims lack of eye safety warning constitutes hazardous demonstration.',
    status: 'OPEN',
    reportedAt: '1 hour ago',
    severity: 'LOW',
  },
];

const mockAppeals: AppealItem[] = [
  {
    id: 'app_201',
    appellantHandle: '@synth_flow',
    entityType: 'REEL',
    entitySummary: 'Beginner Synth Patching Techniques',
    strikeReason: 'Tag Manipulation Strike',
    appealStatement:
      'I accidentally selected Horology from the dropdown menu when typing sound design tags. It was a UI mis-click, not intentional spam. Please reinstate!',
    status: 'PENDING',
    submittedAt: '2 hours ago',
  },
  {
    id: 'app_202',
    appellantHandle: '@cnc_machinist',
    entityType: 'REEL',
    entitySummary: 'Titanium Impeller 5-Axis Milling Run',
    strikeReason: 'Commercial Watermark Strike',
    appealStatement:
      'The watermark is my registered CNC shop logo, not an affiliate link or external promotion. All equipment shown is in my workshop.',
    status: 'PENDING',
    submittedAt: '4 hours ago',
  },
];

export default function ReportQueuePage() {
  const { admin, hasPermission } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<'REPORTS' | 'APPEALS'>('REPORTS');
  const [reports, setReports] = useState<ReportItem[]>(mockReports);
  const [appeals, setAppeals] = useState<AppealItem[]>(mockAppeals);

  const canManage = hasPermission(AdminPermission.MANAGE_REPORTS);

  const handleResolveReport = (report: ReportItem, action: 'STRIKE' | 'DISMISS') => {
    setReports((prev) =>
      prev.map((r) =>
        r.id === report.id
          ? { ...r, status: action === 'STRIKE' ? 'RESOLVED' : 'DISMISSED' }
          : r,
      ),
    );

    auditManager.recordLog({
      actorName: admin.name,
      actorRole: admin.role,
      action: action === 'STRIKE' ? 'REPORT_RESOLVED_STRIKE' : 'REPORT_DISMISSED',
      targetEntity: `Report: ${report.id} on ${report.creatorHandle}`,
      details:
        action === 'STRIKE'
          ? `Issued formal moderation strike and removed violating content. Reason: ${report.reason}`
          : 'Dismissed report as benign/non-violating.',
    });
  };

  const handleResolveAppeal = (appeal: AppealItem, decision: 'GRANTED' | 'DENIED') => {
    setAppeals((prev) =>
      prev.map((a) => (a.id === appeal.id ? { ...a, status: decision } : a)),
    );

    auditManager.recordLog({
      actorName: admin.name,
      actorRole: admin.role,
      action: decision === 'GRANTED' ? 'APPEAL_GRANTED' : 'APPEAL_DENIED',
      targetEntity: `Appeal: ${appeal.id} by ${appeal.appellantHandle}`,
      details:
        decision === 'GRANTED'
          ? 'Appeal upheld. Moderation strike reversed and content restored.'
          : 'Appeal denied. Original moderation strike maintained.',
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Subtitle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Trust & Safety Queue</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Review community incident reports, enforce moderation SLAs, and adjudicate creator appeals.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 p-1.5 rounded-xl">
          <button
            onClick={() => setActiveTab('REPORTS')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${
              activeTab === 'REPORTS'
                ? 'bg-rose-500 text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Incident Reports ({reports.filter((r) => r.status === 'OPEN').length})
          </button>
          <button
            onClick={() => setActiveTab('APPEALS')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${
              activeTab === 'APPEALS'
                ? 'bg-rose-500 text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Appeals Queue ({appeals.filter((a) => a.status === 'PENDING').length})
          </button>
        </div>
      </div>

      {/* INCIDENT REPORTS TAB */}
      {activeTab === 'REPORTS' && (
        <div className="space-y-4">
          {reports.map((report) => (
            <div
              key={report.id}
              className={`bg-zinc-900 border rounded-2xl p-6 transition flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                report.status === 'OPEN'
                  ? 'border-zinc-800'
                  : 'border-zinc-850 opacity-60 bg-zinc-950/40'
              }`}
            >
              <div className="space-y-2 flex-1">
                <div className="flex items-center space-x-2">
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      report.severity === 'HIGH'
                        ? 'bg-rose-950 text-rose-400 border border-rose-800'
                        : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}
                  >
                    {report.reason.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-zinc-500 font-mono">{report.reportedAt}</span>
                  <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded font-mono">
                    {report.entityType}
                  </span>
                </div>

                <h3 className="font-bold text-white text-base">{report.entitySummary}</h3>
                <p className="text-xs text-zinc-400">{report.details}</p>

                <div className="flex items-center space-x-4 text-xs text-zinc-500 pt-1">
                  <span>
                    Creator: <strong className="text-zinc-300">{report.creatorHandle}</strong>
                  </span>
                  <span>
                    Reported by: <span className="text-zinc-400">{report.reporterHandle}</span>
                  </span>
                </div>
              </div>

              {canManage && report.status === 'OPEN' && (
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => handleResolveReport(report, 'DISMISS')}
                    className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4 text-zinc-400" />
                    Dismiss
                  </button>
                  <button
                    onClick={() => handleResolveReport(report, 'STRIKE')}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-rose-900/40 flex items-center gap-1.5"
                  >
                    <Gavel className="w-4 h-4" />
                    Strike & Remove
                  </button>
                </div>
              )}

              {report.status !== 'OPEN' && (
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Resolved: {report.status}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* APPEALS QUEUE TAB */}
      {activeTab === 'APPEALS' && (
        <div className="space-y-4">
          {appeals.map((appeal) => (
            <div
              key={appeal.id}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center space-x-2">
                  <RotateCcw className="w-4 h-4 text-indigo-400" />
                  <span className="font-bold text-white text-sm">
                    Appeal from {appeal.appellantHandle}
                  </span>
                  <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded text-zinc-400 font-mono">
                    {appeal.entityType}
                  </span>
                </div>
                <span className="text-xs text-zinc-500 font-mono">{appeal.submittedAt}</span>
              </div>

              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-2">
                <div className="text-xs text-rose-400 font-bold">
                  Original Strike: {appeal.strikeReason}
                </div>
                <div className="text-xs text-zinc-300 font-medium">
                  Content: "{appeal.entitySummary}"
                </div>
                <div className="text-xs text-zinc-400 italic bg-zinc-900/80 p-3 rounded-lg border border-zinc-800">
                  Creator Statement: "{appeal.appealStatement}"
                </div>
              </div>

              {canManage && appeal.status === 'PENDING' && (
                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    onClick={() => handleResolveAppeal(appeal, 'DENIED')}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition"
                  >
                    Uphold Strike (Deny)
                  </button>
                  <button
                    onClick={() => handleResolveAppeal(appeal, 'GRANTED')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-emerald-900/40"
                  >
                    Grant Appeal & Restore Content
                  </button>
                </div>
              )}

              {appeal.status !== 'PENDING' && (
                <div className="text-right">
                  <span
                    className={`text-xs font-bold ${
                      appeal.status === 'GRANTED' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    Decision: {appeal.status}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
