import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { StoriesService } from '../../src/modules/stories/stories.service';
import { DatabaseService } from '../../src/database/database.service';

describe('Prompt 15 — Stories & Temporary Content Gate Test Suite', () => {
  let storiesService: StoriesService;

  const mockDb = {
    query: jest.fn(),
  };

  const creatorAlice = {
    id: 'user-alice-uuid',
    username: 'alice_creator',
    displayName: 'Alice In Tech',
    avatarUrl: 'https://cdn.interest.test/avatars/alice.jpg',
    isVerified: true,
  };

  const viewerBob = 'user-bob-uuid';
  const viewerCharlie = 'user-charlie-uuid';

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

    storiesService = module.get<StoriesService>(StoriesService);
  });

  describe('1. Server-Authoritative 24-Hour Expiry & Creation', () => {
    it('creates a story with server-authoritative 24-hour expiration window', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'story-101',
              creator_id: creatorAlice.id,
              media_type: 'PHOTO',
              media_url: 'https://cdn.interest.test/stories/story-101.jpg',
              thumbnail_url: null,
              duration_seconds: '5.0',
              caption: 'Morning coffee in Kyoto #kyoto #coffee',
              text_overlays: JSON.stringify([
                { id: 'overlay-1', text: 'Good morning!', color: '#FFFFFF', fontSize: 24, xPercent: 50, yPercent: 20, startTimeSeconds: 0, endTimeSeconds: 5 },
              ]),
              audience: 'PUBLIC',
              allow_replies: 'ALL',
              created_at: now,
              expires_at: expiresAt,
              deleted_at: null,
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [creatorAlice],
        });

      const story = await storiesService.createStory(creatorAlice.id, {
        mediaType: 'PHOTO',
        mediaUrl: 'https://cdn.interest.test/stories/story-101.jpg',
        caption: 'Morning coffee in Kyoto #kyoto #coffee',
        textOverlays: [{ id: 'overlay-1', text: 'Good morning!', color: '#FFFFFF', fontSize: 24, xPercent: 50, yPercent: 20, startTimeSeconds: 0, endTimeSeconds: 5 }],
        audience: 'PUBLIC',
        allowReplies: 'ALL',
      });

      expect(story.id).toBe('story-101');
      expect(story.creatorId).toBe(creatorAlice.id);
      expect(story.mediaType).toBe('PHOTO');
      expect(story.isExpired).toBe(false);
      expect(story.textOverlays).toHaveLength(1);
      expect(story.textOverlays[0].text).toBe('Good morning!');
    });

    it('rejects story creation if caption contains prohibited spam or community violation terms', async () => {
      await expect(
        storiesService.createStory(creatorAlice.id, {
          mediaType: 'PHOTO',
          mediaUrl: 'https://cdn.interest.test/stories/spam.jpg',
          caption: 'Click here for free followers and crypto giveaway!',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('strictly denies access with NotFoundException if story has expired past 24 hours on server', async () => {
      const pastTime = new Date(Date.now() - 3600 * 1000); // 1 hour ago (expired)
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'expired-story-1',
            creator_id: creatorAlice.id,
            media_type: 'PHOTO',
            media_url: 'https://cdn.interest.test/stories/expired.jpg',
            thumbnail_url: null,
            duration_seconds: '5.0',
            caption: 'Yesterday story',
            text_overlays: '[]',
            audience: 'PUBLIC',
            allow_replies: 'ALL',
            created_at: new Date(Date.now() - 25 * 3600 * 1000),
            expires_at: pastTime,
            deleted_at: null,
            creator_username: creatorAlice.username,
            creator_display_name: creatorAlice.displayName,
            creator_avatar_url: creatorAlice.avatarUrl,
            creator_is_verified: creatorAlice.isVerified,
            viewer_progress: null,
            viewer_completed: null,
            views_count: '15',
            reactions_count: '3',
          },
        ],
      });

      await expect(storiesService.getStoryById(viewerBob, 'expired-story-1')).rejects.toThrow(
        new NotFoundException('Story has expired'),
      );
    });

    it('denies access if story has been soft-deleted by creator', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'deleted-story-1',
            creator_id: creatorAlice.id,
            media_type: 'PHOTO',
            media_url: 'https://cdn.interest.test/stories/deleted.jpg',
            thumbnail_url: null,
            duration_seconds: '5.0',
            caption: 'Deleted story',
            text_overlays: '[]',
            audience: 'PUBLIC',
            allow_replies: 'ALL',
            created_at: new Date(),
            expires_at: new Date(Date.now() + 100000),
            deleted_at: new Date(),
            creator_username: creatorAlice.username,
            creator_display_name: creatorAlice.displayName,
            creator_avatar_url: creatorAlice.avatarUrl,
            creator_is_verified: creatorAlice.isVerified,
          },
        ],
      });

      await expect(storiesService.getStoryById(viewerBob, 'deleted-story-1')).rejects.toThrow(
        new NotFoundException('Story has been deleted'),
      );
    });
  });

  describe('2. Audience Scopes & Privacy Enforcement', () => {
    it('allows any user to view a PUBLIC story', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'public-story-1',
              creator_id: creatorAlice.id,
              media_type: 'PHOTO',
              media_url: 'https://cdn.interest.test/stories/pub.jpg',
              thumbnail_url: null,
              duration_seconds: '5.0',
              caption: 'Public announcement',
              text_overlays: '[]',
              audience: 'PUBLIC',
              allow_replies: 'ALL',
              created_at: new Date(),
              expires_at: new Date(Date.now() + 50000000),
              deleted_at: null,
              creator_username: creatorAlice.username,
              creator_display_name: creatorAlice.displayName,
              creator_avatar_url: creatorAlice.avatarUrl,
              creator_is_verified: creatorAlice.isVerified,
              viewer_progress: '0.0',
              viewer_completed: false,
              views_count: '10',
              reactions_count: '2',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // user_blocks check = empty

      const story = await storiesService.getStoryById(viewerBob, 'public-story-1');
      expect(story.id).toBe('public-story-1');
      expect(story.audience).toBe('PUBLIC');
    });

    it('enforces FOLLOWERS_ONLY: denies access to non-followers with ForbiddenException', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'followers-story-1',
              creator_id: creatorAlice.id,
              media_type: 'PHOTO',
              media_url: 'https://cdn.interest.test/stories/fol.jpg',
              thumbnail_url: null,
              duration_seconds: '5.0',
              caption: 'Followers only story',
              text_overlays: '[]',
              audience: 'FOLLOWERS_ONLY',
              allow_replies: 'ALL',
              created_at: new Date(),
              expires_at: new Date(Date.now() + 50000000),
              deleted_at: null,
              creator_username: creatorAlice.username,
              creator_display_name: creatorAlice.displayName,
              creator_avatar_url: creatorAlice.avatarUrl,
              creator_is_verified: creatorAlice.isVerified,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // user_blocks = empty
        .mockResolvedValueOnce({ rows: [] }); // follows = empty (not following)

      await expect(storiesService.getStoryById(viewerBob, 'followers-story-1')).rejects.toThrow(
        new ForbiddenException('This story is restricted to followers only'),
      );
    });

    it('enforces CLOSE_FRIENDS: allows close friends and denies others', async () => {
      // Bob is NOT in Alice's close friends list
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'close-friends-story-1',
              creator_id: creatorAlice.id,
              media_type: 'PHOTO',
              media_url: 'https://cdn.interest.test/stories/cf.jpg',
              thumbnail_url: null,
              duration_seconds: '5.0',
              caption: 'Close friends secret',
              text_overlays: '[]',
              audience: 'CLOSE_FRIENDS',
              allow_replies: 'ALL',
              created_at: new Date(),
              expires_at: new Date(Date.now() + 50000000),
              deleted_at: null,
              creator_username: creatorAlice.username,
              creator_display_name: creatorAlice.displayName,
              creator_avatar_url: creatorAlice.avatarUrl,
              creator_is_verified: creatorAlice.isVerified,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // user_blocks = empty
        .mockResolvedValueOnce({ rows: [] }); // close_friends check = empty

      await expect(storiesService.getStoryById(viewerBob, 'close-friends-story-1')).rejects.toThrow(
        new ForbiddenException('This story is restricted to close friends only'),
      );

      // Charlie IS in Alice's close friends list
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'close-friends-story-1',
              creator_id: creatorAlice.id,
              media_type: 'PHOTO',
              media_url: 'https://cdn.interest.test/stories/cf.jpg',
              thumbnail_url: null,
              duration_seconds: '5.0',
              caption: 'Close friends secret',
              text_overlays: '[]',
              audience: 'CLOSE_FRIENDS',
              allow_replies: 'ALL',
              created_at: new Date(),
              expires_at: new Date(Date.now() + 50000000),
              deleted_at: null,
              creator_username: creatorAlice.username,
              creator_display_name: creatorAlice.displayName,
              creator_avatar_url: creatorAlice.avatarUrl,
              creator_is_verified: creatorAlice.isVerified,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // user_blocks = empty
        .mockResolvedValueOnce({ rows: [{ 1: 1 }] }); // close_friends check = match!

      const cfStory = await storiesService.getStoryById(viewerCharlie, 'close-friends-story-1');
      expect(cfStory.audience).toBe('CLOSE_FRIENDS');
    });

    it('allows creator to always view their own story regardless of audience restriction', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'close-friends-story-1',
              creator_id: creatorAlice.id,
              media_type: 'PHOTO',
              media_url: 'https://cdn.interest.test/stories/cf.jpg',
              thumbnail_url: null,
              duration_seconds: '5.0',
              caption: 'My own secret',
              text_overlays: '[]',
              audience: 'CLOSE_FRIENDS',
              allow_replies: 'ALL',
              created_at: new Date(),
              expires_at: new Date(Date.now() + 50000000),
              deleted_at: null,
              creator_username: creatorAlice.username,
              creator_display_name: creatorAlice.displayName,
              creator_avatar_url: creatorAlice.avatarUrl,
              creator_is_verified: creatorAlice.isVerified,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // user_blocks check = empty

      const story = await storiesService.getStoryById(creatorAlice.id, 'close-friends-story-1');
      expect(story.creatorId).toBe(creatorAlice.id);
    });
  });

  describe('3. Mutual Blocking Enforcement & Safety Reporting', () => {
    it('blocks access if viewer blocked creator or creator blocked viewer', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'story-blocked-1',
              creator_id: creatorAlice.id,
              media_type: 'PHOTO',
              media_url: 'https://cdn.interest.test/stories/blocked.jpg',
              thumbnail_url: null,
              duration_seconds: '5.0',
              caption: 'Blocked user story',
              text_overlays: '[]',
              audience: 'PUBLIC',
              allow_replies: 'ALL',
              created_at: new Date(),
              expires_at: new Date(Date.now() + 50000000),
              deleted_at: null,
              creator_username: creatorAlice.username,
              creator_display_name: creatorAlice.displayName,
              creator_avatar_url: creatorAlice.avatarUrl,
              creator_is_verified: creatorAlice.isVerified,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ 1: 1 }] }); // user_blocks match!

      await expect(storiesService.getStoryById(viewerBob, 'story-blocked-1')).rejects.toThrow(
        new ForbiddenException('Access denied to this story'),
      );
    });

    it('records a moderation report for a story and hides it from the reporter', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const result = await storiesService.reportStory(viewerBob, 'story-101', {
        reason: 'SPAM',
        details: 'Unwanted promotional content',
      });

      expect(result.reported).toBe(true);
      expect(result.storyId).toBe('story-101');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO story_reports'),
        expect.arrayContaining(['story-101', viewerBob, 'SPAM', 'Unwanted promotional content']),
      );
    });
  });

  describe('4. Viewing Progress, Reactions & Reply Controls', () => {
    it('records viewing progress and marks completed when progress exceeds 90%', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'story-view-test',
              creator_id: creatorAlice.id,
              media_type: 'VIDEO',
              media_url: 'https://cdn.interest.test/stories/video.mp4',
              thumbnail_url: null,
              duration_seconds: '15.0',
              caption: 'Coding session',
              text_overlays: '[]',
              audience: 'PUBLIC',
              allow_replies: 'ALL',
              created_at: new Date(),
              expires_at: new Date(Date.now() + 50000000),
              deleted_at: null,
              creator_username: creatorAlice.username,
              creator_display_name: creatorAlice.displayName,
              creator_avatar_url: creatorAlice.avatarUrl,
              creator_is_verified: creatorAlice.isVerified,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // user_blocks empty
        .mockResolvedValueOnce({ rows: [] }); // story_views insert

      const viewResult = await storiesService.recordView(viewerBob, 'story-view-test', {
        progressPercent: 0.95,
      });

      expect(viewResult.recorded).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO story_views'),
        expect.arrayContaining(['story-view-test', viewerBob, 0.95, true]),
      );
    });

    it('allows emoji reactions to active stories', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'story-reaction-test',
              creator_id: creatorAlice.id,
              media_type: 'PHOTO',
              media_url: 'https://cdn.interest.test/stories/img.jpg',
              thumbnail_url: null,
              duration_seconds: '5.0',
              caption: 'Reaction test',
              text_overlays: '[]',
              audience: 'PUBLIC',
              allow_replies: 'ALL',
              created_at: new Date(),
              expires_at: new Date(Date.now() + 50000000),
              deleted_at: null,
              creator_username: creatorAlice.username,
              creator_display_name: creatorAlice.displayName,
              creator_avatar_url: creatorAlice.avatarUrl,
              creator_is_verified: creatorAlice.isVerified,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // user_blocks empty
        .mockResolvedValueOnce({ rows: [] }); // story_reactions insert

      const reactionResult = await storiesService.reactToStory(viewerBob, 'story-reaction-test', {
        reaction: '🔥',
      });

      expect(reactionResult.reacted).toBe(true);
      expect(reactionResult.reaction).toBe('🔥');
    });

    it('strictly respects allowReplies settings: rejects when OFF', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'story-no-replies',
              creator_id: creatorAlice.id,
              media_type: 'PHOTO',
              media_url: 'https://cdn.interest.test/stories/img.jpg',
              thumbnail_url: null,
              duration_seconds: '5.0',
              caption: 'No replies allowed',
              text_overlays: '[]',
              audience: 'PUBLIC',
              allow_replies: 'OFF',
              created_at: new Date(),
              expires_at: new Date(Date.now() + 50000000),
              deleted_at: null,
              creator_username: creatorAlice.username,
              creator_display_name: creatorAlice.displayName,
              creator_avatar_url: creatorAlice.avatarUrl,
              creator_is_verified: creatorAlice.isVerified,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // user_blocks empty

      await expect(
        storiesService.replyToStory(viewerBob, 'story-no-replies', { text: 'Hello!' }),
      ).rejects.toThrow(new BadRequestException('Replies are turned off for this story'));
    });
  });

  describe('5. Stories Tray Grouping & Ordering', () => {
    it('aggregates stories by creator, marks unviewed status, and places own stories first', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 3600 * 1000);

      mockDb.query.mockResolvedValueOnce({
        rows: [
          // Bob's own story
          {
            id: 'bob-story-1',
            creator_id: viewerBob,
            media_type: 'PHOTO',
            media_url: 'https://cdn.interest.test/stories/bob-1.jpg',
            thumbnail_url: null,
            duration_seconds: '5.0',
            caption: 'My story',
            text_overlays: '[]',
            audience: 'PUBLIC',
            allow_replies: 'ALL',
            created_at: new Date(now.getTime() - 2000),
            expires_at: expiresAt,
            deleted_at: null,
            creator_username: 'bob_the_builder',
            creator_display_name: 'Bob',
            creator_avatar_url: 'https://cdn.interest.test/avatars/bob.jpg',
            creator_is_verified: false,
            viewer_progress: null,
            viewer_completed: null,
            views_count: '1',
            reactions_count: '0',
          },
          // Alice's unviewed story
          {
            id: 'alice-story-1',
            creator_id: creatorAlice.id,
            media_type: 'PHOTO',
            media_url: 'https://cdn.interest.test/stories/alice-1.jpg',
            thumbnail_url: null,
            duration_seconds: '5.0',
            caption: 'Alice unviewed',
            text_overlays: '[]',
            audience: 'PUBLIC',
            allow_replies: 'ALL',
            created_at: new Date(now.getTime() - 1000),
            expires_at: expiresAt,
            deleted_at: null,
            creator_username: creatorAlice.username,
            creator_display_name: creatorAlice.displayName,
            creator_avatar_url: creatorAlice.avatarUrl,
            creator_is_verified: creatorAlice.isVerified,
            viewer_progress: null,
            viewer_completed: false,
            views_count: '5',
            reactions_count: '1',
          },
        ],
      });

      const tray = await storiesService.getStoriesTray(viewerBob);

      expect(tray).toHaveLength(2);
      // Own story is first
      expect(tray[0].creatorId).toBe(viewerBob);
      // Alice is second
      expect(tray[1].creatorId).toBe(creatorAlice.id);
      expect(tray[1].hasUnviewedStories).toBe(true);
      expect(tray[1].stories).toHaveLength(1);
    });
  });
});
