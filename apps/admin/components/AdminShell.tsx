'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Film,
  ShieldAlert,
  Network,
  SlidersHorizontal,
  BarChart3,
  Wallet,
  ScrollText,
  ShieldCheck,
  UserCheck,
  Lock,
  Scale,
} from 'lucide-react';
import { useAdminAuth, AdminRole, AdminPermission } from '../lib/rbac';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: AdminPermission;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'User Management', href: '/users', icon: Users, permission: AdminPermission.MANAGE_USERS },
  { name: 'Content Review', href: '/content-review', icon: Film, permission: AdminPermission.REVIEW_CONTENT },
  { name: 'Report Queue', href: '/reports', icon: ShieldAlert, permission: AdminPermission.MANAGE_REPORTS },
  { name: 'Legal & Compliance', href: '/compliance', icon: Scale, permission: AdminPermission.MANAGE_COMPLIANCE },
  { name: 'Taxonomy Editor', href: '/taxonomy', icon: Network, permission: AdminPermission.EDIT_TAXONOMY },
  { name: 'Feature Flags', href: '/feature-flags', icon: SlidersHorizontal, permission: AdminPermission.MANAGE_FEATURE_FLAGS },
  { name: 'Platform Analytics', href: '/analytics', icon: BarChart3, permission: AdminPermission.VIEW_ANALYTICS },
  { name: 'Creator Payouts', href: '/payouts', icon: Wallet, permission: AdminPermission.MANAGE_PAYOUTS },
  { name: 'Audit Logs', href: '/audit-logs', icon: ScrollText, permission: AdminPermission.VIEW_AUDIT_LOGS },
];

export const AdminShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const { admin, setRole, hasPermission } = useAdminAuth();

  return (
    <div className="min-h-screen flex bg-zinc-950 text-zinc-100">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-zinc-800 bg-zinc-900/50 flex flex-col justify-between shrink-0">
        <div className="p-5">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-indigo-600 flex items-center justify-center font-black text-white text-xl shadow-lg shadow-rose-900/20">
              I
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-white block">
                Interest
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block -mt-1">
                Admin Console
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const isAllowed = !item.permission || hasPermission(item.permission);
              const Icon = item.icon;

              if (!isAllowed) {
                return (
                  <div
                    key={item.href}
                    className="flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl text-zinc-600 cursor-not-allowed select-none"
                    title={`Restricted: Requires ${item.permission}`}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className="w-4 h-4 opacity-40" />
                      <span>{item.name}</span>
                    </div>
                    <Lock className="w-3 h-3 text-zinc-600" />
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-xl transition ${
                    isActive
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 mr-3 ${isActive ? 'text-rose-400' : 'text-zinc-400'}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer with Role Switcher & Geo-Blind Badge */}
        <div className="p-4 border-t border-zinc-800/80 space-y-3">
          {/* Active Admin & Role Switcher */}
          <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                RBAC Role Switcher
              </span>
              <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <select
              value={admin.role}
              onChange={(e) => setRole(e.target.value as AdminRole)}
              className="w-full bg-zinc-950 border border-zinc-700 text-xs rounded-lg px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-rose-500"
            >
              <option value={AdminRole.SUPER_ADMIN}>Super Admin (All Access)</option>
              <option value={AdminRole.MODERATOR}>Content Moderator</option>
              <option value={AdminRole.TAXONOMY_CURATOR}>Taxonomy Curator</option>
              <option value={AdminRole.FINANCE_ADMIN}>Finance Administrator</option>
              <option value={AdminRole.ANALYST}>Platform Analyst</option>
            </select>
          </div>

          {/* Zero-Location Hard Guarantee Badge */}
          <div className="bg-emerald-950/30 border border-emerald-800/40 p-3 rounded-xl">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Geo-Blind Guarantee</span>
            </div>
            <p className="text-[10px] text-zinc-400 leading-snug">
              User location and GPS data are permanently stripped from indexes, ranking, and analytics.
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <span className="text-xs text-zinc-400 font-mono">
              Signed in as: <strong className="text-white">{admin.name}</strong> ({admin.email})
            </span>
            <span className="bg-indigo-950/60 border border-indigo-800/60 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {admin.role}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-xs text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Cluster: Production Global (v1.2)</span>
            </div>
          </div>
        </header>

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
};
