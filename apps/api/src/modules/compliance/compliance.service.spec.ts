import { Test, TestingModule } from '@nestjs/testing';
import { ComplianceConsentService } from './compliance-consent.service';
import { ComplianceExportService } from './compliance-export.service';
import { ComplianceDeletionService } from './compliance-deletion.service';
import { ComplianceDmcaService } from './compliance-dmca.service';
import { ComplianceGrievanceService } from './compliance-grievance.service';
import { DatabaseService } from '../../database/database.service';
import {
  ConsentPurpose,
  ConsentStatus,
  ComplianceJurisdiction,
  DmcaStatus,
  GrievanceCategory,
  GrievanceStatus,
} from '@shared/types';

describe('Compliance Services (GDPR, DPDP, CCPA, COPPA, DMCA, Grievance)', () => {
  let consentService: ComplianceConsentService;
  let exportService: ComplianceExportService;
  let deletionService: ComplianceDeletionService;
  let dmcaService: ComplianceDmcaService;
  let grievanceService: ComplianceGrievanceService;
  let mockDatabaseService: any;

  beforeEach(async () => {
    mockDatabaseService = {
      query: jest.fn().mockImplementation((queryText: string, params: any[]) => {
        if (queryText.includes('FROM users WHERE id =')) {
          return Promise.resolve({
            rows: [
              {
                id: params[0],
                username: 'alex_creator',
                display_name: 'Alex Creator',
                email: 'alex@example.com',
                bio: 'AI researcher and video artist',
                avatar_url: 'https://cdn.interest.app/avatars/alex.jpg',
                preferred_languages: ['en'],
                is_minor: false,
                is_verified: true,
                created_at: new Date(),
                updated_at: new Date(),
              },
            ],
          });
        }
        if (queryText.includes('FROM reels WHERE id =')) {
          return Promise.resolve({
            rows: [{ id: params[0], creator_id: 'creator-uuid-1', title: 'Infringing Clip' }],
          });
        }
        if (queryText.includes('FROM user_interests')) {
          return Promise.resolve({ rows: [] });
        }
        if (queryText.includes('FROM comments')) {
          return Promise.resolve({ rows: [] });
        }
        if (queryText.includes('FROM saved_collections')) {
          return Promise.resolve({ rows: [] });
        }
        if (queryText.includes('FROM user_consents')) {
          return Promise.resolve({ rows: [] });
        }
        if (queryText.includes('FROM creator_payout_invoices')) {
          return Promise.resolve({ rows: [] });
        }
        if (queryText.includes('FROM account_deletion_requests')) {
          return Promise.resolve({ rows: [] });
        }
        if (queryText.includes('compliance_grievances')) {
          return Promise.resolve({
            rows: [
              {
                id: 'grv-uuid-1',
                ticket_number: params[params.length - 1] || 'GRV-2026-F1E2D3',
                user_id: 'user-1',
                complainant_name: 'Rohan Verma',
                complainant_email: 'rohan@example.in',
                category: GrievanceCategory.DPDP_DATA_PROTECTION,
                subject: 'Consent withdrawal delay',
                description: 'Need confirmation of consent withdrawal',
                status: GrievanceStatus.SUBMITTED,
                assigned_officer: 'Priya Sharma',
                acknowledgement_sla_deadline: new Date(Date.now() + 72 * 3600 * 1000),
                resolution_sla_deadline: new Date(Date.now() + 15 * 86400 * 1000),
                created_at: new Date(),
              },
            ],
          });
        }
        if (queryText.includes('FROM dmca_takedowns')) {
          return Promise.resolve({
            rows: [
              {
                id: 'dmca-uuid-1',
                ticket_number: params[0],
                reel_id: 'reel-uuid-1',
                creator_id: 'creator-uuid-1',
                claimant_name: 'Universal Media',
                claimant_email: 'legal@universal.com',
                copyrighted_work_description: 'Audio Track 4',
                infringing_material_url: 'https://interest.app/reel/1',
                status: DmcaStatus.CONTENT_REMOVED,
                created_at: new Date(),
              },
            ],
          });
        }
        return Promise.resolve({ rows: [], rowCount: 1 });
      }),
      getClient: jest.fn().mockResolvedValue({
        query: jest.fn().mockImplementation((queryText: string) => {
          if (queryText.includes('strike_count')) {
            return Promise.resolve({ rows: [{ strike_count: '1' }] });
          }
          return Promise.resolve({ rows: [], rowCount: 1 });
        }),
        release: jest.fn(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplianceConsentService,
        ComplianceExportService,
        ComplianceDeletionService,
        ComplianceDmcaService,
        ComplianceGrievanceService,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    consentService = module.get<ComplianceConsentService>(ComplianceConsentService);
    exportService = module.get<ComplianceExportService>(ComplianceExportService);
    deletionService = module.get<ComplianceDeletionService>(ComplianceDeletionService);
    dmcaService = module.get<ComplianceDmcaService>(ComplianceDmcaService);
    grievanceService = module.get<ComplianceGrievanceService>(ComplianceGrievanceService);
  });

  // --------------------------------------------------------------------------
  // 1. Consent Flows & Minor Protection
  // --------------------------------------------------------------------------
  describe('Consent Flows (GDPR, DPDP, CCPA, COPPA)', () => {
    it('should update user consents and persist records', async () => {
      const res = await consentService.updateConsents('user-adult-1', {
        consents: [
          {
            purpose: ConsentPurpose.ESSENTIAL_TERMS,
            status: ConsentStatus.CONSENTED,
            jurisdiction: ComplianceJurisdiction.GDPR,
          },
          {
            purpose: ConsentPurpose.INTEREST_RECOMMENDATIONS,
            status: ConsentStatus.CONSENTED,
            jurisdiction: ComplianceJurisdiction.GDPR,
          },
        ],
      });

      expect(res.success).toBe(true);
      expect(res.count).toBe(2);
    });

    it('should enforce CCPA Do Not Sell/Share Opt-Out', async () => {
      const res = await consentService.processCcpaOptOut('user-ccpa-1', {
        doNotSellOrShare: true,
      });

      expect(res.success).toBe(true);
      expect(res.optOutActive).toBe(true);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_consents'),
        expect.arrayContaining(['CCPA']),
      );
    });

    it('should validate COPPA age eligibility accurately', () => {
      const currentYear = new Date().getFullYear();

      // Child under 13: strictly disallowed
      const under13 = consentService.validateCoppaEligibility(currentYear - 11);
      expect(under13.allowed).toBe(false);
      expect(under13.isMinor).toBe(true);
      expect(under13.reason).toContain('COPPA');

      // Minor 13-17: allowed with minor safety defaults
      const teen = consentService.validateCoppaEligibility(currentYear - 15);
      expect(teen.allowed).toBe(true);
      expect(teen.isMinor).toBe(true);

      // Adult 18+: allowed without minor restrictions
      const adult = consentService.validateCoppaEligibility(currentYear - 25);
      expect(adult.allowed).toBe(true);
      expect(adult.isMinor).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Data Subject Access & Export
  // --------------------------------------------------------------------------
  describe('Data Portability (GDPR Art. 20, DPDP Sec. 11)', () => {
    it('should request a data export and return a signed download token', async () => {
      const exportReq = await exportService.requestDataExport('user-alex-1');

      expect(exportReq.id).toBeDefined();
      expect(exportReq.downloadToken).toBeDefined();
      expect(exportReq.format).toBe('JSON');
      expect(exportReq.expiresAt).toBeDefined();
    });

    it('should compile a complete, zero-location machine-readable data bundle', async () => {
      const bundle = await exportService.generateExportBundle('user-alex-1');

      expect(bundle.complianceMetadata).toBeDefined();
      expect(bundle.complianceMetadata.zeroLocationStatement).toBeDefined();
      expect(bundle.account.username).toBe('alex_creator');
      expect(bundle.interestTaxonomyProfile).toBeDefined();
      expect(bundle.contentAndCreations).toBeDefined();
      expect(bundle.consentsHistory).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // 3. Right to Erasure & 30-Day Grace Period
  // --------------------------------------------------------------------------
  describe('Right to Erasure (GDPR Art. 17, DPDP Sec. 12)', () => {
    it('should initiate a 30-day reversible grace period and freeze public content', async () => {
      const res = await deletionService.requestAccountDeletion('user-delete-1', {
        confirmImmediateFreeze: true,
        reason: 'Switching to another platform',
      });

      expect(res.id).toBeDefined();
      expect(res.gracePeriodEndsAt).toBeDefined();
      expect(new Date(res.gracePeriodEndsAt).getTime()).toBeGreaterThan(Date.now() + 28 * 86400 * 1000);
    });

    it('should allow user to cancel deletion during the grace period', async () => {
      const res = await deletionService.cancelAccountDeletion('user-delete-1');
      expect(res.success).toBe(true);
      expect(res.message).toContain('restored');
    });

    it('should execute permanent crypto-shredding and anonymize financial records', async () => {
      const res = await deletionService.executePermanentDeletion('user-delete-1');
      expect(res.shredded).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 4. DMCA Notice & Counter-Notice Workflow
  // --------------------------------------------------------------------------
  describe('DMCA Takedown Workflow (17 U.S.C. § 512)', () => {
    it('should process a valid DMCA notice and disable infringing reel', async () => {
      const notice = await dmcaService.submitDmcaNotice({
        reelId: 'reel-infringing-1',
        claimantName: 'Warner Music Group',
        claimantEmail: 'dmca@wmg.com',
        copyrightedWorkDescription: 'Master recording of Track XYZ',
        infringingMaterialUrl: 'https://interest.app/reel/reel-infringing-1',
        goodFaithBeliefStatement: true,
        accuracyUnderPenaltyOfPerjury: true,
        electronicSignature: 'Warner Music Legal',
      });

      expect(notice.ticketNumber).toMatch(/^DMCA-\d{4}-[A-F0-9]{6}$/);
      expect(notice.status).toBe(DmcaStatus.CONTENT_REMOVED);
    });

    it('should accept a creator counter-notice and schedule a 14-day restoration date', async () => {
      const counter = await dmcaService.submitCounterNotice({
        ticketNumber: 'DMCA-2026-A1B2C3',
        creatorName: 'Alex Creator',
        creatorEmail: 'alex@example.com',
        counterNoticeStatement: 'I have full commercial sync rights to this track under Creative Commons.',
        consentToJurisdiction: true,
        statementUnderPenaltyOfPerjury: true,
        electronicSignature: 'Alex Creator',
      });

      expect(counter.status).toBe(DmcaStatus.RESTORATION_SCHEDULED);
      expect(counter.restorationDate).toBeDefined();
      expect(new Date(counter.restorationDate!).getTime()).toBeGreaterThan(Date.now() + 13 * 86400 * 1000);
    });
  });

  // --------------------------------------------------------------------------
  // 5. India DPDP Act Grievance Redressal Mechanism
  // --------------------------------------------------------------------------
  describe('Grievance Redressal (India DPDP Act & IT Rules 2021)', () => {
    it('should register a grievance and establish 72h acknowledgment and 15-day resolution deadlines', async () => {
      const grievance = await grievanceService.submitGrievance({
        complainantName: 'Rohan Verma',
        complainantEmail: 'rohan@example.in',
        category: GrievanceCategory.DPDP_DATA_PROTECTION,
        subject: 'Inquiry regarding personal data processing',
        description: 'Please provide details on interest vector retention.',
      });

      expect(grievance.ticketNumber).toMatch(/^GRV-\d{4}-[A-F0-9]{6}$/);
      expect(grievance.status).toBe(GrievanceStatus.SUBMITTED);
      expect(grievance.assignedOfficer).toBe('Priya Sharma');

      // Verify 72-hour acknowledgment SLA
      const ackTime = new Date(grievance.acknowledgementSlaDeadline).getTime();
      expect(ackTime).toBeGreaterThan(Date.now() + 70 * 3600 * 1000);
      expect(ackTime).toBeLessThanOrEqual(Date.now() + 73 * 3600 * 1000);

      // Verify 15-day resolution SLA
      const resTime = new Date(grievance.resolutionSlaDeadline).getTime();
      expect(resTime).toBeGreaterThan(Date.now() + 14 * 86400 * 1000);
    });

    it('should acknowledge grievance ticket and update status', async () => {
      const ack = await grievanceService.acknowledgeGrievance('GRV-2026-F1E2D3');
      expect(ack.ticketNumber).toBe('GRV-2026-F1E2D3');
    });

    it('should update grievance status with resolution summary', async () => {
      const resolved = await grievanceService.updateGrievanceStatus('GRV-2026-F1E2D3', {
        status: GrievanceStatus.RESOLVED,
        resolutionSummary: 'Interest vector retention policy clarified to complainant. All historical vectors purged.',
      });

      expect(resolved.ticketNumber).toBe('GRV-2026-F1E2D3');
    });
  });
});
