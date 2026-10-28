import { FinancePayoutsService } from './finance-payouts.service';
import { PaymentGateway, TaxEntityType } from '@shared/types';
import { BadRequestException } from '@nestjs/common';

describe('FinancePayoutsService (Balances, Taxes, Invoices & Payouts)', () => {
  let service: FinancePayoutsService;
  let mockDb: any;
  let mockPaymentGateway: any;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
    };
    mockPaymentGateway = {
      transferPayout: jest.fn().mockResolvedValue({
        gateway: PaymentGateway.STRIPE,
        payoutId: 'tr_test_123',
        amountCents: 9000,
        status: 'PAID',
      }),
    };

    service = new FinancePayoutsService(mockDb as any, mockPaymentGateway as any);
  });

  describe('getOrCreateFinancialAccount & updateTaxProfile', () => {
    it('should create new financial account if one does not exist', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // initial check
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: 'u-1',
              gateway: 'stripe',
              payout_enabled: false,
              available_balance_cents: 0,
              pending_balance_cents: 0,
              lifetime_earnings_cents: 0,
              currency: 'usd',
              tax_entity_type: 'INDIVIDUAL',
              tax_withholding_rate_bps: 0,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        });

      const acc = await service.getOrCreateFinancialAccount('u-1');
      expect(acc.userId).toBe('u-1');
      expect(acc.payoutEnabled).toBe(false);
      expect(acc.availableBalanceCents).toBe(0);
    });

    it('should update tax profile and enable payouts', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: 'u-1',
              gateway: 'stripe',
              payout_enabled: false,
              available_balance_cents: 10000,
              pending_balance_cents: 0,
              lifetime_earnings_cents: 10000,
              currency: 'usd',
              tax_entity_type: 'INDIVIDUAL',
              tax_withholding_rate_bps: 0,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: 'u-1',
              gateway: 'stripe',
              payout_enabled: true,
              tax_id_number: 'XX-XXXX1234',
              tax_entity_type: 'BUSINESS',
              tax_legal_name: 'Interest Creator LLC',
              tax_jurisdiction_code: 'US-W9',
              tax_withholding_rate_bps: 0,
              available_balance_cents: 10000,
              pending_balance_cents: 0,
              lifetime_earnings_cents: 10000,
              currency: 'usd',
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        });

      const updated = await service.updateTaxProfile('u-1', {
        taxIdNumber: 'XX-XXXX1234',
        taxEntityType: TaxEntityType.BUSINESS,
        taxLegalName: 'Interest Creator LLC',
        taxJurisdictionCode: 'US-W9',
      });

      expect(updated.payoutEnabled).toBe(true);
      expect(updated.taxLegalName).toBe('Interest Creator LLC');
      expect(updated.taxWithholdingRateBps).toBe(0);
    });
  });

  describe('requestPayout', () => {
    it('should reject payout if payout is not enabled (no tax profile)', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            user_id: 'u-1',
            gateway: 'stripe',
            payout_enabled: false,
            available_balance_cents: 10000,
            pending_balance_cents: 0,
            lifetime_earnings_cents: 10000,
            currency: 'usd',
            tax_entity_type: 'INDIVIDUAL',
            tax_withholding_rate_bps: 0,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      await expect(service.requestPayout('u-1', {})).rejects.toThrow(BadRequestException);
    });

    it('should reject payout if balance is under minimum threshold ($50)', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            user_id: 'u-1',
            gateway: 'stripe',
            payout_enabled: true,
            available_balance_cents: 3000, // $30
            pending_balance_cents: 0,
            lifetime_earnings_cents: 3000,
            currency: 'usd',
            tax_entity_type: 'INDIVIDUAL',
            tax_withholding_rate_bps: 0,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      await expect(service.requestPayout('u-1', { amountCents: 3000 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should process compliant payout with tax withholding deduction and record transaction', async () => {
      mockDb.query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM creator_financial_accounts')) {
          return Promise.resolve({
            rows: [
              {
                user_id: 'u-1',
                gateway: 'stripe',
                payout_enabled: true,
                available_balance_cents: 10000, // $100
                pending_balance_cents: 0,
                lifetime_earnings_cents: 10000,
                currency: 'usd',
                tax_entity_type: 'INDIVIDUAL',
                tax_withholding_rate_bps: 1000, // 10% backup withholding = $10
                kyc_status: 'VERIFIED',
                is_compliance_blocked: false,
                created_at: new Date(),
                updated_at: new Date(),
              },
            ],
          });
        }
        if (sql.includes('INSERT INTO creator_payout_records')) {
          return Promise.resolve({
            rows: [
              {
                id: 'pout-1',
                creator_id: 'u-1',
                gateway: 'stripe',
                gateway_payout_id: 'tr_test_123',
                amount_cents: 10000,
                tax_withholding_cents: 1000,
                net_payout_cents: 9000,
                currency: 'usd',
                status: 'PAID',
                initiated_at: new Date(),
                completed_at: new Date(),
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const payout = await service.requestPayout('u-1', { amountCents: 10000 });
      expect(payout.amountCents).toBe(10000);
      expect(payout.taxWithholdingCents).toBe(1000);
      expect(payout.netPayoutCents).toBe(9000);
      expect(payout.status).toBe('PAID');
    });
  });

  describe('generateInvoice', () => {
    it('should generate compliant invoice record with sequential invoice number', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'inv-1',
            invoice_number: 'INV-2026-AB12CD',
            user_id: 'u-1',
            recipient_name: 'Subscriber User',
            tax_id_number: null,
            subtotal_cents: 500,
            tax_rate_bps: 500, // 5%
            tax_amount_cents: 25,
            total_amount_cents: 525,
            currency: 'usd',
            gateway: 'stripe',
            gateway_invoice_id: null,
            status: 'PAID',
            items_breakdown: [{ description: 'Tip', quantity: 1, unitPriceCents: 500, amountCents: 500 }],
            issued_at: new Date(),
            paid_at: new Date(),
          },
        ],
      });

      const inv = await service.generateInvoice({
        userId: 'u-1',
        recipientName: 'Subscriber User',
        subtotalCents: 500,
        taxRateBps: 500,
        currency: 'usd',
        gateway: PaymentGateway.STRIPE,
        items: [{ description: 'Tip', quantity: 1, unitPriceCents: 500, amountCents: 500 }],
      });

      expect(inv.invoiceNumber).toMatch(/^INV-2026-/);
      expect(inv.totalAmountCents).toBe(525);
      expect(inv.status).toBe('PAID');
    });
  });
});
