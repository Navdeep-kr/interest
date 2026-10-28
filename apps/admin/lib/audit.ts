'use client';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetEntity: string;
  details: string;
  diff?: {
    before?: unknown;
    after?: unknown;
  };
}

const initialAuditLogs: AuditLogEntry[] = [
  {
    id: 'log_001',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    actorName: 'Alex Rivera',
    actorRole: 'SUPER_ADMIN',
    action: 'FLAG_TOGGLED',
    targetEntity: 'FeatureFlag: STRICT_ZERO_LOCATION_CI',
    details: 'Enforced zero-location validation on feed candidate generation.',
    diff: { before: { enabled: true, rollout: 90 }, after: { enabled: true, rollout: 100 } },
  },
  {
    id: 'log_002',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    actorName: 'Sarah Chen',
    actorRole: 'MODERATOR',
    action: 'REEL_REMOVED',
    targetEntity: 'Reel: 8f4a-99d1 (Watermark spam)',
    details: 'Removed reel for prominent external promotional watermark.',
  },
  {
    id: 'log_003',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    actorName: 'Marcus Vance',
    actorRole: 'FINANCE_ADMIN',
    action: 'PAYOUT_APPROVED',
    targetEntity: 'Payout: pout_66d6117f ($750.00 to @coffee_artisan)',
    details: 'Approved net Stripe Connect transfer after W-9 verification.',
  },
  {
    id: 'log_004',
    timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    actorName: 'Elena Rostova',
    actorRole: 'TAXONOMY_CURATOR',
    action: 'TAXONOMY_ADDED',
    targetEntity: 'Node: Quantum Error Correction (Niche)',
    details: 'Added sub-niche under Quantum Computing with 512-d unit vector.',
  },
  {
    id: 'log_005',
    timestamp: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    actorName: 'Sarah Chen',
    actorRole: 'MODERATOR',
    action: 'USER_WARNED',
    targetEntity: 'User: @bot_spammer_9',
    details: 'Issued official warning for tag manipulation across 5 reels.',
  },
];

class AuditLogManager {
  private logs: AuditLogEntry[] = [...initialAuditLogs];
  private listeners: Array<() => void> = [];

  getLogs(): AuditLogEntry[] {
    return [...this.logs];
  }

  recordLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) {
    const newEntry: AuditLogEntry = {
      ...entry,
      id: `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
    };
    this.logs.unshift(newEntry);
    this.listeners.forEach((listener) => listener());
    return newEntry;
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}

export const auditManager = new AuditLogManager();
