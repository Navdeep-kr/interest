import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CommunitiesService } from '../../src/modules/communities/communities.service';
import { DatabaseService } from '../../src/database/database.service';

describe('Prompt 16 — Communities & Collaborative Content Gate Test Suite', () => {
  let service: CommunitiesService;

  const mockDb = {
    query: jest.fn(),
  };

  const userOwner = 'user-owner-uuid';
  const userAdmin = 'user-admin-uuid';
  const userMod1 = 'user-mod1-uuid';
  const userMod2 = 'user-mod2-uuid';
  const userMember1 = 'user-member1-uuid';
  const userMember2 = 'user-member2-uuid';
  const userOutsider = 'user-outsider-uuid';
  const communityId = 'comm-gate-1';

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

  describe('1. Private-Community Leakage Gate', () => {
    it('strictly denies access to private community details for non-members', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: communityId,
              name: 'Secret Founders Club',
              slug: 'secret-founders',
              visibility: 'PRIVATE',
              is_active: true,
              members_count: 4,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // outsider is not a member

      await expect(service.getCommunity(userOutsider, communityId)).rejects.toThrow(
        new ForbiddenException('This community is private and accessible only to active members'),
      );
    });

    it('filters private communities from public community listings unless user is an active member', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'comm-pub-1',
            name: 'Open Robotics Forum',
            slug: 'open-robotics',
            visibility: 'PUBLIC',
            members_count: 50,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const list = await service.listCommunities(userOutsider, {});

      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('comm-pub-1');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("AND (c.visibility != 'PRIVATE' OR cm.status = 'ACTIVE')"),
        expect.any(Array),
      );
    });
  });

  describe('2. Permission Escalation Prevention Gate', () => {
    it('denies regular members from modifying staff roles', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ role: 'MEMBER', status: 'ACTIVE' }],
      });

      await expect(
        service.updateMemberRole(userMember1, communityId, userMember2, { role: 'MODERATOR' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('denies moderators from promoting members to Admin or Moderator', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ role: 'MODERATOR', status: 'ACTIVE' }],
      });

      await expect(
        service.updateMemberRole(userMod1, communityId, userMember1, { role: 'MODERATOR' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('prevents Admins from promoting anyone to OWNER (must use handoverOwnership)', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ role: 'ADMIN', status: 'ACTIVE' }] })
        .mockResolvedValueOnce({ rows: [{ role: 'MEMBER', status: 'ACTIVE' }] });

      await expect(
        service.updateMemberRole(userAdmin, communityId, userMember1, { role: 'OWNER' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('prevents Admins from demoting or altering the OWNER role', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ role: 'ADMIN', status: 'ACTIVE' }] })
        .mockResolvedValueOnce({ rows: [{ role: 'OWNER', status: 'ACTIVE' }] });

      await expect(
        service.updateMemberRole(userAdmin, communityId, userOwner, { role: 'MEMBER' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('3. Invitation Abuse & Spam Prevention Gate', () => {
    it('blocks invitation abuse when a user exceeds 20 invitations in 24 hours', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ role: 'MEMBER', status: 'ACTIVE' }] }) // active member
        .mockResolvedValueOnce({ rows: [{ count: 20 }] }); // 20 invites sent today

      await expect(
        service.inviteUser(userMember1, communityId, { userId: userOutsider }),
      ).rejects.toThrow(new BadRequestException('Daily invitation limit reached (20 invites per 24 hours)'));
    });

    it('prevents inviting already banned users into the community', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ role: 'MEMBER', status: 'ACTIVE' }] })
        .mockResolvedValueOnce({ rows: [{ count: 2 }] }) // limit ok
        .mockResolvedValueOnce({ rows: [{ status: 'BANNED' }] }); // target is banned

      await expect(
        service.inviteUser(userMember1, communityId, { userId: 'banned-user-uuid' }),
      ).rejects.toThrow(new ForbiddenException('Cannot invite a banned user to the community'));
    });
  });

  describe('4. Moderator Removal & Accountable Staff Protection Gate', () => {
    it('prevents a moderator from banning or removing another moderator', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ role: 'MODERATOR', status: 'ACTIVE' }] }) // requester is mod1
        .mockResolvedValueOnce({ rows: [{ role: 'MODERATOR', status: 'ACTIVE' }] }); // target is mod2

      await expect(
        service.moderateMember(userMod1, communityId, userMod2, { action: 'BAN' }),
      ).rejects.toThrow(new ForbiddenException('Moderators cannot moderate other staff members'));
    });

    it('strictly prevents anyone from banning, muting, or removing the OWNER', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ role: 'ADMIN', status: 'ACTIVE' }] }) // requester is admin
        .mockResolvedValueOnce({ rows: [{ role: 'OWNER', status: 'ACTIVE' }] }); // target is owner

      await expect(
        service.moderateMember(userAdmin, communityId, userOwner, { action: 'MUTE' }),
      ).rejects.toThrow(new ForbiddenException('Cannot perform moderation actions on the community owner'));
    });

    it('prevents OWNER from leaving the community without first handing over ownership', async () => {
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

  describe('5. Ownership Handover Gate', () => {
    it('atomically transfers ownership to an active member and demotes previous owner to ADMIN', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ role: 'OWNER' }] }) // requester is owner
        .mockResolvedValueOnce({ rows: [{ user_id: userAdmin, status: 'ACTIVE' }] }) // target is active member
        .mockResolvedValueOnce({ rows: [] }) // demote old owner to ADMIN
        .mockResolvedValueOnce({ rows: [] }) // promote target to OWNER
        .mockResolvedValueOnce({ rows: [] }); // update community record

      const result = await service.handoverOwnership(userOwner, communityId, {
        newOwnerId: userAdmin,
      });

      expect(result.handedOver).toBe(true);
      expect(result.newOwnerId).toBe(userAdmin);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("SET role = 'ADMIN'"),
        [communityId, userOwner],
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("SET role = 'OWNER'"),
        [communityId, userAdmin],
      );
    });
  });

  describe('6. Collaborative Posts & Pinned Announcements Gate', () => {
    it('creates multi-author collaborative posts with PENDING status until co-author accepts', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ role: 'MEMBER', status: 'ACTIVE' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'collab-post-1',
              community_id: communityId,
              author_id: userMember1,
              post_type: 'COLLABORATIVE',
              title: 'Joint Astronomy Observation',
              body: 'Observing the Orion Nebula with @member2',
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
        .mockResolvedValueOnce({ rows: [] }) // insert into community_post_collaborators
        .mockResolvedValueOnce({ rows: [] }) // update posts_count
        .mockResolvedValueOnce({
          rows: [{ id: userMember1, username: 'member1', display_name: 'Member 1' }],
        });

      const post = await service.createPost(userMember1, communityId, {
        postType: 'COLLABORATIVE',
        title: 'Joint Astronomy Observation',
        body: 'Observing the Orion Nebula with @member2',
        collaboratorIds: [userMember2],
      });

      expect(post.postType).toBe('COLLABORATIVE');
      expect(post.collaborationStatus).toBe('PENDING');

      // Collaborator accepts
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ post_id: 'collab-post-1', collaborator_id: userMember2 }] })
        .mockResolvedValueOnce({ rows: [] }); // update post collaboration_status = ACCEPTED

      const acceptRes = await service.respondToCollaboration(userMember2, 'collab-post-1', {
        status: 'ACCEPTED',
      });

      expect(acceptRes.status).toBe('ACCEPTED');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("SET collaboration_status = 'ACCEPTED'"),
        ['collab-post-1'],
      );
    });

    it('restricts pinned posts and announcements to staff members only', async () => {
      // Regular member attempts to create a pinned post -> is_pinned is enforced to false
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ role: 'MEMBER', status: 'ACTIVE' }] }) // regular member
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'post-reg-1',
              community_id: communityId,
              author_id: userMember1,
              post_type: 'DISCUSSION',
              title: 'Normal Question',
              body: 'Can I pin this?',
              media_urls: '[]',
              is_pinned: false, // NOT pinned
              is_announcement: false,
              collaboration_status: 'NONE',
              likes_count: 0,
              comments_count: 0,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: userMember1, username: 'member1', display_name: 'Member 1' }],
        });

      const post = await service.createPost(userMember1, communityId, {
        title: 'Normal Question',
        body: 'Can I pin this?',
        isPinned: true, // Attempted pin
      });

      expect(post.isPinned).toBe(false);
    });
  });

  describe('7. Moderation Queue, Reports & Member Appeals Gate', () => {
    it('files content report and resolves report by removing offending post', async () => {
      // 1. Member reports a post
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'report-101' }] });

      const reportResult = await service.reportTarget(userMember1, communityId, {
        targetType: 'POST',
        targetId: 'bad-post-id',
        reason: 'HATE_SPEECH',
        details: 'Offensive language in thread',
      });

      expect(reportResult.reported).toBe(true);

      // 2. Moderator reviews report and removes post
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ role: 'MODERATOR', status: 'ACTIVE' }] }) // requester is mod
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'report-101',
              target_type: 'POST',
              target_id: 'bad-post-id',
              reason: 'HATE_SPEECH',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // soft delete post: deleted_at = NOW()
        .mockResolvedValueOnce({ rows: [] }); // update report status = RESOLVED

      const reviewResult = await service.reviewReport(userMod1, communityId, 'report-101', {
        status: 'RESOLVED',
        actionTaken: 'REMOVE_POST',
      });

      expect(reviewResult.resolved).toBe(true);
      expect(reviewResult.actionTaken).toBe('REMOVE_POST');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE community_posts SET deleted_at = NOW()'),
        ['bad-post-id'],
      );
    });

    it('submits a member appeal and automatically unbans member upon appeal approval', async () => {
      // 1. Banned user submits appeal
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ status: 'BANNED' }] }) // user is banned
        .mockResolvedValueOnce({ rows: [{ id: 'appeal-201' }] }); // insert appeal

      const appealRes = await service.submitAppeal(userMember2, communityId, {
        appealReason: 'My account was compromised. I have reset my password and will follow rules.',
      });

      expect(appealRes.submitted).toBe(true);
      expect(appealRes.appealId).toBe('appeal-201');

      // 2. Admin reviews appeal and approves it -> unbans user!
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ role: 'ADMIN', status: 'ACTIVE' }] }) // requester check
        .mockResolvedValueOnce({
          rows: [{ id: 'appeal-201', appellant_id: userMember2 }],
        })
        // moderateMember('UNBAN') calls:
        .mockResolvedValueOnce({ rows: [{ role: 'ADMIN', status: 'ACTIVE' }] })
        .mockResolvedValueOnce({ rows: [{ role: 'MEMBER', status: 'BANNED' }] })
        .mockResolvedValueOnce({ rows: [] }) // update membership status = ACTIVE, ban_reason = NULL
        .mockResolvedValueOnce({ rows: [] }) // increment members_count
        .mockResolvedValueOnce({ rows: [] }); // update appeal status = APPROVED

      const reviewAppealRes = await service.reviewAppeal(userAdmin, communityId, 'appeal-201', {
        status: 'APPROVED',
        reviewNotes: 'Welcome back. Please keep 2FA enabled.',
      });

      expect(reviewAppealRes.status).toBe('APPROVED');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'ACTIVE', ban_reason = NULL"),
        [communityId, userMember2],
      );
    });
  });
});
