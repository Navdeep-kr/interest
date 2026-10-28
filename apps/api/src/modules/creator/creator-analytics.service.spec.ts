import { Test, TestingModule } from '@nestjs/testing';
import { CreatorAnalyticsService } from './creator-analytics.service';
import { DatabaseService } from '../../database/database.service';

describe('CreatorAnalyticsService', () => {
  let service: CreatorAnalyticsService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorAnalyticsService,
        { provide: DatabaseService, useValue: mockDb },
      ],
    }).compile();

    service = module.get<CreatorAnalyticsService>(CreatorAnalyticsService);
  });

  it('should return audience breakdown exclusively by interest taxonomy (zero-location)', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [
        { interest_id: 'int-ai', interest_title: 'Prompt Engineering', category_title: 'Technology', viewer_count: '60' },
        { interest_id: 'int-fit', interest_title: 'Calisthenics Form', category_title: 'Fitness', viewer_count: '40' },
      ],
    });

    const res = await service.getViewsByInterestAudience('creator-1', 30);
    expect(res.length).toBe(2);
    expect(res[0].interestTitle).toBe('Prompt Engineering');
    expect(res[0].percentage).toBe(60);
    expect(res[1].percentage).toBe(40);

    // Verify zero location fields exist in output
    res.forEach((item: any) => {
      expect(item.country).toBeUndefined();
      expect(item.city).toBeUndefined();
      expect(item.ip).toBeUndefined();
      expect(item.region).toBeUndefined();
    });
  });

  it('should compute 11-point normalized retention curve from 0% to 100%', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [
        { watch_ratio: '1.2' }, // Completed full loop
        { watch_ratio: '0.85' },
        { watch_ratio: '0.55' },
        { watch_ratio: '0.25' },
      ],
    });

    const curve = await service.getRetentionCurve('creator-1');
    expect(curve.length).toBe(11);
    expect(curve[0]).toEqual({ bucketPercent: 0, retentionPercent: 100 });
    // At bucket 50% (watch_ratio >= 0.5): 3 out of 4 = 75%
    const bucket50 = curve.find((p) => p.bucketPercent === 50);
    expect(bucket50?.retentionPercent).toBe(75);
    // At bucket 100% (watch_ratio >= 1.0): 1 out of 4 = 25%
    const bucket100 = curve.find((p) => p.bucketPercent === 100);
    expect(bucket100?.retentionPercent).toBe(25);
  });

  it('should calculate followers growth and overall analytics overview', async () => {
    // 1. Views query
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ total_views: '1250', total_likes: '340', total_comments: '85', total_saves: '50', total_shares: '20' }] })
      // 2. Watch hours query
      .mockResolvedValueOnce({ rows: [{ total_watched_ms: '36000000', avg_watch_ratio: '0.78' }] })
      // 3. Followers total
      .mockResolvedValueOnce({ rows: [{ total_followers: '500' }] })
      // 4. Recent followers
      .mockResolvedValueOnce({ rows: [{ recent_count: '50' }] })
      // 5. Views by interest
      .mockResolvedValueOnce({ rows: [{ interest_id: 'int-1', interest_title: 'AI', category_title: 'Tech', viewer_count: '10' }] })
      // 6. Retention curve
      .mockResolvedValueOnce({ rows: [{ watch_ratio: '0.8' }] })
      // 7. Followers growth daily
      .mockResolvedValueOnce({ rows: [{ date_str: '2026-10-10', new_followers: '5' }] })
      // 8. Top reels
      .mockResolvedValueOnce({ rows: [{ id: 'reel-1', title: 'Top Reel', view_count: '500', like_count: '200', comment_count: '30', save_count: '20', share_count: '10', avg_completion_rate: '0.82', primary_interest_title: 'AI', created_at: new Date() }] });

    const overview = await service.getAnalyticsOverview('creator-1', 30);
    expect(overview.totalViews).toBe(1250);
    expect(overview.totalWatchHours).toBe(10);
    expect(overview.totalFollowers).toBe(500);
    expect(overview.zeroLocationGuarantee).toContain('Zero geographic coordinates');
  });

  describe('Prompt 17 — Verified Server-Side Analytics & Bot Filtering', () => {
    it('should reject duplicate client events idempotently', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'existing-event-id' }] });

      const res = await service.recordEngagementEvent('user-1', {
        clientEventId: 'evt-dup-1',
        reelId: '00000000-0000-0000-0000-000000000001',
        durationMs: 30000,
        watchedMs: 15000,
        action: 'WATCH_PARTIAL',
      });

      expect(res.recorded).toBe(true);
      expect(res.isDuplicate).toBe(true);
      expect(res.isQualifyingView).toBe(false);
      expect(res.isQuarantined).toBe(false);
    });

    it('should quarantine bot zero-watch anomaly in analytics_fraud_events', async () => {
      // 1. Idempotency check: not duplicate
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      // 2. Quarantine insert into analytics_fraud_events
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const res = await service.recordEngagementEvent('user-1', {
        clientEventId: 'evt-bot-1',
        reelId: '00000000-0000-0000-0000-000000000001',
        durationMs: 30000,
        watchedMs: 0, // 0 watched ms but claims WATCH_COMPLETE
        action: 'WATCH_COMPLETE',
      });

      expect(res.recorded).toBe(false);
      expect(res.isQuarantined).toBe(true);
      expect(res.isQualifyingView).toBe(false);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO analytics_fraud_events'),
        expect.arrayContaining(['user-1', '00000000-0000-0000-0000-000000000001', 'evt-bot-1', 'ZERO_WATCH_RATIO']),
      );
    });

    it('should count qualifying views only when >= 1.5s watch time and >= 15% watch ratio', async () => {
      // 1. Idempotency check
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      // 2. Insert into reel_engagements
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      // 3. Update reels view_count
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const res = await service.recordEngagementEvent('user-1', {
        clientEventId: 'evt-qual-1',
        reelId: '00000000-0000-0000-0000-000000000001',
        durationMs: 10000,
        watchedMs: 2500, // 2.5s >= 1.5s and 25% >= 15%
        action: 'WATCH_PARTIAL',
        discoverySource: 'FOR_YOU',
      });

      expect(res.recorded).toBe(true);
      expect(res.isQualifyingView).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE reels SET view_count = view_count + 1'),
        ['00000000-0000-0000-0000-000000000001'],
      );
    });

    it('should not mark short skips (< 1.5s) as qualifying views', async () => {
      // 1. Idempotency check
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      // 2. Insert into reel_engagements
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const res = await service.recordEngagementEvent('user-1', {
        clientEventId: 'evt-skip-1',
        reelId: '00000000-0000-0000-0000-000000000001',
        durationMs: 30000,
        watchedMs: 800, // 800ms < 1.5s -> rapid skip
        action: 'SKIP',
      });

      expect(res.recorded).toBe(true);
      expect(res.isQualifyingView).toBe(false);
    });

    it('should reconcile authoritative financial records strictly from database ledger without placeholders', async () => {
      // 1. Tips ledger
      mockDb.query.mockResolvedValueOnce({
        rows: [{ gross_revenue_cents: 2500, platform_fee_cents: 250, net_earnings_cents: 2250, tips_count: 5 }],
      });
      // 2. Subscriptions ledger
      mockDb.query.mockResolvedValueOnce({
        rows: [{ active_subs: 12 }],
      });

      const earnings = await service.getAuthoritativeEarnings(
        'creator-1',
        new Date('2026-10-01'),
        new Date('2026-10-15'),
      );

      expect(earnings.grossRevenueCents).toBe(2500);
      expect(earnings.platformFeeCents).toBe(250);
      expect(earnings.netEarningsCents).toBe(2250);
      expect(earnings.tipsCount).toBe(5);
      expect(earnings.activeSubscriptionsCount).toBe(12);
      expect(earnings.isFinancialAuthoritative).toBe(true);
    });

    it('should handle deleted content with transparency: title masked as [Deleted Reel] and thumbnail hidden', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'reel-deleted-1',
            title: 'Old Secret Video',
            thumbnail_url: 'https://cdn.interest.app/thumb-deleted.jpg',
            view_count: '1500',
            like_count: '250',
            comment_count: '40',
            save_count: '15',
            share_count: '10',
            avg_completion_rate: '0.65',
            primary_interest_title: 'Engineering',
            created_at: new Date('2026-09-01'),
            deleted_at: new Date('2026-10-05'), // Deleted content
          },
          {
            id: 'reel-active-1',
            title: 'Active High Performance Reel',
            thumbnail_url: 'https://cdn.interest.app/thumb-active.jpg',
            view_count: '3200',
            like_count: '800',
            comment_count: '120',
            save_count: '95',
            share_count: '50',
            avg_completion_rate: '0.88',
            primary_interest_title: 'AI',
            created_at: new Date('2026-10-10'),
            deleted_at: null,
          },
        ],
      });

      const topReels = await service.getTopReels('creator-1', 2);
      expect(topReels.length).toBe(2);

      // Deleted reel verification
      expect(topReels[0].title).toBe('[Deleted Reel]');
      expect(topReels[0].thumbnailUrl).toBeUndefined();
      expect(topReels[0].viewCount).toBe(1500); // Historical views preserved

      // Active reel verification
      expect(topReels[1].title).toBe('Active High Performance Reel');
      expect(topReels[1].thumbnailUrl).toBe('https://cdn.interest.app/thumb-active.jpg');
    });

    it('should return honest empty state when 0 data exists (no fake placeholders)', async () => {
      mockDb.query.mockImplementation((sql: string) => {
        if (sql.includes('qualifying_views')) {
          return Promise.resolve({
            rows: [{
              qualifying_views: 0,
              completed_views: 0,
              total_watched_ms: '0',
              avg_watch_ratio: '0',
              total_likes: 0,
              total_comments: 0,
              total_saves: 0,
              total_shares: 0,
            }],
          });
        }
        if (sql.includes('current_followers')) {
          return Promise.resolve({
            rows: [{ current_followers: 0, new_followers_in_range: 0 }],
          });
        }
        if (sql.includes('creator_tips')) {
          return Promise.resolve({
            rows: [{ gross_revenue_cents: 0, platform_fee_cents: 0, net_earnings_cents: 0, tips_count: 0 }],
          });
        }
        if (sql.includes('user_subscriptions')) {
          return Promise.resolve({
            rows: [{ active_subs: 0 }],
          });
        }
        if (sql.includes('SCHEDULED')) {
          return Promise.resolve({
            rows: [{ count: 0 }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const verified = await service.getVerifiedAnalytics('creator-new', { range: '7d' });

      expect(verified.totalViews).toBe(0);
      expect(verified.totalWatchHours).toBe(0);
      expect(verified.hasSufficientData).toBe(false);
      expect(verified.retentionCurve).toEqual([]);
      expect(verified.discoverySources).toEqual([]);
      expect(verified.topicPerformance).toEqual([]);
      expect(verified.countingRules.minWatchSecondsForView).toBe(1.5);
      expect(verified.countingRules.completionRatioThreshold).toBe(0.9);
      expect(verified.timeframe.processingDelayMinutes).toBe(15);
      expect(verified.earnings.grossRevenueCents).toBe(0);
      expect(verified.zeroLocationGuarantee).toContain('0 GPS, 0 IP coordinates');
    });
  });
});
