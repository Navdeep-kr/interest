import { Test, TestingModule } from '@nestjs/testing';
import { ReelsService } from '../../src/modules/reels/reels.service';
import { InteractionsService } from '../../src/modules/interactions/interactions.service';
import { DatabaseService } from '../../src/database/database.service';
import { StorageService } from '../../src/modules/storage/storage.service';
import { AiInterestSuggesterService } from '../../src/modules/reels/ai-interest-suggester.service';
import { RedisCounterService } from '../../src/modules/interactions/redis-counter.service';
import { AntiSpamService } from '../../src/modules/interactions/anti-spam.service';
import { MentionsService } from '../../src/modules/interactions/mentions.service';
import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ReelVisibility, ReelStatus } from '@shared/types';

describe('Prompt 8 — Posts, Reels and Engagement Integration & Invariants', () => {
  let reelsService: ReelsService;
  let interactionsService: InteractionsService;
  let mockDb: any;
  let mockStorage: any;
  let mockRedisCounters: any;
  let mockAntiSpam: any;
  let mockMentions: any;
  let mockQueue: any;
  let mockClient: any;

  const creatorId = '11111111-1111-1111-1111-111111111111'; // User A (Creator)
  const viewerId = '22222222-2222-2222-2222-222222222222'; // User B (Viewer / Interactor)
  const primaryInterestId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  beforeEach(async () => {
    mockClient = {
      query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [] }),
      release: jest.fn(),
    };

    mockDb = {
      query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
      getClient: jest.fn().mockResolvedValue(mockClient),
      withTransaction: jest.fn().mockImplementation((cb) => cb(mockClient)),
    };

    mockStorage = {
      getPresignedUploadUrl: jest.fn().mockResolvedValue('https://s3.example.com/upload'),
      initiateMultipartUpload: jest.fn().mockResolvedValue('upload-123'),
      getPresignedPartUrl: jest.fn().mockResolvedValue('https://s3.example.com/part-1'),
      completeMultipartUpload: jest.fn().mockResolvedValue('https://cdn.interest.app/video.mp4'),
    };

    let reelLikes = 0;
    let reelComments = 0;
    let reelSaves = 0;
    let reelShares = 0;

    mockRedisCounters = {
      incrementReelCounter: jest.fn().mockImplementation((id, field, delta) => {
        if (field === 'likes') reelLikes += delta;
        if (field === 'comments') reelComments += delta;
        if (field === 'saves') reelSaves += delta;
        if (field === 'shares') reelShares += delta;
        return Promise.resolve(10 + delta);
      }),
      getReelCounters: jest.fn().mockImplementation((id, fallback) =>
        Promise.resolve({
          likes: fallback?.likes ?? 0,
          comments: fallback?.comments ?? 0,
          saves: fallback?.saves ?? 0,
          shares: fallback?.shares ?? 0,
        }),
      ),
      getReelLikeCount: jest.fn().mockImplementation((id, fallback) => Promise.resolve(fallback)),
      getReelCommentCount: jest.fn().mockImplementation((id, fallback) => Promise.resolve(fallback)),
      incrementCommentLikeCount: jest.fn().mockImplementation((id, delta) => Promise.resolve(1 + delta)),
      getCommentLikeCount: jest.fn().mockResolvedValue(1),
      incrementUserCounter: jest.fn().mockResolvedValue(1),
    };

    mockAntiSpam = {
      checkLikeRateLimit: jest.fn().mockResolvedValue(undefined),
      checkCommentRateLimit: jest.fn().mockResolvedValue(undefined),
      checkDuplicateComment: jest.fn().mockResolvedValue(undefined),
      checkFollowRateLimit: jest.fn().mockResolvedValue(undefined),
    };

    mockMentions = {
      extractMentions: jest.fn().mockImplementation((text: string) => {
        if (text.includes('@creator_a')) return ['creator_a'];
        return [];
      }),
      processMentions: jest.fn().mockResolvedValue({
        extractedUsernames: ['creator_a'],
        notifiedUserIds: [creatorId],
      }),
    };

    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-transcode-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReelsService,
        InteractionsService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: StorageService, useValue: mockStorage },
        { provide: RedisCounterService, useValue: mockRedisCounters },
        { provide: AntiSpamService, useValue: mockAntiSpam },
        { provide: MentionsService, useValue: mockMentions },
        {
          provide: AiInterestSuggesterService,
          useValue: { suggestInterests: jest.fn().mockResolvedValue([]) },
        },
        { provide: getQueueToken('video-transcode'), useValue: mockQueue },
      ],
    }).compile();

    reelsService = module.get<ReelsService>(ReelsService);
    interactionsService = module.get<InteractionsService>(InteractionsService);
  });

  // ==========================================================================
  // 1. PUBLISHING: VIDEO REELS & IMAGE POSTS (ZERO-LOCATION INVARIANT)
  // ==========================================================================
  describe('Publishing Posts & Reels', () => {
    it('should create an image/photo post with 1-5 interest tags and sterilize coordinates from caption', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'image-post-1',
              creator_id: creatorId,
              title: 'Autonomous Multi-Agent Architecture Diagram',
              caption: 'Clean distributed system diagram',
              thumbnail_url: 'https://cdn.interest.app/images/arch1.jpg',
              hls_master_url: 'https://cdn.interest.app/images/arch1.jpg',
              duration_seconds: 0,
              view_count: 0,
              like_count: 0,
              comment_count: 0,
              save_count: 0,
              share_count: 0,
              status: ReelStatus.PUBLISHED,
              visibility: ReelVisibility.PUBLIC,
              is_pinned: false,
              media_type: 'IMAGE',
              image_urls: ['https://cdn.interest.app/images/arch1.jpg'],
              hashtags: ['ai', 'architecture'],
              username: 'creator_a',
              display_name: 'Creator A',
              interests: [{ id: primaryInterestId, slug: 'ai-agents', title: 'AI Agents', is_primary: true }],
              created_at: new Date(),
            },
          ],
        });

      const post = await reelsService.createImagePost(creatorId, {
        title: 'Autonomous Multi-Agent Architecture Diagram',
        caption: 'Clean distributed system diagram at 37.7749, -122.4194 in Tokyo Japan near me',
        imageUrls: ['https://cdn.interest.app/images/arch1.jpg'],
        primaryInterestId,
        hashtags: ['ai', 'architecture'],
        visibility: ReelVisibility.PUBLIC,
      });

      expect(post.mediaType).toBe('IMAGE');
      expect(post.title).toBe('Autonomous Multi-Agent Architecture Diagram');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE profiles SET reels_count = reels_count + 1'),
        [creatorId],
      );

      // Verify that SQL insert did NOT contain coordinate tokens
      const insertCall = mockClient.query.mock.calls.find((call: any) =>
        call[0].includes('INSERT INTO reels'),
      );
      expect(insertCall).toBeDefined();
      const captionParam = insertCall[1][3];
      expect(captionParam).not.toContain('37.7749');
      expect(captionParam).not.toContain('-122.4194');
      expect(captionParam).not.toContain('Tokyo');
      expect(captionParam).not.toContain('near me');
    });

    it('should reject image posts with 0 images or more than 10 images', async () => {
      await expect(
        reelsService.createImagePost(creatorId, {
          title: 'Empty Post',
          imageUrls: [],
          primaryInterestId,
        }),
      ).rejects.toThrow(BadRequestException);

      const elevenImages = Array.from({ length: 11 }, (_, i) => `https://cdn.interest.app/img_${i}.jpg`);
      await expect(
        reelsService.createImagePost(creatorId, {
          title: 'Too Many Images',
          imageUrls: elevenImages,
          primaryInterestId,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================================================================
  // 2. ENGAGEMENT: LIKES & UNLIKES (ATOMIC COUNTERS & OPTIMISTIC ROLLBACK)
  // ==========================================================================
  describe('Engagement: Likes and Unlikes', () => {
    it('User B likes User A reel -> increments live counter and dispatches notification', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'reel-100', creator_id: creatorId, like_count: 10 }] }) // Reel exists
        .mockResolvedValueOnce({ rows: [] }) // No prior like
        .mockResolvedValueOnce({ rows: [] }) // Insert like
        .mockResolvedValueOnce({ rows: [] }); // Notification insert

      const res = await interactionsService.toggleReelLike(viewerId, 'reel-100');

      expect(res.liked).toBe(true);
      expect(mockRedisCounters.incrementReelCounter).toHaveBeenCalledWith('reel-100', 'likes', 1);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notifications'),
        expect.arrayContaining([creatorId, viewerId, 'reel-100']),
      );
    });

    it('User B unlikes User A reel -> decrements live counter cleanly', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'reel-100', creator_id: creatorId, like_count: 11 }] }) // Reel exists
        .mockResolvedValueOnce({ rows: [{ 1: 1 }] }) // Prior like exists
        .mockResolvedValueOnce({ rows: [] }); // Delete like

      const res = await interactionsService.toggleReelLike(viewerId, 'reel-100');

      expect(res.liked).toBe(false);
      expect(mockRedisCounters.incrementReelCounter).toHaveBeenCalledWith('reel-100', 'likes', -1);
    });
  });

  // ==========================================================================
  // 3. THREADED COMMENTS, REPLIES, PINNING & MODERATION
  // ==========================================================================
  describe('Engagement: Threaded Comments, Replies & Moderation', () => {
    it('User B comments on User A reel -> extracts mentions and increments comment counter', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'reel-100', creator_id: creatorId }] }) // Reel exists
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'comment-1',
              reel_id: 'reel-100',
              user_id: viewerId,
              parent_id: null,
              text: 'Incredible breakdown @creator_a!',
              like_count: 0,
              is_pinned: false,
              is_hidden: false,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        }) // Insert comment
        .mockResolvedValueOnce({ rows: [] }) // Creator notification
        .mockResolvedValueOnce({
          rows: [{ id: viewerId, username: 'viewer_b', display_name: 'Viewer B' }],
        }); // User profile

      const comment = await interactionsService.addComment(viewerId, 'reel-100', {
        text: 'Incredible breakdown @creator_a!',
      });

      expect(comment.text).toBe('Incredible breakdown @creator_a!');
      expect(comment.mentions).toContain('creator_a');
      expect(mockRedisCounters.incrementReelCounter).toHaveBeenCalledWith('reel-100', 'comments', 1);
      expect(mockMentions.processMentions).toHaveBeenCalledWith(
        viewerId,
        'Incredible breakdown @creator_a!',
        'comment-1',
      );
    });

    it('User A (Creator) pins User B comment -> comment becomes pinned', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ id: 'comment-1', reel_id: 'reel-100', is_pinned: false, creator_id: creatorId }],
        })
        .mockResolvedValueOnce({ rows: [] }) // Unpin other comments
        .mockResolvedValueOnce({ rows: [] }); // Pin this comment

      const res = await interactionsService.pinComment(creatorId, 'comment-1');

      expect(res.pinned).toBe(true);
      expect(res.commentId).toBe('comment-1');
    });

    it('User B attempts to pin comment on User A reel -> rejected with 403 Forbidden', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'comment-1', reel_id: 'reel-100', is_pinned: false, creator_id: creatorId }],
      });

      await expect(interactionsService.pinComment(viewerId, 'comment-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('Comment author or reel creator can delete comment', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ id: 'comment-1', reel_id: 'reel-100', user_id: viewerId, creator_id: creatorId }],
        })
        .mockResolvedValueOnce({ rows: [] }); // Delete

      const res = await interactionsService.moderateComment(viewerId, 'comment-1', {
        action: 'delete',
      });
      expect(res.success).toBe(true);
      expect(res.action).toBe('delete');
      expect(mockRedisCounters.incrementReelCounter).toHaveBeenCalledWith('reel-100', 'comments', -1);
    });
  });

  // ==========================================================================
  // 4. SAVES, BOOKMARKS & COLLECTIONS
  // ==========================================================================
  describe('Engagement: Saves and Collections', () => {
    it('User B saves reel -> increments save counter', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'reel-100', save_count: 5 }] }) // Reel exists
        .mockResolvedValueOnce({ rows: [] }) // Not saved yet
        .mockResolvedValueOnce({ rows: [] }); // Insert save

      const res = await interactionsService.toggleReelSave(viewerId, 'reel-100');

      expect(res.saved).toBe(true);
      expect(mockRedisCounters.incrementReelCounter).toHaveBeenCalledWith('reel-100', 'saves', 1);
    });

    it('User B creates a private collection and adds reel', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'col-1',
              user_id: viewerId,
              name: 'Architecture Highlights',
              is_private: true,
              reels_count: 0,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        }) // Create collection
        .mockResolvedValueOnce({ rows: [{ id: 'col-1' }] }) // Collection exists
        .mockResolvedValueOnce({ rows: [{ id: 'reel-100' }] }) // Reel exists
        .mockResolvedValueOnce({ rows: [] }) // Insert into collection_reels
        .mockResolvedValueOnce({ rows: [] }); // Update collection count

      const col = await interactionsService.createCollection(viewerId, {
        name: 'Architecture Highlights',
        isPrivate: true,
      });
      expect(col.name).toBe('Architecture Highlights');
      expect(col.isPrivate).toBe(true);

      const addRes = await interactionsService.addReelToCollection(viewerId, 'col-1', 'reel-100');
      expect(addRes.added).toBe(true);
      expect(addRes.collectionId).toBe('col-1');
      expect(addRes.reelId).toBe('reel-100');
    });

    it('User A cannot view User B private collection (403 Forbidden)', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'col-1',
            user_id: viewerId,
            name: 'Architecture Highlights',
            is_private: true,
            reels_count: 1,
          },
        ],
      });

      await expect(
        interactionsService.getCollectionReels(creatorId, 'col-1', 20, 0),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ==========================================================================
  // 5. SHARES & REPOSTS
  // ==========================================================================
  describe('Engagement: Shares', () => {
    it('User B records a share -> increments share counter and returns canonical URL', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'reel-100' }] }) // Reel exists
        .mockResolvedValueOnce({ rows: [] }); // Insert share

      const res = await interactionsService.recordShare(viewerId, 'reel-100', 'whatsapp');

      expect(res.shared).toBe(true);
      expect(res.shareUrl).toBe('https://interest.app/reel/reel-100');
      expect(mockRedisCounters.incrementReelCounter).toHaveBeenCalledWith('reel-100', 'shares', 1);
    });
  });

  // ==========================================================================
  // 6. EDITING & PINNED POSTS RULES
  // ==========================================================================
  describe('Editing & Pinned Posts Rules', () => {
    it('Creator can pin up to 3 posts on profile; 4th attempt is rejected', async () => {
      // Find reel and verify owner (passes)
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ id: 'reel-100', creator_id: creatorId }],
        })
        // Check current pinned count: already 3 pinned
        .mockResolvedValueOnce({
          rows: [{ count: 3 }],
        });

      await expect(reelsService.pinReel(creatorId, 'reel-100')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('Creator can successfully pin a reel when count < 3', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ id: 'reel-100', creator_id: creatorId }],
        })
        .mockResolvedValueOnce({
          rows: [{ count: 2 }],
        }) // Count < 3
        .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE reels
        // getReelById call
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'reel-100',
              creator_id: creatorId,
              title: 'Pinned Architecture',
              is_pinned: true,
              like_count: 5,
              created_at: new Date(),
              interests: [],
            },
          ],
        });

      const updated = await reelsService.pinReel(creatorId, 'reel-100');
      expect(updated.isPinned).toBe(true);
    });
  });

  // ==========================================================================
  // 7. VISIBILITY CONTROLS & HIDING
  // ==========================================================================
  describe('Visibility Controls & Content Hiding', () => {
    it('Non-follower cannot view FOLLOWERS_ONLY reel', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'reel-f-only',
              creator_id: creatorId,
              title: 'Followers Secret',
              visibility: ReelVisibility.FOLLOWERS_ONLY,
              is_pinned: false,
              created_at: new Date(),
              interests: [],
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // No block
        .mockResolvedValueOnce({ rows: [] }); // Not following

      await expect(reelsService.getReelById('reel-f-only', viewerId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('User B hides User A reel -> inserted into user_hidden_reels', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'reel-100' }] }) // Reel exists
        .mockResolvedValueOnce({ rowCount: 1 }); // Insert hidden reel

      const res = await reelsService.hideReel(viewerId, 'reel-100');
      expect(res.hidden).toBe(true);
      expect(res.reelId).toBe('reel-100');
    });

    it('User B unhides reel -> deleted from user_hidden_reels', async () => {
      mockDb.query.mockResolvedValueOnce({ rowCount: 1 });

      const res = await reelsService.unhideReel(viewerId, 'reel-100');
      expect(res.hidden).toBe(false);
      expect(res.reelId).toBe('reel-100');
    });
  });

  // ==========================================================================
  // 8. DELETION RULES
  // ==========================================================================
  describe('Reel Deletion Rules', () => {
    it('Non-creator cannot delete reel (403 Forbidden)', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'reel-100', creator_id: creatorId }],
      });

      await expect(reelsService.deleteReel(viewerId, 'reel-100')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('Creator can delete reel, triggering cascade and decrementing profile reels count', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'reel-100', creator_id: creatorId }],
      });

      const res = await reelsService.deleteReel(creatorId, 'reel-100');
      expect(res.deleted).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM reels WHERE id = $1'),
        ['reel-100'],
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE profiles SET reels_count = GREATEST(0, reels_count - 1)'),
        [creatorId],
      );
    });
  });
});
