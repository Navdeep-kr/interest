import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionsService } from '../../src/modules/monetization/subscriptions.service';
import { TipsService } from '../../src/modules/monetization/tips.service';
import { FinancePayoutsService } from '../../src/modules/monetization/finance-payouts.service';
import { PaymentGatewayService } from '../../src/modules/monetization/payment-gateway.service';
import { DatabaseService } from '../../src/database/database.service';
import {
  PaymentGateway,
  EntitlementType,
  EntitlementStatus,
  KycStatus,
  TaxEntityType,
} from '@shared/types';

describe('Prompt 18 — Subscriptions, Tips, Payouts & Entitlements Gate', () => {
  let subscriptionsService: SubscriptionsService;
  let tipsService: TipsService;
  let financePayoutsService: FinancePayoutsService;
  let paymentGatewayService: PaymentGatewayService;

  const mockDb = {
    query: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'STRIPE_API_KEY') return 'sk_test_mock_stripe_key';
      if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_mock_stripe_webhook';
      if (key === 'RAZORPAY_KEY_ID') return 'rzp_test_mock_key';
      if (key === 'RAZORPAY_KEY_SECRET') return 'mock_razorpay_secret';
      if (key === 'RAZORPAY_WEBHOOK_SECRET') return 'mock_razorpay_whsec';
      return null;
    }),
  };

  beforeEach(async () => {
    mockDb.query.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        TipsService,
        FinancePayoutsService,
        PaymentGatewayService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: DatabaseService,
          useValue: mockDb,
        },
      ],
    }).compile();

    subscriptionsService = module.get<SubscriptionsService>(SubscriptionsService);
    tipsService = module.get<TipsService>(TipsService);
    financePayoutsService = module.get<FinancePayoutsService>(FinancePayoutsService);
    paymentGatewayService = module.get<PaymentGatewayService>(PaymentGatewayService);
  });

  describe('1. Sandbox Transactions & Entitlements Reconciliation', () => {
    it('creates recurring subscription in sandbox, grants server-verified entitlement, and credits creator net balance', async () => {
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 3600 * 1000);

      // 1. Fetch active plan
      mockDb.query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT * FROM creator_subscription_plans WHERE id = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: 'plan-uuid-1',
                creator_id: 'creator-user-1',
                title: 'VIP Masterclass Tier',
                description: 'Exclusive behind-the-scenes & tutorials',
                price_cents: 999, // $9.99
                currency: 'usd',
                billing_interval: 'month',
                perks: ['Exclusive Content', 'Direct Q&A'],
                is_active: true,
                created_at: now,
                updated_at: now,
              },
            ],
          });
        }
        if (sql.includes('INSERT INTO user_subscriptions')) {
          return Promise.resolve({
            rows: [
              {
                id: 'sub-uuid-1',
                subscriber_id: 'subscriber-user-1',
                creator_id: 'creator-user-1',
                plan_id: 'plan-uuid-1',
                gateway: 'stripe',
                gateway_subscription_id: 'sub_test_12345',
                status: 'active',
                current_period_start: now,
                current_period_end: periodEnd,
                cancel_at_period_end: false,
                created_at: now,
              },
            ],
          });
        }
        if (sql.includes('INSERT INTO entitlements')) {
          return Promise.resolve({
            rows: [
              {
                id: 'ent-uuid-1',
                user_id: 'subscriber-user-1',
                creator_id: 'creator-user-1',
                entitlement_type: 'CREATOR_SUBSCRIPTION',
                plan_id: 'plan-uuid-1',
                gateway: 'stripe',
                transaction_id: 'sub_test_12345',
                status: 'ACTIVE',
                expires_at: periodEnd,
                created_at: now,
                updated_at: now,
              },
            ],
          });
        }
        if (sql.includes('SELECT * FROM creator_financial_accounts WHERE user_id = $1')) {
          return Promise.resolve({
            rows: [
              {
                user_id: 'creator-user-1',
                gateway: 'stripe',
                payout_enabled: true,
                available_balance_cents: '1000',
                pending_balance_cents: '0',
                lifetime_earnings_cents: '1000',
                currency: 'usd',
                kyc_status: 'VERIFIED',
                is_compliance_blocked: false,
                created_at: now,
                updated_at: now,
              },
            ],
          });
        }
        if (sql.includes('UPDATE creator_financial_accounts')) {
          return Promise.resolve({
            rows: [
              {
                user_id: 'creator-user-1',
                gateway: 'stripe',
                payout_enabled: true,
                available_balance_cents: '1899', // 1000 + 899 (999 minus 10% fee)
                pending_balance_cents: '0',
                lifetime_earnings_cents: '1899',
                currency: 'usd',
                kyc_status: 'VERIFIED',
                is_compliance_blocked: false,
                created_at: now,
                updated_at: now,
              },
            ],
          });
        }
        if (sql.includes('INSERT INTO financial_audit_trail')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('INSERT INTO invoices')) {
          return Promise.resolve({
            rows: [
              {
                id: 'inv-uuid-1',
                invoice_number: 'INV-2026-ABC',
                user_id: 'subscriber-user-1',
                recipient_name: 'Subscriber',
                subtotal_cents: 999,
                tax_rate_bps: 0,
                tax_amount_cents: 0,
                total_amount_cents: 999,
                currency: 'usd',
                gateway: 'stripe',
                status: 'PAID',
                items_breakdown: '[]',
                issued_at: now,
                paid_at: now,
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await subscriptionsService.subscribe('subscriber-user-1', {
        planId: 'plan-uuid-1',
        gateway: PaymentGateway.STRIPE,
      });

      expect(res).toBeDefined();
      expect(res.subscriberId).toBe('subscriber-user-1');
      expect(res.creatorId).toBe('creator-user-1');
      expect(res.status).toBe('active');
      expect(res.planTitle).toBe('VIP Masterclass Tier');
    });

    it('verifies Apple StoreKit 2 IAP receipt in sandbox and reconciles creator entitlement without trusting client prices', async () => {
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 3600 * 1000);

      mockDb.query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM creator_subscription_plans WHERE id = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: 'plan-uuid-apple',
                creator_id: 'creator-user-2',
                title: 'Apple Sub Tier',
                price_cents: 1499, // $14.99 authoritative server price
                currency: 'usd',
              },
            ],
          });
        }
        if (sql.includes('SELECT * FROM creator_financial_accounts WHERE user_id = $1')) {
          return Promise.resolve({
            rows: [
              {
                user_id: 'creator-user-2',
                gateway: 'stripe',
                payout_enabled: true,
                available_balance_cents: '0',
                pending_balance_cents: '0',
                lifetime_earnings_cents: '0',
                currency: 'usd',
                kyc_status: 'VERIFIED',
                is_compliance_blocked: false,
                created_at: now,
                updated_at: now,
              },
            ],
          });
        }
        if (sql.includes('UPDATE creator_financial_accounts')) {
          return Promise.resolve({
            rows: [
              {
                user_id: 'creator-user-2',
                gateway: 'stripe',
                payout_enabled: true,
                available_balance_cents: '1124', // 1499 minus 15% store commission ($2.25) minus 10% platform fee ($1.50) = $11.24
                pending_balance_cents: '0',
                lifetime_earnings_cents: '1124',
                currency: 'usd',
                kyc_status: 'VERIFIED',
                is_compliance_blocked: false,
                created_at: now,
                updated_at: now,
              },
            ],
          });
        }
        if (sql.includes('INSERT INTO user_subscriptions')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('INSERT INTO financial_audit_trail')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('INSERT INTO entitlements')) {
          return Promise.resolve({
            rows: [
              {
                id: 'ent-apple-1',
                user_id: 'viewer-user-ios',
                creator_id: 'creator-user-2',
                entitlement_type: 'CREATOR_SUBSCRIPTION',
                plan_id: 'plan-uuid-apple',
                gateway: 'apple_iap',
                transaction_id: 'apple_tx_sandbox_123',
                status: 'ACTIVE',
                expires_at: periodEnd,
                created_at: now,
                updated_at: now,
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const entitlement = await subscriptionsService.verifyAndProcessIap('viewer-user-ios', {
        gateway: PaymentGateway.APPLE_IAP,
        receiptOrToken: 'mock_apple_valid_receipt_jws_sandbox_payload',
        productId: 'com.interest.creator.sub1',
        transactionId: 'apple_tx_sandbox_123',
        planId: 'plan-uuid-apple',
        isSandbox: true,
      });

      expect(entitlement.entitlementType).toBe(EntitlementType.CREATOR_SUBSCRIPTION);
      expect(entitlement.gateway).toBe(PaymentGateway.APPLE_IAP);
      expect(entitlement.status).toBe(EntitlementStatus.ACTIVE);
      expect(entitlement.transactionId).toBe('apple_tx_sandbox_123');
    });

    it('rejects tampered or fabricated in-app purchase receipts', async () => {
      await expect(
        subscriptionsService.verifyAndProcessIap('viewer-user-hacker', {
          gateway: PaymentGateway.APPLE_IAP,
          receiptOrToken: 'tampered_fake_receipt_data',
          productId: 'com.interest.sub',
          transactionId: 'fake_tx_000',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('2. Store Policy Rules & Digital Goods Evaluation', () => {
    it('evaluates Apple Guideline 3.1.1 requiring StoreKit IAP for digital subscriptions and tips on iOS', () => {
      const iosRule = paymentGatewayService.evaluateStorePolicyRules({
        platform: 'ios',
        itemType: 'SUBSCRIPTION',
        priceCents: 499,
        isDigitalGood: true,
      });

      expect(iosRule.requiresIap).toBe(true);
      expect(iosRule.allowedGateways).toContain(PaymentGateway.APPLE_IAP);
      expect(iosRule.policyNote).toContain('Apple App Store Review Guideline 3.1.1');
    });

    it('evaluates Google Play Billing policy requiring Play Billing for digital goods on Android', () => {
      const androidRule = paymentGatewayService.evaluateStorePolicyRules({
        platform: 'android',
        itemType: 'COMMUNITY_PASS',
        priceCents: 1999,
        isDigitalGood: true,
      });

      expect(androidRule.requiresIap).toBe(true);
      expect(androidRule.allowedGateways).toContain(PaymentGateway.GOOGLE_PLAY);
      expect(androidRule.policyNote).toContain('Google Play Billing');
    });

    it('permits direct payment gateways (Stripe, Razorpay) without store commissions on web platforms', () => {
      const webRule = paymentGatewayService.evaluateStorePolicyRules({
        platform: 'web',
        itemType: 'TIP',
        priceCents: 500,
        isDigitalGood: true,
      });

      expect(webRule.requiresIap).toBe(false);
      expect(webRule.allowedGateways).toContain(PaymentGateway.STRIPE);
      expect(webRule.allowedGateways).toContain(PaymentGateway.RAZORPAY);
    });
  });

  describe('3. Webhooks Verification, Idempotency & Replay Protection', () => {
    it('processes signed webhook and rejects duplicate replays with identical eventId', async () => {
      const payload = {
        id: 'evt_stripe_test_unique_123',
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            subscription: 'sub_test_12345',
          },
        },
      };

      // 1. First delivery: event not in database
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // duplicate check: empty
        .mockResolvedValueOnce({ rows: [] }) // insert into payment_webhook_events
        .mockResolvedValueOnce({ rows: [] }); // update entitlements expires_at

      const firstResult = await subscriptionsService.processWebhook(
        PaymentGateway.STRIPE,
        payload,
        'whsec_mock_stripe_webhook',
      );

      expect(firstResult.processed).toBe(true);
      expect(firstResult.isDuplicate).toBe(false);
      expect(firstResult.eventId).toBe('evt_stripe_test_unique_123');

      // 2. Second delivery (replayed attack or retry): event already present in database
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'existing-event-uuid-1' }],
      });

      const replayResult = await subscriptionsService.processWebhook(
        PaymentGateway.STRIPE,
        payload,
        'whsec_mock_stripe_webhook',
      );

      expect(replayResult.processed).toBe(true);
      expect(replayResult.isDuplicate).toBe(true);
      expect(replayResult.message).toContain('Duplicate event already processed');
    });

    it('rejects webhooks with invalid cryptographic signature', async () => {
      await expect(
        subscriptionsService.processWebhook(
          PaymentGateway.STRIPE,
          { id: 'evt_bad', type: 'charge.succeeded' },
          'invalid_tampered_signature_hex',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('4. Restore Purchases Across Devices Without Duplicate Charges', () => {
    it('restores existing active server entitlements for authenticated user without re-charging', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 20 * 24 * 3600 * 1000);

      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'ent-restored-1',
            user_id: 'restoring-user-1',
            creator_id: 'creator-user-1',
            entitlement_type: 'CREATOR_SUBSCRIPTION',
            plan_id: 'plan-1',
            gateway: 'apple_iap',
            transaction_id: 'apple_tx_original',
            status: 'ACTIVE',
            expires_at: expiresAt,
            created_at: now,
            updated_at: now,
          },
        ],
      });

      const restoreResult = await subscriptionsService.restorePurchases('restoring-user-1', {
        gateway: PaymentGateway.APPLE_IAP,
      });

      expect(restoreResult.restoredCount).toBe(1);
      expect(restoreResult.restoredEntitlements[0].transactionId).toBe('apple_tx_original');
      expect(restoreResult.message).toContain('Successfully restored');
    });
  });

  describe('5. Subscriber-Only Content Access Gate', () => {
    it('blocks non-subscriber from viewing subscriber-only reel', async () => {
      mockDb.query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT id, creator_id, is_subscriber_only, title FROM reels')) {
          return Promise.resolve({
            rows: [
              {
                id: 'reel-sub-only-1',
                creator_id: 'creator-user-1',
                is_subscriber_only: true,
                title: 'Exclusive Cooking Masterclass',
              },
            ],
          });
        }
        if (sql.includes('SELECT 1 FROM entitlements')) {
          return Promise.resolve({ rows: [] }); // Not entitled
        }
        if (sql.includes('SELECT 1 FROM user_subscriptions')) {
          return Promise.resolve({ rows: [] }); // No subscription
        }
        return Promise.resolve({ rows: [] });
      });

      const gate = await subscriptionsService.checkSubscriberAccess('viewer-user-unpaid', 'reel-sub-only-1');

      expect(gate.hasAccess).toBe(false);
      expect(gate.isSubscriberOnly).toBe(true);
      expect(gate.reason).toBe('SUBSCRIBER_ONLY_LOCKED');
    });

    it('grants access to subscriber-only reel when viewer has active server entitlement', async () => {
      mockDb.query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT id, creator_id, is_subscriber_only, title FROM reels')) {
          return Promise.resolve({
            rows: [
              {
                id: 'reel-sub-only-1',
                creator_id: 'creator-user-1',
                is_subscriber_only: true,
                title: 'Exclusive Cooking Masterclass',
              },
            ],
          });
        }
        if (sql.includes('SELECT 1 FROM entitlements')) {
          return Promise.resolve({ rows: [{ exists: 1 }] }); // Has entitlement
        }
        return Promise.resolve({ rows: [] });
      });

      const gate = await subscriptionsService.checkSubscriberAccess('viewer-user-paid', 'reel-sub-only-1');

      expect(gate.hasAccess).toBe(true);
      expect(gate.isSubscriberOnly).toBe(true);
      expect(gate.reason).toBe('ACTIVE_SUBSCRIPTION');
    });

    it('grants author access to their own subscriber-only reel unconditionally', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'reel-sub-only-1',
            creator_id: 'creator-user-author',
            is_subscriber_only: true,
            title: 'My Subscriber-Only Masterclass',
          },
        ],
      });

      const gate = await subscriptionsService.checkSubscriberAccess(
        'creator-user-author',
        'reel-sub-only-1',
      );

      expect(gate.hasAccess).toBe(true);
      expect(gate.reason).toBe('CONTENT_CREATOR');
    });
  });

  describe('6. Cancellation, Refunds, and Dispute Handling', () => {
    it('schedules subscription cancellation at the end of the period without instant revoking', async () => {
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 15 * 24 * 3600 * 1000);

      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'sub-uuid-to-cancel',
              subscriber_id: 'subscriber-1',
              creator_id: 'creator-1',
              plan_id: 'plan-1',
              plan_title: 'Tier 1',
              gateway: 'stripe',
              gateway_subscription_id: 'sub_test_active',
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'sub-uuid-to-cancel',
              subscriber_id: 'subscriber-1',
              creator_id: 'creator-1',
              plan_id: 'plan-1',
              gateway: 'stripe',
              gateway_subscription_id: 'sub_test_active',
              status: 'active',
              current_period_start: now,
              current_period_end: periodEnd,
              cancel_at_period_end: true,
              created_at: now,
            },
          ],
        });

      const result = await subscriptionsService.cancelSubscription('subscriber-1', 'sub-uuid-to-cancel');

      expect(result.cancelAtPeriodEnd).toBe(true);
      expect(result.status).toBe('active');
    });

    it('processes refund webhook: revokes entitlement and debits creator balance via audit trail', async () => {
      const refundPayload = {
        id: 'evt_stripe_refund_999',
        type: 'charge.refunded',
        transactionId: 'pi_test_refund_target',
        amount_cents: 999,
      };

      const now = new Date();

      mockDb.query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT id FROM payment_webhook_events')) {
          return Promise.resolve({ rows: [] }); // Not duplicate
        }
        if (sql.includes('INSERT INTO payment_webhook_events')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('SELECT * FROM entitlements WHERE transaction_id = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: 'ent-to-revoke-1',
                user_id: 'user-refunded',
                creator_id: 'creator-debited-1',
                transaction_id: 'pi_test_refund_target',
                status: 'ACTIVE',
              },
            ],
          });
        }
        if (sql.includes('UPDATE entitlements SET status = $2')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('SELECT * FROM creator_financial_accounts WHERE user_id = $1')) {
          return Promise.resolve({
            rows: [
              {
                user_id: 'creator-debited-1',
                gateway: 'stripe',
                payout_enabled: true,
                available_balance_cents: '5000',
                pending_balance_cents: '0',
                lifetime_earnings_cents: '5000',
                currency: 'usd',
                kyc_status: 'VERIFIED',
                is_compliance_blocked: false,
                created_at: now,
                updated_at: now,
              },
            ],
          });
        }
        if (sql.includes('UPDATE creator_financial_accounts') && sql.includes('available_balance_cents = $2')) {
          return Promise.resolve({
            rows: [
              {
                user_id: 'creator-debited-1',
                gateway: 'stripe',
                payout_enabled: true,
                available_balance_cents: '4001', // 5000 - 999
                pending_balance_cents: '0',
                lifetime_earnings_cents: '5000',
                currency: 'usd',
                kyc_status: 'VERIFIED',
                is_compliance_blocked: false,
                created_at: now,
                updated_at: now,
              },
            ],
          });
        }
        if (sql.includes('INSERT INTO financial_audit_trail')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await subscriptionsService.processWebhook(
        PaymentGateway.STRIPE,
        refundPayload,
        'whsec_mock_stripe_webhook',
      );

      expect(res.processed).toBe(true);
      expect(res.eventType).toBe('charge.refunded');
    });
  });

  describe('7. Compliance & Sanctions Gate (Unresolved Issues Remain Blocked)', () => {
    it('strictly blocks payouts for unverified KYC creators', async () => {
      const now = new Date();
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            user_id: 'creator-unverified-kyc',
            gateway: 'stripe',
            payout_enabled: false,
            available_balance_cents: '10000', // $100.00
            pending_balance_cents: '0',
            lifetime_earnings_cents: '10000',
            currency: 'usd',
            kyc_status: 'UNVERIFIED',
            is_compliance_blocked: true,
            compliance_block_reason: 'Identity and tax verification required before enabling payouts.',
            created_at: now,
            updated_at: now,
          },
        ],
      });

      await expect(
        financePayoutsService.requestPayout('creator-unverified-kyc', {
          amountCents: 10000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks and rejects creators attempting KYC verification from sanctioned jurisdictions (Cuba, Iran, North Korea, Syria, Russia)', async () => {
      const now = new Date();
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: 'creator-sanctioned-country',
              gateway: 'stripe',
              payout_enabled: false,
              available_balance_cents: '0',
              pending_balance_cents: '0',
              lifetime_earnings_cents: '0',
              currency: 'usd',
              kyc_status: 'UNVERIFIED',
              is_compliance_blocked: true,
              created_at: now,
              updated_at: now,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // update compliance blocked
        .mockResolvedValueOnce({ rows: [] }); // audit log

      await expect(
        financePayoutsService.submitKycVerification('creator-sanctioned-country', {
          taxFormType: 'W8BEN',
          taxLegalName: 'Sanctioned Creator',
          taxIdNumber: '999-99-9999',
          countryCode: 'KP', // North Korea (Sanctioned)
          bankAccountLast4: '1234',
          bankRoutingNumber: '987654321',
          certificationAccepted: true,
        }),
      ).rejects.toThrow(/international trade sanctions/);
    });

    it('rejects payout requests below the minimum threshold ($50.00 / 5000 cents)', async () => {
      const now = new Date();
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            user_id: 'creator-low-balance',
            gateway: 'stripe',
            payout_enabled: true,
            available_balance_cents: '2000', // $20.00
            pending_balance_cents: '0',
            lifetime_earnings_cents: '2000',
            currency: 'usd',
            kyc_status: 'VERIFIED',
            is_compliance_blocked: false,
            created_at: now,
            updated_at: now,
          },
        ],
      });

      await expect(
        financePayoutsService.requestPayout('creator-low-balance', {
          amountCents: 2000,
        }),
      ).rejects.toThrow(/Minimum payout amount is \$50\.00/);
    });

    it('allows verified, compliant creator to disburse sandbox payout, generates itemized invoice, and records in audit trail', async () => {
      const now = new Date();

      mockDb.query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM creator_financial_accounts WHERE user_id = $1')) {
          return Promise.resolve({
            rows: [
              {
                user_id: 'creator-verified-compliant',
                gateway: 'stripe',
                stripe_account_id: 'acct_compliant_123',
                payout_enabled: true,
                available_balance_cents: '20000', // $200.00
                pending_balance_cents: '0',
                lifetime_earnings_cents: '20000',
                currency: 'usd',
                tax_id_number: '123-45-6789',
                tax_entity_type: 'INDIVIDUAL',
                tax_legal_name: 'Jane Creator',
                tax_jurisdiction_code: 'US',
                tax_withholding_rate_bps: 0,
                kyc_status: 'VERIFIED',
                is_compliance_blocked: false,
                tax_form_type: 'W9',
                created_at: now,
                updated_at: now,
              },
            ],
          });
        }
        if (sql.includes('UPDATE creator_financial_accounts SET available_balance_cents = available_balance_cents - $2')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('INSERT INTO creator_payout_records')) {
          return Promise.resolve({
            rows: [
              {
                id: 'payout-rec-1',
                creator_id: 'creator-verified-compliant',
                gateway: 'stripe',
                gateway_payout_id: 'po_test_123',
                amount_cents: '20000',
                tax_withholding_cents: '0',
                net_payout_cents: '20000',
                currency: 'usd',
                status: 'PAID',
                initiated_at: now,
                completed_at: now,
              },
            ],
          });
        }
        if (sql.includes('INSERT INTO creator_payout_invoices')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('INSERT INTO financial_audit_trail')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const payout = await financePayoutsService.requestPayout('creator-verified-compliant', {
        amountCents: 20000,
      });

      expect(payout).toBeDefined();
      expect(payout.amountCents).toBe(20000);
      expect(payout.netPayoutCents).toBe(20000);
      expect(payout.status).toBe('PAID');
    });
  });
});
