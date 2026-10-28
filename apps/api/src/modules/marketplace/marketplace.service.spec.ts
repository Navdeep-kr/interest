import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketplaceService } from './marketplace.service';
import { DatabaseService } from '../../database/database.service';
import { ContentScannerService } from '../safety/content-scanner.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '@shared/types';

describe('MarketplaceService (Prompt 28 — Creator Marketplace)', () => {
  let service: MarketplaceService;
  let mockContentScanner: any;
  let mockNotificationsService: any;
  let mockDatabaseService: any;
  let mockConfigService: any;

  beforeEach(async () => {
    mockDatabaseService = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };

    mockContentScanner = {
      scanReel: jest.fn().mockImplementation(async (metadata: any) => {
        const text = (metadata.title + ' ' + (metadata.caption || '')).toLowerCase();
        if (text.includes('scam') || text.includes('fraud') || text.includes('illegal')) {
          return {
            action: 'REJECT',
            reasons: ['FINANCIAL_FRAUD_RISK'],
            scores: { nudity: 0, violence: 0, hateSpeech: 0, copyrightMatch: 0, syntheticProbability: 0 },
            isAiGenerated: false,
          };
        }
        return {
          action: 'APPROVE',
          reasons: [],
          scores: { nudity: 0, violence: 0, hateSpeech: 0, copyrightMatch: 0, syntheticProbability: 0 },
          isAiGenerated: false,
        };
      }),
    };

    mockNotificationsService = {
      dispatchNotification: jest.fn().mockResolvedValue({ delivered: true }),
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'CREATOR_MARKETPLACE_ENABLED') return 'true';
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketplaceService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: ContentScannerService, useValue: mockContentScanner },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<MarketplaceService>(MarketplaceService);
  });

  it('should be defined with seeded pilot campaigns', () => {
    expect(service).toBeDefined();
    const metrics = service.getDemandMetrics();
    expect(metrics.totalBrandCampaignsCount).toBeGreaterThanOrEqual(2);
    expect(metrics.isMarketplaceEnabled).toBe(true);
  });

  describe('1. Demand Evaluation & Feature Gate', () => {
    it('aggregates demand metrics across campaigns and interests', () => {
      const metrics = service.getDemandMetrics();
      expect(metrics.totalBrandCampaignsCount).toBe(2);
      expect(metrics.totalCreatorApplicationsCount).toBeGreaterThanOrEqual(1);
      expect(metrics.topInterestsByDemand.length).toBeGreaterThanOrEqual(2);
    });

    it('enforces feature gate when marketplace is disabled pending compliance', async () => {
      service.setMarketplaceEnabled(false);
      const metrics = service.getDemandMetrics();
      expect(metrics.isMarketplaceEnabled).toBe(false);

      await expect(
        service.createCampaign('brand_x', 'Brand X', {
          title: 'Brand Campaign',
          description: 'Valid brief description',
          interestId: 'interest_tech',
          interestName: 'Tech',
          budgetMinCents: 50000,
          budgetMaxCents: 100000,
          requiredDeliverables: ['1 video reel'],
          applicationDeadline: new Date().toISOString(),
          campaignDeadline: new Date().toISOString(),
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('2. Creator Eligibility & Portfolio', () => {
    it('approves eligible creators with >1,000 followers and 0 strikes', () => {
      const eligibility = service.checkEligibility('creator_dan', 2500, 90, 0, true);
      expect(eligibility.isEligible).toBe(true);
      expect(eligibility.ineligibilityReasons.length).toBe(0);
    });

    it('rejects creators with insufficient followers or active strikes', () => {
      const inelig1 = service.checkEligibility('creator_low_followers', 450, 60, 0, true);
      expect(inelig1.isEligible).toBe(false);
      expect(inelig1.ineligibilityReasons).toContain('Requires at least 1000 verified followers.');

      const inelig2 = service.checkEligibility('creator_with_strike', 2000, 60, 1, true);
      expect(inelig2.isEligible).toBe(false);
      expect(inelig2.ineligibilityReasons).toContain('Account has active trust and safety moderation strikes.');
    });

    it('retrieves and updates creator portfolio', () => {
      const creatorId = 'creator_elena_sound';
      const initial = service.getPortfolio(creatorId);
      expect(initial.creatorId).toBe(creatorId);

      const updated = service.updatePortfolio(creatorId, {
        bio: 'Updated bio highlighting analog synthesis and modular patch work.',
        interestCategories: ['Audio Production', 'Sound Design'],
        baseRateCents: 95000,
      });

      expect(updated.baseRateCents).toBe(95000);
      expect(updated.interestCategories).toContain('Sound Design');
    });
  });

  describe('3. Brand Campaigns & Safety Scanning', () => {
    it('creates campaign and opens for applications after passing safety scan', async () => {
      const campaign = await service.createCampaign('brand_synth_corp', 'Synthesizer Labs', {
        title: 'Eurorack Filter Review',
        description: 'Hands-on review of analog filter modules with modular synthesis demo.',
        interestId: 'interest_audio_04',
        interestName: 'Audio Production',
        budgetMinCents: 80000,
        budgetMaxCents: 150000,
        requiredDeliverables: ['1x 60s Reel', '1x Story with link'],
        applicationDeadline: new Date(Date.now() + 86400000).toISOString(),
        campaignDeadline: new Date(Date.now() + 7 * 86400000).toISOString(),
      });

      expect(campaign.id).toBeDefined();
      expect(campaign.status).toBe('OPEN_FOR_APPLICATIONS');
    });

    it('rejects fraudulent or illegal campaign briefs', async () => {
      await expect(
        service.createCampaign('brand_bad', 'Scam Brand', {
          title: 'Guaranteed 100x return financial scam',
          description: 'Promote our illegal scheme',
          interestId: 'interest_crypto',
          interestName: 'Crypto',
          budgetMinCents: 10000,
          budgetMaxCents: 50000,
          requiredDeliverables: ['1 reel'],
          applicationDeadline: new Date().toISOString(),
          campaignDeadline: new Date().toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('4. Application & Contract Workflow', () => {
    const campaignId = 'camp-brand-audio-sponsor-01';

    it('allows eligible creator to apply with pitch and proposed rate', async () => {
      const app = await service.applyToCampaign('user_eligible_creator', 'tech_producer', campaignId, {
        proposedRateCents: 90000,
        pitchNote: 'I will create an immersive studio demo showcasing resonance curves.',
        portfolioSampleLinks: ['https://interest.app/reel/modular_sound_01'],
      });

      expect(app.id).toBeDefined();
      expect(app.status).toBe('PENDING');
      expect(app.proposedRateCents).toBe(90000);
    });

    it('allows brand to accept application and generate contract with notifications', async () => {
      // Elena applied in seed data
      const contract = await service.acceptApplicationAndCreateContract(
        'brand_synthesizer_corp',
        campaignId,
        'app_seed_01',
      );

      expect(contract.id).toBeDefined();
      expect(contract.status).toBe('ACTIVE');
      expect(contract.agreedAmountCents).toBe(85000);
      expect(contract.deliverables.length).toBeGreaterThan(0);
      expect(mockNotificationsService.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user_elena_sound',
          type: NotificationType.CREATOR_MILESTONE,
        }),
      );
    });
  });

  describe('5. Mandatory Sponsorship Disclosures & Deliverable Review', () => {
    let contractId: string;
    let deliverableId: string;

    beforeEach(async () => {
      const contract = await service.acceptApplicationAndCreateContract(
        'brand_synthesizer_corp',
        'camp-brand-audio-sponsor-01',
        'app_seed_01',
      );
      contractId = contract.id;
      deliverableId = contract.deliverables[0].id;
    });

    it('rejects deliverable if sponsorship disclosure is missing', async () => {
      await expect(
        service.submitDeliverable('user_elena_sound', contractId, deliverableId, {
          title: 'My Video Review',
          description: 'No brand disclosure here',
          hasSponsorshipDisclosure: false,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts deliverable with prominent #sponsored disclosure and updates status', async () => {
      const submitted = await service.submitDeliverable('user_elena_sound', contractId, deliverableId, {
        title: 'Analog Filter Demo Reel',
        description: 'Deep dive into sound synthesis #sponsored by Elektronik Audio Labs',
        reelId: 'reel_approved_demo_01',
        hasSponsorshipDisclosure: true,
      });

      expect(submitted.status).toBe('SUBMITTED');
      expect(submitted.hasSponsorshipDisclosure).toBe(true);
    });

    it('allows brand to review deliverable, request changes, and approve', async () => {
      // 1. Submit
      await service.submitDeliverable('user_elena_sound', contractId, deliverableId, {
        title: 'Draft Reel',
        description: '#sponsored demo',
        hasSponsorshipDisclosure: true,
      });

      // 2. Request changes
      const changes = await service.reviewDeliverable('brand_synthesizer_corp', contractId, deliverableId, {
        approved: false,
        feedbackNotes: 'Please boost the audio level on the resonance test.',
      });
      expect(changes.status).toBe('CHANGES_REQUESTED');

      // 3. Resubmit and Approve
      await service.submitDeliverable('user_elena_sound', contractId, deliverableId, {
        title: 'Draft Reel v2',
        description: '#sponsored demo with boosted audio',
        hasSponsorshipDisclosure: true,
      });

      const approved = await service.reviewDeliverable('brand_synthesizer_corp', contractId, deliverableId, {
        approved: true,
        feedbackNotes: 'Approved! Excellent resonance clarity.',
      });
      expect(approved.status).toBe('APPROVED');
    });
  });

  describe('6. Dispute Escalation & Formal Resolution', () => {
    let contractId: string;

    beforeEach(async () => {
      const contract = await service.acceptApplicationAndCreateContract(
        'brand_synthesizer_corp',
        'camp-brand-audio-sponsor-01',
        'app_seed_01',
      );
      contractId = contract.id;
    });

    it('allows either party to raise formal dispute into DISPUTED state', () => {
      const dispute = service.raiseDispute('brand_synthesizer_corp', contractId, {
        reason: 'Deliverable does not meet agreed technical specifications.',
        evidenceDescription: 'Filter sweep was not included in final cut.',
      });

      expect(dispute.status).toBe('OPENED');
      const contract = service.getContract('brand_synthesizer_corp', contractId);
      expect(contract.status).toBe('DISPUTED');
    });

    it('allows moderator to resolve dispute and update contract state', () => {
      service.raiseDispute('brand_synthesizer_corp', contractId, {
        reason: 'Specification mismatch',
        evidenceDescription: 'Missing feature',
      });

      const resolved = service.resolveDispute('moderator_trust_safety', contractId, {
        resolution: 'RESOLVED_CREATOR',
        moderatorNotes: 'Creator satisfied all requirements outlined in initial brief.',
      });

      expect(resolved.status).toBe('RESOLVED_CREATOR');
      const contract = service.getContract('brand_synthesizer_corp', contractId);
      expect(contract.status).toBe('APPROVED');
    });
  });

  describe('7. Direct Payment Reconciliation (No Custody / No Escrow)', () => {
    let contractId: string;

    beforeEach(async () => {
      const contract = await service.acceptApplicationAndCreateContract(
        'brand_synthesizer_corp',
        'camp-brand-audio-sponsor-01',
        'app_seed_01',
      );
      contractId = contract.id;
      // Approve all deliverables
      for (const d of contract.deliverables) {
        await service.submitDeliverable('user_elena_sound', contractId, d.id, {
          title: 'Deliv',
          description: '#sponsored',
          hasSponsorshipDisclosure: true,
        });
        await service.reviewDeliverable('brand_synthesizer_corp', contractId, d.id, {
          approved: true,
        });
      }
    });

    it('reconciles direct payment invoice with strict platform custody avoidance guarantee', () => {
      const reconciliation = service.reconcilePayment('brand_synthesizer_corp', contractId, {
        paymentProvider: 'STRIPE_DIRECT_INVOICE',
        externalInvoiceId: 'in_stripe_direct_99214',
        amountCents: 85000,
        currency: 'USD',
      });

      expect(reconciliation.isPlatformCustodyAvoided).toBe(true);
      expect(reconciliation.paymentProvider).toBe('STRIPE_DIRECT_INVOICE');

      const contract = service.getContract('brand_synthesizer_corp', contractId);
      expect(contract.status).toBe('FULFILLED');
      expect(contract.completedAt).toBeDefined();
    });
  });
});
