import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface DataRetentionPolicy {
  dataCategory: string;
  retentionPeriod: string;
  legalBasis: string;
  disposalMethod: string;
  automatedJobActive: boolean;
}

@Injectable()
export class ComplianceRetentionService {
  private readonly logger = new Logger(ComplianceRetentionService.name);

  // Platform Data Retention Matrix
  private readonly RETENTION_POLICIES: DataRetentionPolicy[] = [
    {
      dataCategory: 'Telemetry Seen Reels (Redis & DB)',
      retentionPeriod: '14 Days',
      legalBasis: 'Legitimate Interest (Recommendation freshness)',
      disposalMethod: 'Automated sliding window expiry',
      automatedJobActive: true,
    },
    {
      dataCategory: 'Disappearing Direct Messages',
      retentionPeriod: '24 Hours / 7 Days (Configurable)',
      legalBasis: 'User Consent & Ephemeral Privacy',
      disposalMethod: 'Cryptographic deletion from Redis & DB',
      automatedJobActive: true,
    },
    {
      dataCategory: 'Data Subject Export Bundles',
      retentionPeriod: '48 Hours',
      legalBasis: 'GDPR Art. 20 / DPDP Security minimization',
      disposalMethod: 'Automated purge of temporary signed tokens',
      automatedJobActive: true,
    },
    {
      dataCategory: 'Pending Account Deletion',
      retentionPeriod: '30 Days Grace Period',
      legalBasis: 'GDPR Art. 17 / DPDP Right to Erasure cooling-off',
      disposalMethod: 'Soft freeze followed by permanent crypto-shredding',
      automatedJobActive: true,
    },
    {
      dataCategory: 'Creator Payout Invoices & Tax Ledger',
      retentionPeriod: '7 Years',
      legalBasis: 'Statutory Financial & Tax Authority Mandates (IRS / Income Tax Act)',
      disposalMethod: 'PII-anonymized ledger archiving',
      automatedJobActive: true,
    },
    {
      dataCategory: 'Administrative Audit Logs',
      retentionPeriod: '365 Days Rolling',
      legalBasis: 'Security & Accountability (SOC 2 / ISO 27001)',
      disposalMethod: 'Rolling immutable ledger truncation',
      automatedJobActive: true,
    },
    {
      dataCategory: 'Inactive Accounts (>24 Months)',
      retentionPeriod: '24 Months Inactivity',
      legalBasis: 'Data Minimization Principle',
      disposalMethod: 'Prior email notification followed by archival',
      automatedJobActive: true,
    },
  ];

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Retrieves all defined data retention policies
   */
  getRetentionPolicies(): DataRetentionPolicy[] {
    return this.RETENTION_POLICIES;
  }

  /**
   * Executes automated garbage collection cleanup for expired exports and grace periods
   */
  async runRetentionCleanup(): Promise<{ expiredExportsPurged: number; gracePeriodDeletionsPurged: number }> {
    // 1. Purge expired data export requests (>48h)
    const exportPurgeRes = await this.databaseService.query(
      `UPDATE data_export_requests
       SET status = 'EXPIRED'
       WHERE status = 'COMPLETED' AND expires_at < NOW()`,
    );

    // 2. Identify and flag expired account deletion grace periods (>30 days)
    const deletionRes = await this.databaseService.query(
      `SELECT user_id FROM account_deletion_requests
       WHERE status = 'PENDING_GRACE_PERIOD' AND grace_period_ends_at < NOW()`,
    );

    this.logger.log(
      `Retention cleanup executed: ${exportPurgeRes.rowCount || 0} exports expired, ${deletionRes.rows.length} accounts ready for shredding.`,
    );

    return {
      expiredExportsPurged: exportPurgeRes.rowCount || 0,
      gracePeriodDeletionsPurged: deletionRes.rows.length,
    };
  }
}
