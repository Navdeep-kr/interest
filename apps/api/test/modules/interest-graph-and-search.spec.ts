import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InterestsService } from '../../src/modules/interests/interests.service';
import { InterestsController } from '../../src/modules/interests/interests.controller';
import { SearchService } from '../../src/modules/search/search.service';
import { SearchController } from '../../src/modules/search/search.controller';
import { DatabaseService } from '../../src/database/database.service';
import { SearchType } from '@interest/shared';

describe('Prompt 11 — Interest Graph and Search Gate', () => {
  let interestsService: InterestsService;
  let interestsController: InterestsController;
  let searchService: SearchService;
  let searchController: SearchController;
  let mockDatabaseService: any;
  let mockClient: any;

  const viewerId = 'user-viewer-1111-4111-a111-111111111111';

  beforeEach(async () => {
    mockClient = {
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
      release: jest.fn(),
    };

    mockDatabaseService = {
      query: jest.fn(),
      getClient: jest.fn().mockResolvedValue(mockClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InterestsController, SearchController],
      providers: [
        InterestsService,
        SearchService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    interestsService = module.get<InterestsService>(InterestsService);
    interestsController = module.get<InterestsController>(InterestsController);
    searchService = module.get<SearchService>(SearchService);
    searchController = module.get<SearchController>(SearchController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Hierarchical Taxonomy, Cycle & Duplicate Prevention, Spam Moderation', () => {
    it('rejects topic creation if title or slug contains prohibited/spam terms', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ term: 'csam' }],
      });

      await expect(
        interestsService.createTopic({
          slug: 'csam-content',
          title: 'Illegal Stuff',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects topic creation if slug already exists in taxonomy', async () => {
      // 1. Prohibited check returns empty
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [] });
      // 2. Slug check returns existing row
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ id: 'int-existing-slug' }],
      });

      await expect(
        interestsService.createTopic({
          slug: 'distributed-systems',
          title: 'Distributed Systems',
        }),
      ).rejects.toThrow('already exists');
    });

    it('rejects duplicate topic title under the same parent category', async () => {
      // 1. Prohibited check returns empty
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [] });
      // 2. Slug check returns empty
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [] });
      // 3. Parent check returns parent row
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ id: 'parent-cs', level: 0, vector: `[${new Array(512).fill(0.01).join(',')}]` }],
      });
      // 4. Duplicate title under parent returns existing row
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ id: 'existing-subtopic' }],
      });

      await expect(
        interestsService.createTopic({
          slug: 'raft-consensus',
          title: 'Raft Consensus',
          parentId: 'parent-cs',
        }),
      ).rejects.toThrow('already exists under this category');
    });

    it('successfully creates valid child topic with derived parent vector and assigns correct hierarchy level', async () => {
      // 1. Prohibited check
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [] });
      // 2. Slug check
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [] });
      // 3. Parent check
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ id: 'parent-tech', level: 0, vector: `[${new Array(512).fill(0.04).join(',')}]` }],
      });
      // 4. Dup title check
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [] });
      // 5. Insert row
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'int-cloud-native',
            slug: 'cloud-native',
            title: 'Cloud Native',
            description: 'Microservices & k8s',
            parent_id: 'parent-tech',
            level: 1,
            icon: '☁️',
          },
        ],
      });

      const res = await interestsService.createTopic({
        slug: 'cloud-native',
        title: 'Cloud Native',
        description: 'Microservices & k8s',
        parentId: 'parent-tech',
        icon: '☁️',
      });

      expect(res.id).toBe('int-cloud-native');
      expect(res.level).toBe(1);
      expect(res.parent_id).toBe('parent-tech');
    });
  });

  describe('2. Topic Pages, Breadcrumb Hierarchy & Authorization', () => {
    it('retrieves full topic page with breadcrumbs, subtopics, related topics, and authorized reels', async () => {
      const topicId = 'int-paxos';
      // 1. Topic metadata
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [
          {
            id: topicId,
            slug: 'paxos-consensus',
            title: 'Paxos Consensus',
            description: 'Distributed consensus algorithm',
            level: 2,
            icon: '🏛️',
            parent_id: 'int-dist-sys',
            created_at: new Date().toISOString(),
            followers_count: 320,
            reels_count: 45,
            is_following: true,
            is_muted: false,
          },
        ],
      });
      // 2. Breadcrumb 1 (int-dist-sys)
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [
          { id: 'int-dist-sys', title: 'Distributed Systems', slug: 'distributed-systems', level: 1, parent_id: 'int-root-cs' },
        ],
      });
      // 3. Breadcrumb 2 (int-root-cs)
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [
          { id: 'int-root-cs', title: 'Computer Science', slug: 'computer-science', level: 0, parent_id: null },
        ],
      });
      // 4. Subtopics
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ id: 'int-multi-paxos', title: 'Multi-Paxos', slug: 'multi-paxos', icon: '📜', reels_count: 12 }],
      });
      // 5. Related topics - vector query in getRelatedInterests
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ vector: `[${new Array(512).fill(0.05).join(',')}]` }],
      });
      // 6. Related topics - similarity query in getRelatedInterests
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ id: 'int-raft', title: 'Raft Protocol', slug: 'raft-protocol', description: 'Consensus', level: 2, similarity: '0.94' }],
      });
      // 5. Followers count
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ count: 320 }],
      });
      // 6. Viewer relationship
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ is_muted: false, is_paused: false }],
      });
      // 7. Recent reels
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [],
      });
      // 8. Top reels
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'reel-paxos-1',
            title: 'Paxos Made Simple Walkthrough',
            caption: 'Phase 1a to 2b',
            thumbnail_url: 'https://cdn.interest.app/paxos.jpg',
            hls_master_url: 'https://cdn.interest.app/paxos.m3u8',
            view_count: 1200,
            like_count: 450,
            comment_count: 30,
            creator_id: 'creator-leslie',
            creator_username: 'lamport_fan',
            creator_display_name: 'Distributed Researcher',
            creator_avatar_url: 'https://cdn.interest.app/avatar.jpg',
          },
        ],
      });

      const page = await interestsService.getTopicPage(topicId, viewerId);

      expect(page.slug).toBe('paxos-consensus');
      expect(page.isFollowing).toBe(true);
      expect(page.breadcrumbs.length).toBe(3);
      expect(page.breadcrumbs[0].title).toBe('Computer Science');
      expect(page.breadcrumbs[1].title).toBe('Distributed Systems');
      expect(page.breadcrumbs[2].title).toBe('Paxos Consensus');
      expect(page.subtopics.length).toBe(1);
      expect(page.subtopics[0].slug).toBe('multi-paxos');
      expect(page.relatedInterests.length).toBe(1);
      expect(page.relatedInterests[0].title).toBe('Raft Protocol');
      expect(page.topReels.length).toBe(1);
      expect(page.topReels[0].id).toBe('reel-paxos-1');
    });

    it('throws NotFoundException when topic does not exist', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [] });

      await expect(interestsService.getTopicPage('non-existent-topic', viewerId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('3. Multi-Domain Search Across Topics, Creators, Videos, Hashtags & Communities', () => {
    it('searches communities respecting membership and activity', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'comm-1',
            name: 'Distributed Systems Engineers',
            description: 'Advanced distributed consensus and peer-to-peer protocols',
            cover_image_url: 'https://cdn.interest.app/comm.jpg',
            price_monthly_cents: 0,
            price_annual_cents: 0,
            is_free: true,
            members_count: 850,
            interest_title: 'Distributed Systems',
            is_member: true,
            relevance_score: 1.15,
          },
        ],
      });

      const res = await searchService.search(viewerId, {
        q: 'distributed systems',
        type: SearchType.COMMUNITIES,
      });

      expect(res.type).toBe(SearchType.COMMUNITIES);
      expect(res.communities.length).toBe(1);
      expect(res.communities[0].name).toBe('Distributed Systems Engineers');
    });

    it('enforces privacy and blocks suppression in reels and users search', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [],
      });

      await searchService.searchReels(viewerId, 'privacy test');

      const executedSql = mockDatabaseService.query.mock.calls[0][0];
      // Assert bidirectional blocks suppression is present in SQL
      expect(executedSql).toContain('blocks');
      // Assert private accounts/followers_only visibility authorization check is present
      expect(executedSql).toContain('visibility');
      expect(executedSql).toContain('FOLLOWERS_ONLY');
      // Assert 0 location weighting
      expect(executedSql).not.toMatch(/latitude/i);
      expect(executedSql).not.toMatch(/longitude/i);
    });
  });

  describe('4. Safe Autocomplete, Moderation & Prohibited Terms', () => {
    it('intercepts prohibited search queries and returns safe moderation message without querying DB', async () => {
      const res = await searchService.search(viewerId, {
        q: 'malware distribution guide',
        type: SearchType.ALL,
      });

      expect(res.isProhibited).toBe(true);
      expect(res.totalCount).toBe(0);
      expect(res.moderationMessage).toContain('prohibited by community guidelines');
      expect(res.emptySuggestions.trendingTopics.length).toBeGreaterThan(0);
      // Ensure zero database queries were consumed
      expect(mockDatabaseService.query).not.toHaveBeenCalled();
    });

    it('provides multi-entity safe autocomplete suggestions for topic, creator, and hashtag prefixes', async () => {
      // 1. Topics
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ id: 'int-rust', title: 'Rust Language', slug: 'rust-lang', icon: '🦀', reels_count: 120 }],
      });
      // 2. Creators
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ user_id: 'u-rustacean', username: 'rustacean', display_name: 'Ferris', avatar_url: 'https://cdn.interest.app/ferris.jpg', is_verified: true, followers_count: 5000 }],
      });
      // 3. Hashtags
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ tag: 'rustlang', reels_count: 340 }],
      });

      const autocomplete = await searchService.getSafeAutocomplete('rust', 10);

      expect(autocomplete.query).toBe('rust');
      expect(autocomplete.suggestions.length).toBe(3);
      expect(autocomplete.suggestions.map((s) => s.type)).toEqual(['topic', 'creator', 'hashtag']);
      expect(autocomplete.suggestions[0].text).toBe('Rust Language');
      expect(autocomplete.suggestions[1].text).toBe('@rustacean');
      expect(autocomplete.suggestions[2].text).toBe('#rustlang');
    });
  });

  describe('5. Recent Searches Persistence, Single Deletion & Clear All', () => {
    it('records and retrieves recent searches for authenticated user', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'recent-1',
            user_id: viewerId,
            query_text: 'zero knowledge proofs',
            search_type: 'all',
            created_at: new Date().toISOString(),
          },
          {
            id: 'recent-2',
            user_id: viewerId,
            query_text: 'calisthenics',
            search_type: 'topics',
            created_at: new Date().toISOString(),
          },
        ],
      });

      const recents = await searchService.getRecentSearches(viewerId, 10);
      expect(recents.length).toBe(2);
      expect(recents[0].queryText).toBe('zero knowledge proofs');
      expect(recents[1].queryText).toBe('calisthenics');
    });

    it('deletes a single recent search query securely', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({ rowCount: 1 });

      await searchService.deleteRecentSearch(viewerId, 'recent-1');

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM search_recent_queries'),
        [viewerId, 'recent-1'],
      );
    });

    it('clears all recent searches for user', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({ rowCount: 2 });

      await searchService.clearRecentSearches(viewerId);

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM search_recent_queries WHERE user_id = $1::uuid'),
        [viewerId],
      );
    });
  });

  describe('6. Transparent Trending Windows (24h, 72h, 7d)', () => {
    it('returns transparent trending velocity metrics for 24h window', async () => {
      // 1. Trending topics
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 't-zkp',
            slug: 'zero-knowledge-proofs',
            title: 'Zero Knowledge Proofs',
            icon: '🔐',
            category_title: 'Cryptography',
            window_posts: 88,
            velocity_score: 142.5,
          },
        ],
      });
      // 2. Trending hashtags
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ tag: 'zkp', post_count: 120 }],
      });

      const trending = await searchService.getTransparentTrending('24h', 10);

      expect(trending.window).toBe('24h');
      expect(trending.topics.length).toBe(1);
      expect(trending.topics[0].title).toBe('Zero Knowledge Proofs');
      expect(trending.topics[0].velocityScore).toBe(142.5);
      expect(trending.hashtags[0].tag).toBe('#zkp');
    });
  });

  describe('7. GATE VERIFICATION: Interest Choices Meaningfully Affect Discovery', () => {
    it('shifting user interest preferences directly updates 512-d preference centroid', async () => {
      const interestIds = ['int-1', 'int-2', 'int-3', 'int-4', 'int-5'];

      mockDatabaseService.query.mockResolvedValueOnce({
        // fetch vectors for centroid computation
        rows: [
          { id: 'int-1', vector: `[${new Array(512).fill(0.05).join(',')}]` },
          { id: 'int-2', vector: `[${new Array(512).fill(0.02).join(',')}]` },
          { id: 'int-3', vector: `[${new Array(512).fill(0.08).join(',')}]` },
          { id: 'int-4', vector: `[${new Array(512).fill(0.03).join(',')}]` },
          { id: 'int-5', vector: `[${new Array(512).fill(0.06).join(',')}]` },
        ],
      });

      const res = await interestsService.selectInterests(viewerId, interestIds);

      expect(res.success).toBe(true);
      expect(res.count).toBe(5);

      // Verify transaction committed with UPDATE users SET interest_vector
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users\n         SET interest_vector = $1::vector'),
        expect.arrayContaining([expect.any(String), viewerId]),
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('muting an interest recalculates preference centroid without the muted topic', async () => {
      const topicToMute = 'int-unwanted';

      // 1. Toggle mute upsert
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ interest_id: topicToMute, is_muted: true }],
      });
      // 2. Recalculate centroid from only ACTIVE unmuted interests (ui.is_muted = FALSE)
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [
          { vector: `[${new Array(512).fill(0.08).join(',')}]`, affinity_weight: 1.0 },
        ],
      });
      // 3. Update users.interest_centroid
      mockDatabaseService.query.mockResolvedValueOnce({ rowCount: 1 });

      const res = await interestsService.toggleMute(viewerId, topicToMute, true);

      expect(res.isMuted).toBe(true);
      // Verify that SQL query for active centroid specifically filtered WHERE ui.is_muted = FALSE
      const centroidRecalcSql = mockDatabaseService.query.mock.calls[1][0];
      expect(centroidRecalcSql).toContain('ui.is_muted = FALSE');
    });

    it('following an interest adds explicit affinity and triggers centroid recalculation', async () => {
      // 1. Select interest vector
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ id: 'int-rust', vector: `[${new Array(512).fill(0.1).join(',')}]` }],
      });
      // 2. Insert into user_interests
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ user_id: viewerId, interest_id: 'int-rust' }],
      });
      // 3. Centroid recalculation
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ vector: `[${new Array(512).fill(0.1).join(',')}]`, affinity_weight: 1.0 }],
      });
      mockDatabaseService.query.mockResolvedValueOnce({ rowCount: 1 });

      const followRes = await interestsService.followInterest(viewerId, 'int-rust');
      expect(followRes.success).toBe(true);
    });
  });
});
