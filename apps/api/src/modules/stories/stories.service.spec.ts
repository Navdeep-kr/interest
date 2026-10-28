import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { StoriesService } from './stories.service';
import { DatabaseService } from '../../database/database.service';

describe('StoriesService', () => {
  let service: StoriesService;
  let databaseService: DatabaseService;

  const mockDb = {
    query: jest.fn(),
  };

  beforeEach(async () => {
    mockDb.query.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoriesService,
        {
          provide: DatabaseService,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<StoriesService>(StoriesService);
    databaseService = module.get<DatabaseService>(DatabaseService);
  });

  describe('createStory', () => {
    it('creates story with 24-hour expiry and returns StoryItem', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 3600 * 1000);

      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'story-1',
              creator_id: 'user-1',
              media_type: 'PHOTO',
              media_url: 'https://cdn.interest.app/stories/photo1.jpg',
              thumbnail_url: null,
              duration_seconds: '5.0',
              caption: 'Morning coffee',
              text_overlays: '[]',
              audience: 'PUBLIC',
              allow_replies: 'ALL',
              created_at: now,
              expires_at: expiresAt,
              deleted_at: null,
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'user-1',
              username: 'alice',
              display_name: 'Alice',
              avatar_url: 'https://cdn.interest.app/avatars/alice.jpg',
              is_verified: true,
            },
          ],
        });

      const story = await service.createStory('user-1', {
        mediaType: 'PHOTO',
        mediaUrl: 'https://cdn.interest.app/stories/photo1.jpg',
        caption: 'Morning coffee',
        audience: 'PUBLIC',
      });

      expect(story.id).toBe('story-1');
      expect(story.creator.username).toBe('alice');
      expect(story.mediaType).toBe('PHOTO');
      expect(story.isExpired).toBe(false);
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('rejects prohibited spam terms in caption', async () => {
      await expect(
        service.createStory('user-1', {
          mediaType: 'PHOTO',
          mediaUrl: 'https://cdn.interest.app/stories/spam.jpg',
          caption: 'Click here for free followers and likes!',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getStoryById — Expiry, Deletion & Privacy Gates', () => {
    it('throws NotFoundException when story is expired', async () => {
      const pastExpiry = new Date(Date.now() - 3600000); // 1 hour ago

      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'story-expired-1',
            creator_id: 'creator-1',
            creator_username: 'bob',
            creator_display_name: 'Bob',
            creator_avatar_url: null,
            creator_is_verified: false,
            media_type: 'PHOTO',
            media_url: 'https://cdn.interest.app/stories/exp.jpg',
            duration_seconds: '5.0',
            caption: 'Old story',
            text_overlays: '[]',
            audience: 'PUBLIC',
            allow_replies: 'ALL',
            created_at: new Date(Date.now() - 90000000),
            expires_at: pastExpiry,
            deleted_at: null,
          },
        ],
      });

      await expect(service.getStoryById('viewer-1', 'story-expired-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when story is soft-deleted', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'story-del-1',
            creator_id: 'creator-1',
            creator_username: 'bob',
            creator_display_name: 'Bob',
            media_type: 'PHOTO',
            media_url: 'https://cdn.interest.app/stories/del.jpg',
            duration_seconds: '5.0',
            caption: 'Deleted story',
            audience: 'PUBLIC',
            allow_replies: 'ALL',
            created_at: new Date(),
            expires_at: new Date(Date.now() + 3600000),
            deleted_at: new Date(),
          },
        ],
      });

      await expect(service.getStoryById('viewer-1', 'story-del-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when creator has blocked viewer', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'story-blocked-1',
              creator_id: 'creator-blocked',
              creator_username: 'blocked_user',
              creator_display_name: 'Blocked User',
              media_type: 'PHOTO',
              media_url: 'https://cdn.interest.app/stories/block.jpg',
              duration_seconds: '5.0',
              caption: 'Secret story',
              audience: 'PUBLIC',
              allow_replies: 'ALL',
              created_at: new Date(),
              expires_at: new Date(Date.now() + 3600000),
              deleted_at: null,
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ blocker_id: 'creator-blocked', blocked_id: 'viewer-1' }],
        });

      await expect(service.getStoryById('viewer-1', 'story-blocked-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException when followers-only story is viewed by non-follower', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'story-fol-1',
              creator_id: 'creator-priv',
              creator_username: 'priv_user',
              creator_display_name: 'Private Creator',
              media_type: 'PHOTO',
              media_url: 'https://cdn.interest.app/stories/priv.jpg',
              duration_seconds: '5.0',
              caption: 'Followers only',
              audience: 'FOLLOWERS_ONLY',
              allow_replies: 'ALL',
              created_at: new Date(),
              expires_at: new Date(Date.now() + 3600000),
              deleted_at: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // no block
        .mockResolvedValueOnce({ rows: [] }); // follow check returned 0 rows

      await expect(service.getStoryById('viewer-non-fol', 'story-fol-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('Viewing Progress, Reactions & Replies', () => {
    it('records view progress for authorized story', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'story-view-1',
              creator_id: 'creator-1',
              creator_username: 'creator1',
              creator_display_name: 'Creator',
              media_type: 'PHOTO',
              media_url: 'https://cdn.interest.app/stories/v.jpg',
              duration_seconds: '5.0',
              caption: 'View me',
              audience: 'PUBLIC',
              allow_replies: 'ALL',
              created_at: new Date(),
              expires_at: new Date(Date.now() + 3600000),
              deleted_at: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // block check
        .mockResolvedValueOnce({ rows: [] }); // insert view

      const res = await service.recordView('viewer-1', 'story-view-1', {
        progressPercent: 1.0,
        completed: true,
      });

      expect(res.recorded).toBe(true);
      expect(res.storyId).toBe('story-view-1');
    });

    it('records reaction to story', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'story-react-1',
              creator_id: 'creator-1',
              creator_username: 'creator1',
              creator_display_name: 'Creator',
              media_type: 'PHOTO',
              media_url: 'https://cdn.interest.app/stories/r.jpg',
              duration_seconds: '5.0',
              caption: 'React to me',
              audience: 'PUBLIC',
              allow_replies: 'ALL',
              created_at: new Date(),
              expires_at: new Date(Date.now() + 3600000),
              deleted_at: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // block check
        .mockResolvedValueOnce({ rows: [] }); // insert reaction

      const res = await service.reactToStory('viewer-1', 'story-react-1', {
        reaction: '❤️',
      });

      expect(res.reacted).toBe(true);
      expect(res.reaction).toBe('❤️');
    });

    it('rejects reply when creator turned off replies', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'story-no-reply-1',
              creator_id: 'creator-1',
              creator_username: 'creator1',
              creator_display_name: 'Creator',
              media_type: 'PHOTO',
              media_url: 'https://cdn.interest.app/stories/nr.jpg',
              duration_seconds: '5.0',
              caption: 'No replies allowed',
              audience: 'PUBLIC',
              allow_replies: 'OFF',
              created_at: new Date(),
              expires_at: new Date(Date.now() + 3600000),
              deleted_at: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // block check

      await expect(
        service.replyToStory('viewer-1', 'story-no-reply-1', { text: 'Hi!' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Moderation Reporting & Story Deletion', () => {
    it('records moderation report for inappropriate story', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const res = await service.reportStory('viewer-1', 'story-rep-1', {
        reason: 'INAPPROPRIATE',
        details: 'Violates community guidelines',
      });

      expect(res.reported).toBe(true);
      expect(res.storyId).toBe('story-rep-1');
    });

    it('soft-deletes story with creator ownership check', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'story-del-1' }] });

      const res = await service.deleteStory('creator-1', 'story-del-1');

      expect(res.deleted).toBe(true);
      expect(res.storyId).toBe('story-del-1');
    });
  });
});
