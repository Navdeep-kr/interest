import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CommunitiesService } from './communities.service';
import { DatabaseService } from '../../database/database.service';

describe('CommunitiesService', () => {
  let service: CommunitiesService;

  const mockDb = {
    query: jest.fn(),
  };

  const userOwner = 'user-owner-uuid';
  const userAdmin = 'user-admin-uuid';
  const userMod = 'user-mod-uuid';
  const userMember = 'user-member-uuid';
  const userOutsider = 'user-outsider-uuid';
  const communityId = 'comm-uuid-1';

  beforeEach(async () => {
    mockDb.query.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunitiesService,
        {
          provide: DatabaseService,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<CommunitiesService>(CommunitiesService);
  });

  describe('createCommunity', () => {
    it('creates community with slug and automatically assigns creator as OWNER', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // slug check
        .mockResolvedValueOnce({
          rows: [
            {
              id: communityId,
              creator_id: userOwner,
              interest_id: null,
              name: 'Anime & Manga Fanatics',
              slug: 'anime-manga-fanatics',
              description: 'All about shonen, seinen, and anime culture.',
              avatar_url: null,
              banner_url: null,
              visibility: 'PUBLIC',
              guidelines: '[]',
              members_count: 1,
              posts_count: 0,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // insert membership

      const result = await service.createCommunity(userOwner, {
        name: 'Anime & Manga Fanatics',
        description: 'All about shonen, seinen, and anime culture.',
        visibility: 'PUBLIC',
      });

      expect(result.id).toBe(communityId);
      expect(result.slug).toBe('anime-manga-fanatics');
      expect(result.userRole).toBe('OWNER');
      expect(result.userStatus).toBe('ACTIVE');
    });

    it('rejects duplicate slug with ConflictException', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'existing-id' }] });

      await expect(
        service.createCommunity(userOwner, {
          name: 'Anime',
          slug: 'anime',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getCommunity & Private-Community Leakage Gate', () => {
    it('allows anyone to access PUBLIC community', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: communityId,
              name: 'Public Space',
              slug: 'public-space',
              visibility: 'PUBLIC',
              members_count: 5,
              posts_count: 10,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // not a member

      const comm = await service.getCommunity(userOutsider, communityId);
      expect(comm.id).toBe(communityId);
      expect(comm.visibility).toBe('PUBLIC');
      expect(comm.userRole).toBeNull();
    });

    it('denies access to PRIVATE community for non-members with ForbiddenException', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: communityId,
              name: 'Private Club',
              slug: 'private-club',
              visibility: 'PRIVATE',
              members_count: 3,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // not an active member

      await expect(service.getCommunity(userOutsider, communityId)).rejects.toThrow(
        new ForbiddenException('This community is private and accessible only to active members'),
      );
    });
  });

  describe('joinCommunity & leaveCommunity', () => {
    it('joins PUBLIC community directly with status ACTIVE', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ id: communityId, visibility: 'PUBLIC', is_active: true }],
        })
        .mockResolvedValueOnce({ rows: [] }) // no existing membership
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'mem-1',
              community_id: communityId,
              user_id: userMember,
              role: 'MEMBER',
              status: 'ACTIVE',
              created_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // update members_count
        .mockResolvedValueOnce({
          rows: [{ id: userMember, username: 'member1', display_name: 'Member 1' }],
        });

      const member = await service.joinCommunity(userMember, communityId);
      expect(member.status).toBe('ACTIVE');
      expect(member.role).toBe('MEMBER');
    });

    it('submits PENDING_REQUEST for RESTRICTED community', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ id: communityId, visibility: 'RESTRICTED', is_active: true }],
        })
        .mockResolvedValueOnce({ rows: [] }) // no existing membership
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'mem-2',
              community_id: communityId,
              user_id: userMember,
              role: 'MEMBER',
              status: 'PENDING_REQUEST',
              created_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ id: userMember, username: 'member1', display_name: 'Member 1' }],
        });

      const member = await service.joinCommunity(userMember, communityId);
      expect(member.status).toBe('PENDING_REQUEST');
    });

    it('prevents OWNER from leaving without ownership handover', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ role: 'OWNER', status: 'ACTIVE' }],
      });

      await expect(service.leaveCommunity(userOwner, communityId)).rejects.toThrow(
        new BadRequestException(
          'Community owner cannot leave without transferring ownership to another member first',
        ),
      );
    });
  });

  describe('handoverOwnership', () => {
    it('atomically transfers OWNER role to active member and demotes old owner to ADMIN', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ role: 'OWNER' }] }) // requester is OWNER
        .mockResolvedValueOnce({ rows: [{ user_id: userAdmin, status: 'ACTIVE' }] }) // new owner is active
        .mockResolvedValueOnce({ rows: [] }) // update old owner to ADMIN
        .mockResolvedValueOnce({ rows: [] }) // update new owner to OWNER
        .mockResolvedValueOnce({ rows: [] }); // update community creator_id

      const result = await service.handoverOwnership(userOwner, communityId, {
        newOwnerId: userAdmin,
      });

      expect(result.handedOver).toBe(true);
      expect(result.newOwnerId).toBe(userAdmin);
    });
  });

  describe('Permission Escalation Protection', () => {
    it('rejects role promotion to OWNER via updateMemberRole', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ role: 'ADMIN', status: 'ACTIVE' }] }) // requester check
        .mockResolvedValueOnce({ rows: [{ role: 'MEMBER', status: 'ACTIVE' }] }); // target check

      await expect(
        service.updateMemberRole(userAdmin, communityId, userMember, { role: 'OWNER' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('denies MODERATOR from updating roles with ForbiddenException', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ role: 'MODERATOR', status: 'ACTIVE' }] });

      await expect(
        service.updateMemberRole(userMod, communityId, userMember, { role: 'ADMIN' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Moderator Removal & Abuse Security', () => {
    it('prevents MODERATOR from removing or banning another MODERATOR', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ role: 'MODERATOR', status: 'ACTIVE' }] }) // requester is MOD
        .mockResolvedValueOnce({ rows: [{ role: 'MODERATOR', status: 'ACTIVE' }] }); // target is MOD

      await expect(
        service.moderateMember(userMod, communityId, 'other-mod-uuid', { action: 'BAN' }),
      ).rejects.toThrow(
        new ForbiddenException('Moderators cannot moderate other staff members'),
      );
    });

    it('prevents anyone from banning or removing the OWNER', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ role: 'ADMIN', status: 'ACTIVE' }] }) // requester is ADMIN
        .mockResolvedValueOnce({ rows: [{ role: 'OWNER', status: 'ACTIVE' }] }); // target is OWNER

      await expect(
        service.moderateMember(userAdmin, communityId, userOwner, { action: 'BAN' }),
      ).rejects.toThrow(
        new ForbiddenException('Cannot perform moderation actions on the community owner'),
      );
    });
  });

  describe('Invitation Abuse Protection', () => {
    it('rejects invitations when daily limit (20) is exceeded', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ role: 'MEMBER', status: 'ACTIVE' }] }) // inviter is active member
        .mockResolvedValueOnce({ rows: [{ count: 20 }] }); // daily count = 20

      await expect(
        service.inviteUser(userMember, communityId, { userId: userOutsider }),
      ).rejects.toThrow(new BadRequestException('Daily invitation limit reached (20 invites per 24 hours)'));
    });
  });

  describe('Collaborative Posts & Safety', () => {
    it('creates collaborative post with PENDING collaboration status', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ role: 'MEMBER', status: 'ACTIVE' }] }) // membership
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'post-collab-1',
              community_id: communityId,
              author_id: userMember,
              post_type: 'COLLABORATIVE',
              title: 'Joint AI Research Study',
              body: 'Excited to publish this with @alice!',
              media_urls: '[]',
              reel_id: null,
              is_pinned: false,
              is_announcement: false,
              collaboration_status: 'PENDING',
              likes_count: 0,
              comments_count: 0,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // insert collaborator invitation
        .mockResolvedValueOnce({ rows: [] }) // update posts_count
        .mockResolvedValueOnce({
          rows: [{ id: userMember, username: 'member1', display_name: 'Member 1' }],
        });

      const post = await service.createPost(userMember, communityId, {
        postType: 'COLLABORATIVE',
        title: 'Joint AI Research Study',
        body: 'Excited to publish this with @alice!',
        collaboratorIds: ['user-alice-uuid'],
      });

      expect(post.postType).toBe('COLLABORATIVE');
      expect(post.collaborationStatus).toBe('PENDING');
    });
  });
});
