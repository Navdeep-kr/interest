import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CompliancePrivacyService } from '../../src/modules/compliance/compliance-privacy.service';
import { ComplianceDeletionService } from '../../src/modules/compliance/compliance-deletion.service';
import { ComplianceExportService } from '../../src/modules/compliance/compliance-export.service';
import { ComplianceGrievanceService } from '../../src/modules/compliance/compliance-grievance.service';
import { DatabaseService } from '../../src/database/database.service';
import {
  AccountDeletionStatus,
  DataExportStatus,
  GrievanceCategory,
  GrievanceStatus,
} from '@shared/types';

describe('Prompt 20 — Privacy, Account Deletion & Data Governance Gate Test Suite', () => {
  let privacyService: CompliancePrivacyService;
  let deletionService: ComplianceDeletionService;
  let exportService: ComplianceExportService;
  let grievanceService: ComplianceGrievanceService;
  let mockDb: any;
  let mockClient: any;

  beforeEach(async () => {
    mockClient = {
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
      release: jest.fn(),
    };

    mockDb = {
      query: jest.fn(),
      getClient: jest.fn().mockResolvedValue(mockClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompliancePrivacyService,
        ComplianceDeletionService,
        ComplianceExportService,
        ComplianceGrievanceService,
        {
          provide: DatabaseService,
          useValue: mockDb,
        },
      ],
    }).compile();

    privacyService = module.get<CompliancePrivacyService>(CompliancePrivacyService);
    deletionService = module.get<ComplianceDeletionService>(ComplianceDeletionService);
    exportService = module.get<ComplianceExportService>(ComplianceExportService);
    grievanceService = module.get<ComplianceGrievanceService>(ComplianceGrievanceService);
  });

  // ==========================================================================
  // 1. PRIVACY SETTINGS & PUBLIC / PRIVATE ACCOUNT CONTROLS
  // ==========================================================================
  describe('1. Privacy Settings & Public/Private Controls', () => {
    it('retrieves user privacy settings accurately', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            is_minor: false,
            is_private_account: false,
            allow_search_discovery: true,
            messaging_permission: 'EVERYONE',
            commenting_permission: 'EVERYONE',
            activity_status_visible: true,
            personalized_ads_enabled: true,
          },
        ],
      });

      const settings = await privacyService.getPrivacySettings('user-adult-1');
      expect(settings.isPrivateAccount).toBe(false);
      expect(settings.allowSearchDiscovery).toBe(true);
      expect(settings.messagingPermission).toBe('EVERYONE');
      expect(settings.personalizedAdsConsent).toBe(true);
      expect(settings.isMinor).toBe(false);
    });

    it('updates privacy settings: enables private account and restricts messaging to followers', async () => {
      mockDb.query
        // 1. User check (not minor)
        .mockResolvedValueOnce({ rows: [{ is_minor: false }] })
        // 2. Update query
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        // 3. Re-fetch query
        .mockResolvedValueOnce({
          rows: [
            {
              is_minor: false,
              is_private_account: true,
              allow_search_discovery: false,
              messaging_permission: 'FOLLOWERS_ONLY',
              commenting_permission: 'FOLLOWERS_ONLY',
              activity_status_visible: false,
              personalized_ads_enabled: false,
            },
          ],
        });

      const updated = await privacyService.updatePrivacySettings('user-adult-1', {
        isPrivateAccount: true,
        allowSearchDiscovery: false,
        messagingPermission: 'FOLLOWERS_ONLY',
        commentingPermission: 'FOLLOWERS_ONLY',
        activityStatusVisible: false,
        personalizedAdsConsent: false,
      });

      expect(updated.isPrivateAccount).toBe(true);
      expect(updated.allowSearchDiscovery).toBe(false);
      expect(updated.messagingPermission).toBe('FOLLOWERS_ONLY');
      expect(updated.personalizedAdsConsent).toBe(false);
    });

    it('strictly prohibits minors from consenting to personalized advertising (COPPA / DPDP)', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ is_minor: true }] }); // User is minor!

      await expect(
        privacyService.updatePrivacySettings('user-minor-1', {
          personalizedAdsConsent: true,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ==========================================================================
  // 2. ACTIVE DEVICE SESSIONS & REMOTE REVOCATION
  // ==========================================================================
  describe('2. Active Device Sessions & Revocation (Zero-Location Policy)', () => {
    it('retrieves active sessions without IP or location coordinates', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'sess-1',
            device_name: 'iPhone 15 Pro',
            user_agent: 'Interest/1.0 (iOS 18)',
            last_active_at: new Date(),
            created_at: new Date(),
          },
          {
            id: 'sess-2',
            device_name: 'Chrome on Windows',
            user_agent: 'Mozilla/5.0 Chrome/120',
            last_active_at: new Date(),
            created_at: new Date(),
          },
        ],
      });

      const sessions = await privacyService.getUserSessions('user-1', 'sess-1');
      expect(sessions.length).toBe(2);
      expect(sessions[0].id).toBe('sess-1');
      expect(sessions[0].isCurrentSession).toBe(true);
      expect(sessions[1].isCurrentSession).toBe(false);
      // Zero location guarantee: no ip or geo fields returned
      expect((sessions[0] as any).ipAddress).toBeUndefined();
    });

    it('revokes a specific device session', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'sess-2' }], rowCount: 1 });

      const res = await privacyService.revokeSession('user-1', 'sess-2');
      expect(res.success).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SET revoked = TRUE'),
        ['sess-2', 'user-1'],
      );
    });

    it('revokes all other device sessions except current', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'sess-2' }, { id: 'sess-3' }], rowCount: 2 });

      const res = await privacyService.revokeAllOtherSessions('user-1', 'sess-current');
      expect(res.revokedCount).toBe(2);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('id != $2'),
        ['user-1', 'sess-current'],
      );
    });
  });

  // ==========================================================================
  // 3. DATA SUBJECT EXPORT (GDPR ART. 20 / INDIA DPDP SEC. 11)
  // ==========================================================================
  describe('3. Machine-Readable Data Subject Export', () => {
    it('requests data export and generates 48-hour download token', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const req = await exportService.requestDataExport('user-1');
      expect(req.status).toBe(DataExportStatus.PENDING);
      expect(req.format).toBe('JSON');
      expect(req.downloadToken).toBeDefined();
      expect(req.downloadToken!.length).toBe(64); // 32-byte hex string
    });

    it('generates machine-readable export bundle covering profile, interests, and activity', async () => {
      // 1. Profile
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'user-1',
            username: 'alice',
            display_name: 'Alice W',
            email: 'alice@example.com',
            is_minor: false,
            created_at: new Date(),
          },
        ],
      });
      // 2. Interests
      mockDb.query.mockResolvedValueOnce({
        rows: [{ interest_id: 'int-1', title: 'Generative AI', affinity_weight: 0.9 }],
      });
      // 3. Reels
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'reel-1', title: 'My Coding Reel', duration_seconds: 30 }],
      });
      // 4. Comments
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'comm-1', text: 'Great point!' }],
      });
      // 5. Saved collections
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'col-1', name: 'Favorites' }],
      });
      // 6. Consents
      mockDb.query.mockResolvedValueOnce({
        rows: [{ purpose: 'ANALYTICS', status: 'CONSENTED' }],
      });
      // 7. Invoices
      mockDb.query.mockResolvedValueOnce({
        rows: [{ invoice_number: 'INV-1' }],
      });

      const bundle = await exportService.generateExportBundle('user-1');
      expect(bundle.account.username).toBe('alice');
      expect(bundle.interestTaxonomyProfile.length).toBe(1);
      expect(bundle.contentAndCreations.reels.length).toBe(1);
      expect(bundle.complianceMetadata.zeroLocationStatement).toBeDefined();
    });
  });

  // ==========================================================================
  // 4. ACCOUNT DELETION REQUEST & 30-DAY GRACE PERIOD
  // ==========================================================================
  describe('4. Account Deletion Request & 30-Day Cooling-off Period', () => {
    it('initiates account deletion: queues retryable job, freezes reels, deactivates account, and revokes sessions', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] }); // No existing pending request

      const res = await deletionService.requestAccountDeletion('user-retiring-1', {
        confirmImmediateFreeze: true,
        reason: 'Switching platforms',
      });

      expect(res.status).toBe(AccountDeletionStatus.PENDING_GRACE_PERIOD);

      // Verify transaction queries
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      // 1. Insert deletion request
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO account_deletion_requests'),
        expect.arrayContaining(['user-retiring-1', 'Switching platforms']),
      );
      // 2. Insert retryable deletion job
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO account_deletion_jobs'),
        expect.arrayContaining(['user-retiring-1']),
      );
      // 3. Reels soft-frozen (ARCHIVED) to remove from discovery
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'ARCHIVED'"),
        ['user-retiring-1'],
      );
      // 4. Account deactivated
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SET is_active = FALSE'),
        ['user-retiring-1'],
      );
      // 5. Sessions force-revoked
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SET revoked = TRUE'),
        ['user-retiring-1'],
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('cancels account deletion during grace period: restores content, re-activates account, and cancels jobs', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'del-req-1' }], rowCount: 1 });

      const res = await deletionService.cancelAccountDeletion('user-retiring-1');
      expect(res.success).toBe(true);

      // Re-activate user
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SET is_active = TRUE'),
        ['user-retiring-1'],
      );
      // Restore reels
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'PUBLISHED'"),
        ['user-retiring-1'],
      );
      // Cancel pending jobs
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'FAILED', last_error = 'Canceled by user during grace period'"),
        ['user-retiring-1'],
      );
    });
  });

  // ==========================================================================
  // 5. CASCADE DELETION PROPAGATION & RETRYABLE BACKGROUND JOBS
  // ==========================================================================
  describe('5. Cascade Deletion Propagation & Retryable Jobs', () => {
    it('executes complete cascade erasure: purges reels, comments, handsover communities, cancels subscriptions, anonymizes invoices, and crypto-shreds user', async () => {
      mockClient.query.mockImplementation((sql: string) => {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
          return Promise.resolve({ rows: [], rowCount: 1 });
        }
        if (sql.includes('DELETE FROM reels')) {
          return Promise.resolve({ rows: [{ id: 'r1' }, { id: 'r2' }], rowCount: 2 });
        }
        if (sql.includes('DELETE FROM comments')) {
          return Promise.resolve({ rows: [{ id: 'c1' }], rowCount: 1 });
        }
        if (sql.includes('DELETE FROM likes')) {
          return Promise.resolve({ rows: [{ id: 'l1' }], rowCount: 1 });
        }
        if (sql.includes('DELETE FROM saves')) {
          return Promise.resolve({ rows: [{ id: 's1' }], rowCount: 1 });
        }
        if (sql.includes('FROM communities WHERE creator_id')) {
          return Promise.resolve({ rows: [{ id: 'comm-100' }] });
        }
        if (sql.includes('FROM community_memberships')) {
          return Promise.resolve({ rows: [{ user_id: 'admin-successor-1' }] });
        }
        if (sql.includes('UPDATE subscriptions')) {
          return Promise.resolve({ rows: [{ id: 'sub-1' }], rowCount: 1 });
        }
        if (sql.includes('UPDATE messages')) {
          return Promise.resolve({ rows: [{ id: 'msg-1' }, { id: 'msg-2' }], rowCount: 2 });
        }
        if (sql.includes('UPDATE creator_payout_invoices')) {
          return Promise.resolve({ rows: [{ id: 'inv-1' }], rowCount: 1 });
        }
        if (sql.includes('UPDATE user_sessions')) {
          return Promise.resolve({ rows: [{ id: 'sess-1' }], rowCount: 1 });
        }
        return Promise.resolve({ rows: [], rowCount: 1 });
      });

      const report = await deletionService.executePermanentDeletion('user-shred-1');

      expect(report.reelsArchivedOrPurged).toBe(2);
      expect(report.commentsDeleted).toBe(1);
      expect(report.likesAndSavesRemoved).toBe(2);
      expect(report.communitiesHandedOverOrDeactivated).toBe(1);
      expect(report.subscriptionsCancelled).toBe(1);
      expect(report.messagesAnonymized).toBe(2);
      expect(report.financialRecordsAnonymized).toBe(1);
      expect(report.sessionsRevoked).toBe(1);
      // Honest backup disclosure: backup purge timeline is 90 days rolling window
      expect(report.backupPurgeTimelineDays).toBe(90);
    });

    it('executes retryable deletion job and records error state if failure occurs during processing', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'job-err-1',
            request_id: 'req-1',
            user_id: 'user-fail-1',
            status: 'PENDING',
            current_step: 'INIT',
            retry_count: 0,
            max_retries: 3,
          },
        ],
      });

      // Update in progress
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      // Transaction starts and throws simulated storage failure
      mockClient.query.mockImplementationOnce(() => Promise.resolve());
      mockClient.query.mockImplementationOnce(() => {
        throw new Error('Database transaction lock timeout');
      });

      await expect(
        deletionService.executeRetryableDeletionJob('job-err-1'),
      ).rejects.toThrow('Database transaction lock timeout');

      // Verify job status updated with error and incremented retry count
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE account_deletion_jobs'),
        ['PENDING', 1, 'Database transaction lock timeout', 'job-err-1'],
      );
    });
  });

  // ==========================================================================
  // 6. INDIA DPDP ACT 2023 GRIEVANCE REDRESSAL (72H ACK, 15D RESOLUTION SLA)
  // ==========================================================================
  describe('6. India DPDP Act 2023 & Grievance Redressal SLA', () => {
    it('submits grievance with automatic 72-hour acknowledgement and 15-day resolution SLA deadlines', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const grievance = await grievanceService.submitGrievance({
        complainantName: 'Rohan Sharma',
        complainantEmail: 'rohan.sharma@example.in',
        category: GrievanceCategory.DPDP_DATA_PROTECTION,
        subject: 'Inquiry regarding personal data processing under DPDP Act',
        description: 'Requesting confirmation of data fiduciary compliance under Section 6',
      });

      expect(grievance.status).toBe(GrievanceStatus.SUBMITTED);
      expect(grievance.ticketNumber).toContain('GRV-');
      expect(grievance.acknowledgementSlaDeadline).toBeDefined();
      expect(grievance.resolutionSlaDeadline).toBeDefined();

      const ackDiffHours =
        (new Date(grievance.acknowledgementSlaDeadline).getTime() - Date.now()) / (1000 * 60 * 60);
      expect(ackDiffHours).toBeGreaterThan(70);
      expect(ackDiffHours).toBeLessThanOrEqual(73);
    });

    it('Resident Grievance Officer updates status to RESOLVED with formal resolution summary', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'grv-1',
            ticket_number: 'GRV-2026-TEST',
            status: GrievanceStatus.RESOLVED,
            resolution_summary: 'Data fiduciary explanation provided to data principal',
            assigned_officer: 'Resident Grievance Officer (India DPDP)',
            acknowledgement_sla_deadline: new Date(),
            resolution_sla_deadline: new Date(),
            created_at: new Date(),
          },
        ],
      });

      const updated = await grievanceService.updateGrievanceStatus('GRV-2026-TEST', {
        status: GrievanceStatus.RESOLVED,
        resolutionSummary: 'Data fiduciary explanation provided to data principal',
      });

      expect(updated.status).toBe(GrievanceStatus.RESOLVED);
      expect(updated.resolutionSummary).toContain('Data fiduciary explanation');
    });
  });
});
