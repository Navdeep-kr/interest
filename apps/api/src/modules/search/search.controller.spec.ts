import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { SearchType } from '@interest/shared';

describe('SearchController', () => {
  let controller: SearchController;
  let searchService: jest.Mocked<SearchService>;

  const mockSearchService = {
    search: jest.fn(),
    getTrendingInterests: jest.fn(),
    getExplorePayload: jest.fn(),
    getAudioReels: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        {
          provide: SearchService,
          useValue: mockSearchService,
        },
      ],
    }).compile();

    controller = module.get<SearchController>(SearchController);
    searchService = module.get(SearchService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('search', () => {
    it('delegates query to searchService with viewer userId', async () => {
      mockSearchService.search.mockResolvedValueOnce({
        query: 'ai agent',
        reels: [],
        users: [],
        hashtags: [],
        interests: [],
        audio: [],
        totalCount: 0,
      });

      const res = await controller.search('viewer-123', {
        q: 'ai agent',
        type: SearchType.ALL,
      });

      expect(res.query).toBe('ai agent');
      expect(searchService.search).toHaveBeenCalledWith('viewer-123', {
        q: 'ai agent',
        type: SearchType.ALL,
      });
    });
  });

  describe('getTrendingInterests', () => {
    it('returns trending interests list', async () => {
      mockSearchService.getTrendingInterests.mockResolvedValueOnce([
        {
          id: 't-1',
          slug: 'ai',
          title: 'Artificial Intelligence',
          categoryTitle: 'Technology',
          recentReelsCount: 50,
          growthPercent: 120,
          totalReelsCount: 1500,
          trendingRank: 1,
        },
      ]);

      const res = await controller.getTrendingInterests(10);
      expect(res.length).toBe(1);
      expect(res[0].title).toBe('Artificial Intelligence');
      expect(searchService.getTrendingInterests).toHaveBeenCalledWith(10);
    });
  });

  describe('getExplorePayload', () => {
    it('returns explore payload', async () => {
      mockSearchService.getExplorePayload.mockResolvedValueOnce({
        trendingInterests: [],
        recommendedTopics: [],
        featuredCreators: [],
        trendingAudio: [],
        categoryClusters: [],
      });

      const res = await controller.getExplorePayload('viewer-123');
      expect(res).toHaveProperty('trendingInterests');
      expect(searchService.getExplorePayload).toHaveBeenCalledWith('viewer-123');
    });
  });

  describe('getAudioReels', () => {
    it('returns reels for specific audio track', async () => {
      mockSearchService.getAudioReels.mockResolvedValueOnce([]);

      const res = await controller.getAudioReels('audio-99', 20, 0);
      expect(res).toEqual([]);
      expect(searchService.getAudioReels).toHaveBeenCalledWith('audio-99', 20, 0);
    });
  });
});
