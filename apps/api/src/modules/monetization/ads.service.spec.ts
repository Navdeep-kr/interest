import { AdsService } from './ads.service';
import { AdBidType, AdEventType, AdCampaignStatus } from '@shared/types';
import { BadRequestException } from '@nestjs/common';

describe('AdsService (Privacy-Friendly, Interest-Only Targeting)', () => {
  let service: AdsService;
  let mockDb: any;
  let mockPaymentGateway: any;
  let mockFinancePayouts: any;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
    };
    mockPaymentGateway = {
      createPaymentOrder: jest.fn().mockResolvedValue({
        gateway: 'stripe',
        orderId: 'cs_test_ad_123',
        amountCents: 5000,
      }),
    };
    mockFinancePayouts = {
      generateInvoice: jest.fn().mockResolvedValue({}),
    };

    service = new AdsService(
      mockDb as any,
      mockPaymentGateway as any,
      mockFinancePayouts as any,
    );
  });

  describe('createCampaign', () => {
    it('should create an interest-targeted ad campaign and generate deposit invoice', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ id: 'reel-ad-1', status: 'PUBLISHED', creator_id: 'adv-1' }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'int-tech' }, { id: 'int-ai' }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'camp-1',
              advertiser_id: 'adv-1',
              title: 'Autonomous Coding Tools',
              reel_id: 'reel-ad-1',
              target_interest_ids: ['int-tech', 'int-ai'],
              call_to_action_url: 'https://example.com/tools',
              call_to_action_text: 'Learn More',
              daily_budget_cents: 1000,
              total_budget_cents: 5000,
              spent_cents: 0,
              bid_type: 'CPM',
              bid_cents: 200,
              status: 'ACTIVE',
              impressions_count: 0,
              clicks_count: 0,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        });

      const camp = await service.createCampaign('adv-1', {
        title: 'Autonomous Coding Tools',
        reelId: 'reel-ad-1',
        targetInterestIds: ['int-tech', 'int-ai'],
        callToActionUrl: 'https://example.com/tools',
        callToActionText: 'Learn More',
        dailyBudgetCents: 1000,
        totalBudgetCents: 5000,
        bidType: AdBidType.CPM,
        bidCents: 200,
      });

      expect(camp.id).toBe('camp-1');
      expect(camp.targetInterestIds).toEqual(['int-tech', 'int-ai']);
      expect(camp.status).toBe(AdCampaignStatus.ACTIVE);
      expect(mockFinancePayouts.generateInvoice).toHaveBeenCalled();
    });
  });

  describe('serveAdForInterestFeed', () => {
    it('should serve highest-bidding campaign matching viewer interest affinities', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'camp-1',
            reel_id: 'reel-ad-1',
            advertiser_id: 'adv-1',
            advertiser_name: 'TechLab',
            title: 'Autonomous Coding Tools',
            call_to_action_url: 'https://example.com/tools',
            call_to_action_text: 'Install Now',
            bid_cents: 250,
          },
        ],
      });

      const adItem = await service.serveAdForInterestFeed({
        viewerInterestIds: ['int-ai', 'int-gaming'],
      });

      expect(adItem).not.toBeNull();
      expect(adItem!.campaignId).toBe('camp-1');
      expect(adItem!.advertiserName).toBe('TechLab');
      expect(adItem!.attributionToken).toBeDefined();
    });

    it('should return null if no matching campaign or empty interest profile', async () => {
      const adItem = await service.serveAdForInterestFeed({
        viewerInterestIds: [],
      });
      expect(adItem).toBeNull();
    });
  });

  describe('trackAdEvent', () => {
    it('should reject forged or corrupted attribution tokens', async () => {
      await expect(
        service.trackAdEvent({
          campaignId: 'camp-1',
          eventType: AdEventType.IMPRESSION,
          attributionToken: 'invalid-token-tampered',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should track impression and deduct CPM cost from campaign budget', async () => {
      // Generate genuine token
      const validToken = (service as any).generateAttributionToken('camp-1');

      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'camp-1',
              bid_type: 'CPM',
              bid_cents: 500, // $5 CPM = 0.5 cents per impression
              spent_cents: 100,
              total_budget_cents: 1000,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // update budget
        .mockResolvedValueOnce({ rows: [] }); // insert event

      const trackRes = await service.trackAdEvent({
        campaignId: 'camp-1',
        eventType: AdEventType.IMPRESSION,
        attributionToken: validToken,
      });

      expect(trackRes.success).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE ad_campaigns'),
        ['camp-1', 1], // rounded 500/1000 = 1 cent
      );
    });
  });
});
