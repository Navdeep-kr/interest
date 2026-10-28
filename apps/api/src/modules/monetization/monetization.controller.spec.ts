import { MonetizationController } from './monetization.controller';
import {
  PaymentGateway,
  CommunityPricingType,
  AdBidType,
  AdEventType,
  TaxEntityType,
  AdCampaignStatus,
} from '@shared/types';

describe('MonetizationController', () => {
  let controller: MonetizationController;
  let mockSubscriptionsService: any;
  let mockTipsService: any;
  let mockCommunitiesService: any;
  let mockCreatorFundService: any;
  let mockAdsService: any;
  let mockFinancePayoutsService: any;

  const mockUserReq = {
    user: { id: 'user-monetize-1' },
  };

  beforeEach(() => {
    mockSubscriptionsService = {
      createPlan: jest.fn().mockResolvedValue({ id: 'plan-1' }),
      getCreatorPlans: jest.fn().mockResolvedValue([]),
      subscribe: jest.fn().mockResolvedValue({ id: 'sub-1' }),
      getUserSubscriptions: jest.fn().mockResolvedValue([]),
      cancelSubscription: jest.fn().mockResolvedValue({ id: 'sub-1' }),
    };
    mockTipsService = {
      sendTip: jest.fn().mockResolvedValue({ id: 'tip-1' }),
      getCreatorReceivedTips: jest.fn().mockResolvedValue([]),
      getUserSentTips: jest.fn().mockResolvedValue([]),
      getReelTips: jest.fn().mockResolvedValue([]),
    };
    mockCommunitiesService = {
      createCommunity: jest.fn().mockResolvedValue({ id: 'comm-1' }),
      getCommunityById: jest.fn().mockResolvedValue({ id: 'comm-1' }),
      getCommunitiesByInterest: jest.fn().mockResolvedValue([]),
      joinCommunity: jest.fn().mockResolvedValue({ id: 'mem-1' }),
      getUserMemberships: jest.fn().mockResolvedValue([]),
    };
    mockCreatorFundService = {
      calculateAndDistributePool: jest.fn().mockResolvedValue({ allocationsCount: 5 }),
      getCreatorAllocations: jest.fn().mockResolvedValue([]),
      getPool: jest.fn().mockResolvedValue({ periodName: '2026-10' }),
    };
    mockAdsService = {
      createCampaign: jest.fn().mockResolvedValue({ id: 'camp-1' }),
      getAdvertiserCampaigns: jest.fn().mockResolvedValue([]),
      updateCampaignStatus: jest.fn().mockResolvedValue({ id: 'camp-1' }),
      serveAdForInterestFeed: jest.fn().mockResolvedValue({ campaignId: 'camp-1' }),
      trackAdEvent: jest.fn().mockResolvedValue({ success: true }),
    };
    mockFinancePayoutsService = {
      getOrCreateFinancialAccount: jest.fn().mockResolvedValue({ userId: 'user-monetize-1' }),
      updateTaxProfile: jest.fn().mockResolvedValue({ payoutEnabled: true }),
      getUserInvoices: jest.fn().mockResolvedValue([]),
      requestPayout: jest.fn().mockResolvedValue({ id: 'pout-1' }),
      getCreatorPayouts: jest.fn().mockResolvedValue([]),
    };

    controller = new MonetizationController(
      mockSubscriptionsService,
      mockTipsService,
      mockCommunitiesService,
      mockCreatorFundService,
      mockAdsService,
      mockFinancePayoutsService,
    );
  });

  describe('Subscriptions', () => {
    it('createPlan should delegate to subscriptionsService', async () => {
      const dto = { title: 'VIP', priceCents: 999 };
      await controller.createPlan(mockUserReq, dto as any);
      expect(mockSubscriptionsService.createPlan).toHaveBeenCalledWith('user-monetize-1', dto);
    });

    it('subscribe should delegate to subscriptionsService', async () => {
      const dto = { planId: 'plan-1', gateway: PaymentGateway.STRIPE };
      await controller.subscribe(mockUserReq, dto);
      expect(mockSubscriptionsService.subscribe).toHaveBeenCalledWith('user-monetize-1', dto);
    });
  });

  describe('Tips', () => {
    it('sendTip should delegate to tipsService', async () => {
      const dto = { creatorId: 'c-1', amountCents: 500, gateway: PaymentGateway.STRIPE };
      await controller.sendTip(mockUserReq, dto);
      expect(mockTipsService.sendTip).toHaveBeenCalledWith('user-monetize-1', dto);
    });
  });

  describe('Paid Communities', () => {
    it('createCommunity should delegate to communitiesService', async () => {
      const dto = {
        interestId: 'int-1',
        name: 'AI Club',
        pricingType: CommunityPricingType.RECURRING,
        priceCents: 1000,
      };
      await controller.createCommunity(mockUserReq, dto);
      expect(mockCommunitiesService.createCommunity).toHaveBeenCalledWith('user-monetize-1', dto);
    });

    it('joinCommunity should delegate to communitiesService', async () => {
      const dto = { communityId: 'comm-1', gateway: PaymentGateway.STRIPE };
      await controller.joinCommunity(mockUserReq, dto);
      expect(mockCommunitiesService.joinCommunity).toHaveBeenCalledWith('user-monetize-1', dto);
    });
  });

  describe('Creator Fund', () => {
    it('calculateFund should delegate to creatorFundService', async () => {
      const dto = { periodName: '2026-10', totalPoolCents: 10000000 };
      await controller.calculateFund(dto);
      expect(mockCreatorFundService.calculateAndDistributePool).toHaveBeenCalledWith(dto);
    });
  });

  describe('Ads (Zero Location)', () => {
    it('createAdCampaign should delegate to adsService', async () => {
      const dto = {
        title: 'Tech Promo',
        reelId: 'r-1',
        targetInterestIds: ['int-1'],
        dailyBudgetCents: 1000,
        totalBudgetCents: 5000,
        bidCents: 100,
      };
      await controller.createAdCampaign(mockUserReq, dto);
      expect(mockAdsService.createCampaign).toHaveBeenCalledWith('user-monetize-1', dto);
    });

    it('serveAd should delegate to adsService', async () => {
      const body = { viewerInterestIds: ['int-1'] };
      await controller.serveAd(body);
      expect(mockAdsService.serveAdForInterestFeed).toHaveBeenCalledWith(body);
    });

    it('trackAdEvent should delegate to adsService', async () => {
      const dto = {
        campaignId: 'camp-1',
        eventType: AdEventType.CLICK,
        attributionToken: 'token',
      };
      await controller.trackAdEvent(dto);
      expect(mockAdsService.trackAdEvent).toHaveBeenCalledWith(dto);
    });
  });

  describe('Finances, Taxes, Invoices & Payouts', () => {
    it('updateTaxProfile should delegate to financePayoutsService', async () => {
      const dto = {
        taxIdNumber: 'EIN-1234',
        taxEntityType: TaxEntityType.BUSINESS,
        taxLegalName: 'Creator LLC',
        taxJurisdictionCode: 'US-W9',
      };
      await controller.updateTaxProfile(mockUserReq, dto);
      expect(mockFinancePayoutsService.updateTaxProfile).toHaveBeenCalledWith(
        'user-monetize-1',
        dto,
      );
    });

    it('requestPayout should delegate to financePayoutsService', async () => {
      const dto = { amountCents: 5000 };
      await controller.requestPayout(mockUserReq, dto);
      expect(mockFinancePayoutsService.requestPayout).toHaveBeenCalledWith(
        'user-monetize-1',
        dto,
      );
    });
  });
});
