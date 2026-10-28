import {
  Controller,
  Get,
  Put,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { ProfileService } from './profile.service';
import {
  UpdateProfileDto,
  RespondFollowRequestDto,
  ProfilePaginationDto,
  MentionSearchDto,
} from './dto/profile.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserProfile, FollowRequestItem, FollowProfileItem } from '@shared/types';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  // ==========================================================================
  // 1. OWN PROFILE MANAGEMENT
  // ==========================================================================

  @Get('me')
  async getMyProfile(@CurrentUser('userId') userId: string): Promise<UserProfile> {
    return this.profileService.getProfile(userId, userId);
  }

  @Put('me')
  async updateProfile(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfile> {
    return this.profileService.updateProfile(userId, dto);
  }

  @Patch('me')
  async patchProfile(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfile> {
    return this.profileService.updateProfile(userId, dto);
  }

  // ==========================================================================
  // 2. DISCOVERY & MENTIONS
  // ==========================================================================

  @Get('recommendations')
  async getRecommendations(
    @CurrentUser('userId') userId: string,
    @Query('limit') limit?: string,
  ): Promise<FollowProfileItem[]> {
    const parsedLimit = limit ? parseInt(limit, 10) : 15;
    return this.profileService.getProfileRecommendations(userId, parsedLimit);
  }

  @Get('mentions/search')
  async searchMentions(
    @CurrentUser('userId') userId: string,
    @Query() query: MentionSearchDto,
  ): Promise<FollowProfileItem[]> {
    return this.profileService.searchMentionCandidates(userId, query.q, query.limit || 20);
  }

  // ==========================================================================
  // 3. PRIVATE ACCOUNT FOLLOW REQUESTS
  // ==========================================================================

  @Get('follow-requests/pending')
  async getPendingFollowRequests(
    @CurrentUser('userId') userId: string,
    @Query() pagination: ProfilePaginationDto,
  ): Promise<FollowRequestItem[]> {
    return this.profileService.getPendingFollowRequests(
      userId,
      pagination.limit || 20,
      pagination.offset || 0,
    );
  }

  @Post('follow-requests/:requestId/respond')
  @HttpCode(HttpStatus.OK)
  async respondFollowRequest(
    @CurrentUser('userId') userId: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: RespondFollowRequestDto,
  ) {
    return this.profileService.respondFollowRequest(userId, requestId, dto.action);
  }

  @Delete('follow-requests/cancel/:targetUserId')
  @HttpCode(HttpStatus.OK)
  async cancelFollowRequest(
    @CurrentUser('userId') userId: string,
    @Param('targetUserId', ParseUUIDPipe) targetUserId: string,
  ) {
    return this.profileService.cancelFollowRequest(userId, targetUserId);
  }

  // ==========================================================================
  // 4. RESTRICTIONS
  // ==========================================================================

  @Get('restricts')
  async getRestrictedUsers(@CurrentUser('userId') userId: string): Promise<FollowProfileItem[]> {
    return this.profileService.getRestrictedUsers(userId);
  }

  @Post(':userId/restrict')
  @HttpCode(HttpStatus.OK)
  async restrictUser(
    @CurrentUser('userId') userId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
  ) {
    return this.profileService.restrictUser(userId, targetUserId);
  }

  @Delete(':userId/restrict')
  @HttpCode(HttpStatus.OK)
  async unrestrictUser(
    @CurrentUser('userId') userId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
  ) {
    return this.profileService.unrestrictUser(userId, targetUserId);
  }

  // ==========================================================================
  // 5. SOCIAL GRAPH (Follow / Unfollow)
  // ==========================================================================

  @Post(':userId/follow')
  @HttpCode(HttpStatus.OK)
  async followUser(
    @CurrentUser('userId') followerId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
  ) {
    return this.profileService.followUser(followerId, targetUserId);
  }

  @Delete(':userId/follow')
  @HttpCode(HttpStatus.OK)
  async unfollowUser(
    @CurrentUser('userId') followerId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
  ) {
    return this.profileService.unfollowUser(followerId, targetUserId);
  }

  // ==========================================================================
  // 6. CONTENT TABS
  // ==========================================================================

  @Public()
  @Get(':userId/reels')
  async getProfileReels(
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @Req() req: Request,
    @Query() pagination: ProfilePaginationDto,
  ) {
    const requesterId = (req as any).user?.userId;
    return this.profileService.getProfileReels(
      requesterId,
      targetUserId,
      pagination.limit || 20,
      pagination.cursor,
    );
  }

  @Get(':userId/collections')
  async getProfileCollections(
    @CurrentUser('userId') requesterId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @Query() pagination: ProfilePaginationDto,
  ) {
    return this.profileService.getProfileCollections(
      requesterId,
      targetUserId,
      pagination.limit || 20,
      pagination.offset || 0,
    );
  }

  @Get(':userId/liked')
  async getProfileLikedReels(
    @CurrentUser('userId') requesterId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @Query() pagination: ProfilePaginationDto,
  ) {
    return this.profileService.getProfileLikedReels(
      requesterId,
      targetUserId,
      pagination.limit || 20,
      pagination.cursor,
    );
  }

  // ==========================================================================
  // 7. PUBLIC / VISITOR PROFILE VIEW (UUID or Username)
  // ==========================================================================

  @Public()
  @Get(':identifier')
  async getProfile(
    @Param('identifier') identifier: string,
    @Req() req: Request,
  ): Promise<UserProfile> {
    const requesterId = (req as any).user?.userId;
    return this.profileService.getProfile(requesterId, identifier);
  }
}
