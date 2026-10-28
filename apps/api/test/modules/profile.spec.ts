import { Test, TestingModule } from '@nestjs/testing';
import { ProfileService } from '../../src/modules/profile/profile.service';
import { DatabaseService } from '../../src/database/database.service';
import { NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';

describe('ProfileService — Profiles and Social Graph Unit & Security Tests', () => {
  let service: ProfileService;
  let mockDb: any;

  const userOwnerId = '11111111-1111-1111-1111-111111111111';
  const visitorId = '22222222-2222-2222-2222-222222222222';
  const privateUserId = '33333333-3333-3333-3333-333333333333';
  const blockedUserId = '44444444-4444-4444-4444-444444444444';

  beforeEach(async () => {
    mockDb = {
      query: jest.fn(),
      withTransaction: jest.fn().mockImplementation((cb) =>
        cb({
          query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [] }),
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: DatabaseService, useValue: mockDb },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
  });

  // ==========================================================================
  // 1. PROFILE RETRIEVAL & PRIVACY CONTROLS
  // ==========================================================================
  describe('getProfile()', () => {
    it('should return profile for owner with sensitive fields and unmasked counts', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: userOwnerId,
            email: 'creator@interest.app',
            phone_number: '+1234567890',
            is_active: true,
            is_verified: true,
            user_created_at: new Date('2026-01-01'),
            username: 'cyber_creator',
            display_name: 'Cyber Creator',
            bio: 'Autonomous agent researcher',
            avatar_url: 'https://cdn.interest.app/avatar.jpg',
            banner_url: null,
            preferred_languages: ['en', 'ja'],
            reels_count: 12,
            followers_count: 1500,
            following_count: 200,
            is_private: false,
            links: JSON.stringify([{ title: 'GitHub', url: 'https://github.com/interest' }]),
            hide_follower_count: true, // Should NOT mask for owner
            hide_following_count: true,
            allow_tagging: 'EVERYONE',
            allow_mentions: 'EVERYONE',
            profile_updated_at: new Date('2026-02-01'),
          },
        ],
      });

      const profile = await service.getProfile(userOwnerId, userOwnerId);

      expect(profile.id).toBe(userOwnerId);
      expect(profile.username).toBe('cyber_creator');
      expect(profile.email).toBe('creator@interest.app');
      expect(profile.followersCount).toBe(1500); // Unmasked for owner
      expect(profile.followingCount).toBe(200);
      expect(profile.links).toHaveLength(1);
    });

    it('should mask followers and following counts for visitor when hidden by user', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: userOwnerId,
              email: 'hidden@interest.app',
              is_active: true,
              user_created_at: new Date('2026-01-01'),
              username: 'secretive',
              display_name: 'Secretive Artist',
              followers_count: 9999,
              following_count: 50,
              is_private: false,
              hide_follower_count: true,
              hide_following_count: true,
              allow_tagging: 'EVERYONE',
              allow_mentions: 'EVERYONE',
              profile_updated_at: new Date('2026-02-01'),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // No block
        .mockResolvedValueOnce({
          rows: [
            {
              is_following: true,
              is_follower: false,
              has_pending_request: false,
              is_muted: false,
              is_restricted: false,
            },
          ],
        });

      const profile = await service.getProfile(visitorId, userOwnerId);

      expect(profile.email).toBeUndefined(); // Email stripped for non-owner
      expect(profile.followersCount).toBe(-1); // Masked
      expect(profile.followingCount).toBe(-1); // Masked
      expect(profile.isFollowing).toBe(true);
    });

    it('should throw NotFoundException (404) when a bidirectional block exists', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: blockedUserId,
              is_active: true,
              username: 'blocked_user',
              display_name: 'Blocked User',
              user_created_at: new Date(),
              profile_updated_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ blocker_id: blockedUserId }], // Block confirmed
        });

      await expect(service.getProfile(visitorId, blockedUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==========================================================================
  // 2. PROFILE EDITING & ZERO-LOCATION SANITIZATION
  // ==========================================================================
  describe('updateProfile()', () => {
    it('should enforce case-insensitive username uniqueness', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ user_id: 'some-other-uuid' }], // Username exists
      });

      await expect(
        service.updateProfile(userOwnerId, { username: 'TakenName' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should sterilize GPS coordinates and city names from bio (Zero-Location Invariant)', async () => {
      // Mock unique username check (pass)
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // No conflict
        .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE profiles
        // getProfile call
        .mockResolvedValueOnce({
          rows: [
            {
              id: userOwnerId,
              is_active: true,
              username: 'geo_free',
              display_name: 'Explorer',
              bio: 'Filming drone shots at mountain ridge', // Sanitized text
              user_created_at: new Date(),
              profile_updated_at: new Date(),
              preferred_languages: ['en'],
            },
          ],
        });

      await service.updateProfile(userOwnerId, {
        username: 'geo_free',
        bio: 'Filming drone shots at 37.7749, -122.4194 in Tokyo Japan near me',
      });

      // Assert that UPDATE query did NOT contain GPS coordinates
      const updateCall = mockDb.query.mock.calls.find((c: any) =>
        c[0].includes('UPDATE profiles SET'),
      );
      expect(updateCall).toBeDefined();
      const sanitizedBioArg = updateCall[1].find((arg: any) =>
        typeof arg === 'string' && arg.includes('Filming drone shots'),
      );
      expect(sanitizedBioArg).not.toContain('37.7749');
      expect(sanitizedBioArg).not.toContain('-122.4194');
      expect(sanitizedBioArg).not.toContain('Tokyo');
      expect(sanitizedBioArg).not.toContain('near me');
    });

    it('should reject more than 5 social links', async () => {
      const excessiveLinks = [
        { title: '1', url: 'https://example.com/1' },
        { title: '2', url: 'https://example.com/2' },
        { title: '3', url: 'https://example.com/3' },
        { title: '4', url: 'https://example.com/4' },
        { title: '5', url: 'https://example.com/5' },
        { title: '6', url: 'https://example.com/6' },
      ];

      await expect(
        service.updateProfile(userOwnerId, { links: excessiveLinks }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================================================================
  // 3. PRIVATE ACCOUNT REELS & COLLECTIONS GATING
  // ==========================================================================
  describe('Content Tabs & Privacy Gating', () => {
    it('should deny access to private account reels for unapproved visitor', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ id: privateUserId, is_active: true, is_private: true }],
        })
        .mockResolvedValueOnce({ rows: [] }) // No block
        .mockResolvedValueOnce({ rows: [] }); // Not following

      await expect(
        service.getProfileReels(visitorId, privateUserId, 20),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should grant access to private account reels when visitor is an approved follower', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ id: privateUserId, is_active: true, is_private: true }],
        })
        .mockResolvedValueOnce({ rows: [] }) // No block
        .mockResolvedValueOnce({ rows: [{ 1: 1 }] }) // Is following
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'reel-123',
              creator_id: privateUserId,
              title: 'Private Reel',
              created_at: new Date(),
              username: 'private_creator',
              display_name: 'Private Creator',
            },
          ],
        });

      const res = await service.getProfileReels(visitorId, privateUserId, 20);
      expect(res.items).toHaveLength(1);
      expect(res.items[0].id).toBe('reel-123');
    });

    it('should reject non-owner viewing liked reels (Strictly Owner-Only Tab)', async () => {
      await expect(
        service.getProfileLikedReels(visitorId, userOwnerId, 20),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should filter out private collections when viewed by visitor', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ id: userOwnerId, is_active: true, is_private: false }],
        })
        .mockResolvedValueOnce({ rows: [] }) // No block
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'col-pub',
              user_id: userOwnerId,
              name: 'Public Inspiration',
              is_private: false,
              reels_count: 5,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        });

      const cols = await service.getProfileCollections(visitorId, userOwnerId, 20, 0);
      expect(cols).toHaveLength(1);
      expect(cols[0].isPrivate).toBe(false);

      const queryCall = mockDb.query.mock.calls[2][0];
      expect(queryCall).toContain('AND is_private = FALSE');
    });
  });

  // ==========================================================================
  // 4. SOCIAL GRAPH: PUBLIC FOLLOW VS PRIVATE FOLLOW REQUESTS
  // ==========================================================================
  describe('followUser() & Follow Requests Flow', () => {
    it('should reject self-follow', async () => {
      await expect(service.followUser(visitorId, visitorId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should immediately follow a public account and increment counters', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ id: userOwnerId, is_active: true, is_private: false }],
        })
        .mockResolvedValueOnce({ rows: [] }) // No block
        .mockResolvedValueOnce({ rows: [] }) // Not following yet
        .mockResolvedValueOnce({ rows: [] }); // Mutual check

      const res = await service.followUser(visitorId, userOwnerId);

      expect(res.following).toBe(true);
      expect(res.requested).toBe(false);
      expect(res.status).toBe('FOLLOWING');
      expect(mockDb.withTransaction).toHaveBeenCalled();
    });

    it('should create a PENDING follow request when targeting a private account', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ id: privateUserId, is_active: true, is_private: true }],
        })
        .mockResolvedValueOnce({ rows: [] }) // No block
        .mockResolvedValueOnce({ rows: [] }) // Not following yet
        .mockResolvedValueOnce({ rows: [] }) // No existing request
        .mockResolvedValueOnce({ rowCount: 1 }) // Insert follow_request
        .mockResolvedValueOnce({ rowCount: 1 }); // Notification

      const res = await service.followUser(visitorId, privateUserId);

      expect(res.following).toBe(false);
      expect(res.requested).toBe(true);
      expect(res.status).toBe('REQUESTED');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO follow_requests'),
        expect.arrayContaining([visitorId, privateUserId]),
      );
    });

    it('should accept follow request and establish follow relationship in transaction', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'req-uuid-1',
            requester_id: visitorId,
            target_id: privateUserId,
            status: 'PENDING',
          },
        ],
      });

      const res = await service.respondFollowRequest(privateUserId, 'req-uuid-1', 'ACCEPT');

      expect(res.success).toBe(true);
      expect(res.action).toBe('ACCEPTED');
      expect(mockDb.withTransaction).toHaveBeenCalled();
    });

    it('should cancel pending follow request', async () => {
      mockDb.query.mockResolvedValueOnce({ rowCount: 1 });

      const res = await service.cancelFollowRequest(visitorId, privateUserId);
      expect(res.cancelled).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM follow_requests'),
        [visitorId, privateUserId],
      );
    });
  });

  // ==========================================================================
  // 5. RESTRICT SAFETY CONTROLS
  // ==========================================================================
  describe('restrictUser() & unrestrictUser()', () => {
    it('should restrict user and prevent self-restriction', async () => {
      await expect(service.restrictUser(visitorId, visitorId)).rejects.toThrow(
        BadRequestException,
      );

      mockDb.query.mockResolvedValueOnce({ rowCount: 1 });
      const res = await service.restrictUser(visitorId, userOwnerId);
      expect(res.restricted).toBe(true);
    });

    it('should unrestrict a user', async () => {
      mockDb.query.mockResolvedValueOnce({ rowCount: 1 });
      const res = await service.unrestrictUser(visitorId, userOwnerId);
      expect(res.restricted).toBe(false);
    });
  });

  // ==========================================================================
  // 6. MENTIONS / TAGGING AUTOCOMPLETE CANDIDATE SEARCH
  // ==========================================================================
  describe('searchMentionCandidates()', () => {
    it('should return candidates excluding blocked users and respecting privacy', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: userOwnerId,
            username: 'cyber_creator',
            display_name: 'Cyber Creator',
            avatar_url: 'https://cdn.interest.app/avatar.jpg',
            allow_mentions: 'EVERYONE',
            is_following: true,
            is_follower: true,
          },
        ],
      });

      const candidates = await service.searchMentionCandidates(visitorId, '@cyber');

      expect(candidates).toHaveLength(1);
      expect(candidates[0].username).toBe('cyber_creator');
      expect(candidates[0].isMutual).toBe(true);

      const queryText = mockDb.query.mock.calls[0][0];
      expect(queryText).toContain('NOT EXISTS (\n           SELECT 1 FROM blocks b');
      expect(queryText).toContain("p.allow_mentions = 'EVERYONE'");
    });
  });

  // ==========================================================================
  // 7. ZERO-LOCATION PROFILE RECOMMENDATIONS
  // ==========================================================================
  describe('getProfileRecommendations()', () => {
    it('should compute recommendations strictly via 512-dim interest vector similarity with 0 location', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ interest_vector: '[0.1, 0.2, ...]' }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: userOwnerId,
              username: 'ai_architect',
              display_name: 'AI Architect',
              avatar_url: null,
              interest_similarity: 0.94,
              reels_count: 20,
              followers_count: 500,
            },
          ],
        });

      const recs = await service.getProfileRecommendations(visitorId, 10);

      expect(recs).toHaveLength(1);
      expect(recs[0].username).toBe('ai_architect');

      const queryCall = mockDb.query.mock.calls[1][0];
      expect(queryCall).toContain('u.interest_vector <=> (SELECT interest_vector FROM users');
      expect(queryCall).not.toContain('location');
      expect(queryCall).not.toContain('geo');
      expect(queryCall).not.toContain('country');
      expect(queryCall).not.toContain('latitude');
    });
  });
});
