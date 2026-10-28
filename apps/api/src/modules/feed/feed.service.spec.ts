import { FeedService } from './feed.service';
import { DatabaseService } from '../../database/database.service';
import { FeedMode, FeedControlAction, CandidateSource } from '@shared/types';

describe('FeedService (Interest Recommendation Engine)', () => {
  let service: FeedService;
  let mockDatabaseService: any;
  let mockConfigService: any;

  const userId = '11111111-1111-4111-a111-111111111111';
  const dummyVector = `[${new Array(512).fill(0.02).join(',')}]`;

  const mockReelRow = (id: string, creatorId: string, overrides: any = {}) => ({
    id,
    creator_id: creatorId,
    title: `Reel ${id}`,
    caption: `Caption for ${id}`,
    hls_master_url: `https://cdn.interest.app/reels/${id}/hls/master.m3u8`,
    thumbnail_url: `https://cdn.interest.app/reels/${id}/hls/thumb.jpg`,
    duration_seconds: '20.0',
    view_count: '250',
    like_count: '50',
    comment_count: '10',
    save_count: '20',
    share_count: '8',
    quick_skip_count: '15',
    test_audience_delivered: '0',
    cosine_similarity: '0.88',
    username: `creator_${creatorId}`,
    display_name: `Creator ${creatorId}`,
    avatar_url: null,
    primary_interest_id: 'interest-1',
    created_at: new Date().toISOString(),
    ...overrides,
  });

  beforeEach(() => {
    mockDatabaseService = {
      query: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('redis://localhost:6379'),
    };

    service = new FeedService(mockDatabaseService as any, mockConfigService as any);
  });

  afterEach(async () => {
    if ((service as any).redisClient) {
      await (service as any).redisClient.disconnect();
    }
  });

  // ==========================================================================
  // 1. FOR YOU BLENDED MODE
  // ==========================================================================
  it('should deliver FOR_YOU blended feed with ranking scores, prefetch, and cursor', async () => {
    mockDatabaseService.query.mockImplementation((sql: string, params: any[]) => {
      if (sql.includes('FROM users WHERE id = $1')) {
        return Promise.resolve({
          rows: [{ id: userId, interest_vector: dummyVector }],
        });
      }
      if (sql.includes('FROM user_interests WHERE user_id = $1')) {
        return Promise.resolve({
          rows: [
            { interest_id: 'interest-1', affinity_weight: '2.5', is_muted: false, is_paused: false },
          ],
        });
      }
      if (sql.includes('FROM blocks')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('ri.interest_id = ANY')) {
        // Trending query
        return Promise.resolve({
          rows: [mockReelRow('reel-trend-1', 'creator-t')],
        });
      }
      if (sql.includes('r.test_audience_delivered < 500')) {
        // Guaranteed test audience query
        return Promise.resolve({
          rows: [
            mockReelRow('reel-cold-1', 'creator-emerging', {
              test_audience_delivered: '50',
              view_count: '45',
              cosine_similarity: '0.75',
            }),
          ],
        });
      }
      if (sql.includes('RANDOM()')) {
        // Exploration query
        return Promise.resolve({
          rows: [mockReelRow('reel-explore-1', 'creator-e', { cosine_similarity: '0.60' })],
        });
      }
      if (sql.includes('r.embedding <=> $1::vector')) {
        // Vector similarity query
        return Promise.resolve({
          rows: [
            mockReelRow('reel-vec-1', 'creator-1', { cosine_similarity: '0.94' }),
            mockReelRow('reel-vec-2', 'creator-2', { cosine_similarity: '0.91' }),
            mockReelRow('reel-vec-3', 'creator-3', { cosine_similarity: '0.89' }),
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const feed = await service.getPersonalizedFeed(userId, {
      limit: 5,
      mode: FeedMode.FOR_YOU,
    });

    expect(feed.items).toBeDefined();
    expect(feed.items.length).toBeGreaterThan(0);
    expect(feed.mode).toBe(FeedMode.FOR_YOU);
    expect(feed.items[0].rankingScore).toBeDefined();
    expect(feed.prefetch).toBeDefined();
    expect(feed.prefetch.length).toBeLessThanOrEqual(3);

    // Verify SQL does not contain any forbidden location columns
    const sqlCalls: string[] = mockDatabaseService.query.mock.calls.map((c: any[]) => c[0]);
    for (const sql of sqlCalls) {
      expect(sql).not.toContain('country');
      expect(sql).not.toContain('city');
      expect(sql).not.toContain('latitude');
      expect(sql).not.toContain('longitude');
    }
  });

  // ==========================================================================
  // 2. FOLLOWING MODE
  // ==========================================================================
  it('should deliver FOLLOWING feed exclusively from creators the user follows', async () => {
    mockDatabaseService.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM users WHERE id = $1')) {
        return Promise.resolve({
          rows: [{ id: userId, interest_vector: dummyVector }],
        });
      }
      if (sql.includes('FROM user_interests WHERE user_id = $1')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('FROM blocks')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('JOIN follows f ON r.creator_id = f.following_id')) {
        return Promise.resolve({
          rows: [
            mockReelRow('reel-follow-1', 'creator-followed-1'),
            mockReelRow('reel-follow-2', 'creator-followed-2'),
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const feed = await service.getPersonalizedFeed(userId, {
      limit: 10,
      mode: FeedMode.FOLLOWING,
    });

    expect(feed.mode).toBe(FeedMode.FOLLOWING);
    expect(feed.items.length).toBe(2);
    expect(feed.items[0].creatorId).toBe('creator-followed-1');
  });

  // ==========================================================================
  // 3. INTEREST SPECIFIC MODE
  // ==========================================================================
  it('should deliver INTEREST feed filtered to the chosen taxonomy interest topic', async () => {
    const interestId = '22222222-2222-4222-a222-222222222222';

    mockDatabaseService.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM interests WHERE id = $1')) {
        return Promise.resolve({
          rows: [{ id: interestId, slug: 'calisthenics', title: 'Calisthenics' }],
        });
      }
      if (sql.includes('FROM users WHERE id = $1')) {
        return Promise.resolve({
          rows: [{ id: userId, interest_vector: dummyVector }],
        });
      }
      if (sql.includes('FROM user_interests WHERE user_id = $1')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('FROM blocks')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('ri.interest_id = $4')) {
        return Promise.resolve({
          rows: [
            mockReelRow('reel-cal-1', 'creator-1', {
              primary_interest_id: interestId,
              title: 'Planche Progression',
            }),
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const feed = await service.getPersonalizedFeed(userId, {
      limit: 10,
      mode: FeedMode.INTEREST,
      interestId,
    });

    expect(feed.mode).toBe(FeedMode.INTEREST);
    expect(feed.interestFilter?.title).toBe('Calisthenics');
    expect(feed.items.length).toBe(1);
    expect(feed.items[0].title).toBe('Planche Progression');
  });

  // ==========================================================================
  // 4. COLD START NEW USER (ONBOARDING CENTROID)
  // ==========================================================================
  it('should compute cold start vector centroid from onboarding interests for new user', async () => {
    const onboardingInterestIds = [
      '33333333-3333-4333-a333-000000000001',
      '33333333-3333-4333-a333-000000000002',
    ];

    mockDatabaseService.query.mockImplementation((sql: string) => {
      const cleanSql = sql.replace(/\s+/g, ' ');
      if (cleanSql.includes('FROM users WHERE id = $1')) {
        // Cold start: User has NO interest_vector yet!
        return Promise.resolve({
          rows: [{ id: userId, interest_vector: null }],
        });
      }
      if (cleanSql.includes('FROM user_interests WHERE user_id = $1')) {
        // Has completed onboarding (picked 2 interests)
        return Promise.resolve({
          rows: [
            { interest_id: onboardingInterestIds[0], affinity_weight: '1.0', is_muted: false },
            { interest_id: onboardingInterestIds[1], affinity_weight: '1.0', is_muted: false },
          ],
        });
      }
      if (cleanSql.includes('SELECT vector::text FROM interests WHERE id = ANY')) {
        return Promise.resolve({
          rows: [{ vector: dummyVector }, { vector: dummyVector }],
        });
      }
      if (cleanSql.includes('UPDATE users SET interest_vector')) {
        return Promise.resolve({ rowCount: 1 });
      }
      if (cleanSql.includes('FROM blocks')) {
        return Promise.resolve({ rows: [] });
      }
      if (cleanSql.includes('r.embedding <=> $1::vector')) {
        return Promise.resolve({
          rows: [mockReelRow('reel-cold-match', 'creator-cold')],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const feed = await service.getPersonalizedFeed(userId, { limit: 10 });
    expect(feed.items.length).toBeGreaterThan(0);

    // Verify user vector centroid was computed and persisted
    const updateCall = mockDatabaseService.query.mock.calls.find((c: any[]) =>
      c[0].replace(/\s+/g, ' ').includes('UPDATE users SET interest_vector'),
    );
    expect(updateCall).toBeDefined();
  });

  // ==========================================================================
  // 5. NEGATIVE FEED CONTROLS
  // ==========================================================================
  describe('Feed Controls', () => {
    beforeEach(() => {
      mockDatabaseService.query.mockImplementation((sql: string) => {
        const cleanSql = sql.replace(/\s+/g, ' ');
        if (cleanSql.includes('FROM reels r')) {
          return Promise.resolve({
            rows: [
              {
                id: 'reel-target',
                creator_id: 'creator-target',
                embedding: dummyVector,
                primary_interest_id: 'interest-target',
              },
            ],
          });
        }
        return Promise.resolve({ rowCount: 1, rows: [] });
      });
    });

    it('should handle "Show less of this" control by reducing affinity weight and nudging vector', async () => {
      const res = await service.applyFeedControl(userId, {
        reelId: 'reel-target',
        action: FeedControlAction.SHOW_LESS,
      });

      expect(res.success).toBe(true);
      expect(res.action).toBe(FeedControlAction.SHOW_LESS);

      // Verify affinity weight was reduced
      const updateAffinity = mockDatabaseService.query.mock.calls.find((c: any[]) =>
        c[0].includes('affinity_weight - 0.15'),
      );
      expect(updateAffinity).toBeDefined();
    });

    it('should handle "Not interested" control by strongly penalizing affinity weight', async () => {
      const res = await service.applyFeedControl(userId, {
        reelId: 'reel-target',
        action: FeedControlAction.NOT_INTERESTED,
      });

      expect(res.success).toBe(true);
      expect(res.action).toBe(FeedControlAction.NOT_INTERESTED);

      const updateAffinity = mockDatabaseService.query.mock.calls.find((c: any[]) =>
        c[0].includes('affinity_weight - 0.35'),
      );
      expect(updateAffinity).toBeDefined();
    });


    it('should handle "Pause this interest" control by setting is_paused to true', async () => {
      const res = await service.applyFeedControl(userId, {
        reelId: 'reel-target',
        action: FeedControlAction.PAUSE_INTEREST,
        interestId: 'interest-target',
      });

      expect(res.success).toBe(true);
      expect(res.action).toBe(FeedControlAction.PAUSE_INTEREST);

      const pauseCall = mockDatabaseService.query.mock.calls.find((c: any[]) =>
        c[0].includes('SET is_paused = TRUE'),
      );
      expect(pauseCall).toBeDefined();
    });
  });
});
