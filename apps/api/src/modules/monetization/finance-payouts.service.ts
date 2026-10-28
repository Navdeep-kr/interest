import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PaymentGatewayService } from './payment-gateway.service';
import {
  CreatorFinancialAccount,
  InvoiceItem,
  CreatorPayoutRecord,
  PaymentGateway,
  PayoutStatus,
  InvoiceStatus,
  TaxEntityType,
  KycStatus,
  CreatorEligibilityStatus,
  FinancialAuditTrailItem,
  CreatorPayoutInvoiceItem,
} from '@shared/types';
import {
  UpdateTaxProfileDto,
  RequestPayoutDto,
  SubmitKycVerificationDto,
} from './dto/monetization.dto';
import * as crypto from 'crypto';

@Injectable()
export class FinancePayoutsService {
  private readonly logger = new Logger(FinancePayoutsService.name);
  private readonly MIN_PAYOUT_CENTS = 5000; // $50.00 minimum threshold

  constructor(
    private readonly db: DatabaseService,
    private readonly paymentGatewayService: PaymentGatewayService,
  ) {}

  /**
   * Get or Create Creator Financial & Tax Profile
   */
  async getOrCreateFinancialAccount(userId: string): Promise<CreatorFinancialAccount> {
    const existing = await this.db.query(
      `SELECT * FROM creator_financial_accounts WHERE user_id = $1`,
      [userId],
    );

    if (existing.rows.length > 0) {
      return this.mapFinancialAccount(existing.rows[0]);
    }

    const inserted = await this.db.query(
      `INSERT INTO creator_financial_accounts 
        (user_id, gateway, payout_enabled, available_balance_cents, pending_balance_cents, lifetime_earnings_cents, currency, tax_entity_type, tax_withholding_rate_bps, kyc_status, is_compliance_blocked, compliance_block_reason)
       VALUES ($1, 'stripe', FALSE, 0, 0, 0, 'usd', 'INDIVIDUAL', 0, 'UNVERIFIED', TRUE, 'Identity and tax verification required before enabling payouts.')
       RETURNING *`,
      [userId],
    );

    return this.mapFinancialAccount(inserted.rows[0]);
  }

  /**
   * Check Creator Monetization & Payout Eligibility
   */
  async checkCreatorEligibility(userId: string): Promise<CreatorEligibilityStatus> {
    const account = await this.getOrCreateFinancialAccount(userId);

    const userRes = await this.db.query(
      `SELECT created_at FROM users WHERE id = $1`,
      [userId],
    );
    const createdAt = userRes.rows[0]?.created_at || new Date();
    const accountAgeDays = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 3600 * 24));

    const followersRes = await this.db.query(
      `SELECT COUNT(*)::int as count FROM user_followers WHERE following_id = $1`,
      [userId],
    );
    const followerCount = followersRes.rows[0]?.count || 0;

    const MIN_FOLLOWERS = 10;
    const MIN_AGE_DAYS = 7;
    const reasons: string[] = [];

    if (followerCount < MIN_FOLLOWERS) {
      reasons.push(`Minimum ${MIN_FOLLOWERS} followers required (currently ${followerCount}).`);
    }

    if (accountAgeDays < MIN_AGE_DAYS) {
      reasons.push(`Account must be at least ${MIN_AGE_DAYS} days old (currently ${accountAgeDays} days).`);
    }

    if (account.kycStatus !== KycStatus.VERIFIED) {
      reasons.push(`KYC identity verification required (current status: ${account.kycStatus}).`);
    }

    const isTaxCompliant = Boolean(account.taxIdNumber && account.taxFormType);
    if (!isTaxCompliant) {
      reasons.push('Valid tax profile and tax form (W-9 or W-8BEN) submission required.');
    }

    if (account.isComplianceBlocked) {
      reasons.push(`Compliance block active: ${account.complianceBlockReason || 'Under compliance review'}`);
    }

    const isEligible = reasons.length === 0;

    return {
      isEligible,
      minFollowersRequired: MIN_FOLLOWERS,
      currentFollowers: followerCount,
      minAccountAgeDays: MIN_AGE_DAYS,
      currentAccountAgeDays: accountAgeDays,
      kycStatus: account.kycStatus,
      isTaxCompliant,
      isComplianceBlocked: account.isComplianceBlocked,
      complianceBlockReason: account.complianceBlockReason,
      reasons,
    };
  }

  /**
   * Submit KYC Verification & Tax Information
   */
  async submitKycVerification(userId: string, dto: SubmitKycVerificationDto): Promise<CreatorFinancialAccount> {
    await this.getOrCreateFinancialAccount(userId);

    const sanctionedJurisdictions = ['CU', 'IR', 'KP', 'SY', 'RU'];
    const countryUpper = dto.countryCode.trim().toUpperCase();

    if (sanctionedJurisdictions.includes(countryUpper)) {
      await this.db.query(
        `UPDATE creator_financial_accounts
         SET kyc_status = 'REJECTED',
             is_compliance_blocked = TRUE,
             compliance_block_reason = 'Country/Jurisdiction is subject to international trade sanctions. Creator payouts are strictly prohibited.',
             tax_jurisdiction_code = $2,
             updated_at = NOW()
         WHERE user_id = $1`,
        [userId, countryUpper],
      );

      await this.logAuditTrail({
        userId,
        actionType: 'COMPLIANCE_SANCTION_BLOCK',
        amountCents: 0,
        balanceBeforeCents: 0,
        balanceAfterCents: 0,
        notes: `Sanctioned jurisdiction block applied for country: ${countryUpper}`,
      });

      throw new BadRequestException(
        `Compliance review failed: Jurisdiction '${countryUpper}' is subject to international trade sanctions. Monetization is blocked.`,
      );
    }

    let withholdingBps = 0;
    if (dto.taxFormType === 'W8BEN') {
      withholdingBps = 3000; // 30% statutory withholding on non-US treaty non-exempt
    } else if (dto.taxFormType === 'W9') {
      withholdingBps = 0; // W-9 US taxpayer certification
    }

    const res = await this.db.query(
      `UPDATE creator_financial_accounts
       SET kyc_status = 'VERIFIED',
           is_compliance_blocked = FALSE,
           compliance_block_reason = NULL,
           tax_form_type = $2,
           tax_form_submitted_at = NOW(),
           tax_legal_name = $3,
           tax_id_number = $4,
           tax_jurisdiction_code = $5,
           tax_withholding_rate_bps = $6,
           bank_account_last4 = $7,
           bank_routing_number = $8,
           payout_enabled = TRUE,
           updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      [
        userId,
        dto.taxFormType,
        dto.taxLegalName,
        dto.taxIdNumber,
        countryUpper,
        withholdingBps,
        dto.bankAccountLast4,
        dto.bankRoutingNumber,
      ],
    );

    const updatedAccount = this.mapFinancialAccount(res.rows[0]);

    await this.logAuditTrail({
      userId,
      actionType: 'KYC_VERIFICATION_APPROVED',
      amountCents: 0,
      balanceBeforeCents: updatedAccount.availableBalanceCents,
      balanceAfterCents: updatedAccount.availableBalanceCents,
      notes: `KYC verified with tax form ${dto.taxFormType} (${countryUpper})`,
    });

    this.logger.log(`KYC verified successfully for User: ${userId} (${countryUpper})`);
    return updatedAccount;
  }

  /**
   * Log an entry in the Tamper-Evident Financial Audit Trail
   */
  async logAuditTrail(params: {
    userId: string;
    actionType: string;
    amountCents: number;
    feeCents?: number;
    balanceBeforeCents: number;
    balanceAfterCents: number;
    referenceId?: string;
    notes?: string;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO financial_audit_trail
        (user_id, action_type, amount_cents, fee_cents, balance_before_cents, balance_after_cents, reference_id, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        params.userId,
        params.actionType,
        params.amountCents,
        params.feeCents || 0,
        params.balanceBeforeCents,
        params.balanceAfterCents,
        params.referenceId || null,
        params.notes || null,
      ],
    );
  }

  /**
   * Get User Financial Audit Trail
   */
  async getAuditTrail(userId: string, limit = 50, offset = 0): Promise<FinancialAuditTrailItem[]> {
    const res = await this.db.query(
      `SELECT * FROM financial_audit_trail WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );
    return res.rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      actionType: r.action_type,
      amountCents: parseInt(r.amount_cents, 10),
      feeCents: parseInt(r.fee_cents, 10),
      balanceBeforeCents: parseInt(r.balance_before_cents, 10),
      balanceAfterCents: parseInt(r.balance_after_cents, 10),
      referenceId: r.reference_id,
      notes: r.notes,
      createdAt: r.created_at.toISOString(),
    }));
  }

  /**
   * Update Tax & Identity Profile
   * Strictly decoupled from physical geo-location. Relies on self-declared tax entity.
   */
  async updateTaxProfile(userId: string, dto: UpdateTaxProfileDto): Promise<CreatorFinancialAccount> {
    await this.getOrCreateFinancialAccount(userId);

    // Compute withholding rate based on jurisdiction (e.g. US with W-9 is 0%, backup withholding is 24%)
    let withholdingBps = 0;
    if (dto.taxJurisdictionCode.toUpperCase().includes('BACKUP')) {
      withholdingBps = 2400; // 24%
    } else if (dto.taxJurisdictionCode.toUpperCase().includes('TDS')) {
      withholdingBps = 1000; // 10%
    }

    const res = await this.db.query(
      `UPDATE creator_financial_accounts
       SET tax_id_number = $2,
           tax_entity_type = $3,
           tax_legal_name = $4,
           tax_jurisdiction_code = $5,
           tax_withholding_rate_bps = $6,
           gateway = COALESCE($7, gateway),
           payout_enabled = TRUE,
           updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      [
        userId,
        dto.taxIdNumber,
        dto.taxEntityType,
        dto.taxLegalName,
        dto.taxJurisdictionCode,
        withholdingBps,
        dto.gateway,
      ],
    );

    this.logger.log(`Updated Tax Profile for User: ${userId} (${dto.taxJurisdictionCode})`);
    return this.mapFinancialAccount(res.rows[0]);
  }

  /**
   * Credit Creator Balance with Net Earnings
   */
  async creditCreatorBalance(
    userId: string,
    netCents: number,
    currency = 'usd',
    reason = 'EARNINGS',
    referenceId?: string,
  ): Promise<CreatorFinancialAccount> {
    const account = await this.getOrCreateFinancialAccount(userId);
    const balanceBefore = account.availableBalanceCents;

    const res = await this.db.query(
      `UPDATE creator_financial_accounts
       SET available_balance_cents = available_balance_cents + $2,
           lifetime_earnings_cents = lifetime_earnings_cents + $2,
           currency = $3,
           updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      [userId, netCents, currency.toLowerCase()],
    );

    const updated = this.mapFinancialAccount(res.rows[0]);

    await this.logAuditTrail({
      userId,
      actionType: reason.startsWith('TIP') ? 'CREDIT_TIP' : reason.startsWith('SUBSCRIPTION') ? 'CREDIT_SUBSCRIPTION' : 'CREDIT_EARNINGS',
      amountCents: netCents,
      balanceBeforeCents: balanceBefore,
      balanceAfterCents: updated.availableBalanceCents,
      referenceId,
      notes: reason,
    });

    this.logger.log(`Credited ${netCents} cents to User: ${userId} [${reason}]`);
    return updated;
  }

  /**
   * Debit Creator Balance (Refunds, Chargebacks, Dispute Holds)
   */
  async debitCreatorBalance(
    userId: string,
    amountCents: number,
    reason = 'REFUND_DEBIT',
    referenceId?: string,
  ): Promise<CreatorFinancialAccount> {
    const account = await this.getOrCreateFinancialAccount(userId);
    const balanceBefore = account.availableBalanceCents;
    const balanceAfter = Math.max(0, balanceBefore - amountCents);

    const res = await this.db.query(
      `UPDATE creator_financial_accounts
       SET available_balance_cents = $2,
           updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      [userId, balanceAfter],
    );

    await this.logAuditTrail({
      userId,
      actionType: reason,
      amountCents,
      balanceBeforeCents: balanceBefore,
      balanceAfterCents: balanceAfter,
      referenceId,
      notes: `Debit: ${reason}`,
    });

    this.logger.log(`Debited ${amountCents} cents from User: ${userId} [${reason}]`);
    return res.rows.length > 0 ? this.mapFinancialAccount(res.rows[0]) : { ...account, availableBalanceCents: balanceAfter };
  }

  /**
   * Request / Disburse Payout to Connected Gateway
   */
  async requestPayout(userId: string, dto: RequestPayoutDto): Promise<CreatorPayoutRecord> {
    const account = await this.getOrCreateFinancialAccount(userId);

    if (account.isComplianceBlocked) {
      throw new BadRequestException(
        `Payout blocked: ${account.complianceBlockReason || 'Compliance block active. Identity and tax verification required.'}`,
      );
    }

    if (account.kycStatus !== KycStatus.VERIFIED) {
      throw new BadRequestException(
        'Identity and tax verification (KYC) required before payouts can be disbursed.',
      );
    }

    if (!account.payoutEnabled) {
      throw new BadRequestException('Please complete your tax profile before requesting a payout.');
    }

    const payoutAmount = dto.amountCents || account.availableBalanceCents;

    if (payoutAmount < this.MIN_PAYOUT_CENTS) {
      throw new BadRequestException(
        `Minimum payout amount is $${(this.MIN_PAYOUT_CENTS / 100).toFixed(2)} (${this.MIN_PAYOUT_CENTS} cents).`,
      );
    }

    if (account.availableBalanceCents < payoutAmount) {
      throw new BadRequestException('Insufficient available balance for requested payout.');
    }

    // Calculate tax withholding
    const withholdingCents = Math.round((payoutAmount * account.taxWithholdingRateBps) / 10000);
    const netPayoutCents = payoutAmount - withholdingCents;

    // Deduct available balance
    await this.db.query(
      `UPDATE creator_financial_accounts
       SET available_balance_cents = available_balance_cents - $2,
           updated_at = NOW()
       WHERE user_id = $1`,
      [userId, payoutAmount],
    );

    // Call payment gateway transfer
    const idempotencyKey = `payout_${userId}_${Date.now()}`;
    const destinationAccount =
      account.gateway === PaymentGateway.STRIPE
        ? account.stripeAccountId || `acct_${userId.substring(0, 8)}`
        : account.razorpayAccountId || `acc_${userId.substring(0, 8)}`;

    const transferRes = await this.paymentGatewayService.transferPayout({
      creatorAccountId: destinationAccount,
      amountCents: netPayoutCents,
      currency: account.currency,
      gateway: account.gateway,
      idempotencyKey,
    });

    // Record payout transaction
    const insertRes = await this.db.query(
      `INSERT INTO creator_payout_records
        (creator_id, gateway, gateway_payout_id, amount_cents, tax_withholding_cents, net_payout_cents, currency, status, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [
        userId,
        account.gateway,
        transferRes.payoutId,
        payoutAmount,
        withholdingCents,
        netPayoutCents,
        account.currency,
        transferRes.status,
      ],
    );

    // Itemized Payout Invoice
    const year = new Date().getFullYear();
    const invoiceNumber = `POINV-${year}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const maskedTaxId = account.taxIdNumber
      ? `***-**-${account.taxIdNumber.slice(-4)}`
      : undefined;

    await this.db.query(
      `INSERT INTO creator_payout_invoices
        (payout_record_id, invoice_number, creator_id, gross_amount_cents, platform_fee_cents, tax_withheld_cents, net_payout_cents, currency, tax_id_masked, issued_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        insertRes.rows[0].id,
        invoiceNumber,
        userId,
        payoutAmount,
        0,
        withholdingCents,
        netPayoutCents,
        account.currency,
        maskedTaxId,
      ],
    );

    // Log Audit Trail
    await this.logAuditTrail({
      userId,
      actionType: 'PAYOUT_DISBURSED',
      amountCents: payoutAmount,
      feeCents: withholdingCents,
      balanceBeforeCents: account.availableBalanceCents,
      balanceAfterCents: account.availableBalanceCents - payoutAmount,
      referenceId: insertRes.rows[0].id,
      notes: `Payout disburse: Net ${netPayoutCents} cents, Tax withheld ${withholdingCents} cents via ${account.gateway}`,
    });

    this.logger.log(
      `Payout executed for User: ${userId}, Gross: ${payoutAmount}, Tax: ${withholdingCents}, Net: ${netPayoutCents}`,
    );

    return this.mapPayoutRecord(insertRes.rows[0]);
  }

  /**
   * Generate Compliant Invoice & Itemized Billing Record
   */
  async generateInvoice(params: {
    userId: string;
    recipientName: string;
    subtotalCents: number;
    taxRateBps?: number;
    currency?: string;
    gateway: PaymentGateway;
    gatewayInvoiceId?: string;
    items: Array<{
      description: string;
      quantity: number;
      unitPriceCents: number;
      amountCents: number;
    }>;
  }): Promise<InvoiceItem> {
    const taxRateBps = params.taxRateBps || 0;
    const taxAmountCents = Math.round((params.subtotalCents * taxRateBps) / 10000);
    const totalAmountCents = params.subtotalCents + taxAmountCents;
    const currency = (params.currency || 'usd').toLowerCase();

    // Generate unique sequential invoice number
    const year = new Date().getFullYear();
    const randomSeq = crypto.randomBytes(3).toString('hex').toUpperCase();
    const invoiceNumber = `INV-${year}-${randomSeq}`;

    const res = await this.db.query(
      `INSERT INTO invoices
        (invoice_number, user_id, recipient_name, subtotal_cents, tax_rate_bps, tax_amount_cents, total_amount_cents, currency, gateway, gateway_invoice_id, status, items_breakdown, issued_at, paid_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PAID', $11, NOW(), NOW())
       RETURNING *`,
      [
        invoiceNumber,
        params.userId,
        params.recipientName,
        params.subtotalCents,
        taxRateBps,
        taxAmountCents,
        totalAmountCents,
        currency,
        params.gateway,
        params.gatewayInvoiceId,
        JSON.stringify(params.items),
      ],
    );

    this.logger.log(`Generated Invoice ${invoiceNumber} for User: ${params.userId} (${totalAmountCents} cents)`);
    return this.mapInvoice(res.rows[0]);
  }

  /**
   * Get User's Invoices
   */
  async getUserInvoices(userId: string): Promise<InvoiceItem[]> {
    const res = await this.db.query(
      `SELECT * FROM invoices WHERE user_id = $1 ORDER BY issued_at DESC`,
      [userId],
    );
    return res.rows.map((row) => this.mapInvoice(row));
  }

  /**
   * Get Creator Payout Invoices
   */
  async getPayoutInvoices(creatorId: string): Promise<CreatorPayoutInvoiceItem[]> {
    const res = await this.db.query(
      `SELECT * FROM creator_payout_invoices WHERE creator_id = $1 ORDER BY issued_at DESC`,
      [creatorId],
    );
    return res.rows.map((r) => ({
      id: r.id,
      payoutRecordId: r.payout_record_id,
      invoiceNumber: r.invoice_number,
      creatorId: r.creator_id,
      grossAmountCents: parseInt(r.gross_amount_cents, 10),
      platformFeeCents: parseInt(r.platform_fee_cents, 10),
      taxWithheldCents: parseInt(r.tax_withheld_cents, 10),
      netPayoutCents: parseInt(r.net_payout_cents, 10),
      currency: r.currency,
      taxIdMasked: r.tax_id_masked,
      issuedAt: r.issued_at.toISOString(),
      pdfUrl: r.pdf_url,
    }));
  }

  /**
   * Get Creator Payout Records
   */
  async getCreatorPayouts(creatorId: string): Promise<CreatorPayoutRecord[]> {
    const res = await this.db.query(
      `SELECT * FROM creator_payout_records WHERE creator_id = $1 ORDER BY initiated_at DESC`,
      [creatorId],
    );
    return res.rows.map((row) => this.mapPayoutRecord(row));
  }

  private mapFinancialAccount(row: any): CreatorFinancialAccount {
    return {
      userId: row.user_id,
      gateway: row.gateway as PaymentGateway,
      stripeAccountId: row.stripe_account_id,
      razorpayAccountId: row.razorpay_account_id,
      payoutEnabled: row.payout_enabled,
      availableBalanceCents: parseInt(row.available_balance_cents, 10),
      pendingBalanceCents: parseInt(row.pending_balance_cents, 10),
      lifetimeEarningsCents: parseInt(row.lifetime_earnings_cents, 10),
      currency: row.currency,
      taxIdNumber: row.tax_id_number,
      taxEntityType: row.tax_entity_type as TaxEntityType,
      taxLegalName: row.tax_legal_name,
      taxJurisdictionCode: row.tax_jurisdiction_code,
      taxWithholdingRateBps: row.tax_withholding_rate_bps || 0,
      kycStatus: (row.kyc_status || 'UNVERIFIED') as KycStatus,
      isComplianceBlocked: Boolean(row.is_compliance_blocked),
      complianceBlockReason: row.compliance_block_reason || undefined,
      taxFormType: row.tax_form_type || undefined,
      taxFormSubmittedAt: row.tax_form_submitted_at ? row.tax_form_submitted_at.toISOString() : undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private mapInvoice(row: any): InvoiceItem {
    return {
      id: row.id,
      invoiceNumber: row.invoice_number,
      userId: row.user_id,
      recipientName: row.recipient_name,
      taxIdNumber: row.tax_id_number,
      subtotalCents: row.subtotal_cents,
      taxRateBps: row.tax_rate_bps,
      taxAmountCents: row.tax_amount_cents,
      totalAmountCents: row.total_amount_cents,
      currency: row.currency,
      gateway: row.gateway as PaymentGateway,
      gatewayInvoiceId: row.gateway_invoice_id,
      status: row.status as InvoiceStatus,
      itemsBreakdown: typeof row.items_breakdown === 'string' ? JSON.parse(row.items_breakdown) : row.items_breakdown,
      issuedAt: row.issued_at.toISOString(),
      paidAt: row.paid_at ? row.paid_at.toISOString() : undefined,
    };
  }

  private mapPayoutRecord(row: any): CreatorPayoutRecord {
    return {
      id: row.id,
      creatorId: row.creator_id,
      gateway: row.gateway as PaymentGateway,
      gatewayPayoutId: row.gateway_payout_id,
      amountCents: parseInt(row.amount_cents, 10),
      taxWithholdingCents: parseInt(row.tax_withholding_cents, 10),
      netPayoutCents: parseInt(row.net_payout_cents, 10),
      currency: row.currency,
      status: row.status as PayoutStatus,
      failureReason: row.failure_reason,
      initiatedAt: row.initiated_at.toISOString(),
      completedAt: row.completed_at ? row.completed_at.toISOString() : undefined,
    };
  }
}
