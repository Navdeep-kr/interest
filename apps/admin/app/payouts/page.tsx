'use client';

import React, { useState } from 'react';
import {
  Wallet,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  DollarSign,
  FileText,
  Building,
  ShieldCheck,
} from 'lucide-react';
import { useAdminAuth, AdminPermission } from '../../lib/rbac';
import { auditManager } from '../../lib/audit';

interface PayoutRequestItem {
  id: string;
  creatorHandle: string;
  creatorName: string;
  grossAmountCents: number;
  taxWithheldCents: number;
  netPayoutCents: number;
  currency: string;
  gateway: 'STRIPE' | 'RAZORPAY';
  destinationAccount: string;
  taxJurisdiction: string;
  status: 'PENDING' | 'PROCESSING' | 'PAID' | 'HOLD' | 'REJECTED';
  requestedAt: string;
}

const mockPayouts: PayoutRequestItem[] = [
  {
    id: 'pout_req_01',
    creatorHandle: '@barista_elena',
    creatorName: 'Elena Specialty Coffee',
    grossAmountCents: 125000, // $1,250.00
    taxWithheldCents: 0, // US W-9 verified
    netPayoutCents: 125000,
    currency: 'USD',
    gateway: 'STRIPE',
    destinationAccount: 'acct_1NZsStE6',
    taxJurisdiction: 'US-W9',
    status: 'PENDING',
    requestedAt: '30 mins ago',
  },
  {
    id: 'pout_req_02',
    creatorHandle: '@cnc_machinist',
    creatorName: 'Marcus Miller',
    grossAmountCents: 84000, // $840.00
    taxWithheldCents: 8400, // 10% TDS
    netPayoutCents: 75600,
    currency: 'USD',
    gateway: 'RAZORPAY',
    destinationAccount: 'acc_rzp_88a',
    taxJurisdiction: 'IN-TDS',
    status: 'PENDING',
    requestedAt: '1 hour ago',
  },
  {
    id: 'pout_req_03',
    creatorHandle: '@synth_nerd',
    creatorName: 'Liam Vance',
    grossAmountCents: 52000, // $520.00
    taxWithheldCents: 12480, // 24% Backup withholding
    netPayoutCents: 39520,
    currency: 'USD',
    gateway: 'STRIPE',
    destinationAccount: 'acct_1O8kLeF1',
    taxJurisdiction: 'US-BACKUP',
    status: 'HOLD',
    requestedAt: '3 hours ago',
  },
  {
    id: 'pout_req_04',
    creatorHandle: '@ai_architect',
    creatorName: 'Dr. David Rao',
    grossAmountCents: 310000, // $3,100.00
    taxWithheldCents: 0,
    netPayoutCents: 310000,
    currency: 'USD',
    gateway: 'STRIPE',
    destinationAccount: 'acct_1P2kKkL9',
    taxJurisdiction: 'US-W9',
    status: 'PAID',
    requestedAt: 'Yesterday',
  },
];

export default function CreatorPayoutsPage() {
  const { admin, hasPermission } = useAdminAuth();
  const [payouts, setPayouts] = useState<PayoutRequestItem[]>(mockPayouts);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const canManage = hasPermission(AdminPermission.MANAGE_PAYOUTS);

  const filteredPayouts = payouts.filter((p) => {
    if (statusFilter === 'ALL') return true;
    return p.status === statusFilter;
  });

  const handleAction = (payout: PayoutRequestItem, nextStatus: 'PAID' | 'HOLD' | 'REJECTED') => {
    setPayouts((prev) =>
      prev.map((p) => (p.id === payout.id ? { ...p, status: nextStatus } : p)),
    );

    auditManager.recordLog({
      actorName: admin.name,
      actorRole: admin.role,
      action:
        nextStatus === 'PAID'
          ? 'PAYOUT_DISBURSED'
          : nextStatus === 'HOLD'
          ? 'PAYOUT_HELD'
          : 'PAYOUT_REJECTED',
      targetEntity: `Payout: ${payout.id} ($${(payout.netPayoutCents / 100).toFixed(2)} to ${payout.creatorHandle})`,
      details: `Updated payout status to ${nextStatus} via ${payout.gateway}. Tax withheld: $${(payout.taxWithheldCents / 100).toFixed(2)}.`,
      diff: { before: { status: payout.status }, after: { status: nextStatus } },
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Creator Payouts & Treasury</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Review creator disbursement requests, verify tax withholding compliance, and trigger Stripe Connect / Razorpay Route payouts.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 p-1.5 rounded-xl">
          {['ALL', 'PENDING', 'HOLD', 'PAID'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition ${
                statusFilter === st
                  ? 'bg-rose-500 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Treasury Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
            Pending Queue Value
          </span>
          <div className="text-2xl font-black text-white mt-1">$2,090.00</div>
          <span className="text-xs text-amber-400 font-medium">2 pending approvals</span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
            Disbursed This Month
          </span>
          <div className="text-2xl font-black text-white mt-1">$142,800.00</div>
          <span className="text-xs text-emerald-400 font-medium">100% on schedule</span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
            Tax Withholding Reserve
          </span>
          <div className="text-2xl font-black text-white mt-1">$18,420.00</div>
          <span className="text-xs text-indigo-400 font-medium">1099-MISC & TDS records</span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
            Connected Creator Accounts
          </span>
          <div className="text-2xl font-black text-white mt-1">1,248</div>
          <span className="text-xs text-zinc-400">Stripe: 88% • Razorpay: 12%</span>
        </div>
      </div>

      {/* Payouts Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-zinc-950/70 border-b border-zinc-800 text-xs uppercase font-semibold text-zinc-400">
              <tr>
                <th className="py-3.5 px-4">Payout ID & Creator</th>
                <th className="py-3.5 px-4">Gross Request</th>
                <th className="py-3.5 px-4">Tax Withholding</th>
                <th className="py-3.5 px-4">Net Payout</th>
                <th className="py-3.5 px-4">Gateway & Account</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850">
              {filteredPayouts.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-850/40 transition">
                  <td className="py-3.5 px-4">
                    <div>
                      <span className="font-mono text-xs text-zinc-500 block">{item.id}</span>
                      <strong className="text-white text-sm block">{item.creatorHandle}</strong>
                      <span className="text-xs text-zinc-400">{item.creatorName}</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 font-mono font-medium text-white">
                    ${(item.grossAmountCents / 100).toFixed(2)}
                  </td>

                  <td className="py-3.5 px-4">
                    <div>
                      <span
                        className={`font-mono font-bold text-xs ${
                          item.taxWithheldCents > 0 ? 'text-amber-400' : 'text-zinc-500'
                        }`}
                      >
                        ${(item.taxWithheldCents / 100).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-zinc-500 block font-mono">
                        {item.taxJurisdiction}
                      </span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="font-mono font-extrabold text-emerald-400 text-sm">
                      ${(item.netPayoutCents / 100).toFixed(2)}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <div>
                      <span className="text-xs font-bold text-indigo-400 font-mono">
                        {item.gateway}
                      </span>
                      <span className="text-[11px] text-zinc-500 font-mono block">
                        {item.destinationAccount}
                      </span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded font-bold font-mono ${
                        item.status === 'PAID'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : item.status === 'HOLD'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : item.status === 'PENDING'
                          ? 'bg-indigo-950 text-indigo-400 border border-indigo-800'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    {canManage && item.status !== 'PAID' && item.status !== 'REJECTED' && (
                      <div className="flex items-center justify-end space-x-2">
                        {item.status !== 'HOLD' ? (
                          <button
                            onClick={() => handleAction(item, 'HOLD')}
                            className="px-2.5 py-1 bg-amber-950/80 hover:bg-amber-900 text-amber-400 border border-amber-800 rounded-lg text-xs font-bold transition"
                            title="Place on Compliance Hold"
                          >
                            Hold
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAction(item, 'REJECTED')}
                            className="px-2.5 py-1 bg-rose-950/80 hover:bg-rose-900 text-rose-400 border border-rose-800 rounded-lg text-xs font-bold transition"
                            title="Reject and Refund"
                          >
                            Reject
                          </button>
                        )}

                        <button
                          onClick={() => handleAction(item, 'PAID')}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-lg shadow-emerald-900/40"
                          title="Disburse Funds"
                        >
                          Approve
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
