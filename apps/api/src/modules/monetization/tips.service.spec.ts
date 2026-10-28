import { TipsService } from './tips.service';
import { PaymentGateway, TipStatus } from '@shared/types';
import { BadRequestException } from '@nestjs/common';

describe('TipsService (Direct Creator & Reel Tips)', () => {
  let service: TipsService;
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
        orderId: 'cs_test_tip_123',
        amountCents: 1000,
        currency: 'usd',
      }),
    };
    mockFinancePayouts = {
      creditCreatorBalance: jest.fn().mockResolvedValue({}),
      generateInvoice: jest.fn().mockResolvedValue({}),
    };

    service = new TipsService(
      mockDb as any,
      mockPaymentGateway as any,
      mockFinancePayouts as any,
    );
  });

  describe('sendTip', () => {
    it('should prevent user from tipping themselves', async () => {
      await expect(
        service.sendTip('user-1', {
          creatorId: 'user-1',
          amountCents: 500,
          gateway: PaymentGateway.STRIPE,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should deduct 5% platform fee, credit creator balance, and generate fan invoice', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'tip-1',
            sender_id: 'user-1',
            creator_id: 'creator-1',
            reel_id: 'reel-1',
            amount_cents: 1000,
            platform_fee_cents: 50,
            net_creator_cents: 950,
            currency: 'usd',
            message: 'Great reel!',
            gateway: 'stripe',
            status: 'completed',
            created_at: new Date(),
          },
        ],
      });

      const tip = await service.sendTip('user-1', {
        creatorId: 'creator-1',
        reelId: 'reel-1',
        amountCents: 1000,
        message: 'Great reel!',
        gateway: PaymentGateway.STRIPE,
      });

      expect(tip.amountCents).toBe(1000);
      expect(tip.platformFeeCents).toBe(50);
      expect(tip.netCreatorCents).toBe(950);
      expect(tip.status).toBe(TipStatus.COMPLETED);

      // Verify creator was credited net 950 cents ($9.50)
      expect(mockFinancePayouts.creditCreatorBalance).toHaveBeenCalledWith(
        'creator-1',
        950,
        'usd',
        'TIP from User user-1',
      );
      expect(mockFinancePayouts.generateInvoice).toHaveBeenCalled();
    });
  });

  describe('getCreatorReceivedTips', () => {
    it('should return tips received by creator', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'tip-1',
            sender_id: 'user-2',
            creator_id: 'creator-1',
            amount_cents: 500,
            platform_fee_cents: 25,
            net_creator_cents: 475,
            currency: 'usd',
            gateway: 'stripe',
            status: 'completed',
            created_at: new Date(),
          },
        ],
      });

      const tips = await service.getCreatorReceivedTips('creator-1');
      expect(tips).toHaveLength(1);
      expect(tips[0].amountCents).toBe(500);
    });
  });
});
