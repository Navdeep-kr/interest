import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreatorAnalyticsService } from '../../src/modules/creator/creator-analytics.service';
import { CreatorSchedulingService } from '../../src/modules/creator/creator-scheduling.service';
import { DatabaseService } from '../../src/database/database.service';
import { ReelStatus } from '@shared/types';

describe('Prompt 17 — Creator Analytics & Scheduling Gate', () => {
  let analyticsService: CreatorAnalyticsService;
  let schedulingService: CreatorSchedulingService;

  const mockDb = {
    query: jest.fn(),
  };

  beforeEach(async () => {
    mockDb.query.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorAnalyticsService,
        CreatorSchedulingService,
        {
          provide: DatabaseService,
          useValue: mockDb,
        },
      ],
    }).compile();

    analyticsService = module.get<CreatorAnalyticsService>(CreatorAnalyticsService);
    schedulingService = module.get<CreatorSchedulingService>(CreatorSchedulingService);
  });

  describe('1. Server-Side Verified Analytics Reconciliation to Source Events', () => {
    it('reconciles views, watch hours, completion rate, and engagements strictly from database source records', async () => {
      mockDb.query.mockImplementation((sql: string) => {
        if (sql.includes('as qualifying_views')) {
          return Promise.resolve({
            rows: [
              {
                qualifying_views: 1200,
                completed_views: 780,
                total_watched_ms: '43200000', // 12 hours
                avg_watch_ratio: '0.74',
                total_likes: 450,
                total_comments: 85,
                total_saves: 110,
                total_shares: 55,
              },
            ],
          });
        }
        if (sql.includes('current_followers')) {
          return Promise.resolve({
            rows: [{ current_followers: 2400, new_followers_in_range: 120 }],
          });
        }
        if (sql.includes('FROM follows') && sql.includes('GROUP BY')) {
          return Promise.resolve({
            rows: [
              { date_str: '2026-10-10', new_followers: 40 },
              { date_str: '2026-10-11', new_followers: 35 },
              { date_str: '2026-10-12', new_followers: 45 },
            ],
          });
        }
        if (sql.includes('SELECT e.watch_ratio')) {
          return Promise.resolve({
            rows: [
              { watch_ratio: '1.0' },
              { watch_ratio: '0.85' },
              { watch_ratio: '0.60' },
              { watch_ratio: '0.20' },
            ],
          });
        }
        if (sql.includes('discovery_source')) {
          return Promise.resolve({
            rows: [
              { source: 'FOR_YOU', count: 800 },
              { source: 'TOPIC_PAGE', count: 250 },
              { source: 'COMMUNITY', count: 150 },
            ],
          });
        }
        if (sql.includes('GROUP BY i.id, i.title')) {
          return Promise.resolve({
            rows: [
              {
                topic_id: 'top-ai',
                topic_title: 'Generative AI',
                reels_count: 5,
                views_count: 850,
                watch_time_seconds: '28000',
                avg_watch_ratio: '0.78',
                total_engagements: '520',
              },
            ],
          });
        }
        if (sql.includes('creator_tips')) {
          return Promise.resolve({
            rows: [
              {
                gross_revenue_cents: 8000,
                platform_fee_cents: 800,
                net_earnings_cents: 7200,
                tips_count: 16,
              },
            ],
          });
        }
        if (sql.includes('user_subscriptions')) {
          return Promise.resolve({
            rows: [{ active_subs: 25 }],
          });
        }
        if (sql.includes('ORDER BY r.view_count DESC, r.like_count DESC')) {
          return Promise.resolve({
            rows: [
              {
                id: 'reel-101',
                title: 'High Performance Agents',
                thumbnail_url: 'https://cdn.interest.app/thumb-agents.jpg',
                view_count: '850',
                like_count: '320',
                comment_count: '60',
                save_count: '80',
                share_count: '40',
                avg_completion_rate: '0.78',
                primary_interest_title: 'Generative AI',
                created_at: new Date('2026-10-01'),
                deleted_at: null,
              },
            ],
          });
        }
        if (sql.includes('SCHEDULED')) {
          return Promise.resolve({
            rows: [{ count: 3 }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const analytics = await analyticsService.getVerifiedAnalytics('creator-user-42', {
        range: '30d',
      });

      // 1. Authoritative metrics verification
      expect(analytics.totalViews).toBe(1200);
      expect(analytics.totalWatchHours).toBe(12);
      expect(analytics.completionRate).toBe(65); // 780 / 1200 = 65%
      expect(analytics.totalLikes).toBe(450);
      expect(analytics.totalComments).toBe(85);
      expect(analytics.totalSaves).toBe(110);
      expect(analytics.totalShares).toBe(55);
      expect(analytics.engagementRate).toBe(58.33); // (450+85+110+55)/1200 = 58.33%

      // 2. Follower Growth verification
      expect(analytics.totalFollowers).toBe(2400);
      expect(analytics.followerGrowthPercent).toBe(5.26); // 120 / (2400 - 120) * 100

      // 3. Documented Counting Rules verification
      expect(analytics.countingRules.minWatchSecondsForView).toBe(1.5);
      expect(analytics.countingRules.completionRatioThreshold).toBe(0.90);
      expect(analytics.countingRules.deduplicationWindowMinutes).toBe(30);
      expect(analytics.countingRules.rapidSkipDurationLimitSeconds).toBe(1.5);
      expect(analytics.countingRules.botFilteringEnabled).toBe(true);

      // 4. Timeframe metadata verification
      expect(analytics.timeframe.processingDelayMinutes).toBe(15);
      expect(analytics.timeframe.timezone).toBe('UTC');

      // 5. Authoritative Financial Reconciliation verification
      expect(analytics.earnings.isFinancialAuthoritative).toBe(true);
      expect(analytics.earnings.grossRevenueCents).toBe(8000);
      expect(analytics.earnings.platformFeeCents).toBe(800);
      expect(analytics.earnings.netEarningsCents).toBe(7200);
      expect(analytics.earnings.tipsCount).toBe(16);
      expect(analytics.earnings.activeSubscriptionsCount).toBe(25);

      // 6. Discovery Sources and Topic Breakdown
      expect(analytics.discoverySources.length).toBe(3);
      expect(analytics.discoverySources[0].source).toBe('FOR_YOU');
      expect(analytics.topicPerformance.length).toBe(1);
      expect(analytics.topicPerformance[0].topicTitle).toBe('Generative AI');

      // 7. Scheduled Content Count
      expect(analytics.scheduledCount).toBe(3);

      // 8. Strict Zero Location Guarantee
      expect(analytics.zeroLocationGuarantee).toContain('0 GPS, 0 IP coordinates');
      expect((analytics as any).country).toBeUndefined();
      expect((analytics as any).city).toBeUndefined();
      expect((analytics as any).location).toBeUndefined();
    });

    it('returns honest empty states without fake placeholder metrics when creator has zero events', async () => {
      mockDb.query.mockImplementation((sql: string) => {
        if (sql.includes('as qualifying_views')) {
          return Promise.resolve({
            rows: [
              {
                qualifying_views: 0,
                completed_views: 0,
                total_watched_ms: '0',
                avg_watch_ratio: '0',
                total_likes: 0,
                total_comments: 0,
                total_saves: 0,
                total_shares: 0,
              },
            ],
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
          return Promise.resolve({ rows: [{ active_subs: 0 }] });
        }
        if (sql.includes('SCHEDULED')) {
          return Promise.resolve({ rows: [{ count: 0 }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const analytics = await analyticsService.getVerifiedAnalytics('new-creator-0', {
        range: '7d',
      });

      expect(analytics.hasSufficientData).toBe(false);
      expect(analytics.totalViews).toBe(0);
      expect(analytics.totalWatchHours).toBe(0);
      expect(analytics.completionRate).toBe(0);
      expect(analytics.engagementRate).toBe(0);
      expect(analytics.retentionCurve).toEqual([]);
      expect(analytics.discoverySources).toEqual([]);
      expect(analytics.topicPerformance).toEqual([]);
      expect(analytics.topReels).toEqual([]);
      expect(analytics.earnings.netEarningsCents).toBe(0);
    });
  });

  describe('2. Bot Filtering, Rate Limiting & Idempotency', () => {
    it('idempotently ignores duplicate engagement telemetry with matching clientEventId', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'existing-event-uuid' }] });

      const res = await analyticsService.recordEngagementEvent('viewer-1', {
        clientEventId: 'client-evt-unique-uuid-999',
        reelId: '00000000-0000-0000-0000-000000000001',
        durationMs: 30000,
        watchedMs: 25000,
        action: 'WATCH_PARTIAL',
      });

      expect(res.recorded).toBe(true);
      expect(res.isDuplicate).toBe(true);
      expect(res.isQualifyingView).toBe(false);
      expect(res.isQuarantined).toBe(false);
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('quarantines bot zero-watch anomaly in analytics_fraud_events table', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // not duplicate
        .mockResolvedValueOnce({ rows: [] }); // insert into fraud events

      const res = await analyticsService.recordEngagementEvent('bot-user', {
        clientEventId: 'bot-evt-1',
        reelId: '00000000-0000-0000-0000-000000000001',
        durationMs: 45000,
        watchedMs: 0, // Anomaly: 0 watched ms but claims WATCH_COMPLETE
        action: 'WATCH_COMPLETE',
      });

      expect(res.recorded).toBe(false);
      expect(res.isQuarantined).toBe(true);
      expect(res.isQualifyingView).toBe(false);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO analytics_fraud_events'),
        expect.arrayContaining(['bot-user', '00000000-0000-0000-0000-000000000001', 'bot-evt-1', 'ZERO_WATCH_RATIO']),
      );
    });

    it('quarantines rapid burst flood (< 300ms from same session) in fraud table', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // not duplicate
        .mockResolvedValueOnce({ rows: [{ id: 'recent-event-just-fired' }] }) // burst detected
        .mockResolvedValueOnce({ rows: [] }); // insert into fraud events

      const res = await analyticsService.recordEngagementEvent('spammer-user', {
        clientEventId: 'spammer-evt-1',
        reelId: '00000000-0000-0000-0000-000000000001',
        durationMs: 15000,
        watchedMs: 5000,
        action: 'WATCH_PARTIAL',
        sessionHash: 'session-flood-token-xyz',
      });

      expect(res.recorded).toBe(false);
      expect(res.isQuarantined).toBe(true);
      expect(res.isQualifyingView).toBe(false);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO analytics_fraud_events'),
        expect.arrayContaining(['spammer-user', '00000000-0000-0000-0000-000000000001', 'spammer-evt-1', 'RAPID_BURST']),
      );
    });

    it('counts genuine view only when watch time >= 1.5s and watch ratio >= 15%', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // not duplicate
        .mockResolvedValueOnce({ rows: [] }) // insert engagement
        .mockResolvedValueOnce({ rows: [] }); // increment reel view_count

      const res = await analyticsService.recordEngagementEvent('viewer-legit', {
        reelId: '00000000-0000-0000-0000-000000000001',
        durationMs: 10000,
        watchedMs: 1600, // 1.6s >= 1.5s and 16% >= 15%
        action: 'WATCH_PARTIAL',
      });

      expect(res.recorded).toBe(true);
      expect(res.isQualifyingView).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE reels SET view_count = view_count + 1'),
        ['00000000-0000-0000-0000-000000000001'],
      );
    });

    it('rejects short skips (< 1.5s) from qualifying view threshold', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // not duplicate
        .mockResolvedValueOnce({ rows: [] }); // insert engagement (not qualifying)

      const res = await analyticsService.recordEngagementEvent('viewer-speedrunner', {
        reelId: '00000000-0000-0000-0000-000000000001',
        durationMs: 20000,
        watchedMs: 600, // 600ms < 1.5s
        action: 'SKIP',
      });

      expect(res.recorded).toBe(true);
      expect(res.isQualifyingView).toBe(false);
      // Ensure reels view_count was NOT updated
      expect(mockDb.query).not.toHaveBeenCalledWith(
        expect.stringContaining('UPDATE reels SET view_count'),
        expect.anything(),
      );
    });
  });

  describe('3. Deleted Content Transparency & Historical Integrity', () => {
    it('masks deleted reels as [Deleted Reel] and hides media thumbnail while preserving verified views', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'reel-deleted-xyz',
            title: 'Confidential Strategy Talk',
            thumbnail_url: 'https://cdn.interest.app/secret.jpg',
            view_count: '4500',
            like_count: '600',
            comment_count: '80',
            save_count: '50',
            share_count: '25',
            avg_completion_rate: '0.82',
            primary_interest_title: 'Business',
            created_at: new Date('2026-08-15'),
            deleted_at: new Date('2026-09-30'), // soft-deleted
          },
        ],
      });

      const topReels = await analyticsService.getTopReels('creator-user-1', 5);

      expect(topReels.length).toBe(1);
      expect(topReels[0].title).toBe('[Deleted Reel]');
      expect(topReels[0].thumbnailUrl).toBeUndefined();
      expect(topReels[0].viewCount).toBe(4500); // Historical views remain authoritative
      expect(topReels[0].primaryInterestTitle).toBe('Business');
    });
  });

  describe('4. Reliable Automated Scheduled Posts Publishing', () => {
    it('safely publishes due scheduled reels with FOR UPDATE SKIP LOCKED without duplicate publication', async () => {
      // 1. Due query returns 2 due scheduled reels
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            { id: 'reel-due-1', creator_id: 'creator-1', title: 'Due Reel 1' },
            { id: 'reel-due-2', creator_id: 'creator-2', title: 'Due Reel 2' },
          ],
        })
        // 2. Batch update query transitions status to PUBLISHED and clears scheduled_at
        .mockResolvedValueOnce({ rows: [] });

      const result = await schedulingService.publishDueScheduledReels();

      expect(result.publishedCount).toBe(2);
      expect(result.publishedIds).toEqual(['reel-due-1', 'reel-due-2']);

      // Concurrency lock verification
      expect(mockDb.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('FOR UPDATE SKIP LOCKED'),
      );

      // Status transition verification
      expect(mockDb.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("SET status = 'PUBLISHED', scheduled_at = NULL"),
        [['reel-due-1', 'reel-due-2']],
      );
    });

    it('handles empty scheduled queue gracefully with 0 published count', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const result = await schedulingService.publishDueScheduledReels();

      expect(result.publishedCount).toBe(0);
      expect(result.publishedIds).toEqual([]);
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('rejects scheduling in the past', async () => {
      const pastTime = new Date(Date.now() - 3600 * 1000).toISOString();

      await expect(
        schedulingService.scheduleReel('creator-1', {
          reelId: '00000000-0000-0000-0000-000000000001',
          scheduledAt: pastTime,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects scheduling if reel does not belong to creator', async () => {
      const futureTime = new Date(Date.now() + 3600 * 1000).toISOString();
      mockDb.query.mockResolvedValueOnce({ rows: [] }); // Not found or wrong owner

      await expect(
        schedulingService.scheduleReel('other-user', {
          reelId: '00000000-0000-0000-0000-000000000001',
          scheduledAt: futureTime,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
