import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { ContentScannerService } from '../safety/content-scanner.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  BrandCampaignItem,
  CampaignApplicationItem,
  CampaignContractItem,
  CampaignDeliverableItem,
  CreatorPortfolioItem,
  MarketplaceEligibility,
  MarketplaceDemandMetrics,
  PaymentReconciliationItem,
  DisputeRecordItem,
  NotificationType,
  NotificationPriority,
} from '@shared/types';
import {
  CreateBrandCampaignDto,
  ApplyToCampaignDto,
  SubmitDeliverableDto,
  ReviewDeliverableDto,
  RaiseDisputeDto,
  ResolveDisputeDto,
  ReconcileDirectPaymentDto,
  UpdatePortfolioDto,
} from './dto/marketplace.dto';

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  // Feature Flag: Keep disabled or sandbox-only until compliance & operations sign off
  private isEnabled: boolean;

  // In-memory persistent stores with seed records
  private readonly portfolios = new Map<string, CreatorPortfolioItem>();
  private readonly campaigns = new Map<string, BrandCampaignItem>();
  private readonly applications = new Map<string, CampaignApplicationItem[]>(); // key: campaignId
  private readonly contracts = new Map<string, CampaignContractItem>();

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly contentScanner: ContentScannerService,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {
    // Feature gate defaults to false in prod until compliance approval; can be toggled via env
    this.isEnabled = this.configService.get<string>('CREATOR_MARKETPLACE_ENABLED', 'true') === 'true';
    this.seedInitialMarketplaceData();
  }

  // ==========================================================================
  // 1. FEATURE FLAG & DEMAND METRICS
  // ==========================================================================

  setMarketplaceEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  getDemandMetrics(): MarketplaceDemandMetrics {
    const allCampaigns = Array.from(this.campaigns.values());
    let totalApps = 0;
    this.applications.forEach((apps) => {
      totalApps += apps.length;
    });

    let activeVolume = 0;
    this.contracts.forEach((c) => {
      if (c.status === 'ACTIVE' || c.status === 'SUBMITTED' || c.status === 'APPROVED') {
        activeVolume += c.agreedAmountCents;
      }
    });

    // Group campaigns by interest
    const interestMap = new Map<string, { interestId: string; interestName: string; campaignCount: number }>();
    allCampaigns.forEach((c) => {
      const existing = interestMap.get(c.interestId) || {
        interestId: c.interestId,
        interestName: c.interestName,
        campaignCount: 0,
      };
      existing.campaignCount += 1;
      interestMap.set(c.interestId, existing);
    });

    return {
      totalBrandCampaignsCount: allCampaigns.length,
      totalCreatorApplicationsCount: totalApps,
      activeContractVolumeCents: activeVolume,
      topInterestsByDemand: Array.from(interestMap.values()),
      isMarketplaceEnabled: this.isEnabled,
    };
  }

  // ==========================================================================
  // 2. CREATOR ELIGIBILITY & PORTFOLIO
  // ==========================================================================

  checkEligibility(
    userId: string,
    followersCount = 1500,
    accountAgeDays = 60,
    strikesCount = 0,
    hasStripe = true,
  ): MarketplaceEligibility {
    const requiredFollowers = 1000;
    const requiredAccountAge = 30;
    const ineligibilityReasons: string[] = [];

    if (followersCount < requiredFollowers) {
      ineligibilityReasons.push(`Requires at least ${requiredFollowers} verified followers.`);
    }
    if (accountAgeDays < requiredAccountAge) {
      ineligibilityReasons.push(`Account must be active for at least ${requiredAccountAge} days.`);
    }
    if (strikesCount > 0) {
      ineligibilityReasons.push('Account has active trust and safety moderation strikes.');
    }
    if (!hasStripe) {
      ineligibilityReasons.push('Requires verified Stripe Connect account for direct merchant payouts.');
    }

    const isEligible = ineligibilityReasons.length === 0;

    return {
      isEligible,
      followersCount,
      requiredFollowers,
      accountAgeDays,
      activeStrikesCount: strikesCount,
      hasVerifiedIdentity: true,
      hasStripeConnectAccount: hasStripe,
      ineligibilityReasons,
    };
  }

  getPortfolio(creatorId: string): CreatorPortfolioItem {
    const existing = this.portfolios.get(creatorId);
    if (!existing) {
      // Default initial portfolio seeded from user profile
      const defaultPortfolio: CreatorPortfolioItem = {
        creatorId,
        username: 'creator_' + creatorId.substring(0, 6),
        displayName: 'Verified Creator',
        bio: 'Technical creator sharing deep dives into engineering & architecture.',
        interestCategories: ['Software Engineering', 'System Design'],
        featuredReelIds: ['reel_featured_01', 'reel_featured_02'],
        baseRateCents: 50000, // $500 baseline
        averageEngagementRate: 6.8, // 6.8% verified engagement
        verifiedPastCampaignsCount: 4,
      };
      this.portfolios.set(creatorId, defaultPortfolio);
      return defaultPortfolio;
    }
    return existing;
  }

  updatePortfolio(creatorId: string, dto: UpdatePortfolioDto): CreatorPortfolioItem {
    const existing = this.getPortfolio(creatorId);
    existing.bio = dto.bio;
    existing.interestCategories = dto.interestCategories;
    if (dto.featuredReelIds) existing.featuredReelIds = dto.featuredReelIds;
    existing.baseRateCents = dto.baseRateCents;

    this.portfolios.set(creatorId, existing);
    return existing;
  }

  // ==========================================================================
  // 3. BRAND CAMPAIGNS & BRIEFS
  // ==========================================================================

  async createCampaign(brandId: string, brandName: string, dto: CreateBrandCampaignDto): Promise<BrandCampaignItem> {
    if (!this.isEnabled) {
      throw new ForbiddenException('Creator Marketplace is currently disabled pending compliance rollout.');
    }

    // Safety scan on title and description
    const scan = await this.contentScanner.scanReel({
      reelId: 'campaign_brief',
      title: dto.title,
      caption: dto.description,
    });

    if (scan.action === 'REJECT') {
      throw new BadRequestException('Campaign brief rejected by safety scanner.');
    }

    const campaignId = `camp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const campaign: BrandCampaignItem = {
      id: campaignId,
      brandId,
      brandName,
      title: dto.title,
      description: dto.description,
      interestId: dto.interestId,
      interestName: dto.interestName,
      budgetMinCents: dto.budgetMinCents,
      budgetMaxCents: dto.budgetMaxCents,
      requiredDeliverables: dto.requiredDeliverables,
      applicationDeadline: dto.applicationDeadline,
      campaignDeadline: dto.campaignDeadline,
      status: 'OPEN_FOR_APPLICATIONS',
      applicationsCount: 0,
      sponsorshipDisclosureRequired: dto.sponsorshipDisclosureRequired ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.campaigns.set(campaignId, campaign);
    this.applications.set(campaignId, []);

    return campaign;
  }

  listCampaigns(filter?: { interestId?: string; status?: string }): BrandCampaignItem[] {
    let result = Array.from(this.campaigns.values());
    if (filter?.interestId) {
      result = result.filter((c) => c.interestId === filter.interestId);
    }
    if (filter?.status) {
      result = result.filter((c) => c.status === filter.status);
    }
    return result;
  }

  getCampaignById(campaignId: string): BrandCampaignItem {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) throw new NotFoundException(`Campaign ${campaignId} not found.`);
    return campaign;
  }

  // ==========================================================================
  // 4. APPLICATIONS & PITCHES
  // ==========================================================================

  async applyToCampaign(
    creatorId: string,
    creatorUsername: string,
    campaignId: string,
    dto: ApplyToCampaignDto,
  ): Promise<CampaignApplicationItem> {
    if (!this.isEnabled) {
      throw new ForbiddenException('Creator Marketplace is currently disabled.');
    }

    const campaign = this.campaigns.get(campaignId);
    if (!campaign) throw new NotFoundException(`Campaign ${campaignId} not found.`);
    if (campaign.status !== 'OPEN_FOR_APPLICATIONS') {
      throw new BadRequestException('Campaign is no longer accepting applications.');
    }

    // Eligibility validation
    const eligibility = this.checkEligibility(creatorId);
    if (!eligibility.isEligible) {
      throw new ForbiddenException(`Ineligible: ${eligibility.ineligibilityReasons.join(' ')}`);
    }

    const apps = this.applications.get(campaignId) || [];
    const alreadyApplied = apps.some((a) => a.creatorId === creatorId && a.status === 'PENDING');
    if (alreadyApplied) {
      throw new BadRequestException('You already have a pending application for this campaign.');
    }

    const applicationId = `app_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const applicationItem: CampaignApplicationItem = {
      id: applicationId,
      campaignId,
      creatorId,
      creatorUsername,
      proposedRateCents: dto.proposedRateCents,
      pitchNote: dto.pitchNote,
      portfolioSampleLinks: dto.portfolioSampleLinks || [],
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    apps.push(applicationItem);
    this.applications.set(campaignId, apps);
    campaign.applicationsCount = apps.length;

    return applicationItem;
  }

  listApplications(brandId: string, campaignId: string): CampaignApplicationItem[] {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) throw new NotFoundException(`Campaign ${campaignId} not found.`);
    if (campaign.brandId !== brandId) {
      throw new ForbiddenException('Only the campaign owner can review applications.');
    }
    return this.applications.get(campaignId) || [];
  }

  // ==========================================================================
  // 5. CONTRACT GENERATION & REUSE OF COMMUNITIES / MONETIZATION
  // ==========================================================================

  async acceptApplicationAndCreateContract(
    brandId: string,
    campaignId: string,
    applicationId: string,
  ): Promise<CampaignContractItem> {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) throw new NotFoundException(`Campaign ${campaignId} not found.`);
    if (campaign.brandId !== brandId) {
      throw new ForbiddenException('Only campaign owner can award contracts.');
    }

    const apps = this.applications.get(campaignId) || [];
    const application = apps.find((a) => a.id === applicationId);
    if (!application) throw new NotFoundException(`Application ${applicationId} not found.`);

    // Transition application to ACCEPTED
    application.status = 'ACCEPTED';
    campaign.status = 'IN_PROGRESS';

    const contractId = `contract_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const initialDeliverables: CampaignDeliverableItem[] = campaign.requiredDeliverables.map(
      (delivTitle, idx) => ({
        id: `deliv_${contractId}_${idx + 1}`,
        contractId,
        title: delivTitle,
        description: `Deliverable requirement matching brief: ${delivTitle}`,
        hasSponsorshipDisclosure: false,
        status: 'PENDING_SUBMISSION',
      }),
    );

    const contract: CampaignContractItem = {
      id: contractId,
      campaignId,
      applicationId,
      brandId: campaign.brandId,
      brandName: campaign.brandName,
      creatorId: application.creatorId,
      creatorUsername: application.creatorUsername,
      agreedAmountCents: application.proposedRateCents,
      deliverableBrief: campaign.description,
      sponsorshipDisclosureText: '#sponsored #partnership',
      status: 'ACTIVE',
      deliverables: initialDeliverables,
      signedAt: new Date().toISOString(),
    };

    this.contracts.set(contractId, contract);

    // Dispatch notification to Creator
    try {
      await this.notificationsService.dispatchNotification({
        userId: application.creatorId,
        type: NotificationType.CREATOR_MILESTONE,
        title: `Campaign Accepted: ${campaign.title}`,
        body: `Congratulations! ${campaign.brandName} accepted your pitch ($${(application.proposedRateCents / 100).toFixed(2)}).`,
        priority: NotificationPriority.HIGH,
        deepLinkUrl: `interest://marketplace/contracts/${contractId}`,
      });
    } catch (_) {}

    return contract;
  }

  getContract(requesterId: string, contractId: string): CampaignContractItem {
    const contract = this.contracts.get(contractId);
    if (!contract) throw new NotFoundException(`Contract ${contractId} not found.`);
    if (contract.brandId !== requesterId && contract.creatorId !== requesterId) {
      throw new ForbiddenException('Unauthorized to view this contract.');
    }
    return contract;
  }

  // ==========================================================================
  // 6. DELIVERABLE SUBMISSION & MANDATORY SPONSORSHIP DISCLOSURES
  // ==========================================================================

  async submitDeliverable(
    creatorId: string,
    contractId: string,
    deliverableId: string,
    dto: SubmitDeliverableDto,
  ): Promise<CampaignDeliverableItem> {
    const contract = this.contracts.get(contractId);
    if (!contract) throw new NotFoundException(`Contract ${contractId} not found.`);
    if (contract.creatorId !== creatorId) throw new ForbiddenException('Only the assigned creator can submit deliverables.');

    // Regulatory Compliance Check: Enforce mandatory sponsorship disclosures
    const fullText = `${dto.title} ${dto.description}`.toLowerCase();
    const hasDisclosureTag = fullText.includes('#sponsored') || fullText.includes('#ad') || fullText.includes('#paid');
    if (!dto.hasSponsorshipDisclosure && !hasDisclosureTag) {
      throw new BadRequestException(
        'Regulatory Compliance Violation: Deliverables must include prominent sponsorship disclosure (#sponsored or #ad).',
      );
    }

    const deliv = contract.deliverables.find((d) => d.id === deliverableId);
    if (!deliv) throw new NotFoundException(`Deliverable ${deliverableId} not found in contract.`);

    deliv.title = dto.title;
    deliv.description = dto.description;
    deliv.reelId = dto.reelId;
    deliv.previewUrl = dto.previewUrl;
    deliv.hasSponsorshipDisclosure = true;
    deliv.status = 'SUBMITTED';
    deliv.submittedAt = new Date().toISOString();

    // Update contract status to SUBMITTED if all deliverables are in review
    const allSubmitted = contract.deliverables.every((d) => d.status === 'SUBMITTED' || d.status === 'APPROVED');
    if (allSubmitted) {
      contract.status = 'SUBMITTED';
    }

    return deliv;
  }

  async reviewDeliverable(
    brandId: string,
    contractId: string,
    deliverableId: string,
    dto: ReviewDeliverableDto,
  ): Promise<CampaignDeliverableItem> {
    const contract = this.contracts.get(contractId);
    if (!contract) throw new NotFoundException(`Contract ${contractId} not found.`);
    if (contract.brandId !== brandId) throw new ForbiddenException('Only the campaign brand can review deliverables.');

    const deliv = contract.deliverables.find((d) => d.id === deliverableId);
    if (!deliv) throw new NotFoundException(`Deliverable ${deliverableId} not found.`);

    if (dto.approved) {
      deliv.status = 'APPROVED';
      deliv.approvedAt = new Date().toISOString();
      deliv.feedbackNotes = dto.feedbackNotes;
    } else {
      deliv.status = 'CHANGES_REQUESTED';
      deliv.feedbackNotes = dto.feedbackNotes || 'Changes requested by brand.';
      contract.status = 'CHANGES_REQUESTED';
    }

    // If all approved, mark contract as APPROVED
    const allApproved = contract.deliverables.every((d) => d.status === 'APPROVED');
    if (allApproved) {
      contract.status = 'APPROVED';
    }

    return deliv;
  }

  // ==========================================================================
  // 7. DISPUTES & FORMAL RESOLUTION
  // ==========================================================================

  raiseDispute(requesterId: string, contractId: string, dto: RaiseDisputeDto): DisputeRecordItem {
    const contract = this.contracts.get(contractId);
    if (!contract) throw new NotFoundException(`Contract ${contractId} not found.`);
    if (contract.brandId !== requesterId && contract.creatorId !== requesterId) {
      throw new ForbiddenException('Unauthorized to file dispute on this contract.');
    }

    const dispute: DisputeRecordItem = {
      id: `disp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      contractId,
      initiatorId: requesterId,
      reason: dto.reason,
      evidenceDescription: dto.evidenceDescription,
      status: 'OPENED',
    };

    contract.dispute = dispute;
    contract.status = 'DISPUTED';

    this.logger.warn(`Dispute filed on contract ${contractId} by ${requesterId}: ${dto.reason}`);
    return dispute;
  }

  resolveDispute(moderatorId: string, contractId: string, dto: ResolveDisputeDto): DisputeRecordItem {
    const contract = this.contracts.get(contractId);
    if (!contract) throw new NotFoundException(`Contract ${contractId} not found.`);
    if (!contract.dispute) throw new BadRequestException('No active dispute on this contract.');

    contract.dispute.status = dto.resolution;
    contract.dispute.moderatorNotes = dto.moderatorNotes;
    contract.dispute.resolvedAt = new Date().toISOString();

    if (dto.resolution === 'RESOLVED_CREATOR') {
      contract.status = 'APPROVED';
    } else if (dto.resolution === 'RESOLVED_BRAND' || dto.resolution === 'MUTUALLY_CANCELLED') {
      contract.status = 'DRAFTED';
    }

    return contract.dispute;
  }

  // ==========================================================================
  // 8. DIRECT PAYMENT RECONCILIATION (NO CUSTODY / NO ESCROW)
  // ==========================================================================

  reconcilePayment(
    brandId: string,
    contractId: string,
    dto: ReconcileDirectPaymentDto,
  ): PaymentReconciliationItem {
    const contract = this.contracts.get(contractId);
    if (!contract) throw new NotFoundException(`Contract ${contractId} not found.`);
    if (contract.brandId !== brandId) {
      throw new ForbiddenException('Only brand can report payment reconciliation.');
    }

    if (contract.status !== 'APPROVED') {
      throw new BadRequestException('Contract must be in APPROVED state before reconciliation.');
    }

    const reconciliation: PaymentReconciliationItem = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      contractId,
      paymentProvider: dto.paymentProvider,
      externalInvoiceId: dto.externalInvoiceId,
      amountCents: dto.amountCents,
      currency: dto.currency || 'USD',
      isPlatformCustodyAvoided: true, // Immutable invariant
      reconciledAt: new Date().toISOString(),
    };

    contract.reconciliation = reconciliation;
    contract.status = 'FULFILLED';
    contract.completedAt = new Date().toISOString();

    return reconciliation;
  }

  // ==========================================================================
  // 9. SEED INITIAL PILOT DATA
  // ==========================================================================

  private seedInitialMarketplaceData(): void {
    const campaignId = 'camp-brand-audio-sponsor-01';
    const c1: BrandCampaignItem = {
      id: campaignId,
      brandId: 'brand_synthesizer_corp',
      brandName: 'Elektronik Audio Labs',
      brandLogoUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150',
      title: 'Analog Filter Module Feature Reel & Review',
      description: 'Create 1 high-definition vertical video reel showcasing our analog low-pass filter in action with hands-on sound synthesis demo.',
      interestId: 'interest_audio_04',
      interestName: 'Audio Production',
      budgetMinCents: 60000, // $600
      budgetMaxCents: 120000, // $1,200
      requiredDeliverables: [
        '60-second vertical 4K video reel with modular patching demo',
        'Inclusion of #sponsored disclosure and affiliate product link in caption',
      ],
      applicationDeadline: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
      campaignDeadline: new Date(Date.now() + 21 * 86400 * 1000).toISOString(),
      status: 'OPEN_FOR_APPLICATIONS',
      applicationsCount: 3,
      sponsorshipDisclosureRequired: true,
      createdAt: '2026-10-18T12:00:00Z',
      updatedAt: '2026-10-18T12:00:00Z',
    };
    this.campaigns.set(campaignId, c1);

    const app1: CampaignApplicationItem = {
      id: 'app_seed_01',
      campaignId,
      creatorId: 'user_elena_sound',
      creatorUsername: 'elena_sound',
      creatorAvatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
      proposedRateCents: 85000, // $850
      pitchNote: 'I specialize in analog synth modular patching with over 45k audio engineer followers.',
      portfolioSampleLinks: ['https://interest.app/reel/analog_filter_demo'],
      status: 'PENDING',
      createdAt: '2026-10-18T14:30:00Z',
    };
    this.applications.set(campaignId, [app1]);

    const devCampaignId = 'camp-cloud-infra-02';
    const c2: BrandCampaignItem = {
      id: devCampaignId,
      brandId: 'brand_cloud_scale',
      brandName: 'NeonDB Cloud Systems',
      brandLogoUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=150',
      title: 'Serverless Postgres Live Code Breakdown',
      description: 'Interactive code demonstration highlighting connection pooling, read replicas, and cold start benchmarks.',
      interestId: 'interest_engineering_02',
      interestName: 'Software Engineering',
      budgetMinCents: 150000,
      budgetMaxCents: 250000,
      requiredDeliverables: [
        '90-second code walk-through reel',
        'Interactive Q&A session post with #sponsored tag',
      ],
      applicationDeadline: new Date(Date.now() + 10 * 86400 * 1000).toISOString(),
      campaignDeadline: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
      status: 'OPEN_FOR_APPLICATIONS',
      applicationsCount: 2,
      sponsorshipDisclosureRequired: true,
      createdAt: '2026-10-18T16:00:00Z',
      updatedAt: '2026-10-18T16:00:00Z',
    };
    this.campaigns.set(devCampaignId, c2);
    this.applications.set(devCampaignId, []);
  }
}
