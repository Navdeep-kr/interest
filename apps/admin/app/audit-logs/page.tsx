'use client';

import React, { useState, useEffect } from 'react';
import {
  ScrollText,
  Search,
  Filter,
  ShieldCheck,
  UserCheck,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { auditManager, AuditLogEntry } from '../../lib/audit';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState('ALL');

  useEffect(() => {
    setLogs(auditManager.getLogs());
    const unsubscribe = auditManager.subscribe(() => {
      setLogs(auditManager.getLogs());
    });
    return unsubscribe;
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.actorName.toLowerCase().includes(search.toLowerCase()) ||
      log.targetEntity.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase());

    const matchesAction = selectedAction === 'ALL' || log.action === selectedAction;
    return matchesSearch && matchesAction;
  });

  const getActionColor = (action: string) => {
    if (action.includes('REJECT') || action.includes('SUSPEND') || action.includes('STRIKE')) {
      return 'bg-rose-950 text-rose-400 border-rose-800';
    }
    if (action.includes('APPROVE') || action.includes('DISBURSE') || action.includes('REINSTATE') || action.includes('GRANTED')) {
      return 'bg-emerald-950 text-emerald-400 border-emerald-800';
    }
    if (action.includes('WARN') || action.includes('HOLD')) {
      return 'bg-amber-950 text-amber-400 border-amber-800';
    }
    return 'bg-indigo-950 text-indigo-400 border-indigo-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">System Audit & Compliance Log</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Immutable event ledger recording administrative interventions, content decisions, feature toggles, and financial disbursements.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by actor, action, target entity, or details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500"
          />
        </div>

        <select
          value={selectedAction}
          onChange={(e) => setSelectedAction(e.target.value)}
          className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none"
        >
          <option value="ALL">All Actions</option>
          <option value="USER_SUSPENDED">USER_SUSPENDED</option>
          <option value="USER_WARNED">USER_WARNED</option>
          <option value="USER_REINSTATED">USER_REINSTATED</option>
          <option value="REEL_APPROVED">REEL_APPROVED</option>
          <option value="REEL_REJECTED">REEL_REJECTED</option>
          <option value="REEL_TAGS_STRIPPED">REEL_TAGS_STRIPPED</option>
          <option value="FLAG_TOGGLED">FLAG_TOGGLED</option>
          <option value="PAYOUT_DISBURSED">PAYOUT_DISBURSED</option>
          <option value="TAXONOMY_NICHE_ADDED">TAXONOMY_NICHE_ADDED</option>
        </select>
      </div>

      {/* Audit Log Entries List */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="divide-y divide-zinc-850">
          {filteredLogs.map((log) => (
            <div key={log.id} className="p-5 hover:bg-zinc-850/30 transition space-y-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div className="flex items-center space-x-2.5">
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded border font-mono font-bold ${getActionColor(
                      log.action,
                    )}`}
                  >
                    {log.action}
                  </span>
                  <span className="font-bold text-white text-sm">{log.targetEntity}</span>
                </div>

                <div className="flex items-center space-x-3 text-xs text-zinc-500 font-mono">
                  <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span>{new Date(log.timestamp).toLocaleDateString()}</span>
                </div>
              </div>

              <p className="text-xs text-zinc-300 pl-0.5">{log.details}</p>

              <div className="flex items-center justify-between text-[11px] pt-1">
                <div className="flex items-center space-x-2 text-zinc-400">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                  <span>
                    Actor: <strong className="text-zinc-200">{log.actorName}</strong> ({log.actorRole})
                  </span>
                </div>

                <span className="text-zinc-500 font-mono">{log.id}</span>
              </div>

              {/* State Diff Inspection */}
              {log.diff && (
                <div className="mt-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-850 text-[11px] font-mono flex items-center space-x-3">
                  <span className="text-zinc-500">Diff:</span>
                  <span className="text-rose-400 line-through">
                    {JSON.stringify(log.diff.before)}
                  </span>
                  <ArrowRight className="w-3 h-3 text-zinc-600" />
                  <span className="text-emerald-400">{JSON.stringify(log.diff.after)}</span>
                </div>
              )}
            </div>
          ))}

          {filteredLogs.length === 0 && (
            <div className="p-12 text-center text-zinc-500 text-sm">
              No audit log entries matching current search criteria.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
