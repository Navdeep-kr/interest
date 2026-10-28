import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PaymentGatewayService } from './payment-gateway.service';
import { FinancePayoutsService } from './finance-payouts.service';
import { CreatorTipItem, TipStatus, PaymentGateway } from '@shared/types';
import { SendTipDto } from './dto/monetization.dto';

@Injectable()
export class TipsService {
  private readonly logger = new Logger(TipsService.name);
  private readonly TIP_PLATFORM_FEE_BPS = 500; // 5% fee on tips

  constructor(
    private readonly db: DatabaseService,
    private readonly paymentGatewayService: PaymentGatewayService,
    private readonly financePayoutsService: FinancePayoutsService,
  ) {}

  /**
   * Send a Direct Tip to a Creator (Profile or Reel)
   */
  async sendTip(senderId: string, dto: SendTipDto): Promise<CreatorTipItem> {
    if (senderId === dto.creatorId) {
      throw new BadRequestException('You cannot tip yourself.');
    }

    const currency = (dto.currency || 'usd').toLowerCase();
    const platformFeeCents = Math.round((dto.amountCents * this.TIP_PLATFORM_FEE_BPS) / 10000);
    const netCreatorCents = dto.amountCents - platformFeeCents;

    // Process payment with provider
    const order = await this.paymentGatewayService.createPaymentOrder({
      userId: senderId,
      amountCents: dto.amountCents,
      currency,
      gateway: dto.gateway,
      description: `Tip for Creator: ${dto.creatorId}`,
      metadata: {
        creatorId: dto.creatorId,
        reelId: dto.reelId,
      },
    });

    // Record tip in database
    const res = await this.db.query(
      `INSERT INTO creator_tips
        (sender_id, creator_id, reel_id, amount_cents, platform_fee_cents, net_creator_cents, currency, message, gateway, gateway_payment_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'completed')
       RETURNING *`,
      [
        senderId,
        dto.creatorId,
        dto.reelId || null,
        dto.amountCents,
        platformFeeCents,
        netCreatorCents,
        currency,
        dto.message || null,
        dto.gateway,
        order.orderId,
      ],
    );

    // Credit creator's available balance immediately
    await this.financePayoutsService.creditCreatorBalance(
      dto.creatorId,
      netCreatorCents,
      currency,
      `TIP from User ${senderId.substring(0, 8)}`,
    );

    // Generate receipt invoice for sender
    await this.financePayoutsService.generateInvoice({
      userId: senderId,
      recipientName: `Fan (${senderId.substring(0, 8)})`,
      subtotalCents: dto.amountCents,
      currency,
      gateway: dto.gateway,
      items: [
        {
          description: dto.reelId
            ? `Reel Tip (${dto.amountCents / 100} ${currency.toUpperCase()})`
            : `Creator Tip (${dto.amountCents / 100} ${currency.toUpperCase()})`,
          quantity: 1,
          unitPriceCents: dto.amountCents,
          amountCents: dto.amountCents,
        },
      ],
    });

    this.logger.log(`Tip completed: ${dto.amountCents} cents from ${senderId} to ${dto.creatorId}`);
    return this.mapTip(res.rows[0]);
  }

  /**
   * Get Tips Received by Creator
   */
  async getCreatorReceivedTips(creatorId: string): Promise<CreatorTipItem[]> {
    const res = await this.db.query(
      `SELECT * FROM creator_tips WHERE creator_id = $1 AND status = 'completed' ORDER BY created_at DESC`,
      [creatorId],
    );
    return res.rows.map((r) => this.mapTip(r));
  }

  /**
   * Get Tips Sent by User
   */
  async getUserSentTips(senderId: string): Promise<CreatorTipItem[]> {
    const res = await this.db.query(
      `SELECT * FROM creator_tips WHERE sender_id = $1 AND status = 'completed' ORDER BY created_at DESC`,
      [senderId],
    );
    return res.rows.map((r) => this.mapTip(r));
  }

  /**
   * Get Tips on a Specific Reel
   */
  async getReelTips(reelId: string): Promise<CreatorTipItem[]> {
    const res = await this.db.query(
      `SELECT * FROM creator_tips WHERE reel_id = $1 AND status = 'completed' ORDER BY created_at DESC`,
      [reelId],
    );
    return res.rows.map((r) => this.mapTip(r));
  }

  private mapTip(row: any): CreatorTipItem {
    return {
      id: row.id,
      senderId: row.sender_id,
      creatorId: row.creator_id,
      reelId: row.reel_id,
      amountCents: row.amount_cents,
      platformFeeCents: row.platform_fee_cents,
      netCreatorCents: row.net_creator_cents,
      currency: row.currency,
      message: row.message,
      gateway: row.gateway as PaymentGateway,
      status: row.status as TipStatus,
      createdAt: row.created_at.toISOString(),
    };
  }
}
