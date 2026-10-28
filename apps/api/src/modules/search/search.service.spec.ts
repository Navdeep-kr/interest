import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { DatabaseService } from '../../database/database.service';
import { SearchType } from '@interest/shared';

describe('SearchService', () => {
  let service: SearchService;
  let databaseService: any;

  const mockDbService = {
    query: jest.fn(),
    getClient: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: DatabaseService,
          useValue: mockDbService,
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    databaseService = module.get(DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('unifiedSearch', () => {
    it('returns empty result when query is empty or whitespace', async () => {
      const res = await service.search(null, { q: '   ' });
      expect(res.totalCount).toBe(0);
      expect(res.reels).toEqual([]);
      expect(databaseService.query).not.toHaveBeenCalled();
    });

    it('searches across all 5 entities when type is ALL', async () => {
      // Mock 5 parallel calls
      databaseService.query
        .mockResolvedValueOnce({ rows: [] }) // reels
        .mockResolvedValueOnce({ rows: [] }) // users
        .mockResolvedValueOnce({ rows: [] }) // hashtags
        .mockResolvedValueOnce({ rows: [] }) // interests
        .mockResolvedValueOnce({ rows: [] }); // audio

      const res = await service.search('user-1', {
        q: 'calisthenics',
        type: SearchType.ALL,
      });

      expect(res.query).toBe('calisthenics');
      expect(res.totalCount).toBe(0);
      expect(databaseService.query).toHaveBeenCalledTimes(5);
    });

    it('searches only reels when type is REELS', async () => {
      databaseService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'reel-101',
            creator_id: 'c-1',
            creator_username: 'calisthenics_pro',
            creator_display_name: 'Bar Athlete',
            title: 'Muscle Up Tutorial',
            caption: 'Learn how to master the bar muscle up in 3 easy steps.',
            transcript_text: 'Keep your core tight and engage your lats during the pull transition.',
            thumbnail_url: 'https://cdn.interest.app/t.jpg',
            hls_master_url: 'https://cdn.interest.app/s.m3u8',
            hashtags: ['calisthenics', 'muscleup'],
            view_count: 5000,
            like_count: 850,
            comment_count: 92,
            primary_interest_id: 'int-calisthenics',
            primary_interest_title: 'Calisthenics',
            raw_text_relevance: 0.85,
            viewer_interest_match: 1.0,
            final_rank_score: 0.89,
          },
        ],
      });

      const res = await service.search('user-1', {
        q: 'lats during pull transition',
        type: SearchType.REELS,
      });

      expect(res.type).toBe(SearchType.REELS);
      expect(res.reels.length).toBe(1);
      const item = res.reels[0];
      expect(item.id).toBe('reel-101');
      expect(item.matchSource).toBe('transcript');
      expect(item.matchSnippet).toContain('lats during the pull transition');
      expect(item.interestMatchScore).toBe(1.0);
    });
  });

  describe('searchReels and Ranking Guarantee', () => {
    it('ranks reels by text relevance and interest match, with 0% location weighting', async () => {
      databaseService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'reel-ai-1',
            creator_id: 'c-ai',
            creator_username: 'aimaster',
            creator_display_name: 'AI Master',
            title: 'Prompt Engineering Guide',
            caption: 'Chain of thought prompting strategies',
            transcript_text: 'When designing multi-turn agent systems, prioritize chain of thought.',
            thumbnail_url: 'https://cdn.interest.app/ai.jpg',
            hls_master_url: 'https://cdn.interest.app/ai.m3u8',
            hashtags: ['ai', 'promptengineering'],
            view_count: 12000,
            like_count: 2100,
            comment_count: 340,
            primary_interest_id: 'int-pe',
            primary_interest_title: 'Prompt Engineering',
            raw_text_relevance: 0.95,
            viewer_interest_match: 0.9,
            final_rank_score: 0.93,
          },
        ],
      });

      const results = await service.searchReels('user-1', 'chain of thought');
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Prompt Engineering Guide');
      expect(results[0].matchSource).toBe('transcript');
      expect(results[0].matchSnippet).toContain('chain of thought');

      // Verify executed SQL does NOT contain any location terms
      const executedSql = databaseService.query.mock.calls[0][0];
      expect(executedSql).not.toMatch(/country/i);
      expect(executedSql).not.toMatch(/city/i);
      expect(executedSql).not.toMatch(/latitude/i);
      expect(executedSql).not.toMatch(/longitude/i);
    });
  });

  describe('searchUsers', () => {
    it('searches users by username, display name, and bio with shared interest boost', async () => {
      databaseService.query.mockResolvedValueOnce({
        rows: [
          {
            user_id: 'u-42',
            username: 'dev_alex',
            display_name: 'Alex Rivera',
            bio: 'Autonomous systems and reinforcement learning researcher.',
            avatar_url: 'https://cdn.interest.app/alex.jpg',
            followers_count: 4800,
            reels_count: 32,
            is_verified: true,
            shared_interests_count: 3,
            relevance_score: 1.15,
          },
        ],
      });

      const users = await service.searchUsers('viewer-1', 'alex');
      expect(users.length).toBe(1);
      expect(users[0].username).toBe('dev_alex');
      expect(users[0].sharedInterestsCount).toBe(3);
      expect(users[0].isVerified).toBe(true);
    });
  });

  describe('searchHashtags', () => {
    it('searches hashtags and flags trending tags', async () => {
      databaseService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'h-1',
            tag: 'deeplearning',
            reels_count: 85,
            relevance_score: 1.1,
          },
        ],
      });

      const hashtags = await service.searchHashtags('deeplearning');
      expect(hashtags.length).toBe(1);
      expect(hashtags[0].tag).toBe('deeplearning');
      expect(hashtags[0].isTrending).toBe(true);
    });
  });

  describe('searchInterests', () => {
    it('searches taxonomy and resolves category hierarchy', async () => {
      databaseService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'i-1',
            slug: 'prompt-engineering',
            title: 'Prompt Engineering',
            description: 'Designing context prompts for LLMs',
            level: 2,
            icon: '💡',
            reels_count: 450,
            category_title: 'Artificial Intelligence',
            viewer_affinity_weight: 0.95,
            relevance_score: 1.25,
          },
        ],
      });

      const interests = await service.searchInterests('user-1', 'prompt');
      expect(interests.length).toBe(1);
      expect(interests[0].title).toBe('Prompt Engineering');
      expect(interests[0].categoryTitle).toBe('Artificial Intelligence');
      expect(interests[0].viewerAffinityWeight).toBe(0.95);
    });
  });

  describe('searchAudio', () => {
    it('searches audio library by title, artist, and genre', async () => {
      databaseService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'a-1',
            title: 'Midnight Lo-Fi Chill',
            artist: 'BeatCraft',
            genre: 'Lo-Fi',
            audio_url: 'https://cdn.interest.app/lofi.mp3',
            duration_seconds: 60.0,
            cover_url: 'https://cdn.interest.app/cover.jpg',
            reels_count: 1420,
            relevance_score: 1.2,
          },
        ],
      });

      const audio = await service.searchAudio('lo-fi');
      expect(audio.length).toBe(1);
      expect(audio[0].title).toBe('Midnight Lo-Fi Chill');
      expect(audio[0].artist).toBe('BeatCraft');
    });
  });

  describe('getTrendingInterests', () => {
    it('calculates velocity and returns ranked trending interests', async () => {
      databaseService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 't-1',
            slug: 'calisthenics',
            title: 'Calisthenics',
            category_title: 'Fitness',
            icon: '💪',
            total_reels_count: 850,
            recent_reels_count: 42,
          },
        ],
      });

      const trending = await service.getTrendingInterests(5);
      expect(trending.length).toBe(1);
      expect(trending[0].trendingRank).toBe(1);
      expect(trending[0].title).toBe('Calisthenics');
      expect(trending[0].growthPercent).toBeGreaterThan(0);
    });
  });

  describe('getExplorePayload', () => {
    it('aggregates trending interests, recommended topics, creators, audio, and clusters', async () => {
      // 5 calls: trending, recommended, creators, audio, clusters
      databaseService.query
        .mockResolvedValueOnce({ rows: [] }) // trending
        .mockResolvedValueOnce({ rows: [{ id: 'int-1', slug: 'ai', title: 'AI', level: 1, reels_count: 50 }] }) // recommended
        .mockResolvedValueOnce({ rows: [] }) // creators
        .mockResolvedValueOnce({ rows: [] }) // audio
        .mockResolvedValueOnce({ rows: [] }); // clusters

      const payload = await service.getExplorePayload('user-1');
      expect(payload).toHaveProperty('trendingInterests');
      expect(payload).toHaveProperty('recommendedTopics');
      expect(payload).toHaveProperty('featuredCreators');
      expect(payload).toHaveProperty('trendingAudio');
      expect(payload).toHaveProperty('categoryClusters');
    });
  });
});
