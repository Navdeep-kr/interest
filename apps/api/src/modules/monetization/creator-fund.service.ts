import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { FinancePayoutsService } from './finance-payouts.service';
import {
  CreatorFundPoolItem,
  CreatorFundAllocationItem,
  CreatorFundPoolStatus,
} from '@shared/types';
import { CalculateCreatorFundDto } from './dto/monetization.dto';

@Injectable()
export class CreatorFundService {
  private readonly logger = new Logger(CreatorFundService.name);
  private readonly MIN_QUALIFYING_WATCH_SECONDS = 3; // Filter out click-bounce bot views

  constructor(
    private readonly db: DatabaseService,
    private readonly financePayoutsService: FinancePayoutsService,
  ) {}

  /**
   * Create a Creator Fund Pool (e.g. Monthly $100,000 allocation)
   */
  async createPool(
    periodName: string,
    totalPoolCents: number,
    periodStart: Date,
    periodEnd: Date,
    currency = 'usd',
  ): Promise<CreatorFundPoolItem> {
    const res = await this.db.query(
      `INSERT INTO creator_fund_pools
        (period_name, total_pool_cents, currency, period_start, period_end, status)
       VALUES ($1, $2, $3, $4, $5, 'open')
       ON CONFLICT (period_name) DO UPDATE
       SET total_pool_cents = EXCLUDED.total_pool_cents,
           period_start = EXCLUDED.period_start,
           period_end = EXCLUDED.period_end
       RETURNING *`,
      [periodName, totalPoolCents, currency.toLowerCase(), periodStart, periodEnd],
    );

    this.logger.log(`Created Creator Fund Pool: ${periodName} ($${(totalPoolCents / 100).toFixed(2)})`);
    return this.mapPool(res.rows[0]);
  }

  /**
   * Calculate and Distribute Creator Fund Based on Qualified Watch Time
   * Formula: Qualified Watch Time * Audience Interest Affinity Multiplier
   */
  async calculateAndDistributePool(dto: CalculateCreatorFundDto): Promise<{
    pool: CreatorFundPoolItem;
    allocationsCount: number;
    totalDistributedCents: number;
  }> {
    const poolRes = await this.db.query(
      `SELECT * FROM creator_fund_pools WHERE period_name = $1`,
      [dto.periodName],
    );

    let pool = poolRes.rows[0];
    if (!pool) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      pool = await this.createPool(
        dto.periodName,
        dto.totalPoolCents,
        startOfMonth,
        endOfMonth,
        dto.currency || 'usd',
      );
    }

    if (pool.status === 'distributed') {
      throw new BadRequestException(`Pool "${dto.periodName}" has already been distributed.`);
    }

    // Set pool to calculating
    await this.db.query(
      `UPDATE creator_fund_pools SET status = 'calculating' WHERE id = $1`,
      [pool.id],
    );

    // Retrieve qualified watch time per creator from genuine interest audiences
    // Filters out bot/micro-views (<3s), calculates affinity-weighted score
    const query = `
      SELECT 
        r.creator_id,
        COALESCE(SUM(t.watch_time_seconds), 0) AS raw_watch_time,
        COALESCE(
          SUM(
            t.watch_time_seconds * (1.0 + COALESCE(ui.affinity_score, 0.2))
          ),
          0
        ) AS weighted_score,
        COUNT(DISTINCT t.id) AS qualifying_views
      FROM telemetry t
      JOIN reels r ON t.reel_id = r.id
      LEFT JOIN reel_interests ri ON r.id = ri.reel_id
      LEFT JOIN user_interests ui ON t.user_id = ui.user_id AND ri.interest_id = ui.interest_id
      WHERE t.event_type = 'VIEW'
        AND t.watch_time_seconds >= $1
        AND t.created_at >= $2
        AND t.created_at <= $3
      GROUP BY r.creator_id
      HAVING SUM(t.watch_time_seconds) > 0
    `;

    const statsRes = await this.db.query(query, [
      this.MIN_QUALIFYING_WATCH_SECONDS,
      pool.period_start,
      pool.period_end,
    ]);

    let totalWeightedScore = 0;
    let totalQualifiedSeconds = 0;

    statsRes.rows.forEach((row: any) => {
      totalWeightedScore += parseFloat(row.weighted_score);
      totalQualifiedSeconds += parseInt(row.raw_watch_time, 10);
    });

    let totalDistributedCents = 0;
    const allocations: any[] = [];

    if (totalWeightedScore > 0) {
      for (const row of statsRes.rows) {
        const creatorScore = parseFloat(row.weighted_score);
        const creatorRatio = creatorScore / totalWeightedScore;
        const earningsCents = Math.floor(pool.total_pool_cents * creatorRatio);

        if (earningsCents > 0) {
          totalDistributedCents += earningsCents;

          // Record allocation
          const allocRes = await this.db.query(
            `INSERT INTO creator_fund_allocations
              (pool_id, creator_id, qualified_watch_time_seconds, affinity_weighted_score, earnings_cents, status)
             VALUES ($1, $2, $3, $4, $5, 'credited')
             ON CONFLICT (pool_id, creator_id) DO UPDATE
             SET qualified_watch_time_seconds = EXCLUDED.qualified_watch_time_seconds,
                 affinity_weighted_score = EXCLUDED.affinity_weighted_score,
                 earnings_cents = EXCLUDED.earnings_cents,
                 status = 'credited'
             RETURNING *`,
            [
              pool.id,
              row.creator_id,
              parseInt(row.raw_watch_time, 10),
              creatorScore,
              earningsCents,
            ],
          );

          // Credit creator balance
          await this.financePayoutsService.creditCreatorBalance(
            row.creator_id,
            earningsCents,
            pool.currency,
            `CREATOR_FUND:${pool.period_name}`,
          );

          allocations.push(allocRes.rows[0]);
        }
      }
    }

    // Mark pool as distributed
    const updatedPoolRes = await this.db.query(
      `UPDATE creator_fund_pools
       SET status = 'distributed',
           total_qualified_watch_time_seconds = $2
       WHERE id = $1
       RETURNING *`,
      [pool.id, totalQualifiedSeconds],
    );

    this.logger.log(
      `Distributed Creator Fund Pool [${pool.period_name}]: ${allocations.length} creators, ${totalDistributedCents} cents distributed`,
    );

    return {
      pool: this.mapPool(updatedPoolRes.rows[0]),
      allocationsCount: allocations.length,
      totalDistributedCents,
    };
  }

  /**
   * Get Creator's Fund Allocations / Statements
   */
  async getCreatorAllocations(creatorId: string): Promise<CreatorFundAllocationItem[]> {
    const res = await this.db.query(
      `SELECT a.*, p.period_name
       FROM creator_fund_allocations a
       JOIN creator_fund_pools p ON a.pool_id = p.id
       WHERE a.creator_id = $1
       ORDER BY p.period_start DESC`,
      [creatorId],
    );

    return res.rows.map((r) => this.mapAllocation(r, r.period_name));
  }

  /**
   * Get Pool Details
   */
  async getPool(periodName: string): Promise<CreatorFundPoolItem | null> {
    const res = await this.db.query(
      `SELECT * FROM creator_fund_pools WHERE period_name = $1`,
      [periodName],
    );
    if (res.rows.length === 0) return null;
    return this.mapPool(res.rows[0]);
  }

  private mapPool(row: any): CreatorFundPoolItem {
    return {
      id: row.id,
      periodName: row.period_name,
      totalPoolCents: parseInt(row.total_pool_cents, 10),
      currency: row.currency,
      periodStart: row.period_start.toISOString(),
      periodEnd: row.period_end.toISOString(),
      status: row.status as CreatorFundPoolStatus,
      totalQualifiedWatchTimeSeconds: parseInt(row.total_qualified_watch_time_seconds, 10),
      createdAt: row.created_at.toISOString(),
    };
  }

  private mapAllocation(row: any, periodName?: string): CreatorFundAllocationItem {
    return {
      id: row.id,
      poolId: row.pool_id,
      periodName,
      creatorId: row.creator_id,
      qualifiedWatchTimeSeconds: parseInt(row.qualified_watch_time_seconds, 10),
      affinityWeightedScore: parseFloat(row.affinity_weighted_score),
      interestBreakdown: typeof row.interest_breakdown === 'string' ? JSON.parse(row.interest_breakdown) : row.interest_breakdown || {},
      earningsCents: parseInt(row.earnings_cents, 10),
      status: row.status,
      createdAt: row.created_at.toISOString(),
    };
  }
}
