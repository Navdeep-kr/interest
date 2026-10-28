import { SubscriptionsService } from './subscriptions.service';
import { PaymentGateway, SubscriptionStatus } from '@shared/types';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('SubscriptionsService (Plans, Subscriptions & Patronage Gating)', () => {
  let service: SubscriptionsService;
  let mockDb: any;
  let mockPaymentGateway: any;
  let mockFinancePayouts: any;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
    };
    mockPaymentGateway = {
      createSubscription: jest.fn().mockResolvedValue({
        gatewaySubscriptionId: 'sub_test_123',
        clientSecret: 'seti_secret_123',
      }),
      cancelSubscription: jest.fn().mockResolvedValue(true),
    };
    mockFinancePayouts = {
      creditCreatorBalance: jest.fn().mockResolvedValue({}),
      generateInvoice: jest.fn().mockResolvedValue({}),
    };

    service = new SubscriptionsService(
      mockDb as any,
      mockPaymentGateway as any,
      mockFinancePayouts as any,
    );
  });

  describe('createPlan', () => {
    it('should create subscription plan with perks and price', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'plan-1',
            creator_id: 'creator-1',
            title: 'AI Researcher Tier',
            description: 'Exclusive research notes',
            price_cents: 999,
            currency: 'usd',
            billing_interval: 'month',
            perks: ['Exclusive Reels', 'Badge'],
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const plan = await service.createPlan('creator-1', {
        title: 'AI Researcher Tier',
        description: 'Exclusive research notes',
        priceCents: 999,
        perks: ['Exclusive Reels', 'Badge'],
      });

      expect(plan.id).toBe('plan-1');
      expect(plan.priceCents).toBe(999);
      expect(plan.perks).toHaveLength(2);
    });
  });

  describe('subscribe', () => {
    it('should fail if plan does not exist', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.subscribe('user-1', {
          planId: 'plan-missing',
          gateway: PaymentGateway.STRIPE,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should fail if creator tries to subscribe to self', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'plan-1',
            creator_id: 'user-1', // same as subscriber
            title: 'Self plan',
            price_cents: 500,
            currency: 'usd',
            billing_interval: 'month',
            is_active: true,
          },
        ],
      });

      await expect(
        service.subscribe('user-1', {
          planId: 'plan-1',
          gateway: PaymentGateway.STRIPE,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should establish subscription, deduct platform fee, credit creator balance, and generate invoice', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'plan-1',
              creator_id: 'creator-1',
              title: 'Pro Tier',
              price_cents: 1000,
              currency: 'usd',
              billing_interval: 'month',
              is_active: true,
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'sub-rec-1',
              subscriber_id: 'user-1',
              creator_id: 'creator-1',
              plan_id: 'plan-1',
              gateway: 'stripe',
              gateway_subscription_id: 'sub_test_123',
              status: 'active',
              current_period_start: new Date(),
              current_period_end: new Date(Date.now() + 30 * 86400000),
              cancel_at_period_end: false,
              created_at: new Date(),
            },
          ],
        });

      const sub = await service.subscribe('user-1', {
        planId: 'plan-1',
        gateway: PaymentGateway.STRIPE,
      });

      expect(sub.status).toBe(SubscriptionStatus.ACTIVE);
      expect(mockPaymentGateway.createSubscription).toHaveBeenCalled();
      // 10% fee on 1000 cents = 100 cents fee, 900 cents credited to creator
      expect(mockFinancePayouts.creditCreatorBalance).toHaveBeenCalledWith(
        'creator-1',
        900,
        'usd',
        'SUBSCRIPTION:Pro Tier',
        'sub_test_123',
      );
      expect(mockFinancePayouts.generateInvoice).toHaveBeenCalled();
    });
  });

  describe('isSubscriber (Access Gate)', () => {
    it('should return true if user has active unexpired subscription', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] });
      const canAccess = await service.isSubscriber('user-1', 'creator-1');
      expect(canAccess).toBe(true);
    });

    it('should return false if user has no active subscription', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      const canAccess = await service.isSubscriber('user-2', 'creator-1');
      expect(canAccess).toBe(false);
    });
  });
});
