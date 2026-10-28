import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CommunitiesService } from './communities.service';
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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CommunityItem,
  CommunityMemberItem,
  CommunityPostItem,
  CommunityCollectionItem,
  CommunityReportItem,
  CommunityAppealItem,
  CommunityPostType,
} from '@shared/types';

@Controller('communities')
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createCommunity(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateCommunityInputDto,
  ): Promise<CommunityItem> {
    return this.communitiesService.createCommunity(userId, dto);
  }

  @Get()
  async listCommunities(
    @CurrentUser('userId') userId: string,
    @Query('interestId') interestId?: string,
    @Query('joinedOnly') joinedOnly?: string,
    @Query('search') search?: string,
  ): Promise<CommunityItem[]> {
    return this.communitiesService.listCommunities(userId, {
      interestId,
      joinedOnly: joinedOnly === 'true',
      search,
    });
  }

  @Get(':identifier')
  async getCommunity(
    @CurrentUser('userId') userId: string,
    @Param('identifier') identifier: string,
  ): Promise<CommunityItem> {
    return this.communitiesService.getCommunity(userId, identifier);
  }

  @Put(':id')
  async updateCommunity(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) communityId: string,
    @Body() dto: UpdateCommunityInputDto,
  ): Promise<CommunityItem> {
    return this.communitiesService.updateCommunity(userId, communityId, dto);
  }

  @Post(':id/join')
  async joinCommunity(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) communityId: string,
  ): Promise<CommunityMemberItem> {
    return this.communitiesService.joinCommunity(userId, communityId);
  }

  @Post(':id/leave')
  async leaveCommunity(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) communityId: string,
  ): Promise<{ left: boolean; communityId: string }> {
    return this.communitiesService.leaveCommunity(userId, communityId);
  }

  @Post(':id/invite')
  async inviteUser(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) communityId: string,
    @Body() dto: InviteCommunityMemberInputDto,
  ): Promise<CommunityMemberItem> {
    return this.communitiesService.inviteUser(userId, communityId, dto);
  }

  @Post(':id/invitations/respond')
  async respondToInvitation(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) communityId: string,
    @Body('action') action: 'ACCEPT' | 'DECLINE',
  ): Promise<{ status: string }> {
    return this.communitiesService.respondToInvitation(userId, communityId, action);
  }

  @Post(':id/requests/:targetUserId')
  async reviewJoinRequest(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) communityId: string,
    @Param('targetUserId', ParseUUIDPipe) targetUserId: string,
    @Body('action') action: 'APPROVE' | 'REJECT',
  ): Promise<{ status: string }> {
    return this.communitiesService.reviewJoinRequest(userId, communityId, targetUserId, action);
  }

  @Put(':id/members/:targetUserId/role')
  async updateMemberRole(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) communityId: string,
    @Param('targetUserId', ParseUUIDPipe) targetUserId: string,
    @Body() dto: UpdateCommunityMemberRoleInputDto,
  ): Promise<CommunityMemberItem> {
    return this.communitiesService.updateMemberRole(userId, communityId, targetUserId, dto);
  }

  @Post(':id/members/:targetUserId/moderate')
  async moderateMember(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) communityId: string,
    @Param('targetUserId', ParseUUIDPipe) targetUserId: string,
    @Body() dto: ModerateCommunityMemberInputDto,
  ): Promise<{ action: string; targetUserId: string }> {
    return this.communitiesService.moderateMember(userId, communityId, targetUserId, dto);
  }

  @Post(':id/handover')
  async handoverOwnership(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) communityId: string,
    @Body() dto: HandoverCommunityOwnershipInputDto,
  ): Promise<{ handedOver: boolean; newOwnerId: string }> {
    return this.communitiesService.handoverOwnership(userId, communityId, dto);
  }

  @Post(':id/posts')
  @HttpCode(HttpStatus.CREATED)
  async createPost(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) communityId: string,
    @Body() dto: CreateCommunityPostInputDto,
  ): Promise<CommunityPostItem> {
    return this.communitiesService.createPost(userId, communityId, dto);
  }

  @Get(':id/posts')
  async listPosts(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) communityId: string,
    @Query('postType') postType?: CommunityPostType,
    @Query('pinnedOnly') pinnedOnly?: string,
  ): Promise<CommunityPostItem[]> {
    return this.communitiesService.listPosts(userId, communityId, {
      postType,
      pinnedOnly: pinnedOnly === 'true',
    });
  }

  @Post('posts/:postId/collaborate')
  async respondToCollaboration(
    @CurrentUser('userId') userId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() dto: RespondPostCollaborationInputDto,
  ): Promise<{ status: string }> {
    return this.communitiesService.respondToCollaboration(userId, postId, dto);
  }

  @Post(':id/posts/:postId/pin')
  async togglePinPost(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) communityId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
  ): Promise<{ isPinned: boolean; postId: string }> {
    return this.communitiesService.togglePinPost(userId, communityId, postId);
  }

  @Post(':id/collections')
  @HttpCode(HttpStatus.CREATED)
  async createCollection(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) communityId: string,
    @Body() dto: CreateCommunityCollectionInputDto,
  ): Promise<CommunityCollectionItem> {
    return this.communitiesService.createCollection(userId, communityId, dto);
  }

  @Get(':id/collections')
  async listCollections(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) communityId: string,
  ): Promise<CommunityCollectionItem[]> {
    return this.communitiesService.listCollections(userId, communityId);
  }

  @Post(':id/collections/:collectionId/reels')
  async addReelToCollection(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) communityId: string,
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Body() dto: AddReelToCommunityCollectionInputDto,
  ): Promise<{ added: boolean; reelId: string }> {
    return this.communitiesService.addReelToCollection(userId, communityId, collectionId, dto);
  }

  @Post(':id/report')
  async reportTarget(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) communityId: string,
    @Body() dto: ReportCommunityTargetInputDto,
  ): Promise<{ reported: boolean; reportId: string }> {
    return this.communitiesService.reportTarget(userId, communityId, dto);
  }

  @Get(':id/moderation/queue')
  async getModerationQueue(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) communityId: string,
  ): Promise<CommunityReportItem[]> {
    return this.communitiesService.getModerationQueue(userId, communityId);
  }

  @Post(':id/moderation/reports/:reportId')
  async reviewReport(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) communityId: string,
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Body() dto: ReviewCommunityReportInputDto,
  ): Promise<{ resolved: boolean; actionTaken: string }> {
    return this.communitiesService.reviewReport(userId, communityId, reportId, dto);
  }

  @Post(':id/appeals')
  async submitAppeal(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) communityId: string,
    @Body() dto: SubmitCommunityAppealInputDto,
  ): Promise<{ submitted: boolean; appealId: string }> {
    return this.communitiesService.submitAppeal(userId, communityId, dto);
  }

  @Get(':id/moderation/appeals')
  async listAppeals(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) communityId: string,
  ): Promise<CommunityAppealItem[]> {
    return this.communitiesService.listAppeals(userId, communityId);
  }

  @Post(':id/moderation/appeals/:appealId')
  async reviewAppeal(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) communityId: string,
    @Param('appealId', ParseUUIDPipe) appealId: string,
    @Body() dto: ReviewCommunityAppealInputDto,
  ): Promise<{ status: string }> {
    return this.communitiesService.reviewAppeal(userId, communityId, appealId, dto);
  }
}
