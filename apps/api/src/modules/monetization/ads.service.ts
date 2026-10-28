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
  AdCampaignItem,
  FeedAdItem,
  AdCampaignStatus,
  AdBidType,
  AdEventType,
  PaymentGateway,
} from '@shared/types';
import { CreateAdCampaignDto, TrackAdEventDto } from './dto/monetization.dto';
import * as crypto from 'crypto';

@Injectable()
export class AdsService {
  private readonly logger = new Logger(AdsService.name);
  private readonly TOKEN_SECRET = 'interest_zero_location_ad_token_secret';

  constructor(
    private readonly db: DatabaseService,
    private readonly paymentGatewayService: PaymentGatewayService,
    private readonly financePayoutsService: FinancePayoutsService,
  ) {}

  /**
   * Create an Interest-Targeted Ad Campaign (Strict Zero-Location)
   * Hard Rule: No geo-targeting parameters allowed. Purely interest-driven.
   */
  async createCampaign(
    advertiserId: string,
    dto: CreateAdCampaignDto,
  ): Promise<AdCampaignItem> {
    // 1. Verify creative reel exists
    const reelRes = await this.db.query(
      `SELECT id, status, creator_id FROM reels WHERE id = $1`,
      [dto.reelId],
    );

    if (reelRes.rows.length === 0) {
      throw new NotFoundException('Creative reel not found.');
    }

    // 2. Verify target interest IDs exist in taxonomy
    const interestsRes = await this.db.query(
      `SELECT id FROM interests WHERE id = ANY($1::uuid[])`,
      [dto.targetInterestIds],
    );

    if (interestsRes.rows.length === 0) {
      throw new BadRequestException('At least one valid interest taxonomy tag must be targeted.');
    }

    const verifiedInterestIds = interestsRes.rows.map((r: any) => r.id);

    // 3. Process budget deposit with payment provider
    const order = await this.paymentGatewayService.createPaymentOrder({
      userId: advertiserId,
      amountCents: dto.totalBudgetCents,
      currency: 'usd',
      gateway: PaymentGateway.STRIPE,
      description: `Ad Campaign Deposit: ${dto.title}`,
    });

    // 4. Insert Ad Campaign
    const res = await this.db.query(
      `INSERT INTO ad_campaigns
        (advertiser_id, title, reel_id, target_interest_ids, call_to_action_url, call_to_action_text, daily_budget_cents, total_budget_cents, bid_type, bid_cents, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ACTIVE')
       RETURNING *`,
      [
        advertiserId,
        dto.title,
        dto.reelId,
        verifiedInterestIds,
        dto.callToActionUrl || null,
        dto.callToActionText || 'Learn More',
        dto.dailyBudgetCents,
        dto.totalBudgetCents,
        dto.bidType || AdBidType.CPM,
        dto.bidCents,
      ],
    );

    // 5. Generate Tax-compliant Invoice for Advertiser
    await this.financePayoutsService.generateInvoice({
      userId: advertiserId,
      recipientName: `Advertiser (${advertiserId.substring(0, 8)})`,
      subtotalCents: dto.totalBudgetCents,
      currency: 'usd',
      gateway: PaymentGateway.STRIPE,
      items: [
        {
          description: `Interest Ad Campaign Budget: ${dto.title}`,
          quantity: 1,
          unitPriceCents: dto.totalBudgetCents,
          amountCents: dto.totalBudgetCents,
        },
      ],
    });

    this.logger.log(`Created ad campaign: "${dto.title}" with ${verifiedInterestIds.length} target interests.`);
    return this.mapCampaign(res.rows[0]);
  }

  /**
   * Serve an Ad into the Interest-Based Reels Feed
   * Matches active viewer interests to candidate campaigns WITHOUT location filtering.
   */
  async serveAdForInterestFeed(params: {
    viewerInterestIds: string[];
    activeInterestId?: string;
  }): Promise<FeedAdItem | null> {
    const candidateInterests = params.activeInterestId
      ? [params.activeInterestId]
      : params.viewerInterestIds;

    if (!candidateInterests || candidateInterests.length === 0) {
      return null;
    }

    // Query active campaigns that target these interests and have remaining budget
    const query = `
      SELECT c.*, p.username as advertiser_name
      FROM ad_campaigns c
      JOIN profiles p ON c.advertiser_id = p.user_id
      WHERE c.status = 'ACTIVE'
        AND c.spent_cents < c.total_budget_cents
        AND c.target_interest_ids && $1::uuid[]
      ORDER BY c.bid_cents DESC, c.created_at ASC
      LIMIT 1
    `;

    const res = await this.db.query(query, [candidateInterests]);

    if (res.rows.length === 0) {
      return null;
    }

    const campaign = res.rows[0];
    const targetInterestId = candidateInterests[0];

    // Generate cryptographic attribution token (no IP/location in token)
    const attributionToken = this.generateAttributionToken(campaign.id);

    return {
      isAd: true,
      campaignId: campaign.id,
      reelId: campaign.reel_id,
      advertiserId: campaign.advertiser_id,
      advertiserName: campaign.advertiser_name || 'Sponsored Creator',
      title: campaign.title,
      targetInterestId,
      callToActionUrl: campaign.call_to_action_url,
      callToActionText: campaign.call_to_action_text,
      attributionToken,
    };
  }

  /**
   * Track Impression or Click and Deduct Budget
   */
  async trackAdEvent(dto: TrackAdEventDto): Promise<{ success: boolean; eventCostCents: number }> {
    if (!this.verifyAttributionToken(dto.campaignId, dto.attributionToken)) {
      throw new BadRequestException('Invalid or expired ad attribution token.');
    }

    const campRes = await this.db.query(
      `SELECT * FROM ad_campaigns WHERE id = $1`,
      [dto.campaignId],
    );

    if (campRes.rows.length === 0) {
      throw new NotFoundException('Ad campaign not found.');
    }

    const campaign = campRes.rows[0];
    let eventCostCents = 0;

    if (dto.eventType === AdEventType.IMPRESSION) {
      if (campaign.bid_type === AdBidType.CPM) {
        eventCostCents = Math.round(campaign.bid_cents / 1000); // 1 impression from CPM
      }
      await this.db.query(
        `UPDATE ad_campaigns 
         SET impressions_count = impressions_count + 1,
             spent_cents = spent_cents + $2,
             status = CASE WHEN (spent_cents + $2) >= total_budget_cents THEN 'EXHAUSTED' ELSE status END,
             updated_at = NOW()
         WHERE id = $1`,
        [campaign.id, eventCostCents],
      );
    } else if (dto.eventType === AdEventType.CLICK) {
      if (campaign.bid_type === AdBidType.CPC) {
        eventCostCents = campaign.bid_cents;
      }
      await this.db.query(
        `UPDATE ad_campaigns 
         SET clicks_count = clicks_count + 1,
             spent_cents = spent_cents + $2,
             status = CASE WHEN (spent_cents + $2) >= total_budget_cents THEN 'EXHAUSTED' ELSE status END,
             updated_at = NOW()
         WHERE id = $1`,
        [campaign.id, eventCostCents],
      );
    }

    // Record privacy-safe analytics event
    await this.db.query(
      `INSERT INTO ad_analytics_events (campaign_id, event_type, interest_id, cost_cents)
       VALUES ($1, $2, $3, $4)`,
      [campaign.id, dto.eventType, dto.interestId || null, eventCostCents],
    );

    return { success: true, eventCostCents };
  }

  /**
   * Pause / Resume Campaign
   */
  async updateCampaignStatus(
    advertiserId: string,
    campaignId: string,
    status: AdCampaignStatus.ACTIVE | AdCampaignStatus.PAUSED,
  ): Promise<AdCampaignItem> {
    const res = await this.db.query(
      `UPDATE ad_campaigns
       SET status = $3, updated_at = NOW()
       WHERE id = $1 AND advertiser_id = $2
       RETURNING *`,
      [campaignId, advertiserId, status],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException('Campaign not found.');
    }

    return this.mapCampaign(res.rows[0]);
  }

  /**
   * Get Advertiser's Campaigns
   */
  async getAdvertiserCampaigns(advertiserId: string): Promise<AdCampaignItem[]> {
    const res = await this.db.query(
      `SELECT * FROM ad_campaigns WHERE advertiser_id = $1 ORDER BY created_at DESC`,
      [advertiserId],
    );
    return res.rows.map((r) => this.mapCampaign(r));
  }

  private generateAttributionToken(campaignId: string): string {
    const timestamp = Date.now();
    const payload = `${campaignId}:${timestamp}`;
    const hash = crypto
      .createHmac('sha256', this.TOKEN_SECRET)
      .update(payload)
      .digest('hex');
    return `${payload}:${hash}`;
  }

  private verifyAttributionToken(campaignId: string, token: string): boolean {
    const parts = token.split(':');
    if (parts.length !== 3) return false;
    const [tokenCampId, timestamp, hash] = parts;
    if (tokenCampId !== campaignId) return false;

    // Check token freshness (valid for 24 hours)
    const tokenTime = parseInt(timestamp, 10);
    if (Date.now() - tokenTime > 86400000) return false;

    const payload = `${tokenCampId}:${timestamp}`;
    const expected = crypto
      .createHmac('sha256', this.TOKEN_SECRET)
      .update(payload)
      .digest('hex');
    return hash === expected;
  }

  private mapCampaign(row: any): AdCampaignItem {
    return {
      id: row.id,
      advertiserId: row.advertiser_id,
      title: row.title,
      reelId: row.reel_id,
      targetInterestIds: row.target_interest_ids || [],
      callToActionUrl: row.call_to_action_url,
      callToActionText: row.call_to_action_text,
      dailyBudgetCents: row.daily_budget_cents,
      totalBudgetCents: row.total_budget_cents,
      spentCents: row.spent_cents,
      bidType: row.bid_type as AdBidType,
      bidCents: row.bid_cents,
      status: row.status as AdCampaignStatus,
      impressionsCount: row.impressions_count,
      clicksCount: row.clicks_count,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
