import { PaidCommunitiesService } from './communities.service';
import { CommunityPricingType, CommunityMembershipStatus, PaymentGateway } from '@shared/types';
import { NotFoundException } from '@nestjs/common';

describe('PaidCommunitiesService (Interest-Centered Paid Communities)', () => {
  let service: PaidCommunitiesService;
  let mockDb: any;
  let mockPaymentGateway: any;
  let mockFinancePayouts: any;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
    };
    mockPaymentGateway = {
      createPaymentOrder: jest.fn().mockResolvedValue({
        gateway: PaymentGateway.STRIPE,
        orderId: 'cs_test_comm_123',
        amountCents: 2000,
        currency: 'usd',
      }),
    };
    mockFinancePayouts = {
      creditCreatorBalance: jest.fn().mockResolvedValue({}),
      generateInvoice: jest.fn().mockResolvedValue({}),
    };

    service = new PaidCommunitiesService(
      mockDb as any,
      mockPaymentGateway as any,
      mockFinancePayouts as any,
    );
  });

  describe('createCommunity', () => {
    it('should create paid community linked to an interest taxonomy node', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ id: 'int-1', title: 'Specialty Coffee' }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'comm-1',
              creator_id: 'creator-1',
              interest_id: 'int-1',
              name: 'Artisan Roasters Club',
              description: 'Exclusive bean profiles',
              pricing_type: 'recurring',
              price_cents: 1500,
              currency: 'usd',
              billing_interval: 'month',
              members_count: 1,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // creator membership insert

      const comm = await service.createCommunity('creator-1', {
        interestId: 'int-1',
        name: 'Artisan Roasters Club',
        pricingType: CommunityPricingType.RECURRING,
        priceCents: 1500,
      });

      expect(comm.id).toBe('comm-1');
      expect(comm.name).toBe('Artisan Roasters Club');
      expect(comm.interestTitle).toBe('Specialty Coffee');
      expect(comm.isMember).toBe(true);
    });
  });

  describe('joinCommunity', () => {
    it('should process payment, record membership, and credit creator net earnings', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'comm-1',
              creator_id: 'creator-1',
              interest_id: 'int-1',
              name: 'Artisan Roasters Club',
              pricing_type: 'one_time',
              price_cents: 2000,
              currency: 'usd',
              is_active: true,
              interest_title: 'Specialty Coffee',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // not currently a member
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'mem-1',
              community_id: 'comm-1',
              user_id: 'user-2',
              status: 'active',
              gateway: 'stripe',
              expires_at: null, // lifetime
              created_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // increment counter

      const membership = await service.joinCommunity('user-2', {
        communityId: 'comm-1',
        gateway: PaymentGateway.STRIPE,
      });

      expect(membership.status).toBe(CommunityMembershipStatus.ACTIVE);
      // 10% fee on 2000 cents = 200 cents fee, 1800 cents credited
      expect(mockFinancePayouts.creditCreatorBalance).toHaveBeenCalledWith(
        'creator-1',
        1800,
        'usd',
        'COMMUNITY_MEMBERSHIP:Artisan Roasters Club',
      );
      expect(mockFinancePayouts.generateInvoice).toHaveBeenCalled();
    });
  });

  describe('isMember (Access Gate)', () => {
    it('should return true for active community members', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] });
      const hasAccess = await service.isMember('user-2', 'comm-1');
      expect(hasAccess).toBe(true);
    });

    it('should return false for non-members', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      const hasAccess = await service.isMember('user-3', 'comm-1');
      expect(hasAccess).toBe(false);
    });
  });
});
