import { FeedRankingEngine, CandidateReel } from './feed-ranking.engine';
import { CandidateSource } from '@shared/types';

describe('FeedRankingEngine (Scoring Formula & Multi-Objective Ranking)', () => {
  const createMockCandidate = (overrides: Partial<CandidateReel> = {}): CandidateReel => ({
    id: 'reel-1',
    creatorId: 'creator-1',
    creatorUsername: 'synth_coder',
    creatorDisplayName: 'Synth Coder',
    title: 'Modular Clock Dividers',
    caption: 'Eurorack rhythmic modulation demo',
    hlsMasterUrl: 'https://cdn.interest.app/reels/reel-1/hls/master.m3u8',
    thumbnailUrl: 'https://cdn.interest.app/reels/reel-1/hls/thumb.jpg',
    durationSeconds: 20.0,
    primaryInterestId: 'interest-modular-synth',
    interestTags: ['interest-modular-synth'],
    viewCount: 1000,
    likeCount: 200,
    commentCount: 25,
    saveCount: 80,
    shareCount: 40,
    quickSkipCount: 50,
    testAudienceDelivered: 0,
    cosineSimilarity: 0.90,
    createdAt: new Date(),
    candidateSource: CandidateSource.VECTOR_SIMILARITY,
    ...overrides,
  });

  describe('Feature Scoring Components', () => {
    it('should compute interest match blending cosine similarity and user affinity weight', () => {
      const candidate = createMockCandidate({ cosineSimilarity: 0.85 });
      const affinities = new Map<string, number>([['interest-modular-synth', 2.5]]);

      // 0.70 * 0.85 + 0.30 * (2.5 / 5.0) = 0.595 + 0.15 = 0.745
      const matchScore = FeedRankingEngine.calculateInterestMatchScore(candidate, affinities);
      expect(matchScore).toBeCloseTo(0.745, 2);
    });

    it('should compute predicted watch time with duration sensitivity and quick skip discounts', () => {
      const candidate = createMockCandidate({
        viewCount: 1000,
        quickSkipCount: 100,
        durationSeconds: 15.0,
      });

      const pwt = FeedRankingEngine.calculatePredictedWatchTime(candidate, 0.80);
      expect(pwt).toBeGreaterThan(0.50);
      expect(pwt).toBeLessThanOrEqual(1.0);

      // Long video (> 30s) should have lower completion than 15s
      const longCandidate = createMockCandidate({
        viewCount: 1000,
        quickSkipCount: 100,
        durationSeconds: 90.0,
      });
      const longPwt = FeedRankingEngine.calculatePredictedWatchTime(longCandidate, 0.80);
      expect(longPwt).toBeLessThan(pwt);
    });

    it('should compute engagement quality rewarding saves and shares over simple views', () => {
      const highEngagement = createMockCandidate({
        viewCount: 500,
        likeCount: 150,
        saveCount: 80,
        shareCount: 40,
        quickSkipCount: 10,
      });

      const lowEngagement = createMockCandidate({
        viewCount: 500,
        likeCount: 10,
        saveCount: 0,
        shareCount: 0,
        quickSkipCount: 350,
      });

      const highQuality = FeedRankingEngine.calculateEngagementQuality(highEngagement);
      const lowQuality = FeedRankingEngine.calculateEngagementQuality(lowEngagement);

      expect(highQuality).toBeGreaterThan(lowQuality);
      expect(highQuality).toBeGreaterThan(0.50);
      expect(lowQuality).toBeLessThan(0.35);
    });

    it('should compute exponential freshness decay with 72-hour half life', () => {
      const now = new Date();
      const freshCandidate = createMockCandidate({ createdAt: now });
      const threeDaysOld = createMockCandidate({
        createdAt: new Date(now.getTime() - 72 * 3600 * 1000),
      });
      const sixDaysOld = createMockCandidate({
        createdAt: new Date(now.getTime() - 144 * 3600 * 1000),
      });

      const freshScore = FeedRankingEngine.calculateFreshness(freshCandidate, now);
      const threeDayScore = FeedRankingEngine.calculateFreshness(threeDaysOld, now);
      const sixDayScore = FeedRankingEngine.calculateFreshness(sixDaysOld, now);

      expect(freshScore).toBeCloseTo(1.0, 2);
      expect(threeDayScore).toBeCloseTo(0.50, 2);
      expect(sixDayScore).toBeCloseTo(0.25, 2);
    });

    it('should apply exponential creator diversity penalty for consecutive appearances', () => {
      expect(FeedRankingEngine.calculateCreatorDiversityPenalty(0)).toBe(0);
      expect(FeedRankingEngine.calculateCreatorDiversityPenalty(1)).toBe(0.25);
      expect(FeedRankingEngine.calculateCreatorDiversityPenalty(2)).toBe(0.50);
      expect(FeedRankingEngine.calculateCreatorDiversityPenalty(3)).toBe(1.00);
    });
  });

  describe('Candidate Re-ranking & Diversity Enforcement', () => {
    it('should demote multiple reels from the same creator to interleave diverse creators', () => {
      const now = new Date();
      const affinities = new Map<string, number>([['interest-modular-synth', 2.0]]);

      const candidates: CandidateReel[] = [
        createMockCandidate({
          id: 'reel-creator-A-1',
          creatorId: 'creator-A',
          cosineSimilarity: 0.95,
          viewCount: 2000,
        }),
        createMockCandidate({
          id: 'reel-creator-A-2',
          creatorId: 'creator-A',
          cosineSimilarity: 0.94,
          viewCount: 1900,
        }),
        createMockCandidate({
          id: 'reel-creator-B-1',
          creatorId: 'creator-B',
          cosineSimilarity: 0.88,
          viewCount: 1500,
        }),
      ];

      const ranked = FeedRankingEngine.rankCandidates(candidates, affinities, now);

      expect(ranked.length).toBe(3);
      // Top reel should be creator A's best reel
      expect(ranked[0].creatorId).toBe('creator-A');
      // Creator B should be promoted above creator A's second reel due to creator diversity penalty
      expect(ranked[1].creatorId).toBe('creator-B');
      expect(ranked[2].creatorId).toBe('creator-A');
      expect(ranked[2].creatorDiversityPenalty).toBeGreaterThan(0);
    });
  });
});
