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
  PaidInterestCommunityItem,
  PaidCommunityMembershipItem,
  CommunityPricingType,
  CommunityMembershipStatus,
  PaymentGateway,
} from '@shared/types';
import {
  CreatePaidCommunityDto,
  JoinPaidCommunityDto,
} from './dto/monetization.dto';

@Injectable()
export class PaidCommunitiesService {
  private readonly logger = new Logger(PaidCommunitiesService.name);
  private readonly PLATFORM_FEE_BPS = 1000; // 10% platform fee

  constructor(
    private readonly db: DatabaseService,
    private readonly paymentGatewayService: PaymentGatewayService,
    private readonly financePayoutsService: FinancePayoutsService,
  ) {}

  /**
   * Create a Paid Community Centered on an Interest
   */
  async createCommunity(
    creatorId: string,
    dto: CreatePaidCommunityDto,
  ): Promise<PaidInterestCommunityItem> {
    // Verify interest taxonomy node exists
    const interestRes = await this.db.query(
      `SELECT id, title FROM interests WHERE id = $1`,
      [dto.interestId],
    );

    if (interestRes.rows.length === 0) {
      throw new NotFoundException('Interest taxonomy node not found.');
    }

    const res = await this.db.query(
      `INSERT INTO paid_interest_communities
        (creator_id, interest_id, name, description, banner_url, pricing_type, price_cents, currency, billing_interval, members_count, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, TRUE)
       RETURNING *`,
      [
        creatorId,
        dto.interestId,
        dto.name,
        dto.description || null,
        dto.bannerUrl || null,
        dto.pricingType,
        dto.priceCents,
        (dto.currency || 'usd').toLowerCase(),
        dto.pricingType === CommunityPricingType.RECURRING ? dto.billingInterval || 'month' : null,
      ],
    );

    const community = res.rows[0];

    // Creator is automatically a permanent lifetime member
    await this.db.query(
      `INSERT INTO paid_community_memberships (community_id, user_id, status, gateway)
       VALUES ($1, $2, 'active', 'stripe')
       ON CONFLICT (community_id, user_id) DO NOTHING`,
      [community.id, creatorId],
    );

    this.logger.log(`Created paid community: "${dto.name}" for Interest: ${interestRes.rows[0].title}`);
    return this.mapCommunity(community, interestRes.rows[0].title, true);
  }

  /**
   * Get Community Details with Membership Flag
   */
  async getCommunityById(communityId: string, userId?: string): Promise<PaidInterestCommunityItem> {
    const res = await this.db.query(
      `SELECT c.*, i.title as interest_title 
       FROM paid_interest_communities c
       JOIN interests i ON c.interest_id = i.id
       WHERE c.id = $1 AND c.is_active = TRUE`,
      [communityId],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException('Paid community not found.');
    }

    let isMember = false;
    if (userId) {
      isMember = await this.isMember(userId, communityId);
    }

    return this.mapCommunity(res.rows[0], res.rows[0].interest_title, isMember);
  }

  /**
   * List Communities within an Interest
   */
  async getCommunitiesByInterest(interestId: string): Promise<PaidInterestCommunityItem[]> {
    const res = await this.db.query(
      `SELECT c.*, i.title as interest_title
       FROM paid_interest_communities c
       JOIN interests i ON c.interest_id = i.id
       WHERE c.interest_id = $1 AND c.is_active = TRUE
       ORDER BY c.members_count DESC`,
      [interestId],
    );

    return res.rows.map((r) => this.mapCommunity(r, r.interest_title));
  }

  /**
   * Join a Paid Community
   */
  async joinCommunity(userId: string, dto: JoinPaidCommunityDto): Promise<PaidCommunityMembershipItem> {
    const commRes = await this.db.query(
      `SELECT c.*, i.title as interest_title
       FROM paid_interest_communities c
       JOIN interests i ON c.interest_id = i.id
       WHERE c.id = $1 AND c.is_active = TRUE`,
      [dto.communityId],
    );

    if (commRes.rows.length === 0) {
      throw new NotFoundException('Paid community not found.');
    }

    const community = commRes.rows[0];

    // Check if already active member
    const existing = await this.db.query(
      `SELECT * FROM paid_community_memberships WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
      [community.id, userId],
    );

    if (existing.rows.length > 0) {
      return this.mapMembership(existing.rows[0]);
    }

    // Process payment with provider
    const order = await this.paymentGatewayService.createPaymentOrder({
      userId,
      amountCents: community.price_cents,
      currency: community.currency,
      gateway: dto.gateway,
      description: `Join Paid Community: ${community.name}`,
    });

    // Compute expiration
    let expiresAt: Date | null = null;
    if (community.pricing_type === CommunityPricingType.RECURRING) {
      expiresAt = new Date();
      if (community.billing_interval === 'year') {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      } else {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      }
    }

    // Record membership
    const memberRes = await this.db.query(
      `INSERT INTO paid_community_memberships
        (community_id, user_id, status, gateway, gateway_order_id, expires_at)
       VALUES ($1, $2, 'active', $3, $4, $5)
       ON CONFLICT (community_id, user_id)
       DO UPDATE SET
        status = 'active',
        gateway = EXCLUDED.gateway,
        gateway_order_id = EXCLUDED.gateway_order_id,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
       RETURNING *`,
      [community.id, userId, dto.gateway, order.orderId, expiresAt],
    );

    // Update community members counter
    await this.db.query(
      `UPDATE paid_interest_communities SET members_count = members_count + 1 WHERE id = $1`,
      [community.id],
    );

    // Credit creator balance (90% after platform fee)
    const platformFee = Math.round((community.price_cents * this.PLATFORM_FEE_BPS) / 10000);
    const netCreatorEarnings = community.price_cents - platformFee;

    await this.financePayoutsService.creditCreatorBalance(
      community.creator_id,
      netCreatorEarnings,
      community.currency,
      `COMMUNITY_MEMBERSHIP:${community.name}`,
    );

    // Generate invoice for user
    await this.financePayoutsService.generateInvoice({
      userId,
      recipientName: `Member (${userId.substring(0, 8)})`,
      subtotalCents: community.price_cents,
      currency: community.currency,
      gateway: dto.gateway,
      items: [
        {
          description: `Community Access: ${community.name} (${community.pricing_type})`,
          quantity: 1,
          unitPriceCents: community.price_cents,
          amountCents: community.price_cents,
        },
      ],
    });

    this.logger.log(`User ${userId} joined paid community ${community.name}`);
    return this.mapMembership(memberRes.rows[0]);
  }

  /**
   * Check if User is an Active Member (Access Gate)
   */
  async isMember(userId: string, communityId: string): Promise<boolean> {
    const res = await this.db.query(
      `SELECT 1 FROM paid_community_memberships
       WHERE community_id = $1 AND user_id = $2 AND status = 'active'
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [communityId, userId],
    );
    return res.rows.length > 0;
  }

  /**
   * Get User's Active Memberships
   */
  async getUserMemberships(userId: string): Promise<PaidCommunityMembershipItem[]> {
    const res = await this.db.query(
      `SELECT * FROM paid_community_memberships 
       WHERE user_id = $1 AND status = 'active'
       ORDER BY created_at DESC`,
      [userId],
    );
    return res.rows.map((r) => this.mapMembership(r));
  }

  private mapCommunity(row: any, interestTitle?: string, isMember?: boolean): PaidInterestCommunityItem {
    return {
      id: row.id,
      creatorId: row.creator_id,
      interestId: row.interest_id,
      interestTitle,
      name: row.name,
      description: row.description,
      bannerUrl: row.banner_url,
      pricingType: row.pricing_type as CommunityPricingType,
      priceCents: row.price_cents,
      currency: row.currency,
      billingInterval: row.billing_interval,
      membersCount: row.members_count,
      isActive: row.is_active,
      isMember,
      createdAt: row.created_at.toISOString(),
    };
  }

  private mapMembership(row: any): PaidCommunityMembershipItem {
    return {
      id: row.id,
      communityId: row.community_id,
      userId: row.user_id,
      status: row.status as CommunityMembershipStatus,
      gateway: row.gateway as PaymentGateway,
      expiresAt: row.expires_at ? row.expires_at.toISOString() : undefined,
      createdAt: row.created_at.toISOString(),
    };
  }
}
