import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  CreateCommunityInputDto,
  UpdateCommunityInputDto,
  InviteCommunityMemberInputDto,
  UpdateCommunityMemberRoleInputDto,
  ModerateCommunityMemberInputDto,
  HandoverCommunityOwnershipInputDto,
  CreateCommunityPostInputDto,
  RespondPostCollaborationInputDto,
  ReportCommunityTargetInputDto,
  ReviewCommunityReportInputDto,
  SubmitCommunityAppealInputDto,
  ReviewCommunityAppealInputDto,
  CreateCommunityCollectionInputDto,
  AddReelToCommunityCollectionInputDto,
} from './dto/communities.dto';
import {
  CommunityItem,
  CommunityMemberItem,
  CommunityPostItem,
  CommunityCollectionItem,
  CommunityReportItem,
  CommunityAppealItem,
  CommunityVisibility,
  CommunityMemberRole,
  CommunityMemberStatus,
  CommunityPostType,
} from '@shared/types';

@Injectable()
export class CommunitiesService {
  private readonly logger = new Logger(CommunitiesService.name);

  private readonly prohibitedTerms = [
    'hate speech',
    'crypto giveaway',
    'free followers',
    'illegal market',
  ];

  constructor(private readonly databaseService: DatabaseService) {}

  // --------------------------------------------------------------------------
  // 1. Community Lifecycle (Create, Get, List, Update)
  // --------------------------------------------------------------------------

  async createCommunity(userId: string, dto: CreateCommunityInputDto): Promise<CommunityItem> {
    const slug = dto.slug
      ? dto.slug.toLowerCase().trim()
      : dto.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');

    // Check slug uniqueness
    const existing = await this.databaseService.query(
      `SELECT id FROM communities WHERE slug = $1`,
      [slug],
    );
    if (existing.rows.length > 0) {
      throw new ConflictException(`Community slug "${slug}" is already in use`);
    }

    const visibility = dto.visibility || 'PUBLIC';

    // 1. Insert community
    const commRes = await this.databaseService.query(
      `INSERT INTO communities
       (creator_id, interest_id, name, slug, description, avatar_url, banner_url, visibility, guidelines, members_count, posts_count, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, 0, TRUE, NOW(), NOW())
       RETURNING *`,
      [
        userId,
        dto.interestId || null,
        dto.name,
        slug,
        dto.description || '',
        dto.avatarUrl || null,
        dto.bannerUrl || null,
        visibility,
        JSON.stringify(dto.guidelines || []),
      ],
    );

    const communityRow = commRes.rows[0];

    // 2. Creator automatically becomes OWNER
    await this.databaseService.query(
      `INSERT INTO community_memberships (community_id, user_id, role, status, joined_at, created_at, updated_at)
       VALUES ($1, $2, 'OWNER', 'ACTIVE', NOW(), NOW(), NOW())`,
      [communityRow.id, userId],
    );

    this.logger.log(`Created community ${communityRow.id} (${communityRow.slug}) by user ${userId}`);

    return this.mapCommunityRow(communityRow, 'OWNER', 'ACTIVE');
  }

  async getCommunity(userId: string, identifier: string): Promise<CommunityItem> {
    // Can query by UUID or slug
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const query = isUuid
      ? `SELECT * FROM communities WHERE id = $1 AND is_active = TRUE`
      : `SELECT * FROM communities WHERE slug = $1 AND is_active = TRUE`;

    const res = await this.databaseService.query(query, [identifier]);
    if (res.rows.length === 0) {
      throw new NotFoundException('Community not found');
    }

    const community = res.rows[0];

    // Get user's membership
    const memRes = await this.databaseService.query(
      `SELECT role, status FROM community_memberships WHERE community_id = $1 AND user_id = $2`,
      [community.id, userId],
    );

    const membership = memRes.rows[0];
    const userRole = membership?.role || null;
    const userStatus = membership?.status || null;

    // PRIVACY GATE: If private community, non-active members cannot access
    if (community.visibility === 'PRIVATE') {
      if (!membership || membership.status !== 'ACTIVE') {
        throw new ForbiddenException('This community is private and accessible only to active members');
      }
    }

    return this.mapCommunityRow(community, userRole, userStatus);
  }

  async listCommunities(
    userId: string,
    options: { interestId?: string; joinedOnly?: boolean; search?: string },
  ): Promise<CommunityItem[]> {
    let query = `
      SELECT c.*, cm.role as user_role, cm.status as user_status
      FROM communities c
      LEFT JOIN community_memberships cm ON c.id = cm.community_id AND cm.user_id = $1
      WHERE c.is_active = TRUE
    `;
    const params: any[] = [userId];

    if (options.joinedOnly) {
      query += ` AND cm.status = 'ACTIVE'`;
    } else {
      // Privacy filter: Hide private communities unless the user is an active member
      query += ` AND (c.visibility != 'PRIVATE' OR cm.status = 'ACTIVE')`;
    }

    if (options.interestId) {
      params.push(options.interestId);
      query += ` AND c.interest_id = $${params.length}`;
    }

    if (options.search) {
      params.push(`%${options.search.toLowerCase()}%`);
      query += ` AND (LOWER(c.name) LIKE $${params.length} OR LOWER(c.description) LIKE $${params.length})`;
    }

    query += ` ORDER BY c.members_count DESC, c.created_at DESC LIMIT 50`;

    const res = await this.databaseService.query(query, params);
    return res.rows.map((row) =>
      this.mapCommunityRow(row, row.user_role || null, row.user_status || null),
    );
  }

  async updateCommunity(
    userId: string,
    communityId: string,
    dto: UpdateCommunityInputDto,
  ): Promise<CommunityItem> {
    await this.requireRole(userId, communityId, ['OWNER', 'ADMIN']);

    const updates: string[] = [];
    const params: any[] = [communityId];

    if (dto.name) {
      params.push(dto.name);
      updates.push(`name = $${params.length}`);
    }
    if (dto.description !== undefined) {
      params.push(dto.description);
      updates.push(`description = $${params.length}`);
    }
    if (dto.avatarUrl !== undefined) {
      params.push(dto.avatarUrl);
      updates.push(`avatar_url = $${params.length}`);
    }
    if (dto.bannerUrl !== undefined) {
      params.push(dto.bannerUrl);
      updates.push(`banner_url = $${params.length}`);
    }
    if (dto.visibility) {
      params.push(dto.visibility);
      updates.push(`visibility = $${params.length}`);
    }
    if (dto.guidelines) {
      params.push(JSON.stringify(dto.guidelines));
      updates.push(`guidelines = $${params.length}`);
    }

    updates.push(`updated_at = NOW()`);

    const res = await this.databaseService.query(
      `UPDATE communities SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      params,
    );

    const memRes = await this.databaseService.query(
      `SELECT role, status FROM community_memberships WHERE community_id = $1 AND user_id = $2`,
      [communityId, userId],
    );

    return this.mapCommunityRow(res.rows[0], memRes.rows[0]?.role, memRes.rows[0]?.status);
  }

  // --------------------------------------------------------------------------
  // 2. Membership & Roles (Join, Leave, Request, Invite, Role Escalation Guard)
  // --------------------------------------------------------------------------

  async joinCommunity(userId: string, communityId: string): Promise<CommunityMemberItem> {
    const commRes = await this.databaseService.query(
      `SELECT * FROM communities WHERE id = $1 AND is_active = TRUE`,
      [communityId],
    );
    if (commRes.rows.length === 0) {
      throw new NotFoundException('Community not found');
    }
    const community = commRes.rows[0];

    // Check existing membership
    const existing = await this.databaseService.query(
      `SELECT * FROM community_memberships WHERE community_id = $1 AND user_id = $2`,
      [communityId, userId],
    );

    if (existing.rows.length > 0) {
      const current = existing.rows[0];
      if (current.status === 'BANNED') {
        throw new ForbiddenException(`You are banned from this community: "${current.ban_reason || 'Community rules violation'}"`);
      }
      if (current.status === 'ACTIVE') {
        throw new BadRequestException('You are already an active member of this community');
      }
      if (current.status === 'PENDING_REQUEST') {
        throw new BadRequestException('Your join request is already pending review');
      }
    }

    // Determine initial status based on community visibility
    if (community.visibility === 'PUBLIC') {
      // Direct join
      const res = await this.databaseService.query(
        `INSERT INTO community_memberships (community_id, user_id, role, status, joined_at, created_at, updated_at)
         VALUES ($1, $2, 'MEMBER', 'ACTIVE', NOW(), NOW(), NOW())
         ON CONFLICT (community_id, user_id)
         DO UPDATE SET status = 'ACTIVE', role = 'MEMBER', joined_at = NOW(), updated_at = NOW()
         RETURNING *`,
        [communityId, userId],
      );

      // Increment members_count
      await this.databaseService.query(
        `UPDATE communities SET members_count = members_count + 1 WHERE id = $1`,
        [communityId],
      );

      const user = await this.getUserInfo(userId);
      return this.mapMemberRow(res.rows[0], user);
    } else {
      // RESTRICTED or PRIVATE: Requires Moderator Approval
      const res = await this.databaseService.query(
        `INSERT INTO community_memberships (community_id, user_id, role, status, joined_at, created_at, updated_at)
         VALUES ($1, $2, 'MEMBER', 'PENDING_REQUEST', NULL, NOW(), NOW())
         ON CONFLICT (community_id, user_id)
         DO UPDATE SET status = 'PENDING_REQUEST', updated_at = NOW()
         RETURNING *`,
        [communityId, userId],
      );

      const user = await this.getUserInfo(userId);
      return this.mapMemberRow(res.rows[0], user);
    }
  }

  async leaveCommunity(userId: string, communityId: string): Promise<{ left: boolean; communityId: string }> {
    const mem = await this.databaseService.query(
      `SELECT role, status FROM community_memberships WHERE community_id = $1 AND user_id = $2`,
      [communityId, userId],
    );

    if (mem.rows.length === 0 || mem.rows[0].status !== 'ACTIVE') {
      throw new BadRequestException('You are not an active member of this community');
    }

    // OWNER CANNOT LEAVE WITHOUT HANDOVER
    if (mem.rows[0].role === 'OWNER') {
      throw new BadRequestException(
        'Community owner cannot leave without transferring ownership to another member first',
      );
    }

    await this.databaseService.query(
      `DELETE FROM community_memberships WHERE community_id = $1 AND user_id = $2`,
      [communityId, userId],
    );

    await this.databaseService.query(
      `UPDATE communities SET members_count = GREATEST(members_count - 1, 1) WHERE id = $1`,
      [communityId],
    );

    return { left: true, communityId };
  }

  async inviteUser(
    inviterId: string,
    communityId: string,
    dto: InviteCommunityMemberInputDto,
  ): Promise<CommunityMemberItem> {
    // Inviter must be an active member of the community
    const inviterMem = await this.databaseService.query(
      `SELECT role, status FROM community_memberships WHERE community_id = $1 AND user_id = $2 AND status = 'ACTIVE'`,
      [communityId, inviterId],
    );
    if (inviterMem.rows.length === 0) {
      throw new ForbiddenException('Only active community members can invite other users');
    }

    // SPAM PROTECTION: Limit invitations to 20 per day per user
    const inviteCountRes = await this.databaseService.query(
      `SELECT COUNT(*)::int as count FROM community_memberships
       WHERE community_id = $1 AND invited_by = $2 AND created_at > NOW() - INTERVAL '24 hours'`,
      [communityId, inviterId],
    );
    if (inviteCountRes.rows[0].count >= 20) {
      throw new BadRequestException('Daily invitation limit reached (20 invites per 24 hours)');
    }

    // Check target user's existing membership
    const targetMem = await this.databaseService.query(
      `SELECT * FROM community_memberships WHERE community_id = $1 AND user_id = $2`,
      [communityId, dto.userId],
    );

    if (targetMem.rows.length > 0) {
      const current = targetMem.rows[0];
      if (current.status === 'ACTIVE') {
        throw new BadRequestException('User is already an active member of this community');
      }
      if (current.status === 'INVITED') {
        throw new BadRequestException('An invitation is already pending for this user');
      }
      if (current.status === 'BANNED') {
        throw new ForbiddenException('Cannot invite a banned user to the community');
      }
    }

    const res = await this.databaseService.query(
      `INSERT INTO community_memberships (community_id, user_id, role, status, invited_by, created_at, updated_at)
       VALUES ($1, $2, 'MEMBER', 'INVITED', $3, NOW(), NOW())
       ON CONFLICT (community_id, user_id)
       DO UPDATE SET status = 'INVITED', invited_by = $3, updated_at = NOW()
       RETURNING *`,
      [communityId, dto.userId, inviterId],
    );

    const user = await this.getUserInfo(dto.userId);
    return this.mapMemberRow(res.rows[0], user);
  }

  async respondToInvitation(
    userId: string,
    communityId: string,
    action: 'ACCEPT' | 'DECLINE',
  ): Promise<{ status: CommunityMemberStatus }> {
    const memRes = await this.databaseService.query(
      `SELECT * FROM community_memberships WHERE community_id = $1 AND user_id = $2 AND status = 'INVITED'`,
      [communityId, userId],
    );

    if (memRes.rows.length === 0) {
      throw new NotFoundException('No pending invitation found for this community');
    }

    if (action === 'ACCEPT') {
      await this.databaseService.query(
        `UPDATE community_memberships SET status = 'ACTIVE', joined_at = NOW(), updated_at = NOW()
         WHERE community_id = $1 AND user_id = $2`,
        [communityId, userId],
      );
      await this.databaseService.query(
        `UPDATE communities SET members_count = members_count + 1 WHERE id = $1`,
        [communityId],
      );
      return { status: 'ACTIVE' };
    } else {
      await this.databaseService.query(
        `DELETE FROM community_memberships WHERE community_id = $1 AND user_id = $2`,
        [communityId, userId],
      );
      return { status: 'MEMBER' as any };
    }
  }

  async reviewJoinRequest(
    moderatorId: string,
    communityId: string,
    targetUserId: string,
    action: 'APPROVE' | 'REJECT',
  ): Promise<{ status: CommunityMemberStatus }> {
    await this.requireRole(moderatorId, communityId, ['OWNER', 'ADMIN', 'MODERATOR']);

    const memRes = await this.databaseService.query(
      `SELECT * FROM community_memberships WHERE community_id = $1 AND user_id = $2 AND status = 'PENDING_REQUEST'`,
      [communityId, targetUserId],
    );

    if (memRes.rows.length === 0) {
      throw new NotFoundException('No pending join request found for this user');
    }

    if (action === 'APPROVE') {
      await this.databaseService.query(
        `UPDATE community_memberships SET status = 'ACTIVE', joined_at = NOW(), updated_at = NOW()
         WHERE community_id = $1 AND user_id = $2`,
        [communityId, targetUserId],
      );
      await this.databaseService.query(
        `UPDATE communities SET members_count = members_count + 1 WHERE id = $1`,
        [communityId],
      );
      return { status: 'ACTIVE' };
    } else {
      await this.databaseService.query(
        `DELETE FROM community_memberships WHERE community_id = $1 AND user_id = $2`,
        [communityId, targetUserId],
      );
      return { status: 'MEMBER' as any };
    }
  }

  // --------------------------------------------------------------------------
  // 3. Permission Escalation Guard & Moderator Appointments
  // --------------------------------------------------------------------------

  async updateMemberRole(
    requesterId: string,
    communityId: string,
    targetUserId: string,
    dto: UpdateCommunityMemberRoleInputDto,
  ): Promise<CommunityMemberItem> {
    // 1. Only OWNER or ADMIN can modify roles
    const requesterMem = await this.requireRole(requesterId, communityId, ['OWNER', 'ADMIN']);

    if (requesterId === targetUserId) {
      throw new BadRequestException('You cannot modify your own role');
    }

    const targetMemRes = await this.databaseService.query(
      `SELECT * FROM community_memberships WHERE community_id = $1 AND user_id = $2 AND status = 'ACTIVE'`,
      [communityId, targetUserId],
    );

    if (targetMemRes.rows.length === 0) {
      throw new NotFoundException('Target user is not an active member of this community');
    }

    const targetMem = targetMemRes.rows[0];

    // PERMISSION ESCALATION PROTECTION:
    // A. Cannot promote to OWNER via updateMemberRole (must use handoverOwnership)
    if (dto.role === 'OWNER') {
      throw new BadRequestException('Cannot promote to OWNER via role update. Use ownership handover.');
    }

    // B. Target is currently OWNER: Nobody can demote the owner
    if (targetMem.role === 'OWNER') {
      throw new ForbiddenException('Cannot change the role of the community owner');
    }

    // C. Requester is ADMIN: cannot demote another ADMIN, only OWNER can
    if (requesterMem.role === 'ADMIN' && targetMem.role === 'ADMIN') {
      throw new ForbiddenException('Only the community owner can demote an admin');
    }

    const res = await this.databaseService.query(
      `UPDATE community_memberships SET role = $1, updated_at = NOW()
       WHERE community_id = $2 AND user_id = $3
       RETURNING *`,
      [dto.role, communityId, targetUserId],
    );

    this.logger.log(
      `Role of ${targetUserId} in community ${communityId} updated to ${dto.role} by ${requesterId}`,
    );

    const user = await this.getUserInfo(targetUserId);
    return this.mapMemberRow(res.rows[0], user);
  }

  async moderateMember(
    moderatorId: string,
    communityId: string,
    targetUserId: string,
    dto: ModerateCommunityMemberInputDto,
  ): Promise<{ action: string; targetUserId: string }> {
    const modMem = await this.requireRole(moderatorId, communityId, ['OWNER', 'ADMIN', 'MODERATOR']);

    if (moderatorId === targetUserId) {
      throw new BadRequestException('You cannot perform moderation actions on yourself');
    }

    const targetMemRes = await this.databaseService.query(
      `SELECT * FROM community_memberships WHERE community_id = $1 AND user_id = $2`,
      [communityId, targetUserId],
    );

    if (targetMemRes.rows.length === 0) {
      throw new NotFoundException('Target user is not a member of this community');
    }

    const targetMem = targetMemRes.rows[0];

    // MODERATOR REMOVAL SECURITY:
    // A. Cannot moderate the OWNER
    if (targetMem.role === 'OWNER') {
      throw new ForbiddenException('Cannot perform moderation actions on the community owner');
    }

    // B. A MODERATOR cannot moderate or remove another MODERATOR or an ADMIN
    if (modMem.role === 'MODERATOR') {
      if (targetMem.role === 'MODERATOR' || targetMem.role === 'ADMIN') {
        throw new ForbiddenException('Moderators cannot moderate other staff members');
      }
    }

    // C. An ADMIN cannot moderate another ADMIN (only OWNER can)
    if (modMem.role === 'ADMIN' && targetMem.role === 'ADMIN') {
      throw new ForbiddenException('Only the community owner can moderate an admin');
    }

    if (dto.action === 'BAN') {
      await this.databaseService.query(
        `UPDATE community_memberships
         SET status = 'BANNED', ban_reason = $1, role = 'MEMBER', updated_at = NOW()
         WHERE community_id = $2 AND user_id = $3`,
        [dto.reason || 'Violated community guidelines', communityId, targetUserId],
      );
      await this.databaseService.query(
        `UPDATE communities SET members_count = GREATEST(members_count - 1, 1) WHERE id = $1`,
        [communityId],
      );
    } else if (dto.action === 'MUTE') {
      const hours = dto.muteDurationHours && dto.muteDurationHours > 0 ? dto.muteDurationHours : 24;
      await this.databaseService.query(
        `UPDATE community_memberships
         SET status = 'MUTED', muted_until = NOW() + ($1 || ' hours')::interval, updated_at = NOW()
         WHERE community_id = $2 AND user_id = $3`,
        [hours.toString(), communityId, targetUserId],
      );
    } else if (dto.action === 'UNBAN') {
      await this.databaseService.query(
        `UPDATE community_memberships
         SET status = 'ACTIVE', ban_reason = NULL, joined_at = NOW(), updated_at = NOW()
         WHERE community_id = $1 AND user_id = $2`,
        [communityId, targetUserId],
      );
      await this.databaseService.query(
        `UPDATE communities SET members_count = members_count + 1 WHERE id = $1`,
        [communityId],
      );
    } else if (dto.action === 'UNMUTE') {
      await this.databaseService.query(
        `UPDATE community_memberships
         SET status = 'ACTIVE', muted_until = NULL, updated_at = NOW()
         WHERE community_id = $1 AND user_id = $2`,
        [communityId, targetUserId],
      );
    }

    return { action: dto.action, targetUserId };
  }

  async handoverOwnership(
    currentOwnerId: string,
    communityId: string,
    dto: HandoverCommunityOwnershipInputDto,
  ): Promise<{ handedOver: boolean; newOwnerId: string }> {
    const ownerMem = await this.databaseService.query(
      `SELECT role FROM community_memberships WHERE community_id = $1 AND user_id = $2`,
      [communityId, currentOwnerId],
    );

    if (ownerMem.rows.length === 0 || ownerMem.rows[0].role !== 'OWNER') {
      throw new ForbiddenException('Only the current community owner can initiate an ownership handover');
    }

    if (currentOwnerId === dto.newOwnerId) {
      throw new BadRequestException('You are already the owner of this community');
    }

    const newOwnerMem = await this.databaseService.query(
      `SELECT * FROM community_memberships WHERE community_id = $1 AND user_id = $2 AND status = 'ACTIVE'`,
      [communityId, dto.newOwnerId],
    );

    if (newOwnerMem.rows.length === 0) {
      throw new NotFoundException('Target new owner must be an active member of this community');
    }

    // Atomic Role Transfer: Demote old owner to ADMIN, promote target to OWNER
    await this.databaseService.query(
      `UPDATE community_memberships SET role = 'ADMIN', updated_at = NOW()
       WHERE community_id = $1 AND user_id = $2`,
      [communityId, currentOwnerId],
    );

    await this.databaseService.query(
      `UPDATE community_memberships SET role = 'OWNER', updated_at = NOW()
       WHERE community_id = $1 AND user_id = $2`,
      [communityId, dto.newOwnerId],
    );

    await this.databaseService.query(
      `UPDATE communities SET creator_id = $1, updated_at = NOW() WHERE id = $2`,
      [dto.newOwnerId, communityId],
    );

    this.logger.warn(`Ownership of community ${communityId} transferred from ${currentOwnerId} to ${dto.newOwnerId}`);

    return { handedOver: true, newOwnerId: dto.newOwnerId };
  }

  // --------------------------------------------------------------------------
  // 4. Content: Discussions, Collaborative Posts, Pinned Posts, Collections
  // --------------------------------------------------------------------------

  async createPost(
    userId: string,
    communityId: string,
    dto: CreateCommunityPostInputDto,
  ): Promise<CommunityPostItem> {
    const mem = await this.databaseService.query(
      `SELECT role, status, muted_until FROM community_memberships WHERE community_id = $1 AND user_id = $2`,
      [communityId, userId],
    );

    if (mem.rows.length === 0 || mem.rows[0].status !== 'ACTIVE') {
      if (mem.rows[0]?.status === 'MUTED') {
        throw new ForbiddenException(`You are currently muted in this community until ${mem.rows[0].muted_until}`);
      }
      throw new ForbiddenException('You must be an active member to create posts in this community');
    }

    const memberRole: CommunityMemberRole = mem.rows[0].role;

    // Content moderation pre-check
    const textToCheck = `${dto.title} ${dto.body}`.toLowerCase();
    for (const term of this.prohibitedTerms) {
      if (textToCheck.includes(term)) {
        throw new BadRequestException(`Post contains prohibited content: "${term}"`);
      }
    }

    // Pinned & Announcement permissions check: only OWNER, ADMIN, MODERATOR
    let isPinned = false;
    let isAnnouncement = false;
    if (dto.isPinned || dto.isAnnouncement) {
      if (['OWNER', 'ADMIN', 'MODERATOR'].includes(memberRole)) {
        isPinned = dto.isPinned || false;
        isAnnouncement = dto.isAnnouncement || false;
      }
    }

    const postType = dto.postType || 'DISCUSSION';
    const isCollab = postType === 'COLLABORATIVE' && dto.collaboratorIds && dto.collaboratorIds.length > 0;
    const collabStatus = isCollab ? 'PENDING' : 'NONE';

    const postRes = await this.databaseService.query(
      `INSERT INTO community_posts
       (community_id, author_id, post_type, title, body, media_urls, reel_id, is_pinned, pinned_at, is_announcement, collaboration_status, likes_count, comments_count, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, 0, NOW(), NOW())
       RETURNING *`,
      [
        communityId,
        userId,
        postType,
        dto.title,
        dto.body,
        JSON.stringify(dto.mediaUrls || []),
        dto.reelId || null,
        isPinned,
        isPinned ? new Date() : null,
        isAnnouncement,
        collabStatus,
      ],
    );

    const postRow = postRes.rows[0];

    // If collaborative, insert invitations into community_post_collaborators
    if (isCollab) {
      for (const collabId of dto.collaboratorIds!) {
        if (collabId !== userId) {
          await this.databaseService.query(
            `INSERT INTO community_post_collaborators (post_id, collaborator_id, status, invited_at)
             VALUES ($1, $2, 'PENDING', NOW())
             ON CONFLICT DO NOTHING`,
            [postRow.id, collabId],
          );
        }
      }
    }

    await this.databaseService.query(
      `UPDATE communities SET posts_count = posts_count + 1 WHERE id = $1`,
      [communityId],
    );

    const author = await this.getUserInfo(userId);
    return this.mapPostRow(postRow, author, []);
  }

  async listPosts(
    userId: string,
    communityId: string,
    options: { postType?: CommunityPostType; pinnedOnly?: boolean },
  ): Promise<CommunityPostItem[]> {
    // Check community accessibility
    await this.getCommunity(userId, communityId);

    let query = `
      SELECT p.*,
             u.username as author_username,
             u.display_name as author_display_name,
             u.avatar_url as author_avatar_url,
             u.is_verified as author_is_verified
      FROM community_posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.community_id = $1 AND p.deleted_at IS NULL
    `;
    const params: any[] = [communityId];

    // If post is collaborative and pending, only show to author or invited collaborator
    query += `
      AND (
        p.collaboration_status != 'PENDING'
        OR p.author_id = $2
        OR EXISTS (
          SELECT 1 FROM community_post_collaborators cpc
          WHERE cpc.post_id = p.id AND cpc.collaborator_id = $2
        )
      )
    `;
    params.push(userId);

    if (options.pinnedOnly) {
      query += ` AND p.is_pinned = TRUE`;
    }

    if (options.postType) {
      params.push(options.postType);
      query += ` AND p.post_type = $${params.length}`;
    }

    query += ` ORDER BY p.is_pinned DESC, p.created_at DESC LIMIT 50`;

    const res = await this.databaseService.query(query, params);

    const postItems: CommunityPostItem[] = [];
    for (const row of res.rows) {
      const author = {
        id: row.author_id,
        username: row.author_username,
        displayName: row.author_display_name,
        avatarUrl: row.author_avatar_url,
        isVerified: row.author_is_verified,
      };

      const collabRes = await this.databaseService.query(
        `SELECT cpc.*, u.username, u.display_name, u.avatar_url
         FROM community_post_collaborators cpc
         JOIN users u ON cpc.collaborator_id = u.id
         WHERE cpc.post_id = $1`,
        [row.id],
      );

      const collaborators = collabRes.rows.map((c) => ({
        userId: c.collaborator_id,
        username: c.username,
        displayName: c.display_name,
        avatarUrl: c.avatar_url,
        status: c.status,
        respondedAt: c.responded_at ? new Date(c.responded_at).toISOString() : null,
      }));

      postItems.push(this.mapPostRow(row, author, collaborators));
    }

    return postItems;
  }

  async respondToCollaboration(
    userId: string,
    postId: string,
    dto: RespondPostCollaborationInputDto,
  ): Promise<{ status: string }> {
    const res = await this.databaseService.query(
      `UPDATE community_post_collaborators
       SET status = $1, responded_at = NOW()
       WHERE post_id = $2 AND collaborator_id = $3
       RETURNING *`,
      [dto.status, postId, userId],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException('Collaboration invitation not found');
    }

    // Check if all/any collaborators responded
    if (dto.status === 'ACCEPTED') {
      await this.databaseService.query(
        `UPDATE community_posts SET collaboration_status = 'ACCEPTED' WHERE id = $1`,
        [postId],
      );
    }

    return { status: dto.status };
  }

  async togglePinPost(
    userId: string,
    communityId: string,
    postId: string,
  ): Promise<{ isPinned: boolean; postId: string }> {
    await this.requireRole(userId, communityId, ['OWNER', 'ADMIN', 'MODERATOR']);

    const postRes = await this.databaseService.query(
      `SELECT is_pinned FROM community_posts WHERE id = $1 AND community_id = $2 AND deleted_at IS NULL`,
      [postId, communityId],
    );

    if (postRes.rows.length === 0) {
      throw new NotFoundException('Post not found in community');
    }

    const nextPinned = !postRes.rows[0].is_pinned;

    await this.databaseService.query(
      `UPDATE community_posts
       SET is_pinned = $1, pinned_at = $2, updated_at = NOW()
       WHERE id = $3`,
      [nextPinned, nextPinned ? new Date() : null, postId],
    );

    return { isPinned: nextPinned, postId };
  }

  // --------------------------------------------------------------------------
  // 5. Shared Video Collections
  // --------------------------------------------------------------------------

  async createCollection(
    userId: string,
    communityId: string,
    dto: CreateCommunityCollectionInputDto,
  ): Promise<CommunityCollectionItem> {
    await this.requireRole(userId, communityId, ['OWNER', 'ADMIN', 'MODERATOR', 'MEMBER']);

    const res = await this.databaseService.query(
      `INSERT INTO community_collections (community_id, creator_id, title, description, is_curated, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [communityId, userId, dto.title, dto.description || '', dto.isCurated || false],
    );

    const row = res.rows[0];
    return {
      id: row.id,
      communityId: row.community_id,
      creatorId: row.creator_id,
      title: row.title,
      description: row.description,
      isCurated: row.is_curated,
      itemsCount: 0,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  async addReelToCollection(
    userId: string,
    communityId: string,
    collectionId: string,
    dto: AddReelToCommunityCollectionInputDto,
  ): Promise<{ added: boolean; reelId: string }> {
    await this.requireRole(userId, communityId, ['OWNER', 'ADMIN', 'MODERATOR', 'MEMBER']);

    const colCheck = await this.databaseService.query(
      `SELECT id FROM community_collections WHERE id = $1 AND community_id = $2`,
      [collectionId, communityId],
    );
    if (colCheck.rows.length === 0) {
      throw new NotFoundException('Collection not found in this community');
    }

    await this.databaseService.query(
      `INSERT INTO community_collection_items (collection_id, reel_id, added_by, added_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (collection_id, reel_id) DO NOTHING`,
      [collectionId, dto.reelId, userId],
    );

    return { added: true, reelId: dto.reelId };
  }

  async listCollections(userId: string, communityId: string): Promise<CommunityCollectionItem[]> {
    await this.getCommunity(userId, communityId);

    const res = await this.databaseService.query(
      `SELECT cc.*, COUNT(cci.id)::int as items_count
       FROM community_collections cc
       LEFT JOIN community_collection_items cci ON cc.id = cci.collection_id
       WHERE cc.community_id = $1
       GROUP BY cc.id
       ORDER BY cc.is_curated DESC, cc.created_at DESC`,
      [communityId],
    );

    return res.rows.map((row) => ({
      id: row.id,
      communityId: row.community_id,
      creatorId: row.creator_id,
      title: row.title,
      description: row.description,
      isCurated: row.is_curated,
      itemsCount: row.items_count,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  // --------------------------------------------------------------------------
  // 6. Accountable Moderation Queue, Reports & Member Appeals
  // --------------------------------------------------------------------------

  async reportTarget(
    userId: string,
    communityId: string,
    dto: ReportCommunityTargetInputDto,
  ): Promise<{ reported: boolean; reportId: string }> {
    const res = await this.databaseService.query(
      `INSERT INTO community_reports (community_id, reporter_id, target_type, target_id, reason, details, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', NOW())
       RETURNING id`,
      [communityId, userId, dto.targetType, dto.targetId, dto.reason, dto.details || null],
    );

    this.logger.warn(
      `Report filed in community ${communityId} by ${userId} against ${dto.targetType} ${dto.targetId} for ${dto.reason}`,
    );

    return { reported: true, reportId: res.rows[0].id };
  }

  async getModerationQueue(userId: string, communityId: string): Promise<CommunityReportItem[]> {
    await this.requireRole(userId, communityId, ['OWNER', 'ADMIN', 'MODERATOR']);

    const res = await this.databaseService.query(
      `SELECT * FROM community_reports
       WHERE community_id = $1 AND status = 'PENDING'
       ORDER BY created_at ASC`,
      [communityId],
    );

    return res.rows.map((r) => ({
      id: r.id,
      communityId: r.community_id,
      reporterId: r.reporter_id,
      targetType: r.target_type,
      targetId: r.target_id,
      reason: r.reason,
      details: r.details,
      status: r.status,
      actionTaken: r.action_taken,
      reviewedBy: r.reviewed_by,
      reviewedAt: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : null,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  }

  async reviewReport(
    moderatorId: string,
    communityId: string,
    reportId: string,
    dto: ReviewCommunityReportInputDto,
  ): Promise<{ resolved: boolean; actionTaken: string }> {
    await this.requireRole(moderatorId, communityId, ['OWNER', 'ADMIN', 'MODERATOR']);

    const repRes = await this.databaseService.query(
      `SELECT * FROM community_reports WHERE id = $1 AND community_id = $2`,
      [reportId, communityId],
    );

    if (repRes.rows.length === 0) {
      throw new NotFoundException('Report not found');
    }

    const report = repRes.rows[0];
    const actionTaken = dto.actionTaken || 'NO_ACTION';

    if (actionTaken === 'REMOVE_POST' && report.target_type === 'POST') {
      await this.databaseService.query(
        `UPDATE community_posts SET deleted_at = NOW() WHERE id = $1`,
        [report.target_id],
      );
    } else if (actionTaken === 'BAN_MEMBER' && report.target_type === 'MEMBER') {
      await this.moderateMember(moderatorId, communityId, report.target_id, {
        action: 'BAN',
        reason: `Report resolved: ${report.reason}`,
      });
    }

    await this.databaseService.query(
      `UPDATE community_reports
       SET status = $1, action_taken = $2, reviewed_by = $3, reviewed_at = NOW()
       WHERE id = $4`,
      [dto.status, actionTaken, moderatorId, reportId],
    );

    return { resolved: true, actionTaken };
  }

  async submitAppeal(
    userId: string,
    communityId: string,
    dto: SubmitCommunityAppealInputDto,
  ): Promise<{ submitted: boolean; appealId: string }> {
    // Appellant must be banned or have taken action
    const memRes = await this.databaseService.query(
      `SELECT status FROM community_memberships WHERE community_id = $1 AND user_id = $2`,
      [communityId, userId],
    );

    if (memRes.rows.length === 0 || memRes.rows[0].status !== 'BANNED') {
      throw new BadRequestException('Appeals can only be submitted for banned accounts');
    }

    const res = await this.databaseService.query(
      `INSERT INTO community_appeals (community_id, appellant_id, ban_or_action_id, appeal_reason, status, created_at)
       VALUES ($1, $2, $3, $4, 'PENDING', NOW())
       RETURNING id`,
      [communityId, userId, dto.banOrActionId || null, dto.appealReason],
    );

    return { submitted: true, appealId: res.rows[0].id };
  }

  async listAppeals(userId: string, communityId: string): Promise<CommunityAppealItem[]> {
    await this.requireRole(userId, communityId, ['OWNER', 'ADMIN', 'MODERATOR']);

    const res = await this.databaseService.query(
      `SELECT ca.*, u.username, u.display_name, u.avatar_url
       FROM community_appeals ca
       JOIN users u ON ca.appellant_id = u.id
       WHERE ca.community_id = $1 AND ca.status = 'PENDING'
       ORDER BY ca.created_at ASC`,
      [communityId],
    );

    return res.rows.map((row) => ({
      id: row.id,
      communityId: row.community_id,
      appellantId: row.appellant_id,
      appellant: {
        id: row.appellant_id,
        username: row.username,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
      },
      banOrActionId: row.ban_or_action_id,
      appealReason: row.appeal_reason,
      status: row.status,
      reviewNotes: row.review_notes,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  async reviewAppeal(
    moderatorId: string,
    communityId: string,
    appealId: string,
    dto: ReviewCommunityAppealInputDto,
  ): Promise<{ status: string }> {
    await this.requireRole(moderatorId, communityId, ['OWNER', 'ADMIN', 'MODERATOR']);

    const appealRes = await this.databaseService.query(
      `SELECT * FROM community_appeals WHERE id = $1 AND community_id = $2`,
      [appealId, communityId],
    );

    if (appealRes.rows.length === 0) {
      throw new NotFoundException('Appeal not found');
    }

    const appeal = appealRes.rows[0];

    if (dto.status === 'APPROVED') {
      // Unban member!
      await this.moderateMember(moderatorId, communityId, appeal.appellant_id, {
        action: 'UNBAN',
      });
    }

    await this.databaseService.query(
      `UPDATE community_appeals
       SET status = $1, review_notes = $2, reviewed_by = $3, reviewed_at = NOW()
       WHERE id = $4`,
      [dto.status, dto.reviewNotes || null, moderatorId, appealId],
    );

    return { status: dto.status };
  }

  // --------------------------------------------------------------------------
  // Helpers & Role Checker
  // --------------------------------------------------------------------------

  private async requireRole(
    userId: string,
    communityId: string,
    allowedRoles: CommunityMemberRole[],
  ): Promise<{ role: CommunityMemberRole; status: CommunityMemberStatus }> {
    const res = await this.databaseService.query(
      `SELECT role, status FROM community_memberships
       WHERE community_id = $1 AND user_id = $2`,
      [communityId, userId],
    );

    if (res.rows.length === 0 || res.rows[0].status !== 'ACTIVE') {
      throw new ForbiddenException('You are not an active member of this community');
    }

    const role = res.rows[0].role as CommunityMemberRole;
    if (!allowedRoles.includes(role)) {
      throw new ForbiddenException(
        `Insufficient permissions: required one of [${allowedRoles.join(', ')}], but have ${role}`,
      );
    }

    return { role, status: res.rows[0].status };
  }

  private async getUserInfo(userId: string) {
    const res = await this.databaseService.query(
      `SELECT id, username, display_name, avatar_url, is_verified FROM users WHERE id = $1`,
      [userId],
    );
    if (res.rows.length === 0) {
      return { id: userId, username: 'unknown', displayName: 'Unknown', avatarUrl: null, isVerified: false };
    }
    const r = res.rows[0];
    return {
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      isVerified: r.is_verified,
    };
  }

  private mapCommunityRow(
    row: any,
    userRole: CommunityMemberRole | null,
    userStatus: CommunityMemberStatus | null,
  ): CommunityItem {
    const guidelines = typeof row.guidelines === 'string'
      ? JSON.parse(row.guidelines)
      : row.guidelines || [];

    return {
      id: row.id,
      creatorId: row.creator_id,
      interestId: row.interest_id,
      name: row.name,
      slug: row.slug,
      description: row.description || '',
      avatarUrl: row.avatar_url || null,
      bannerUrl: row.banner_url || null,
      visibility: row.visibility as CommunityVisibility,
      guidelines,
      membersCount: parseInt(row.members_count || '1', 10),
      postsCount: parseInt(row.posts_count || '0', 10),
      isActive: row.is_active,
      userRole,
      userStatus,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  private mapMemberRow(row: any, user: any): CommunityMemberItem {
    return {
      id: row.id,
      communityId: row.community_id,
      userId: row.user_id,
      user,
      role: row.role as CommunityMemberRole,
      status: row.status as CommunityMemberStatus,
      invitedBy: row.invited_by || null,
      banReason: row.ban_reason || null,
      mutedUntil: row.muted_until ? new Date(row.muted_until).toISOString() : null,
      joinedAt: row.joined_at ? new Date(row.joined_at).toISOString() : null,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  private mapPostRow(row: any, author: any, collaborators: any[]): CommunityPostItem {
    const mediaUrls = typeof row.media_urls === 'string'
      ? JSON.parse(row.media_urls)
      : row.media_urls || [];

    return {
      id: row.id,
      communityId: row.community_id,
      authorId: row.author_id,
      author,
      postType: row.post_type as CommunityPostType,
      title: row.title,
      body: row.body,
      mediaUrls,
      reelId: row.reel_id || null,
      isPinned: row.is_pinned,
      pinnedAt: row.pinned_at ? new Date(row.pinned_at).toISOString() : null,
      isAnnouncement: row.is_announcement,
      collaborationStatus: row.collaboration_status,
      collaborators,
      likesCount: parseInt(row.likes_count || '0', 10),
      commentsCount: parseInt(row.comments_count || '0', 10),
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }
}
