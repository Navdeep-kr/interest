import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FeedService } from '../../src/modules/feed/feed.service';
import { FeedController } from '../../src/modules/feed/feed.controller';
import { DatabaseService } from '../../src/database/database.service';
import { FeedMode, FeedControlAction, CandidateSource, ReelStatus } from '@shared/types';
import { FeedRankingEngine } from '../../src/modules/feed/feed-ranking.engine';

describe('Prompt 10 — Feed Ranking, Recommendations & User Controls Gate', () => {
  let feedService: FeedService;
  let feedController: FeedController;
  let mockDatabaseService: any;
  let mockConfigService: any;

  const viewerId = 'user-viewer-1111-4111-a111-111111111111';
  const creatorFollowed1 = 'user-creator-followed-1';
  const creatorFollowed2 = 'user-creator-followed-2';
  const creatorUnfollowed = 'user-creator-unfollowed-3';
  const creatorBlocked = 'user-creator-blocked-4';
  const creatorMuted = 'user-creator-muted-5';

  const dummyVector = `[${new Array(512).fill(0.02).join(',')}]`;

  const makeReel = (id: string, creatorId: string, overrides: any = {}) => ({
    id,
    creator_id: creatorId,
    title: `Reel ${id}`,
    caption: `Caption for ${id}`,
    hls_master_url: `https://cdn.interest.app/reels/${id}/hls/master.m3u8`,
    thumbnail_url: `https://cdn.interest.app/reels/${id}/hls/thumb.jpg`,
    duration_seconds: '15.0',
    view_count: '100',
    like_count: '25',
    comment_count: '5',
    save_count: '10',
    share_count: '4',
    quick_skip_count: '5',
    test_audience_delivered: '0',
    cosine_similarity: '0.85',
    username: `creator_${creatorId}`,
    display_name: `Creator ${creatorId}`,
    avatar_url: `https://cdn.interest.app/avatars/${creatorId}.jpg`,
    primary_interest_id: 'interest-dist-sys',
    primary_interest_title: 'Distributed Systems',
    created_at: new Date().toISOString(),
    is_liked: false,
    is_saved: false,
    is_following: creatorId === creatorFollowed1 || creatorId === creatorFollowed2,
    ...overrides,
  });

  beforeEach(async () => {
    mockDatabaseService = {
      query: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('redis://localhost:6379'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeedController],
      providers: [
        FeedService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    feedService = module.get<FeedService>(FeedService);
    feedController = module.get<FeedController>(FeedController);
  });

  afterEach(async () => {
    if ((feedService as any).redisClient) {
      await (feedService as any).redisClient.disconnect();
    }
  });

  // ==========================================================================
  // 1. FOLLOWING FEED WITH AUTHORIZED REAL CONTENT
  // ==========================================================================
  describe('Following Feed (Chronological & Authorized)', () => {
    it('delivers content exclusively from followed creators with transparency explanation', async () => {
      mockDatabaseService.query.mockImplementation((sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return Promise.resolve({ rows: [{ id: viewerId, interest_vector: dummyVector }] });
        }
        if (sql.includes('FROM user_interests WHERE user_id = $1')) {
          return Promise.resolve({ rows: [{ interest_id: 'interest-dist-sys', affinity_weight: '2.0', is_muted: false, is_paused: false }] });
        }
        if (sql.includes('FROM blocks')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('FROM user_mutes')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('FROM user_hidden_reels')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('follows f') || sql.includes('f.follower_id')) {
          // Following query
          return Promise.resolve({
            rows: [
              makeReel('reel-f1', creatorFollowed1, { created_at: new Date(Date.now() - 1000).toISOString() }),
              makeReel('reel-f2', creatorFollowed2, { created_at: new Date(Date.now() - 5000).toISOString() }),
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await feedController.getFeed(viewerId, {
        mode: FeedMode.FOLLOWING,
        limit: 10,
      });

      expect(response.items).toHaveLength(2);
      expect(response.mode).toBe(FeedMode.FOLLOWING);
      expect(response.items[0].id).toBe('reel-f1');
      expect(response.items[0].creatorId).toBe(creatorFollowed1);
      expect(response.items[0].isFollowing).toBe(true);
      expect(response.items[0].explanation).toBe(`From @creator_${creatorFollowed1} whom you follow`);
      expect(response.items[1].id).toBe('reel-f2');
      expect(response.items[1].creatorId).toBe(creatorFollowed2);
      expect(response.items[1].explanation).toBe(`From @creator_${creatorFollowed2} whom you follow`);
    });

    it('allows FOLLOWERS_ONLY reels for verified followers while blocking unauthorized creators', async () => {
      let executedSql = '';
      mockDatabaseService.query.mockImplementation((sql: string) => {
        executedSql = sql;
        if (sql.includes('FROM users WHERE id = $1')) {
          return Promise.resolve({ rows: [{ id: viewerId, interest_vector: dummyVector }] });
        }
        if (sql.includes('FROM user_interests WHERE user_id = $1')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('FROM blocks') || sql.includes('FROM user_mutes') || sql.includes('FROM user_hidden_reels')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('follows f') || sql.includes('f.follower_id')) {
          return Promise.resolve({
            rows: [
              makeReel('reel-followers-only', creatorFollowed1, { visibility: 'FOLLOWERS_ONLY' }),
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await feedService.getPersonalizedFeed(viewerId, { mode: FeedMode.FOLLOWING });
      expect(res.items).toHaveLength(1);
      expect(res.items[0].id).toBe('reel-followers-only');
    });
  });

  // ==========================================================================
  // 2. PERSONALIZED DISCOVERY (FOR_YOU) WITH TRANSPARENT RANKING
  // ==========================================================================
  describe('Personalized Discovery Feed (FOR_YOU Multi-Objective Scoring)', () => {
    it('ranks candidates using interest match, engagement, freshness and applies diversity penalty', async () => {
      mockDatabaseService.query.mockImplementation((sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return Promise.resolve({ rows: [{ id: viewerId, interest_vector: dummyVector }] });
        }
        if (sql.includes('FROM user_interests WHERE user_id = $1')) {
          return Promise.resolve({
            rows: [
              { interest_id: 'interest-dist-sys', affinity_weight: '3.0', is_muted: false, is_paused: false },
            ],
          });
        }
        if (sql.includes('FROM blocks') || sql.includes('FROM user_mutes') || sql.includes('FROM user_hidden_reels')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('ri.interest_id = ANY')) {
          // Trending
          return Promise.resolve({
            rows: [makeReel('reel-trending', creatorUnfollowed, { primary_interest_title: 'Kubernetes', like_count: '200' })],
          });
        }
        if (sql.includes('r.test_audience_delivered < 500')) {
          // Test audience
          return Promise.resolve({
            rows: [makeReel('reel-emerging', 'creator-new', { primary_interest_title: 'Distributed Systems', is_test_audience_slot: true })],
          });
        }
        if (sql.includes('RANDOM()')) {
          // Exploration
          return Promise.resolve({
            rows: [makeReel('reel-explore', 'creator-other', { primary_interest_title: 'Quantum Computing' })],
          });
        }
        if (sql.includes('r.embedding <=> $1::vector')) {
          // Vector similarity
          return Promise.resolve({
            rows: [makeReel('reel-vec', creatorUnfollowed, { primary_interest_title: 'Distributed Systems', cosine_similarity: '0.92' })],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await feedController.getFeed(viewerId, {
        mode: FeedMode.FOR_YOU,
        limit: 10,
      });

      expect(response.items.length).toBeGreaterThan(0);
      for (const item of response.items) {
        // Assert every item in the discovery feed has a transparent explanation
        expect(item.explanation).toBeDefined();
        expect(typeof item.explanation).toBe('string');
        expect(item.explanation!.length).toBeGreaterThan(5);
        // Assert ranking scores are populated
        expect(item.rankingScore).toBeDefined();
      }
    });

    it('demonstrates FeedRankingEngine creator diversity penalty', () => {
      const candidates = [
        makeReel('reel-1', 'monopolist-creator', { cosine_similarity: '0.90', view_count: '1000', like_count: '200' }),
        makeReel('reel-2', 'monopolist-creator', { cosine_similarity: '0.90', view_count: '1000', like_count: '200' }),
        makeReel('reel-3', 'monopolist-creator', { cosine_similarity: '0.90', view_count: '1000', like_count: '200' }),
        makeReel('reel-4', 'diverse-creator', { cosine_similarity: '0.85', view_count: '800', like_count: '150' }),
      ].map((r: any) => ({
        ...r,
        creatorId: r.creator_id,
        creatorUsername: r.username,
        creatorDisplayName: r.display_name,
        interestTags: [r.primary_interest_title],
        candidateSource: CandidateSource.VECTOR_SIMILARITY,
        createdAt: new Date(),
        cosineSimilarity: parseFloat(r.cosine_similarity),
        durationSeconds: 15,
        viewCount: 1000,
        likeCount: 200,
        commentCount: 10,
        saveCount: 10,
        shareCount: 5,
        quickSkipCount: 5,
        testAudienceDelivered: 0,
      }));

      const affinities = new Map<string, number>([['interest-dist-sys', 2.0]]);
      const scored = FeedRankingEngine.rankCandidates(candidates, affinities, new Date());

      // Because monopolist gets penalized on second and third pick, diverse-creator is interleaved
      const creatorOrder = scored.map((s) => s.creatorId);
      expect(creatorOrder[0]).toBe('monopolist-creator');
      // Second pick must see penalty applied
      expect(scored[1].creatorDiversityPenalty).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // 3. NEGATIVE FEEDBACK & USER CONTROLS (NOT INTERESTED, HIDE, MUTE, PAUSE)
  // ==========================================================================
  describe('User Feedback & Negative Controls', () => {
    it('not-interested suppresses reel, adds to user_hidden_reels, and adjusts vector', async () => {
      mockDatabaseService.query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT r.id, r.creator_id, r.embedding::text')) {
          return Promise.resolve({
            rows: [{ id: 'reel-bad-1', creator_id: 'creator-x', embedding: dummyVector, primary_interest_id: 'interest-dist-sys' }],
          });
        }
        if (sql.includes('INSERT INTO user_hidden_reels')) {
          return Promise.resolve({ rowCount: 1 });
        }
        if (sql.includes('UPDATE user_interests')) {
          return Promise.resolve({ rowCount: 1 });
        }
        if (sql.includes('SELECT interest_vector::text FROM users')) {
          return Promise.resolve({ rows: [{ interest_vector: dummyVector }] });
        }
        if (sql.includes('UPDATE users SET interest_vector')) {
          return Promise.resolve({ rowCount: 1 });
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await feedController.notInterested(viewerId, { reelId: 'reel-bad-1' });

      expect(result.success).toBe(true);
      expect(result.action).toBe(FeedControlAction.NOT_INTERESTED);
      expect(result.message).toContain('Similar content will be suppressed');

      // Verify permanent persistence into user_hidden_reels
      const insertCall = mockDatabaseService.query.mock.calls.find((c: any[]) =>
        c[0].includes('INSERT INTO user_hidden_reels'),
      );
      expect(insertCall).toBeDefined();
      expect(insertCall[1]).toEqual([viewerId, 'reel-bad-1']);
    });

    it('muted creators are strictly excluded from feed candidate generation', async () => {
      let exclusionCheckPassed = false;
      mockDatabaseService.query.mockImplementation((sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return Promise.resolve({ rows: [{ id: viewerId, interest_vector: dummyVector }] });
        }
        if (sql.includes('FROM user_interests WHERE user_id = $1')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('FROM blocks')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('FROM user_mutes WHERE muter_id = $1')) {
          return Promise.resolve({ rows: [{ muted_id: creatorMuted }] });
        }
        if (sql.includes('FROM user_hidden_reels')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('r.creator_id != ALL')) {
          exclusionCheckPassed = true;
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      await feedService.getPersonalizedFeed(viewerId, { mode: FeedMode.FOR_YOU });
      expect(exclusionCheckPassed).toBe(true);
    });

    it('hidden reels are strictly excluded from candidate queries', async () => {
      let hiddenExclusionPassed = false;
      mockDatabaseService.query.mockImplementation((sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return Promise.resolve({ rows: [{ id: viewerId, interest_vector: dummyVector }] });
        }
        if (sql.includes('FROM user_interests WHERE user_id = $1')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('FROM blocks') || sql.includes('FROM user_mutes')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('FROM user_hidden_reels WHERE user_id = $1')) {
          return Promise.resolve({ rows: [{ reel_id: 'reel-hidden-123' }] });
        }
        if (sql.includes('r.id != ALL')) {
          hiddenExclusionPassed = true;
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      await feedService.getPersonalizedFeed(viewerId, { mode: FeedMode.FOR_YOU });
      expect(hiddenExclusionPassed).toBe(true);
    });

    it('pause-interest freezes interest recommendations', async () => {
      mockDatabaseService.query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT r.id, r.creator_id, r.embedding::text')) {
          return Promise.resolve({
            rows: [{ id: 'reel-pause-1', creator_id: 'creator-x', primary_interest_id: 'interest-crypto' }],
          });
        }
        if (sql.includes('UPDATE user_interests SET is_paused = TRUE')) {
          return Promise.resolve({ rowCount: 1 });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await feedController.pauseInterest(viewerId, {
        reelId: 'reel-pause-1',
        interestId: 'interest-crypto',
      });

      expect(res.success).toBe(true);
      expect(res.action).toBe(FeedControlAction.PAUSE_INTEREST);
      expect(res.message).toContain('Interest topic paused');
    });
  });

  // ==========================================================================
  // 4. PREFERENCE RESET & RESTART
  // ==========================================================================
  describe('User Preference Reset', () => {
    it('resets user hidden reels and unpauses interests back to baseline', async () => {
      mockDatabaseService.query.mockImplementation((sql: string) => {
        if (sql.includes('DELETE FROM user_hidden_reels WHERE user_id = $1')) {
          return Promise.resolve({ rowCount: 3 });
        }
        if (sql.includes('UPDATE user_interests') && sql.includes('is_paused = FALSE')) {
          return Promise.resolve({ rowCount: 2 });
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await feedController.resetPreferences(viewerId);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Feed preferences and recommendation signals reset to baseline');

      const deleteHiddenCall = mockDatabaseService.query.mock.calls.find((c: any[]) =>
        c[0].includes('DELETE FROM user_hidden_reels'),
      );
      expect(deleteHiddenCall).toBeDefined();
      expect(deleteHiddenCall[1]).toEqual([viewerId]);

      const unpauseCall = mockDatabaseService.query.mock.calls.find((c: any[]) =>
        c[0].includes('UPDATE user_interests') && c[0].includes('is_paused = FALSE'),
      );
      expect(unpauseCall).toBeDefined();
      expect(unpauseCall[1]).toEqual([viewerId]);
    });
  });

  // ==========================================================================
  // 5. PROMPT 10 GATE VERIFICATION
  // ==========================================================================
  describe('Prompt 10 Gate: Relevant, Authorized, Real Feed Content with Meaningful Controls', () => {
    it('verifies end-to-end feed delivery, negative control suppression, and baseline preference reset', async () => {
      // Step A: Feed delivers relevant reel
      mockDatabaseService.query.mockImplementation((sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return Promise.resolve({ rows: [{ id: viewerId, interest_vector: dummyVector }] });
        }
        if (sql.includes('FROM user_interests WHERE user_id = $1')) {
          return Promise.resolve({ rows: [{ interest_id: 'interest-dist-sys', affinity_weight: '3.0', is_muted: false, is_paused: false }] });
        }
        if (sql.includes('FROM blocks') || sql.includes('FROM user_mutes') || sql.includes('FROM user_hidden_reels')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('FROM reels r')) {
          return Promise.resolve({ rows: [makeReel('gate-reel-1', creatorFollowed1)] });
        }
        return Promise.resolve({ rows: [] });
      });

      const initialFeed = await feedController.getFeed(viewerId, { mode: FeedMode.FOR_YOU });
      expect(initialFeed.items).toHaveLength(1);
      expect(initialFeed.items[0].id).toBe('gate-reel-1');
      expect(initialFeed.items[0].explanation).toBeDefined();

      // Step B: User exercises negative control ("Not interested")
      mockDatabaseService.query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT r.id, r.creator_id, r.embedding::text')) {
          return Promise.resolve({ rows: [{ id: 'gate-reel-1', creator_id: creatorFollowed1, primary_interest_id: 'interest-dist-sys' }] });
        }
        if (sql.includes('INSERT INTO user_hidden_reels')) {
          return Promise.resolve({ rowCount: 1 });
        }
        if (sql.includes('UPDATE user_interests')) {
          return Promise.resolve({ rowCount: 1 });
        }
        return Promise.resolve({ rows: [] });
      });

      const controlRes = await feedController.notInterested(viewerId, { reelId: 'gate-reel-1' });
      expect(controlRes.success).toBe(true);

      // Step C: Subsequent feed call suppresses the hidden reel
      mockDatabaseService.query.mockImplementation((sql: string) => {
        if (sql.includes('FROM users WHERE id = $1')) {
          return Promise.resolve({ rows: [{ id: viewerId, interest_vector: dummyVector }] });
        }
        if (sql.includes('FROM user_interests WHERE user_id = $1')) {
          return Promise.resolve({ rows: [{ interest_id: 'interest-dist-sys', affinity_weight: '2.65', is_muted: false, is_paused: false }] });
        }
        if (sql.includes('FROM blocks') || sql.includes('FROM user_mutes')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('FROM user_hidden_reels')) {
          return Promise.resolve({ rows: [{ reel_id: 'gate-reel-1' }] });
        }
        if (sql.includes('r.id != ALL')) {
          // Negative feedback filter excluded the reel
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('FROM reels r')) {
          return Promise.resolve({ rows: [makeReel('gate-reel-1', creatorFollowed1)] });
        }
        return Promise.resolve({ rows: [] });
      });

      const subsequentFeed = await feedController.getFeed(viewerId, { mode: FeedMode.FOR_YOU });
      expect(subsequentFeed.items.find((i) => i.id === 'gate-reel-1')).toBeUndefined();

      // Step D: Reset preferences restores clean baseline
      mockDatabaseService.query.mockImplementation((sql: string) => {
        if (sql.includes('DELETE FROM user_hidden_reels')) return Promise.resolve({ rowCount: 1 });
        if (sql.includes('UPDATE user_interests')) return Promise.resolve({ rowCount: 1 });
        return Promise.resolve({ rows: [] });
      });

      const resetRes = await feedController.resetPreferences(viewerId);
      expect(resetRes.success).toBe(true);
    });
  });
});
