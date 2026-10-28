import { CreatorFundService } from './creator-fund.service';
import { CreatorFundPoolStatus } from '@shared/types';
import { BadRequestException } from '@nestjs/common';

describe('CreatorFundService (Watch Time Allocation from Interest Audiences)', () => {
  let service: CreatorFundService;
  let mockDb: any;
  let mockFinancePayouts: any;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
    };
    mockFinancePayouts = {
      creditCreatorBalance: jest.fn().mockResolvedValue({}),
    };

    service = new CreatorFundService(mockDb as any, mockFinancePayouts as any);
  });

  describe('createPool', () => {
    it('should create creator fund pool with period and total cents', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'pool-1',
            period_name: '2026-10',
            total_pool_cents: 10000000, // $100,000
            currency: 'usd',
            period_start: new Date('2026-10-01'),
            period_end: new Date('2026-10-31'),
            status: 'open',
            total_qualified_watch_time_seconds: 0,
            created_at: new Date(),
          },
        ],
      });

      const pool = await service.createPool(
        '2026-10',
        10000000,
        new Date('2026-10-01'),
        new Date('2026-10-31'),
      );

      expect(pool.periodName).toBe('2026-10');
      expect(pool.totalPoolCents).toBe(10000000);
      expect(pool.status).toBe(CreatorFundPoolStatus.OPEN);
    });
  });

  describe('calculateAndDistributePool', () => {
    it('should reject calculation if pool was already distributed', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'pool-1',
            period_name: '2026-10',
            status: 'distributed',
          },
        ],
      });

      await expect(
        service.calculateAndDistributePool({
          periodName: '2026-10',
          totalPoolCents: 10000000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should calculate allocation based on qualified watch time and interest affinity score', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'pool-1',
              period_name: '2026-10',
              total_pool_cents: 1000000, // $10,000 pool
              currency: 'usd',
              period_start: new Date('2026-10-01'),
              period_end: new Date('2026-10-31'),
              status: 'open',
              total_qualified_watch_time_seconds: 0,
              created_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // update pool to calculating
        .mockResolvedValueOnce({
          rows: [
            {
              creator_id: 'creator-alpha',
              raw_watch_time: '7500',
              weighted_score: '15000', // 75% of weighted score
              qualifying_views: '500',
            },
            {
              creator_id: 'creator-beta',
              raw_watch_time: '2500',
              weighted_score: '5000', // 25% of weighted score
              qualifying_views: '200',
            },
          ],
        })
        // insert allocation for alpha
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'alloc-1',
              pool_id: 'pool-1',
              creator_id: 'creator-alpha',
              qualified_watch_time_seconds: 7500,
              affinity_weighted_score: 15000,
              earnings_cents: 750000, // $7,500
              status: 'credited',
              created_at: new Date(),
            },
          ],
        })
        // insert allocation for beta
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'alloc-2',
              pool_id: 'pool-1',
              creator_id: 'creator-beta',
              qualified_watch_time_seconds: 2500,
              affinity_weighted_score: 5000,
              earnings_cents: 250000, // $2,500
              status: 'credited',
              created_at: new Date(),
            },
          ],
        })
        // update pool to distributed
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'pool-1',
              period_name: '2026-10',
              total_pool_cents: 1000000,
              currency: 'usd',
              period_start: new Date('2026-10-01'),
              period_end: new Date('2026-10-31'),
              status: 'distributed',
              total_qualified_watch_time_seconds: 10000,
              created_at: new Date(),
            },
          ],
        });

      const res = await service.calculateAndDistributePool({
        periodName: '2026-10',
        totalPoolCents: 1000000,
      });

      expect(res.pool.status).toBe(CreatorFundPoolStatus.DISTRIBUTED);
      expect(res.allocationsCount).toBe(2);
      expect(res.totalDistributedCents).toBe(1000000);

      // Verify creator-alpha received 75% of pool ($7,500 = 750,000 cents)
      expect(mockFinancePayouts.creditCreatorBalance).toHaveBeenCalledWith(
        'creator-alpha',
        750000,
        'usd',
        'CREATOR_FUND:2026-10',
      );

      // Verify creator-beta received 25% of pool ($2,500 = 250,000 cents)
      expect(mockFinancePayouts.creditCreatorBalance).toHaveBeenCalledWith(
        'creator-beta',
        250000,
        'usd',
        'CREATOR_FUND:2026-10',
      );
    });
  });
});
