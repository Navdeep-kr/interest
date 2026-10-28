'use client';

import React, { useState } from 'react';
import {
  Film,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Tag,
  ShieldCheck,
  Music,
  Bot,
  Filter,
  Eye,
} from 'lucide-react';
import { useAdminAuth, AdminPermission } from '../../lib/rbac';
import { auditManager } from '../../lib/audit';

interface ReelReviewItem {
  id: string;
  title: string;
  caption: string;
  creatorHandle: string;
  creatorName: string;
  durationSeconds: number;
  interestTags: string[];
  status: 'PENDING_REVIEW' | 'FLAGGED' | 'APPROVED' | 'REJECTED';
  safetyScores: {
    nudity: number;
    violence: number;
    hate: number;
    copyrightClean: boolean;
    copyrightTrack?: string;
    isAiGenerated: boolean;
    tagAlignmentScore: number;
  };
  submittedAt: string;
}

const mockReviewReels: ReelReviewItem[] = [
  {
    id: 'reel_rev_01',
    title: '5-Axis CNC Impeller Precision Milling',
    caption: 'Milling aerospace-grade titanium at 18,000 RPM #machining #cad #aerospace #engineering',
    creatorHandle: '@cnc_machinist',
    creatorName: 'Marcus Miller',
    durationSeconds: 42,
    interestTags: ['cnc-machining', 'aerospace-engineering', 'precision-tooling'],
    status: 'PENDING_REVIEW',
    safetyScores: {
      nudity: 0.01,
      violence: 0.0,
      hate: 0.0,
      copyrightClean: true,
      isAiGenerated: false,
      tagAlignmentScore: 0.96, // Highly aligned with taxonomy
    },
    submittedAt: '8 mins ago',
  },
  {
    id: 'reel_rev_02',
    title: 'Beginner Synth Patching Techniques',
    caption: 'Creating ambient textures with Eurorack oscillators #eurorack #watches #luxury #crypto',
    creatorHandle: '@synth_flow',
    creatorName: 'Liam Vance',
    durationSeconds: 58,
    interestTags: ['modular-synthesizers', 'horology-watches', 'cryptocurrency'],
    status: 'FLAGGED',
    safetyScores: {
      nudity: 0.02,
      violence: 0.0,
      hate: 0.0,
      copyrightClean: true,
      isAiGenerated: false,
      tagAlignmentScore: 0.31, // Tag spam detected!
    },
    submittedAt: '24 mins ago',
  },
  {
    id: 'reel_rev_03',
    title: 'Solar Flare Ambient Bassline',
    caption: 'Late night generative ambient session in the studio.',
    creatorHandle: '@beat_crafter',
    creatorName: 'Maya Thorne',
    durationSeconds: 30,
    interestTags: ['ambient-music', 'audio-production'],
    status: 'FLAGGED',
    safetyScores: {
      nudity: 0.0,
      violence: 0.0,
      hate: 0.0,
      copyrightClean: false,
      copyrightTrack: '"Solar Flare Bassline" by Vapor Grid (Sony Music)',
      isAiGenerated: false,
      tagAlignmentScore: 0.91,
    },
    submittedAt: '45 mins ago',
  },
  {
    id: 'reel_rev_04',
    title: 'Full Autonomous Agent Swarm Demo',
    caption: 'Multi-agent pair programming session orchestrated with Gemini models.',
    creatorHandle: '@ai_architect',
    creatorName: 'Dr. David Rao',
    durationSeconds: 55,
    interestTags: ['artificial-intelligence', 'prompt-engineering'],
    status: 'PENDING_REVIEW',
    safetyScores: {
      nudity: 0.0,
      violence: 0.0,
      hate: 0.0,
      copyrightClean: true,
      isAiGenerated: true,
      tagAlignmentScore: 0.98,
    },
    submittedAt: '1 hour ago',
  },
];

export default function ContentReviewPage() {
  const { admin, hasPermission } = useAdminAuth();
  const [items, setItems] = useState<ReelReviewItem[]>(mockReviewReels);
  const [filter, setFilter] = useState<string>('ALL');
  const [editingReel, setEditingReel] = useState<ReelReviewItem | null>(null);
  const [editedTagsText, setEditedTagsText] = useState('');

  const canReview = hasPermission(AdminPermission.REVIEW_CONTENT);

  const filteredItems = items.filter((item) => {
    if (filter === 'ALL') return true;
    return item.status === filter;
  });

  const handleApprove = (reel: ReelReviewItem) => {
    setItems((prev) =>
      prev.map((r) => (r.id === reel.id ? { ...r, status: 'APPROVED' } : r)),
    );

    auditManager.recordLog({
      actorName: admin.name,
      actorRole: admin.role,
      action: 'REEL_APPROVED',
      targetEntity: `Reel: ${reel.id} ("${reel.title}")`,
      details: `Reel passed review and was released to interest feeds.`,
      diff: { before: { status: reel.status }, after: { status: 'APPROVED' } },
    });
  };

  const handleReject = (reel: ReelReviewItem, reason: string) => {
    setItems((prev) =>
      prev.map((r) => (r.id === reel.id ? { ...r, status: 'REJECTED' } : r)),
    );

    auditManager.recordLog({
      actorName: admin.name,
      actorRole: admin.role,
      action: 'REEL_REJECTED',
      targetEntity: `Reel: ${reel.id} by ${reel.creatorHandle}`,
      details: `Reel rejected during content review. Violation: ${reason}`,
      diff: { before: { status: reel.status }, after: { status: 'REJECTED' } },
    });
  };

  const handleSaveEditedTags = () => {
    if (!editingReel) return;
    const newTags = editedTagsText
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    setItems((prev) =>
      prev.map((r) =>
        r.id === editingReel.id
          ? {
              ...r,
              interestTags: newTags,
              status: 'APPROVED',
              safetyScores: { ...r.safetyScores, tagAlignmentScore: 0.95 },
            }
          : r,
      ),
    );

    auditManager.recordLog({
      actorName: admin.name,
      actorRole: admin.role,
      action: 'REEL_TAGS_STRIPPED',
      targetEntity: `Reel: ${editingReel.id}`,
      details: `Moderator stripped irrelevant tags. New tags: ${newTags.join(', ')}`,
      diff: { before: editingReel.interestTags, after: newTags },
    });

    setEditingReel(null);
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Content Review Queue</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Review uploads flagged for tag mismatch, AI safety thresholds, or unlicensed audio before feed distribution.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 p-1.5 rounded-xl">
          {['ALL', 'PENDING_REVIEW', 'FLAGGED', 'APPROVED', 'REJECTED'].map((st) => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                filter === st
                  ? 'bg-rose-500 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Review Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredItems.map((reel) => {
          const isTagMismatch = reel.safetyScores.tagAlignmentScore < 0.6;
          const hasCopyright = !reel.safetyScores.copyrightClean;

          return (
            <div
              key={reel.id}
              className={`bg-zinc-900 border rounded-2xl p-6 space-y-4 transition ${
                reel.status === 'FLAGGED'
                  ? 'border-amber-700/60 bg-amber-950/10'
                  : reel.status === 'APPROVED'
                  ? 'border-emerald-800/40 bg-zinc-900/60'
                  : 'border-zinc-800'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        reel.status === 'FLAGGED'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : reel.status === 'APPROVED'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : reel.status === 'REJECTED'
                          ? 'bg-rose-950 text-rose-400 border border-rose-800'
                          : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {reel.status}
                    </span>
                    <span className="text-xs text-zinc-500 font-mono">{reel.submittedAt}</span>
                  </div>
                  <h3 className="font-extrabold text-white text-base mt-2">{reel.title}</h3>
                  <p className="text-xs text-zinc-400 mt-1">{reel.caption}</p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-zinc-200 block">{reel.creatorHandle}</span>
                  <span className="text-[11px] text-zinc-500 font-mono">{reel.durationSeconds}s duration</span>
                </div>
              </div>

              {/* Interest Tags */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Tagged Taxonomy Nodes:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {reel.interestTags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-zinc-800/80 border border-zinc-700 text-indigo-300 text-xs px-2.5 py-0.5 rounded-lg flex items-center gap-1 font-mono"
                    >
                      <Tag className="w-3 h-3 text-indigo-400" />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Safety & AI Signals Grid */}
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-zinc-500" />
                    Tag-to-Vector Alignment
                  </span>
                  <span
                    className={`font-mono font-bold ${
                      isTagMismatch ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {(reel.safetyScores.tagAlignmentScore * 100).toFixed(0)}% Match{' '}
                    {isTagMismatch && '(MISMATCH DETECTED)'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5 text-zinc-500" />
                    Audio License / Fingerprint
                  </span>
                  <span
                    className={`font-medium ${
                      hasCopyright ? 'text-amber-400 font-bold' : 'text-zinc-300'
                    }`}
                  >
                    {hasCopyright ? reel.safetyScores.copyrightTrack : 'Clean / Licensed'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5 text-zinc-500" />
                    Synthetic / AI Content Flag
                  </span>
                  <span className="text-zinc-300">
                    {reel.safetyScores.isAiGenerated ? 'AI Generated (Labeled)' : 'Human Creative'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              {canReview && (
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                  <button
                    onClick={() => {
                      setEditingReel(reel);
                      setEditedTagsText(reel.interestTags.join(', '));
                    }}
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <Tag className="w-3.5 h-3.5" />
                    Strip / Clean Tags
                  </button>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleReject(reel, 'Copyright audio without sync license')}
                      className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-400 border border-rose-800 rounded-xl text-xs font-bold transition flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(reel)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-lg shadow-emerald-900/40"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Approve
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Tags Modal */}
      {editingReel && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Tag className="w-5 h-5 text-indigo-400" />
              Clean Interest Tags for "{editingReel.title}"
            </h2>
            <p className="text-xs text-zinc-400">
              Remove unrelated tags used for impression hijacking and preserve authentic taxonomy tags.
            </p>
            <input
              type="text"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500"
              value={editedTagsText}
              onChange={(e) => setEditedTagsText(e.target.value)}
              placeholder="comma-separated tags..."
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setEditingReel(null)}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditedTags}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition"
              >
                Save Clean Tags & Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
