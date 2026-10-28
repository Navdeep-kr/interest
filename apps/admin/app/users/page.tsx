'use client';

import React, { useState } from 'react';
import {
  Search,
  Shield,
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  Ban,
  RotateCcw,
  BadgeCheck,
  UserCog,
  Eye,
  X,
} from 'lucide-react';
import { useAdminAuth, AdminPermission } from '../../lib/rbac';
import { auditManager } from '../../lib/audit';

interface UserRecord {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: 'USER' | 'CREATOR' | 'MODERATOR' | 'ADMIN';
  status: 'ACTIVE' | 'WARNED' | 'SUSPENDED';
  isMinor: boolean;
  isVerified: boolean;
  interestsCount: number;
  followersCount: number;
  strikes: number;
  joinedAt: string;
  warningNote?: string;
  suspensionReason?: string;
}

const mockUsers: UserRecord[] = [
  {
    id: 'u_101',
    username: 'alex_synthesizer',
    displayName: 'Alex Rivers',
    email: 'alex@modular.sound',
    role: 'CREATOR',
    status: 'ACTIVE',
    isMinor: false,
    isVerified: true,
    interestsCount: 8,
    followersCount: 14200,
    strikes: 0,
    joinedAt: '2026-01-14',
  },
  {
    id: 'u_102',
    username: 'barista_elena',
    displayName: 'Elena Specialty Coffee',
    email: 'elena@craftcoffee.org',
    role: 'CREATOR',
    status: 'ACTIVE',
    isMinor: false,
    isVerified: true,
    interestsCount: 12,
    followersCount: 89000,
    strikes: 0,
    joinedAt: '2026-02-01',
  },
  {
    id: 'u_103',
    username: 'crypto_spammer_bot',
    displayName: 'Instant Wealth 100x',
    email: 'bot98@tempmail.io',
    role: 'USER',
    status: 'WARNED',
    isMinor: false,
    isVerified: false,
    interestsCount: 45,
    followersCount: 12,
    strikes: 2,
    joinedAt: '2026-09-10',
    warningNote: 'Multiple instances of automated comment flooding across reels.',
  },
  {
    id: 'u_104',
    username: 'teen_coder_2010',
    displayName: 'Leo K.',
    email: 'leo@familymail.com',
    role: 'USER',
    status: 'ACTIVE',
    isMinor: true,
    isVerified: false,
    interestsCount: 5,
    followersCount: 140,
    strikes: 0,
    joinedAt: '2026-08-20',
  },
  {
    id: 'u_105',
    username: 'dark_tag_exploiter',
    displayName: 'Viral Loophole',
    email: 'exploiter@shady.net',
    role: 'USER',
    status: 'SUSPENDED',
    isMinor: false,
    isVerified: false,
    interestsCount: 2,
    followersCount: 320,
    strikes: 3,
    joinedAt: '2026-07-15',
    suspensionReason: 'Severe tag manipulation: Tagged Medical Surgery in gaming clips.',
  },
];

export default function UserManagementPage() {
  const { admin, hasPermission } = useAdminAuth();
  const [users, setUsers] = useState<UserRecord[]>(mockUsers);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Modals
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [showWarnModal, setShowWarnModal] = useState(false);
  const [warnReason, setWarnReason] = useState('');
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);

  const canManage = hasPermission(AdminPermission.MANAGE_USERS);

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.displayName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;

    return matchesSearch && matchesStatus && matchesRole;
  });

  const handleWarnUser = () => {
    if (!selectedUser || !warnReason.trim()) return;

    setUsers((prev) =>
      prev.map((u) =>
        u.id === selectedUser.id
          ? { ...u, status: 'WARNED', strikes: u.strikes + 1, warningNote: warnReason }
          : u,
      ),
    );

    auditManager.recordLog({
      actorName: admin.name,
      actorRole: admin.role,
      action: 'USER_WARNED',
      targetEntity: `User: @${selectedUser.username} (${selectedUser.id})`,
      details: `Issued warning strike. Reason: ${warnReason}`,
      diff: { before: { status: selectedUser.status }, after: { status: 'WARNED' } },
    });

    setShowWarnModal(false);
    setWarnReason('');
  };

  const handleSuspendUser = () => {
    if (!selectedUser || !suspendReason.trim()) return;

    setUsers((prev) =>
      prev.map((u) =>
        u.id === selectedUser.id
          ? { ...u, status: 'SUSPENDED', strikes: u.strikes + 1, suspensionReason: suspendReason }
          : u,
      ),
    );

    auditManager.recordLog({
      actorName: admin.name,
      actorRole: admin.role,
      action: 'USER_SUSPENDED',
      targetEntity: `User: @${selectedUser.username} (${selectedUser.id})`,
      details: `Suspended user account. Reason: ${suspendReason}`,
      diff: { before: { status: selectedUser.status }, after: { status: 'SUSPENDED' } },
    });

    setShowSuspendModal(false);
    setSuspendReason('');
  };

  const handleReinstateUser = (user: UserRecord) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, status: 'ACTIVE', suspensionReason: undefined } : u)),
    );

    auditManager.recordLog({
      actorName: admin.name,
      actorRole: admin.role,
      action: 'USER_REINSTATED',
      targetEntity: `User: @${user.username} (${user.id})`,
      details: 'Account reinstated to ACTIVE status by moderator.',
      diff: { before: { status: user.status }, after: { status: 'ACTIVE' } },
    });
  };

  const handleToggleVerified = (user: UserRecord) => {
    const nextVerified = !user.isVerified;
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, isVerified: nextVerified } : u)),
    );

    auditManager.recordLog({
      actorName: admin.name,
      actorRole: admin.role,
      action: nextVerified ? 'BADGE_GRANTED' : 'BADGE_REVOKED',
      targetEntity: `User: @${user.username}`,
      details: `Verified creator badge ${nextVerified ? 'granted' : 'revoked'}.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">User Management</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Audit user accounts, enforce moderation strikes, manage minor safety, and oversee creator credentials.
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by username, display name, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="WARNED">Warned</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none"
          >
            <option value="ALL">All Roles</option>
            <option value="USER">User</option>
            <option value="CREATOR">Creator</option>
            <option value="MODERATOR">Moderator</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-zinc-950/70 border-b border-zinc-800 text-xs uppercase font-semibold text-zinc-400">
              <tr>
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Role & Status</th>
                <th className="py-3.5 px-4">Safety Flags</th>
                <th className="py-3.5 px-4">Interests & Audience</th>
                <th className="py-3.5 px-4">Strikes</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-zinc-850/40 transition">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-zinc-200">
                        {user.displayName.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-white">@{user.username}</span>
                          {user.isVerified && (
                            <BadgeCheck className="w-4 h-4 text-rose-500 fill-rose-500/20" />
                          )}
                        </div>
                        <span className="text-xs text-zinc-500 block">{user.displayName}</span>
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-zinc-300">
                        {user.role}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-bold ${
                          user.status === 'ACTIVE'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : user.status === 'WARNED'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}
                      >
                        {user.status}
                      </span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    {user.isMinor ? (
                      <span className="bg-indigo-950 text-indigo-400 border border-indigo-800 text-[11px] px-2 py-0.5 rounded-full font-bold">
                        Minor Protected (&lt;18)
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-500">Standard Account</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="text-xs">
                      <span className="text-zinc-200 font-medium">{user.interestsCount} interests</span>
                      <span className="text-zinc-500 block">
                        {user.followersCount.toLocaleString()} followers
                      </span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`font-mono text-xs font-bold ${
                        user.strikes > 0 ? 'text-rose-400' : 'text-zinc-500'
                      }`}
                    >
                      {user.strikes} / 3
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowDetailModal(true);
                        }}
                        className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition"
                        title="View Profile Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {canManage && (
                        <>
                          <button
                            onClick={() => handleToggleVerified(user)}
                            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition"
                            title={user.isVerified ? 'Revoke Verified Badge' : 'Grant Verified Badge'}
                          >
                            <BadgeCheck className="w-3.5 h-3.5" />
                          </button>

                          {user.status !== 'SUSPENDED' ? (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedUser(user);
                                  setShowWarnModal(true);
                                }}
                                className="p-1.5 bg-amber-950/80 hover:bg-amber-900 text-amber-400 border border-amber-800 rounded-lg transition"
                                title="Issue Warning Strike"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedUser(user);
                                  setShowSuspendModal(true);
                                }}
                                className="p-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-400 border border-rose-800 rounded-lg transition"
                                title="Suspend Account"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleReinstateUser(user)}
                              className="p-1.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-400 border border-emerald-800 rounded-lg transition"
                              title="Reinstate Account"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Warn Modal */}
      {showWarnModal && selectedUser && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Issue Warning Strike to @{selectedUser.username}
            </h2>
            <p className="text-xs text-zinc-400">
              The user will receive an in-app compliance notice. 3 strikes result in automatic account suspension.
            </p>
            <textarea
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-amber-500 h-24"
              placeholder="Specify rule violation (e.g. tag manipulation, comment flood)..."
              value={warnReason}
              onChange={(e) => setWarnReason(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowWarnModal(false)}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleWarnUser}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition"
              >
                Issue Strike
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Modal */}
      {showSuspendModal && selectedUser && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Ban className="w-5 h-5 text-rose-500" />
              Suspend @{selectedUser.username}
            </h2>
            <p className="text-xs text-zinc-400">
              Suspends user sessions immediately. Feed ranking and reel distribution will be paused.
            </p>
            <textarea
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-rose-500 h-24"
              placeholder="State formal reason for account suspension..."
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowSuspendModal(false)}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSuspendUser}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-rose-900/40"
              >
                Confirm Suspension
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      {showDetailModal && selectedUser && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-lg font-bold text-white">User Record Inspection</h2>
              <button onClick={() => setShowDetailModal(false)}>
                <X className="w-5 h-5 text-zinc-400 hover:text-white" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-zinc-800">
                <span className="text-zinc-500">User UUID</span>
                <span className="font-mono text-zinc-300">{selectedUser.id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800">
                <span className="text-zinc-500">Username</span>
                <span className="font-bold text-white">@{selectedUser.username}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800">
                <span className="text-zinc-500">Contact Email</span>
                <span className="text-zinc-300">{selectedUser.email}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800">
                <span className="text-zinc-500">Account Type</span>
                <span className="text-indigo-400 font-bold">{selectedUser.role}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800">
                <span className="text-zinc-500">Minor Protection Active</span>
                <span className={selectedUser.isMinor ? 'text-rose-400 font-bold' : 'text-zinc-400'}>
                  {selectedUser.isMinor ? 'YES (Age-Gate Protected)' : 'NO'}
                </span>
              </div>
              {selectedUser.warningNote && (
                <div className="bg-amber-950/40 border border-amber-800/60 p-3 rounded-xl text-amber-300">
                  <span className="font-bold block mb-1">Active Warning:</span>
                  {selectedUser.warningNote}
                </div>
              )}
              {selectedUser.suspensionReason && (
                <div className="bg-rose-950/40 border border-rose-800/60 p-3 rounded-xl text-rose-300">
                  <span className="font-bold block mb-1">Suspension Reason:</span>
                  {selectedUser.suspensionReason}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
