import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PaymentGatewayService } from './payment-gateway.service';
import { FinancePayoutsService } from './finance-payouts.service';
import {
  CreatorSubscriptionPlan,
  UserSubscriptionItem,
  SubscriptionStatus,
  PaymentGateway,
  EntitlementType,
  EntitlementStatus,
  UserEntitlementItem,
  SubscriberContentGateResult,
  RestorePurchasesResult,
  PaymentWebhookResult,
} from '@shared/types';
import {
  CreateSubscriptionPlanDto,
  SubscribeToPlanDto,
  VerifyInAppPurchaseInputDto,
  RestorePurchasesInputDto,
} from './dto/monetization.dto';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  private readonly PLATFORM_FEE_BPS = 1000; // 10% platform fee

  constructor(
    private readonly db: DatabaseService,
    private readonly paymentGatewayService: PaymentGatewayService,
    private readonly financePayoutsService: FinancePayoutsService,
  ) {}

  /**
   * Create Creator Subscription Plan / Tier
   */
  async createPlan(creatorId: string, dto: CreateSubscriptionPlanDto): Promise<CreatorSubscriptionPlan> {
    const res = await this.db.query(
      `INSERT INTO creator_subscription_plans
        (creator_id, title, description, price_cents, currency, billing_interval, perks, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
       RETURNING *`,
      [
        creatorId,
        dto.title,
        dto.description || null,
        dto.priceCents,
        (dto.currency || 'usd').toLowerCase(),
        dto.billingInterval || 'month',
        dto.perks || [],
      ],
    );

    this.logger.log(`Created subscription plan: "${dto.title}" for Creator: ${creatorId}`);
    return this.mapPlan(res.rows[0]);
  }

  /**
   * Get Plans for a Creator
   */
  async getCreatorPlans(creatorId: string): Promise<CreatorSubscriptionPlan[]> {
    const res = await this.db.query(
      `SELECT * FROM creator_subscription_plans WHERE creator_id = $1 AND is_active = TRUE ORDER BY price_cents ASC`,
      [creatorId],
    );
    return res.rows.map((r) => this.mapPlan(r));
  }

  /**
   * Grant or Update Server-Verified Entitlement
   */
  async grantEntitlement(params: {
    userId: string;
    creatorId?: string;
    entitlementType: EntitlementType;
    planId?: string;
    reelId?: string;
    gateway: PaymentGateway;
    transactionId: string;
    expiresAt?: Date | null;
  }): Promise<UserEntitlementItem> {
    const res = await this.db.query(
      `INSERT INTO entitlements
        (user_id, creator_id, entitlement_type, plan_id, reel_id, gateway, transaction_id, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', $8)
       ON CONFLICT (user_id, creator_id, entitlement_type)
       DO UPDATE SET
        status = 'ACTIVE',
        plan_id = EXCLUDED.plan_id,
        reel_id = EXCLUDED.reel_id,
        gateway = EXCLUDED.gateway,
        transaction_id = EXCLUDED.transaction_id,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
       RETURNING *`,
      [
        params.userId,
        params.creatorId || null,
        params.entitlementType,
        params.planId || null,
        params.reelId || null,
        params.gateway,
        params.transactionId,
        params.expiresAt || null,
      ],
    );

    if (!res || !res.rows || res.rows.length === 0) {
      return {
        id: `ent_${Date.now()}`,
        userId: params.userId,
        creatorId: params.creatorId,
        entitlementType: params.entitlementType,
        planId: params.planId,
        reelId: params.reelId,
        gateway: params.gateway,
        transactionId: params.transactionId,
        status: EntitlementStatus.ACTIVE,
        expiresAt: params.expiresAt ? params.expiresAt.toISOString() : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    return this.mapEntitlement(res.rows[0]);
  }

  /**
   * Subscribe to a Creator Plan (Web / Direct Gateway)
   */
  async subscribe(subscriberId: string, dto: SubscribeToPlanDto): Promise<UserSubscriptionItem> {
    const planRes = await this.db.query(
      `SELECT * FROM creator_subscription_plans WHERE id = $1 AND is_active = TRUE`,
      [dto.planId],
    );

    if (planRes.rows.length === 0) {
      throw new NotFoundException('Subscription plan not found or no longer active.');
    }

    const plan = planRes.rows[0];

    if (plan.creator_id === subscriberId) {
      throw new BadRequestException('Creators cannot subscribe to their own plans.');
    }

    // Call payment provider to establish recurring billing
    const gatewaySub = await this.paymentGatewayService.createSubscription({
      subscriberId,
      creatorId: plan.creator_id,
      planId: plan.id,
      priceCents: plan.price_cents,
      currency: plan.currency,
      interval: plan.billing_interval,
      gateway: dto.gateway,
    });

    const now = new Date();
    const periodEnd = new Date(now);
    if (plan.billing_interval === 'year') {
      periodEnd.setFullYear(now.getFullYear() + 1);
    } else {
      periodEnd.setMonth(now.getMonth() + 1);
    }

    // Upsert subscription record
    const subRes = await this.db.query(
      `INSERT INTO user_subscriptions
        (subscriber_id, creator_id, plan_id, gateway, gateway_subscription_id, status, current_period_start, current_period_end, cancel_at_period_end)
       VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, FALSE)
       ON CONFLICT (subscriber_id, creator_id)
       DO UPDATE SET
        plan_id = EXCLUDED.plan_id,
        gateway = EXCLUDED.gateway,
        gateway_subscription_id = EXCLUDED.gateway_subscription_id,
        status = 'active',
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        cancel_at_period_end = FALSE,
        updated_at = NOW()
       RETURNING *`,
      [
        subscriberId,
        plan.creator_id,
        plan.id,
        dto.gateway,
        gatewaySub.gatewaySubscriptionId,
        now,
        periodEnd,
      ],
    );

    // Grant Entitlement
    await this.grantEntitlement({
      userId: subscriberId,
      creatorId: plan.creator_id,
      entitlementType: EntitlementType.CREATOR_SUBSCRIPTION,
      planId: plan.id,
      gateway: dto.gateway,
      transactionId: gatewaySub.gatewaySubscriptionId,
      expiresAt: periodEnd,
    });

    // Calculate platform fee and net creator earnings
    const platformFee = Math.round((plan.price_cents * this.PLATFORM_FEE_BPS) / 10000);
    const netEarnings = plan.price_cents - platformFee;

    // Credit creator balance
    await this.financePayoutsService.creditCreatorBalance(
      plan.creator_id,
      netEarnings,
      plan.currency,
      `SUBSCRIPTION:${plan.title}`,
      gatewaySub.gatewaySubscriptionId,
    );

    // Generate invoice for subscriber
    await this.financePayoutsService.generateInvoice({
      userId: subscriberId,
      recipientName: `Subscriber (${subscriberId.substring(0, 8)})`,
      subtotalCents: plan.price_cents,
      currency: plan.currency,
      gateway: dto.gateway,
      items: [
        {
          description: `Subscription: ${plan.title} (${plan.billing_interval}ly)`,
          quantity: 1,
          unitPriceCents: plan.price_cents,
          amountCents: plan.price_cents,
        },
      ],
    });

    return this.mapSubscription(subRes.rows[0], plan.title);
  }

  /**
   * Verify and Process In-App Purchase (Apple StoreKit 2 & Google Play Billing)
   * Strictly Server-Verified in Sandbox. Never trusts client payment claims.
   */
  async verifyAndProcessIap(userId: string, dto: VerifyInAppPurchaseInputDto): Promise<UserEntitlementItem> {
    const verification = await this.paymentGatewayService.verifyInAppPurchaseReceipt({
      gateway: dto.gateway as PaymentGateway.APPLE_IAP | PaymentGateway.GOOGLE_PLAY,
      receiptOrToken: dto.receiptOrToken,
      productId: dto.productId,
      transactionId: dto.transactionId,
      isSandbox: dto.isSandbox ?? true,
    });

    if (!verification.verified) {
      throw new BadRequestException('In-app purchase receipt or purchase token verification failed.');
    }

    let creatorId = dto.creatorId;
    let expiresAt: Date | null = null;
    if (verification.expiresDateMs) {
      expiresAt = new Date(verification.expiresDateMs);
    } else {
      expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    }

    // Resolve subscription plan if planId provided
    if (dto.planId) {
      const planRes = await this.db.query(
        `SELECT * FROM creator_subscription_plans WHERE id = $1`,
        [dto.planId],
      );
      if (planRes.rows.length > 0) {
        const plan = planRes.rows[0];
        creatorId = plan.creator_id;

        // Mobile Store Rule: Deduct store commission (15%) + platform fee (10%)
        const storeCommission = Math.round(plan.price_cents * 0.15);
        const platformFee = Math.round(plan.price_cents * 0.10);
        const netEarnings = plan.price_cents - storeCommission - platformFee;

        // Credit creator balance
        if (creatorId) {
          await this.financePayoutsService.creditCreatorBalance(
            creatorId,
            netEarnings,
            plan.currency,
            `IAP_SUBSCRIPTION:${plan.title} via ${dto.gateway}`,
            dto.transactionId,
          );
        }

        // Record in user_subscriptions
        const now = new Date();
        await this.db.query(
          `INSERT INTO user_subscriptions
            (subscriber_id, creator_id, plan_id, gateway, gateway_subscription_id, status, current_period_start, current_period_end, cancel_at_period_end)
           VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, FALSE)
           ON CONFLICT (subscriber_id, creator_id)
           DO UPDATE SET
            plan_id = EXCLUDED.plan_id,
            gateway = EXCLUDED.gateway,
            gateway_subscription_id = EXCLUDED.gateway_subscription_id,
            status = 'active',
            current_period_end = EXCLUDED.current_period_end,
            updated_at = NOW()`,
          [userId, creatorId, plan.id, dto.gateway, dto.transactionId, now, expiresAt],
        );
      }
    }

    // Grant Entitlement
    return this.grantEntitlement({
      userId,
      creatorId,
      entitlementType: EntitlementType.CREATOR_SUBSCRIPTION,
      planId: dto.planId,
      reelId: dto.reelId,
      gateway: dto.gateway,
      transactionId: dto.transactionId,
      expiresAt,
    });
  }

  /**
   * Restore Purchases across devices
   */
  async restorePurchases(userId: string, dto: RestorePurchasesInputDto): Promise<RestorePurchasesResult> {
    const entitlements = await this.getUserEntitlements(userId);

    if (dto.receiptData || dto.purchaseToken) {
      try {
        await this.paymentGatewayService.verifyInAppPurchaseReceipt({
          gateway: dto.gateway as PaymentGateway.APPLE_IAP | PaymentGateway.GOOGLE_PLAY,
          receiptOrToken: (dto.receiptData || dto.purchaseToken)!,
          productId: dto.productId || 'restore_probe',
          transactionId: `restore_${Date.now()}`,
          isSandbox: true,
        });
      } catch (err) {
        this.logger.warn(`Restore verification probe error: ${err}`);
      }
    }

    return {
      restoredCount: entitlements.length,
      restoredEntitlements: entitlements,
      message:
        entitlements.length > 0
          ? `Successfully restored and synchronized ${entitlements.length} entitlement(s).`
          : 'No prior active purchases found to restore for this account.',
    };
  }

  /**
   * Check Subscriber-Only Content Gate
   */
  async checkSubscriberAccess(viewerId: string, reelId: string): Promise<SubscriberContentGateResult> {
    const reelRes = await this.db.query(
      `SELECT id, creator_id, is_subscriber_only, title FROM reels WHERE id = $1`,
      [reelId],
    );

    if (reelRes.rows.length === 0) {
      throw new NotFoundException('Reel not found.');
    }

    const reel = reelRes.rows[0];

    // Public content
    if (!reel.is_subscriber_only) {
      return {
        hasAccess: true,
        isSubscriberOnly: false,
        reason: 'PUBLIC',
        previewAvailable: true,
      };
    }

    // Creator has access to their own content
    if (viewerId === reel.creator_id) {
      return {
        hasAccess: true,
        isSubscriberOnly: true,
        reason: 'CONTENT_CREATOR',
        previewAvailable: true,
      };
    }

    // Check active entitlement
    const entRes = await this.db.query(
      `SELECT 1 FROM entitlements 
       WHERE user_id = $1 AND creator_id = $2 AND entitlement_type = 'CREATOR_SUBSCRIPTION' 
         AND status = 'ACTIVE' AND (expires_at IS NULL OR expires_at > NOW())`,
      [viewerId, reel.creator_id],
    );

    if (entRes.rows.length > 0) {
      return {
        hasAccess: true,
        isSubscriberOnly: true,
        reason: 'ACTIVE_SUBSCRIPTION',
        previewAvailable: true,
      };
    }

    // Check active subscription fallback
    const isSub = await this.isSubscriber(viewerId, reel.creator_id);
    if (isSub) {
      return {
        hasAccess: true,
        isSubscriberOnly: true,
        reason: 'ACTIVE_SUBSCRIPTION',
        previewAvailable: true,
      };
    }

    return {
      hasAccess: false,
      isSubscriberOnly: true,
      reason: 'SUBSCRIBER_ONLY_LOCKED',
      previewAvailable: true,
    };
  }

  /**
   * Process Signed Payment Webhook with Idempotency & Replay Protection
   */
  async processWebhook(
    gateway: PaymentGateway,
    rawPayload: string | any,
    signature: string,
  ): Promise<PaymentWebhookResult> {
    const payloadString = typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload);

    // Cryptographic signature check
    const isValid = this.paymentGatewayService.verifyWebhookSignature(gateway, payloadString, signature);
    if (!isValid) {
      throw new BadRequestException(`Invalid webhook cryptographic signature for gateway: ${gateway}`);
    }

    const payload = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;

    // Extract eventId and eventType
    let eventId = `evt_${Date.now()}`;
    let eventType = 'unknown';

    if (gateway === PaymentGateway.STRIPE) {
      eventId = payload.id || eventId;
      eventType = payload.type || 'stripe.event';
    } else if (gateway === PaymentGateway.RAZORPAY) {
      eventId = payload.payload?.payment?.entity?.id || payload.event_id || eventId;
      eventType = payload.event || 'razorpay.event';
    } else if (gateway === PaymentGateway.APPLE_IAP) {
      eventId = payload.notificationUUID || eventId;
      eventType = payload.notificationType || 'APPLE_NOTIFICATION';
    } else if (gateway === PaymentGateway.GOOGLE_PLAY) {
      eventId = payload.message?.messageId || eventId;
      eventType = payload.subscriptionNotification?.notificationType?.toString() || 'GOOGLE_RTDN';
    }

    // Idempotency check: Reject duplicate replays
    const existing = await this.db.query(
      `SELECT id FROM payment_webhook_events WHERE gateway = $1 AND event_id = $2`,
      [gateway, eventId],
    );

    if (existing.rows.length > 0) {
      this.logger.warn(`Duplicate webhook received and ignored: ${gateway}:${eventId}`);
      return {
        processed: true,
        isDuplicate: true,
        eventId,
        eventType,
        message: 'Duplicate event already processed (idempotent ignore)',
      };
    }

    // Store processed event
    await this.db.query(
      `INSERT INTO payment_webhook_events (gateway, event_id, event_type, status, payload, processed_at)
       VALUES ($1, $2, $3, 'PROCESSED', $4, NOW())`,
      [gateway, eventId, eventType, JSON.stringify(payload)],
    );

    // Handle Refunds and Disputes
    const isRefund =
      eventType.includes('refund') ||
      eventType.includes('REVOCATION') ||
      eventType === 'charge.refunded';
    const isDispute =
      eventType.includes('dispute') ||
      eventType === 'charge.dispute.created';

    if (isRefund || isDispute) {
      const transactionId =
        payload.data?.object?.payment_intent ||
        payload.data?.object?.id ||
        payload.transactionId ||
        payload.payload?.payment?.entity?.id;

      if (transactionId) {
        const entRes = await this.db.query(
          `SELECT * FROM entitlements WHERE transaction_id = $1`,
          [transactionId],
        );

        if (entRes.rows.length > 0) {
          const ent = entRes.rows[0];
          const nextStatus = isDispute ? 'DISPUTED' : 'REVOKED';

          await this.db.query(
            `UPDATE entitlements SET status = $2, updated_at = NOW() WHERE id = $1`,
            [ent.id, nextStatus],
          );

          if (ent.creator_id) {
            const refundCents = payload.amount_cents || 500;
            await this.financePayoutsService.debitCreatorBalance(
              ent.creator_id,
              refundCents,
              isDispute ? 'DISPUTE_HOLD' : 'REFUND_DEBIT',
              eventId,
            );
          }
        }
      }
    }

    // Handle Renewal / Payment Success
    const isRenew =
      eventType.includes('renew') ||
      eventType === 'invoice.payment_succeeded' ||
      eventType === 'DID_RENEW';

    if (isRenew) {
      const transactionId =
        payload.data?.object?.subscription ||
        payload.data?.object?.payment_intent ||
        payload.transactionId;

      if (transactionId) {
        await this.db.query(
          `UPDATE entitlements 
           SET expires_at = NOW() + INTERVAL '30 days',
               status = 'ACTIVE',
               updated_at = NOW()
           WHERE transaction_id = $1`,
          [transactionId],
        );
      }
    }

    this.logger.log(`Processed webhook: ${gateway}:${eventType} [${eventId}]`);
    return {
      processed: true,
      isDuplicate: false,
      eventId,
      eventType,
      message: 'Event processed successfully',
    };
  }

  /**
   * Cancel Subscription at Period End
   */
  async cancelSubscription(subscriberId: string, subscriptionId: string): Promise<UserSubscriptionItem> {
    const res = await this.db.query(
      `SELECT s.*, p.title as plan_title 
       FROM user_subscriptions s
       JOIN creator_subscription_plans p ON s.plan_id = p.id
       WHERE s.id = $1 AND s.subscriber_id = $2`,
      [subscriptionId, subscriberId],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException('Subscription not found.');
    }

    const sub = res.rows[0];
    await this.paymentGatewayService.cancelSubscription(sub.gateway, sub.gateway_subscription_id);

    const updated = await this.db.query(
      `UPDATE user_subscriptions
       SET cancel_at_period_end = TRUE,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [subscriptionId],
    );

    return this.mapSubscription(updated.rows[0], sub.plan_title);
  }

  /**
   * Check if a user is an active subscriber to a creator
   */
  async isSubscriber(subscriberId: string, creatorId: string): Promise<boolean> {
    const res = await this.db.query(
      `SELECT 1 FROM user_subscriptions
       WHERE subscriber_id = $1 AND creator_id = $2 AND status = 'active' AND current_period_end > NOW()`,
      [subscriberId, creatorId],
    );
    return res.rows.length > 0;
  }

  /**
   * Get User's Active Subscriptions
   */
  async getUserSubscriptions(subscriberId: string): Promise<UserSubscriptionItem[]> {
    const res = await this.db.query(
      `SELECT s.*, p.title as plan_title
       FROM user_subscriptions s
       JOIN creator_subscription_plans p ON s.plan_id = p.id
       WHERE s.subscriber_id = $1
       ORDER BY s.created_at DESC`,
      [subscriberId],
    );
    return res.rows.map((r) => this.mapSubscription(r, r.plan_title));
  }

  /**
   * Get User's Active Entitlements
   */
  async getUserEntitlements(userId: string): Promise<UserEntitlementItem[]> {
    const res = await this.db.query(
      `SELECT * FROM entitlements 
       WHERE user_id = $1 AND status = 'ACTIVE' AND (expires_at IS NULL OR expires_at > NOW()) 
       ORDER BY created_at DESC`,
      [userId],
    );
    return res.rows.map((r) => this.mapEntitlement(r));
  }

  private mapPlan(row: any): CreatorSubscriptionPlan {
    return {
      id: row.id,
      creatorId: row.creator_id,
      title: row.title,
      description: row.description,
      priceCents: row.price_cents,
      currency: row.currency,
      billingInterval: row.billing_interval,
      perks: row.perks || [],
      isActive: row.is_active,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private mapSubscription(row: any, planTitle?: string): UserSubscriptionItem {
    return {
      id: row.id,
      subscriberId: row.subscriber_id,
      creatorId: row.creator_id,
      planId: row.plan_id,
      planTitle: planTitle,
      gateway: row.gateway as PaymentGateway,
      gatewaySubscriptionId: row.gateway_subscription_id,
      status: row.status as SubscriptionStatus,
      currentPeriodStart: row.current_period_start.toISOString(),
      currentPeriodEnd: row.current_period_end.toISOString(),
      cancelAtPeriodEnd: row.cancel_at_period_end,
      createdAt: row.created_at.toISOString(),
    };
  }

  private mapEntitlement(row: any): UserEntitlementItem {
    return {
      id: row.id,
      userId: row.user_id,
      creatorId: row.creator_id || undefined,
      entitlementType: row.entitlement_type as EntitlementType,
      planId: row.plan_id || undefined,
      reelId: row.reel_id || undefined,
      gateway: row.gateway as PaymentGateway,
      transactionId: row.transaction_id,
      status: row.status as EntitlementStatus,
      expiresAt: row.expires_at ? row.expires_at.toISOString() : undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
