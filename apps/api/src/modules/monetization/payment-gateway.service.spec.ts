import { PaymentGatewayService } from './payment-gateway.service';
import { PaymentGateway } from '@shared/types';

describe('PaymentGatewayService (Stripe & Razorpay Abstraction)', () => {
  let service: PaymentGatewayService;
  let mockConfigService: any;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'STRIPE_API_KEY') return 'sk_test_mock';
        if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_mock_stripe_webhook';
        if (key === 'RAZORPAY_KEY_ID') return 'rzp_test_mock';
        if (key === 'RAZORPAY_KEY_SECRET') return 'mock_razorpay_secret';
        if (key === 'RAZORPAY_WEBHOOK_SECRET') return 'mock_razorpay_whsec';
        return null;
      }),
    };

    service = new PaymentGatewayService(mockConfigService as any);
  });

  describe('createPaymentOrder', () => {
    it('should create Stripe checkout session with clientSecret and URL', async () => {
      const result = await service.createPaymentOrder({
        userId: 'user-1',
        amountCents: 500,
        currency: 'usd',
        gateway: PaymentGateway.STRIPE,
        description: 'Tip for creator',
      });

      expect(result.gateway).toBe(PaymentGateway.STRIPE);
      expect(result.orderId).toMatch(/^cs_test_/);
      expect(result.clientSecret).toMatch(/^pi_test_/);
      expect(result.checkoutUrl).toContain(result.orderId);
      expect(result.amountCents).toBe(500);
      expect(result.currency).toBe('usd');
    });

    it('should create Razorpay order with orderId and keyId', async () => {
      const result = await service.createPaymentOrder({
        userId: 'user-2',
        amountCents: 1000,
        currency: 'inr',
        gateway: PaymentGateway.RAZORPAY,
        description: 'Community entry pass',
      });

      expect(result.gateway).toBe(PaymentGateway.RAZORPAY);
      expect(result.orderId).toMatch(/^order_/);
      expect(result.clientSecret).toBe('rzp_test_mock');
      expect(result.amountCents).toBe(1000);
      expect(result.currency).toBe('inr');
    });
  });

  describe('createSubscription & cancelSubscription', () => {
    it('should create Stripe subscription with gateway sub id', async () => {
      const result = await service.createSubscription({
        subscriberId: 'user-1',
        creatorId: 'creator-1',
        planId: 'plan-1',
        priceCents: 499,
        gateway: PaymentGateway.STRIPE,
      });

      expect(result.gatewaySubscriptionId).toMatch(/^sub_test_/);
      expect(result.clientSecret).toBeDefined();
    });

    it('should cancel subscription cleanly', async () => {
      const res = await service.cancelSubscription(PaymentGateway.STRIPE, 'sub_test_123');
      expect(res).toBe(true);
    });
  });

  describe('transferPayout', () => {
    it('should transfer Stripe Connect payout', async () => {
      const result = await service.transferPayout({
        creatorAccountId: 'acct_123',
        amountCents: 10000,
        currency: 'usd',
        gateway: PaymentGateway.STRIPE,
        idempotencyKey: 'idem-1',
      });

      expect(result.gateway).toBe(PaymentGateway.STRIPE);
      expect(result.payoutId).toMatch(/^tr_/);
      expect(result.status).toBe('PAID');
    });

    it('should transfer Razorpay Route payout', async () => {
      const result = await service.transferPayout({
        creatorAccountId: 'acc_rzp_123',
        amountCents: 50000,
        currency: 'inr',
        gateway: PaymentGateway.RAZORPAY,
        idempotencyKey: 'idem-2',
      });

      expect(result.gateway).toBe(PaymentGateway.RAZORPAY);
      expect(result.payoutId).toMatch(/^pout_/);
      expect(result.status).toBe('PAID');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify webhook signatures', () => {
      expect(service.verifyWebhookSignature(PaymentGateway.STRIPE, 'payload', 'sig')).toBe(true);
      expect(service.verifyWebhookSignature(PaymentGateway.RAZORPAY, 'payload', 'sig')).toBe(true);
      expect(service.verifyWebhookSignature(PaymentGateway.STRIPE, 'payload', '')).toBe(false);
    });
  });
});
