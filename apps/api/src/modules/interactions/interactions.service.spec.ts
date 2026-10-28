import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InteractionsService } from './interactions.service';
import { DatabaseService } from '../../database/database.service';
import { RedisCounterService } from './redis-counter.service';
import { AntiSpamService } from './anti-spam.service';
import { MentionsService } from './mentions.service';

describe('InteractionsService', () => {
  let service: InteractionsService;
  let mockDb: any;
  let mockRedisCounters: any;
  let mockAntiSpam: any;
  let mockMentions: any;

  beforeEach(async () => {
    mockDb = {
      query: jest.fn(),
    };

    mockRedisCounters = {
      incrementReelCounter: jest.fn().mockImplementation((id, field, delta) => Promise.resolve(10 + delta)),
      getReelCounters: jest.fn().mockResolvedValue({ likes: 10, comments: 5, saves: 3, shares: 2 }),
      incrementCommentLikeCount: jest.fn().mockImplementation((id, delta) => Promise.resolve(5 + delta)),
      getCommentLikeCount: jest.fn().mockResolvedValue(5),
      incrementUserCounter: jest.fn().mockResolvedValue(1),
    };

    mockAntiSpam = {
      checkLikeRateLimit: jest.fn().mockResolvedValue(undefined),
      checkCommentRateLimit: jest.fn().mockResolvedValue(undefined),
      checkDuplicateComment: jest.fn().mockResolvedValue(undefined),
      checkFollowRateLimit: jest.fn().mockResolvedValue(undefined),
    };

    mockMentions = {
      extractMentions: jest.fn().mockReturnValue(['techguru']),
      processMentions: jest.fn().mockResolvedValue({
        extractedUsernames: ['techguru'],
        notifiedUserIds: ['user-techguru-uuid'],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InteractionsService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: RedisCounterService, useValue: mockRedisCounters },
        { provide: AntiSpamService, useValue: mockAntiSpam },
        { provide: MentionsService, useValue: mockMentions },
      ],
    }).compile();

    service = module.get<InteractionsService>(InteractionsService);
  });

  describe('Likes', () => {
    it('should like a reel when not previously liked', async () => {
      // Reel exists
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'reel-1', creator_id: 'creator-1', like_count: 5 }] })
        // Existing like check: not liked yet
        .mockResolvedValueOnce({ rows: [] })
        // Insert like
        .mockResolvedValueOnce({ rows: [] })
        // Notification insert
        .mockResolvedValueOnce({ rows: [] });

      const res = await service.toggleReelLike('user-viewer-1', 'reel-1');

      expect(mockAntiSpam.checkLikeRateLimit).toHaveBeenCalledWith('user-viewer-1');
      expect(mockRedisCounters.incrementReelCounter).toHaveBeenCalledWith('reel-1', 'likes', 1);
      expect(res.liked).toBe(true);
      expect(res.reelId).toBe('reel-1');
    });

    it('should unlike a reel when already liked', async () => {
      // Reel exists
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'reel-1', creator_id: 'creator-1', like_count: 6 }] })
        // Existing like check: already liked
        .mockResolvedValueOnce({ rows: [{ 1: 1 }] })
        // Delete like
        .mockResolvedValueOnce({ rows: [] });

      const res = await service.toggleReelLike('user-viewer-1', 'reel-1');

      expect(mockRedisCounters.incrementReelCounter).toHaveBeenCalledWith('reel-1', 'likes', -1);
      expect(res.liked).toBe(false);
    });

    it('should throw NotFoundException if reel does not exist', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.toggleReelLike('user-1', 'missing-reel')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should toggle comment likes cleanly', async () => {
      // Comment exists
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'comm-1', user_id: 'user-2', like_count: 3 }] })
        // Not liked yet
        .mockResolvedValueOnce({ rows: [] })
        // Insert comment like
        .mockResolvedValueOnce({ rows: [] });

      const res = await service.toggleCommentLike('user-1', 'comm-1');
      expect(res.liked).toBe(true);
      expect(mockRedisCounters.incrementCommentLikeCount).toHaveBeenCalledWith('comm-1', 1);
    });
  });

  describe('Threaded Comments', () => {
    it('should add root comment with mentions parsing and creator notification', async () => {
      // Reel exists
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'reel-1', creator_id: 'creator-1' }] })
        // Insert comment
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'comment-1',
              reel_id: 'reel-1',
              user_id: 'user-1',
              parent_id: null,
              text: 'Incredible breakdown! cc @techguru',
              like_count: 0,
              is_pinned: false,
              is_hidden: false,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        })
        // Notification to creator
        .mockResolvedValueOnce({ rows: [] })
        // User query
        .mockResolvedValueOnce({
          rows: [{ id: 'user-1', username: 'learner', display_name: 'Learner', avatar_url: null }],
        });

      const res = await service.addComment('user-1', 'reel-1', {
        text: 'Incredible breakdown! cc @techguru',
      });

      expect(mockAntiSpam.checkCommentRateLimit).toHaveBeenCalledWith('user-1');
      expect(mockAntiSpam.checkDuplicateComment).toHaveBeenCalledWith('user-1', 'Incredible breakdown! cc @techguru');
      expect(mockMentions.processMentions).toHaveBeenCalledWith('user-1', 'Incredible breakdown! cc @techguru', 'comment-1');
      expect(mockRedisCounters.incrementReelCounter).toHaveBeenCalledWith('reel-1', 'comments', 1);
      expect(res.id).toBe('comment-1');
      expect(res.parentId).toBeNull();
      expect(res.mentions).toEqual(['techguru']);
    });

    it('should validate parent comment when creating a threaded reply', async () => {
      // Reel exists
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'reel-1', creator_id: 'creator-1' }] })
        // Parent comment check: belongs to different reel!
        .mockResolvedValueOnce({
          rows: [{ id: 'parent-comm', user_id: 'other-user', reel_id: 'other-reel' }],
        });

      await expect(
        service.addComment('user-1', 'reel-1', {
          text: 'Replying to you',
          parentId: 'parent-comm',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should pin a comment if the caller is the reel creator', async () => {
      // Comment lookup with reel creator
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ id: 'comm-1', reel_id: 'reel-1', is_pinned: false, creator_id: 'creator-1' }],
        })
        // Unpin previous
        .mockResolvedValueOnce({ rows: [] })
        // Pin this one
        .mockResolvedValueOnce({ rows: [] });

      const res = await service.pinComment('creator-1', 'comm-1');
      expect(res.pinned).toBe(true);
      expect(res.commentId).toBe('comm-1');
    });

    it('should forbid comment pinning if caller is not the reel creator', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'comm-1', reel_id: 'reel-1', is_pinned: false, creator_id: 'creator-1' }],
      });

      await expect(service.pinComment('random-user', 'comm-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow author or reel creator to delete a comment', async () => {
      // Comment exists
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ id: 'comm-1', reel_id: 'reel-1', user_id: 'author-user', is_hidden: false, creator_id: 'creator-1' }],
        })
        // Delete comment
        .mockResolvedValueOnce({ rows: [] });

      // Reel creator deletes author comment
      const res = await service.moderateComment('creator-1', 'comm-1', { action: 'delete' });
      expect(res.success).toBe(true);
      expect(mockRedisCounters.incrementReelCounter).toHaveBeenCalledWith('reel-1', 'comments', -1);
    });

    it('should allow only creator to hide a comment', async () => {
      // Comment exists
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'comm-1', reel_id: 'reel-1', user_id: 'author-user', is_hidden: false, creator_id: 'creator-1' }],
      });

      // Random user attempts to hide
      await expect(
        service.moderateComment('random-user', 'comm-1', { action: 'hide' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Saves & Collections', () => {
    it('should toggle reel save and update counters', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'reel-1', save_count: 2 }] })
        .mockResolvedValueOnce({ rows: [] }) // not saved yet
        .mockResolvedValueOnce({ rows: [] }); // insert save

      const res = await service.toggleReelSave('user-1', 'reel-1');
      expect(res.saved).toBe(true);
      expect(mockRedisCounters.incrementReelCounter).toHaveBeenCalledWith('reel-1', 'saves', 1);
    });

    it('should create custom collection', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'col-1',
            user_id: 'user-1',
            name: 'Machine Learning Must-Watch',
            is_private: true,
            reels_count: 0,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const res = await service.createCollection('user-1', {
        name: 'Machine Learning Must-Watch',
        isPrivate: true,
      });

      expect(res.id).toBe('col-1');
      expect(res.name).toBe('Machine Learning Must-Watch');
    });

    it('should add reel to collection and ensure it is saved in default saves', async () => {
      // Collection exists and belongs to user
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'col-1' }] })
        // Check default save
        .mockResolvedValueOnce({ rows: [] })
        // Insert into default saves
        .mockResolvedValueOnce({ rows: [] })
        // Insert into collection_reels
        .mockResolvedValueOnce({ rows: [] })
        // Update collection count
        .mockResolvedValueOnce({ rows: [] });

      const res = await service.addReelToCollection('user-1', 'col-1', 'reel-1');
      expect(res.added).toBe(true);
      expect(mockRedisCounters.incrementReelCounter).toHaveBeenCalledWith('reel-1', 'saves', 1);
    });
  });

  describe('Shares', () => {
    it('should record share and return deep link share URL', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'reel-1' }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await service.recordShare('user-1', 'reel-1', 'whatsapp');
      expect(res.shared).toBe(true);
      expect(res.shareUrl).toBe('https://interest.app/reel/reel-1');
      expect(mockRedisCounters.incrementReelCounter).toHaveBeenCalledWith('reel-1', 'shares', 1);
    });
  });

  describe('Follows Graph', () => {
    it('should prevent self-following', async () => {
      await expect(service.toggleFollow('user-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should follow user and detect mutual follow status', async () => {
      // Target user exists
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'creator-2', followers_count: 10 }] })
        // Not following yet
        .mockResolvedValueOnce({ rows: [] })
        // Insert follow
        .mockResolvedValueOnce({ rows: [] })
        // Insert notification
        .mockResolvedValueOnce({ rows: [] })
        // Mutual check (creator-2 already follows user-1)
        .mockResolvedValueOnce({ rows: [{ 1: 1 }] })
        // Counts
        .mockResolvedValueOnce({ rows: [{ followers_count: '11', following_count: '5' }] });

      const res = await service.toggleFollow('user-1', 'creator-2');
      expect(mockAntiSpam.checkFollowRateLimit).toHaveBeenCalledWith('user-1');
      expect(res.following).toBe(true);
      expect(res.isMutual).toBe(true);
      expect(res.followersCount).toBe(11);
    });
  });

  describe('Duet & Remix Lineage', () => {
    it('should allow remix when permissions are enabled', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'reel-orig',
            creator_id: 'creator-1',
            title: 'Beatbox Loop',
            allow_duet: true,
            allow_remix: true,
            status: 'PUBLISHED',
          },
        ],
      });

      const res = await service.validateCanRemix('reel-orig');
      expect(res.canRemix).toBe(true);
    });

    it('should disallow remix when creator disabled remixes and duets', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'reel-orig',
            creator_id: 'creator-1',
            title: 'Private Vocal',
            allow_duet: false,
            allow_remix: false,
            status: 'PUBLISHED',
          },
        ],
      });

      await expect(service.validateCanRemix('reel-orig')).rejects.toThrow(ForbiddenException);
    });
  });
});
