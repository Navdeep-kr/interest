'use client';

import React, { useState } from 'react';
import {
  Scale,
  ShieldCheck,
  AlertTriangle,
  Clock,
  FileText,
  Trash2,
  Download,
  CheckCircle2,
  XCircle,
  UserX,
  FileCheck,
  ChevronRight,
  Search,
  Filter,
  Eye,
  RefreshCw,
  Award,
} from 'lucide-react';
import { useAdminAuth, AdminPermission } from '../../lib/rbac';
import {
  GrievanceStatus,
  GrievanceCategory,
  DmcaStatus,
  DataExportStatus,
  AccountDeletionStatus,
} from '@shared/types';

type ComplianceTab = 'grievances' | 'dmca' | 'dsr' | 'retention' | 'policies';

export default function ComplianceOperationsPage() {
  const { hasPermission } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<ComplianceTab>('grievances');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrievance, setSelectedGrievance] = useState<any | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // --- Mock Grievances List (India DPDP & Global) ---
  const [grievances, setGrievances] = useState([
    {
      ticketNumber: 'GRV-2026-A109E2',
      complainantName: 'Rohan Verma',
      complainantEmail: 'rohan.v@example.in',
      category: GrievanceCategory.DPDP_DATA_PROTECTION,
      subject: 'Inquiry regarding personal data processing & vector retention',
      description: 'Requesting confirmation whether dynamic vector drift history has been decoupled upon consent withdrawal.',
      status: GrievanceStatus.SUBMITTED,
      assignedOfficer: 'Priya Sharma (Resident Grievance Officer)',
      ackDeadline: '2026-10-15T14:30:00Z',
      resolveDeadline: '2026-10-27T14:30:00Z',
      createdAt: '2026-10-12T14:30:00Z',
    },
    {
      ticketNumber: 'GRV-2026-B821F4',
      complainantName: 'Ananya Deshmukh',
      complainantEmail: 'ananya.d@example.in',
      category: GrievanceCategory.COPPA_CHILD_SAFETY,
      subject: 'Parental verification confirmation for minor creator',
      description: 'Parent seeking verification that personalized advertising and stranger direct messaging remain disabled.',
      status: GrievanceStatus.ACKNOWLEDGED,
      assignedOfficer: 'Priya Sharma (Resident Grievance Officer)',
      ackDeadline: '2026-10-14T10:00:00Z',
      resolveDeadline: '2026-10-26T10:00:00Z',
      createdAt: '2026-10-11T10:00:00Z',
    },
    {
      ticketNumber: 'GRV-2026-C449D1',
      complainantName: 'Marcus Lindqvist',
      complainantEmail: 'marcus.l@example.se',
      category: GrievanceCategory.GDPR_RIGHTS,
      subject: 'Right to Access data portability request assistance',
      description: 'User requested machine-readable JSON archive containing all historical uploaded reels and captions.',
      status: GrievanceStatus.RESOLVED,
      assignedOfficer: 'EU Compliance Desk',
      ackDeadline: '2026-10-10T12:00:00Z',
      resolveDeadline: '2026-10-22T12:00:00Z',
      resolutionSummary: 'Signed data archive generated and dispatched to complainant. Request successfully fulfilled.',
      createdAt: '2026-10-07T12:00:00Z',
    },
  ]);

  // --- Mock DMCA Notices (17 U.S.C. § 512) ---
  const [dmcaNotices, setDmcaNotices] = useState([
    {
      ticketNumber: 'DMCA-2026-881A2F',
      reelId: 'reel-synth-8821',
      creatorName: 'SynthWaveMaster',
      claimantName: 'Sony Music Entertainment Legal',
      claimantEmail: 'copyright@sonymusic.com',
      workDescription: 'Audio track "Neon Skyline" master recording without synchronization license',
      status: DmcaStatus.CONTENT_REMOVED,
      createdAt: '2026-10-11T09:00:00Z',
      restorationDate: null,
    },
    {
      ticketNumber: 'DMCA-2026-992B1C',
      reelId: 'reel-cnc-4190',
      creatorName: 'PrecisionMachinist',
      claimantName: 'Apex Tooling IP Corp',
      claimantEmail: 'ip-enforce@apextooling.com',
      workDescription: 'Proprietary G-Code simulation animation and blueprints',
      status: DmcaStatus.RESTORATION_SCHEDULED,
      counterNoticeText: 'Creator affirms under penalty of perjury that model was independently authored with open CC-BY-4.0 license.',
      restorationDate: '2026-10-25T11:00:00Z',
      createdAt: '2026-10-09T11:00:00Z',
    },
  ]);

  // --- Mock Data Subject Requests (DSR) ---
  const [dsrRequests, setDsrRequests] = useState([
    {
      id: 'dsr-exp-101',
      userId: 'user-elena-v',
      username: 'elena_ceramics',
      type: 'DATA_EXPORT',
      format: 'JSON',
      status: DataExportStatus.COMPLETED,
      requestedAt: '2026-10-12T08:00:00Z',
      expiresAt: '2026-10-14T08:00:00Z',
      token: 'tok_signed_48h_f928a',
    },
    {
      id: 'dsr-del-202',
      userId: 'user-tobias-k',
      username: 'tobias_woodwork',
      type: 'ACCOUNT_DELETION',
      status: AccountDeletionStatus.PENDING_GRACE_PERIOD,
      requestedAt: '2026-10-02T16:00:00Z',
      gracePeriodEndsAt: '2026-11-01T16:00:00Z', // 30-day grace period
      reason: 'No longer creating video content',
    },
  ]);

  // Retention Policies
  const retentionPolicies = [
    { category: 'Telemetry Seen Reels (Redis & DB)', period: '14 Days', basis: 'Legitimate Interest (Recommendation freshness)', disposal: 'Automated sliding window expiry' },
    { category: 'Disappearing Direct Messages', period: '24 Hours / 7 Days', basis: 'User Ephemeral Privacy', disposal: 'Crypto-shredded from database' },
    { category: 'Data Subject Export Bundles', period: '48 Hours', basis: 'Security Minimization', disposal: 'Purge of temporary signed tokens' },
    { category: 'Pending Account Deletion', period: '30 Days Grace Period', basis: 'Right to Erasure cooling-off', disposal: 'Soft freeze followed by permanent crypto-shredding' },
    { category: 'Financial & Tax Invoices', period: '7 Years', basis: 'Statutory Financial & Tax Mandates', disposal: 'PII-anonymized ledger retention' },
    { category: 'Administrative Audit Logs', period: '365 Days Rolling', basis: 'Accountability (SOC 2 / ISO 27001)', disposal: 'Rolling immutable ledger truncation' },
  ];

  const handleAcknowledgeGrievance = (ticket: string) => {
    setGrievances((prev) =>
      prev.map((g) => (g.ticketNumber === ticket ? { ...g, status: GrievanceStatus.ACKNOWLEDGED } : g)),
    );
    setActionMessage(`Grievance ${ticket} successfully acknowledged within statutory 72h SLA!`);
    setTimeout(() => setActionMessage(null), 3500);
  };

  const handleResolveGrievance = (ticket: string) => {
    if (!resolutionNote) return;
    setGrievances((prev) =>
      prev.map((g) =>
        g.ticketNumber === ticket
          ? { ...g, status: GrievanceStatus.RESOLVED, resolutionSummary: resolutionNote }
          : g,
      ),
    );
    setSelectedGrievance(null);
    setResolutionNote('');
    setActionMessage(`Grievance ${ticket} marked as RESOLVED.`);
    setTimeout(() => setActionMessage(null), 3500);
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Legal & Regulatory Compliance</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Statutory governance across GDPR, India DPDP Act 2023, CCPA/CPRA, US COPPA, and 17 U.S.C. § 512 DMCA.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-xl self-start md:self-auto overflow-x-auto">
          {[
            { id: 'grievances', label: 'Grievance Redressal (DPDP)', icon: Scale },
            { id: 'dmca', label: 'DMCA & IP Takedowns', icon: FileCheck },
            { id: 'dsr', label: 'Data Subject Rights (GDPR)', icon: UserX },
            { id: 'retention', label: 'Data Retention Rules', icon: Clock },
            { id: 'policies', label: 'Statutory Disclosures', icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ComplianceTab)}
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

      {/* Action Banner */}
      {actionMessage && (
        <div className="bg-emerald-950/50 border border-emerald-800 p-3.5 rounded-xl text-xs text-emerald-300 font-semibold flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-zinc-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Strict Zero-Location Compliance Notice */}
      <div className="bg-emerald-950/20 border border-emerald-800/40 p-4 rounded-2xl flex items-start space-x-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-sm font-bold text-emerald-400">Zero-Location Privacy Architecture Guarantees</h2>
          <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
            By architectural invariant, the Interest platform processes zero GPS coordinates, zero proximity radii, zero country codes, and zero IP-derived locations. Compliance with GDPR, DPDP, CCPA, and COPPA is simplified through absolute data minimization at the ingestion boundary.
          </p>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: GRIEVANCE REDRESSAL (INDIA DPDP ACT 2023 & IT RULES 2021)
          ========================================================================= */}
      {activeTab === 'grievances' && (
        <div className="space-y-6">
          {/* Statutory Grievance Officer Card */}
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wider block">
                Statutory Resident Grievance Officer (India DPDP Act &amp; IT Rules)
              </span>
              <h3 className="text-lg font-black text-white mt-0.5">Priya Sharma</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Interest Media Pvt. Ltd., Level 6, Tech Park, Outer Ring Road, Bengaluru, Karnataka 560103
              </p>
              <span className="text-xs font-mono text-zinc-300 block mt-1">grievance-officer@interest.app</span>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-center">
                <span className="text-zinc-400 block text-[10px] uppercase font-bold">Acknowledgment SLA</span>
                <span className="text-emerald-400 font-bold text-sm">72 Hours</span>
              </div>
              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-center">
                <span className="text-zinc-400 block text-[10px] uppercase font-bold">Statutory Resolution SLA</span>
                <span className="text-indigo-400 font-bold text-sm">15 Days</span>
              </div>
            </div>
          </div>

          {/* Grievances Queue */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-lg overflow-hidden">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Scale className="w-4 h-4 text-rose-500" />
                  Statutory Grievance Redressal Queue
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Complaints filed by data principals and citizens under the DPDP Act and Intermediary Guidelines.
                </p>
              </div>
              <span className="text-xs font-mono text-zinc-400">{grievances.length} Tickets Registered</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950 text-zinc-400 font-bold border-b border-zinc-800">
                  <tr>
                    <th className="p-4">Ticket</th>
                    <th className="p-4">Complainant</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Subject</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">72h SLA Deadline</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                  {grievances.map((g) => (
                    <tr key={g.ticketNumber}>
                      <td className="p-4 font-mono font-bold text-white">{g.ticketNumber}</td>
                      <td className="p-4">
                        <div className="font-bold text-white">{g.complainantName}</div>
                        <span className="text-[11px] text-zinc-400 font-mono">{g.complainantEmail}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-[10px] font-bold bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
                          {g.category}
                        </span>
                      </td>
                      <td className="p-4 max-w-xs truncate">{g.subject}</td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            g.status === GrievanceStatus.SUBMITTED
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : g.status === GrievanceStatus.ACKNOWLEDGED
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          {g.status}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-[11px] text-zinc-400">
                        {new Date(g.ackDeadline).toLocaleDateString()} {new Date(g.ackDeadline).toLocaleTimeString()}
                      </td>
                      <td className="p-4 text-right space-x-2">
                        {g.status === GrievanceStatus.SUBMITTED && (
                          <button
                            onClick={() => handleAcknowledgeGrievance(g.ticketNumber)}
                            className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] transition"
                          >
                            Acknowledge (72h)
                          </button>
                        )}
                        {g.status !== GrievanceStatus.RESOLVED && (
                          <button
                            onClick={() => setSelectedGrievance(g)}
                            className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] transition"
                          >
                            Resolve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Resolution Modal */}
          {selectedGrievance && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-zinc-900 border border-zinc-800 max-w-lg w-full rounded-2xl p-6 space-y-4">
                <h3 className="text-base font-bold text-white">Resolve Grievance: {selectedGrievance.ticketNumber}</h3>
                <p className="text-xs text-zinc-400">
                  Complainant: <strong className="text-white">{selectedGrievance.complainantName}</strong> ({selectedGrievance.complainantEmail})
                </p>
                <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-xs text-zinc-300">
                  {selectedGrievance.description}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300 block">Formal Resolution Summary</label>
                  <textarea
                    rows={4}
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    placeholder="Document corrective actions, vector deletions, or policy clarifications..."
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setSelectedGrievance(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleResolveGrievance(selectedGrievance.ticketNumber)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition"
                  >
                    Confirm &amp; Dispatch Resolution
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: DMCA NOTICE & TAKEDOWN (17 U.S.C. § 512)
          ========================================================================= */}
      {activeTab === 'dmca' && (
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-lg overflow-hidden">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-indigo-400" />
                  DMCA 512(c) Notice &amp; Counter-Notice Registry
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Statutory safe harbor compliance with 14-day counter-notice restoration countdowns.
                </p>
              </div>
              <span className="text-xs font-mono text-zinc-400">{dmcaNotices.length} Active Matters</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950 text-zinc-400 font-bold border-b border-zinc-800">
                  <tr>
                    <th className="p-4">Ticket</th>
                    <th className="p-4">Target Reel</th>
                    <th className="p-4">Claimant</th>
                    <th className="p-4">Work Description</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Restoration Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                  {dmcaNotices.map((n) => (
                    <tr key={n.ticketNumber}>
                      <td className="p-4 font-mono font-bold text-white">{n.ticketNumber}</td>
                      <td className="p-4">
                        <span className="font-mono text-rose-400 font-bold">{n.reelId}</span>
                        <span className="text-[11px] text-zinc-400 block">Creator: {n.creatorName}</span>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-white">{n.claimantName}</div>
                        <span className="text-[11px] text-zinc-400 font-mono">{n.claimantEmail}</span>
                      </td>
                      <td className="p-4 max-w-xs text-zinc-300">{n.workDescription}</td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            n.status === DmcaStatus.CONTENT_REMOVED
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                          }`}
                        >
                          {n.status}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-[11px] text-zinc-400">
                        {n.restorationDate ? new Date(n.restorationDate).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: DATA SUBJECT RIGHTS (GDPR ART. 17 / 20 & DPDP)
          ========================================================================= */}
      {activeTab === 'dsr' && (
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-lg overflow-hidden">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UserX className="w-4 h-4 text-rose-500" />
                  Data Subject Rights Ledger (DSR)
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Machine-readable data exports (GDPR Art. 20) and 30-day erasure grace periods (Art. 17).
                </p>
              </div>
              <span className="text-xs font-mono text-zinc-400">{dsrRequests.length} Active Invocations</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950 text-zinc-400 font-bold border-b border-zinc-800">
                  <tr>
                    <th className="p-4">Request ID</th>
                    <th className="p-4">User</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Requested At</th>
                    <th className="p-4">Expiration / Grace End</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                  {dsrRequests.map((r) => (
                    <tr key={r.id}>
                      <td className="p-4 font-mono font-bold text-white">{r.id}</td>
                      <td className="p-4">
                        <div className="font-bold text-white">@{r.username}</div>
                        <span className="text-[11px] text-zinc-400 font-mono">{r.userId}</span>
                      </td>
                      <td className="p-4 font-bold text-indigo-400">{r.type}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300">
                          {r.status}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-[11px] text-zinc-400">
                        {new Date(r.requestedAt).toLocaleDateString()}
                      </td>
                      <td className="p-4 font-mono text-[11px] text-zinc-400">
                        {r.expiresAt
                          ? new Date(r.expiresAt).toLocaleDateString()
                          : r.gracePeriodEndsAt
                          ? `${new Date(r.gracePeriodEndsAt).toLocaleDateString()} (Grace Period)`
                          : '—'}
                      </td>
                      <td className="p-4 text-right">
                        {r.type === 'DATA_EXPORT' ? (
                          <button className="px-2.5 py-1 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition flex items-center gap-1.5 ml-auto">
                            <Download className="w-3 h-3" />
                            Download Archive
                          </button>
                        ) : (
                          <span className="text-amber-400 font-semibold text-[11px]">Freezing Public Profile</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: DATA RETENTION RULES
          ========================================================================= */}
      {activeTab === 'retention' && (
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-lg p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              Automated Data Retention &amp; Garbage Collection Matrix
            </h3>
            <p className="text-xs text-zinc-400">
              Retention policies enforced across Redis in-memory caches, PostgreSQL partitions, and media vaults.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {retentionPolicies.map((p) => (
                <div key={p.category} className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">{p.category}</span>
                    <span className="font-mono text-emerald-400 text-xs font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                      {p.period}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400">Legal Basis: {p.basis}</p>
                  <p className="text-[11px] text-zinc-500 font-mono">Disposal: {p.disposal}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: STATUTORY DISCLOSURES & POLICIES
          ========================================================================= */}
      {activeTab === 'policies' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-rose-500" />
              Privacy Policy (Zero-Location)
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Discloses interest vector profiling, CCPA Do Not Sell opt-out, COPPA age verification, and zero IP geolocation storage.
            </p>
            <span className="text-xs font-mono text-zinc-500 block">Version: v2.4 (October 2026)</span>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-indigo-400" />
              Terms of Service (TOS)
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Governs creator monetization splits (95% tips, 80% subscriptions), remix/duet licensing, and arbitration clauses.
            </p>
            <span className="text-xs font-mono text-zinc-500 block">Version: v2.1 (October 2026)</span>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Community Guidelines
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Strict prohibitions against CSAM, nudity, hate speech, harassment, copyright theft, and mandatory AI-generated labeling.
            </p>
            <span className="text-xs font-mono text-zinc-500 block">Version: v3.0 (October 2026)</span>
          </div>
        </div>
      )}
    </div>
  );
}
