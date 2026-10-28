import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CreatorDraftsService } from './creator-drafts.service';
import { CreatorSchedulingService } from './creator-scheduling.service';
import { CreatorAnalyticsService } from './creator-analytics.service';
import { CreatorStudioService } from './creator-studio.service';
import {
  SaveDraftInputDto,
  ScheduleReelInputDto,
  PublishReelInputDto,
  UpdatePublishedReelDto,
  AnalyticsQueryDto,
  RecordEngagementEventDto,
} from './dto/creator.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  ReelDraftItem,
  ScheduledReelItem,
  LicensedSoundItem,
  PublishingSessionResponse,
  CreatorAnalyticsOverview,
  CreatorAudienceInterest,
  RetentionPoint,
  FollowerGrowthPoint,
  CreatorTopReel,
  VerifiedCreatorAnalytics,
} from '@shared/types';

@Controller('creator')
export class CreatorController {
  constructor(
    private readonly draftsService: CreatorDraftsService,
    private readonly schedulingService: CreatorSchedulingService,
    private readonly analyticsService: CreatorAnalyticsService,
    private readonly studioService: CreatorStudioService,
  ) {}

  // ==========================================================================
  // IN-APP EDITOR DRAFTS (RESILIENT SAVING & AUTO-SAVE)
  // ==========================================================================

  @Post('drafts')
  @HttpCode(HttpStatus.CREATED)
  async createDraft(
    @CurrentUser('userId') userId: string,
    @Body() dto: SaveDraftInputDto,
  ): Promise<ReelDraftItem> {
    return this.draftsService.saveDraft(userId, dto);
  }

  @Get('drafts')
  async getDrafts(@CurrentUser('userId') userId: string): Promise<ReelDraftItem[]> {
    return this.draftsService.getDrafts(userId);
  }

  @Get('drafts/:id')
  async getDraftById(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) draftId: string,
  ): Promise<ReelDraftItem> {
    return this.draftsService.getDraftById(userId, draftId);
  }

  @Put('drafts/:id')
  async updateDraft(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) draftId: string,
    @Body() dto: SaveDraftInputDto,
  ): Promise<ReelDraftItem> {
    return this.draftsService.saveDraft(userId, dto, draftId);
  }

  @Delete('drafts/:id')
  async deleteDraft(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) draftId: string,
  ): Promise<{ deleted: boolean; draftId: string }> {
    return this.draftsService.deleteDraft(userId, draftId);
  }

  // ==========================================================================
  // LICENSED / AUTHORIZED SOUNDS
  // ==========================================================================

  @Get('sounds')
  async getLicensedSounds(
    @Query('q') query?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ sounds: LicensedSoundItem[]; total: number }> {
    const parsedLimit = limit ? Math.min(parseInt(limit, 10), 50) : 20;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;
    return this.studioService.getLicensedSounds(query, parsedLimit, parsedOffset);
  }

  // ==========================================================================
  // CREATOR STUDIO PUBLISHING & RECOVERY (IDEMPOTENT)
  // ==========================================================================

  @Post('publish')
  @HttpCode(HttpStatus.OK)
  async publishOrSchedule(
    @CurrentUser('userId') userId: string,
    @Body() dto: PublishReelInputDto,
  ): Promise<PublishingSessionResponse> {
    return this.studioService.publishOrSchedule(userId, dto);
  }

  @Get('publish/status/:identifier')
  async getPublishingStatus(
    @CurrentUser('userId') userId: string,
    @Param('identifier') identifier: string,
  ): Promise<PublishingSessionResponse> {
    return this.studioService.getPublishingStatus(userId, identifier);
  }

  // ==========================================================================
  // CONTENT SCHEDULING
  // ==========================================================================

  @Post('schedule')
  @HttpCode(HttpStatus.OK)
  async scheduleReel(
    @CurrentUser('userId') userId: string,
    @Body() dto: ScheduleReelInputDto,
  ): Promise<{ scheduled: boolean; scheduledAt: string; reelId: string }> {
    return this.schedulingService.scheduleReel(userId, dto);
  }

  @Get('scheduled')
  async getScheduledReels(@CurrentUser('userId') userId: string): Promise<ScheduledReelItem[]> {
    return this.schedulingService.getScheduledReels(userId);
  }

  @Delete('scheduled/:reelId')
  async cancelSchedule(
    @CurrentUser('userId') userId: string,
    @Param('reelId', ParseUUIDPipe) reelId: string,
  ): Promise<{ cancelled: boolean; reelId: string }> {
    return this.schedulingService.cancelSchedule(userId, reelId);
  }

  // ==========================================================================
  // EDIT & DELETE PUBLISHED CONTENT
  // ==========================================================================

  @Put('reels/:id')
  async updatePublishedReel(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) reelId: string,
    @Body() dto: UpdatePublishedReelDto,
  ): Promise<{ updated: boolean; reelId: string }> {
    return this.studioService.updatePublishedReel(userId, reelId, dto);
  }

  @Delete('reels/:id')
  async deleteReel(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) reelId: string,
  ): Promise<{ deleted: boolean; reelId: string }> {
    return this.studioService.deleteReel(userId, reelId);
  }

  // ==========================================================================
  // CREATOR ANALYTICS (ZERO-LOCATION: INTEREST-ONLY AUDIENCE METRICS)
  // ==========================================================================

  @Get('analytics')
  async getVerifiedAnalytics(
    @CurrentUser('userId') userId: string,
    @Query() query: AnalyticsQueryDto,
  ): Promise<VerifiedCreatorAnalytics> {
    return this.analyticsService.getVerifiedAnalytics(userId, query);
  }

  @Post('analytics/events')
  @HttpCode(HttpStatus.OK)
  async recordEngagementEvent(
    @CurrentUser('userId') userId: string | null,
    @Body() dto: RecordEngagementEventDto,
  ) {
    return this.analyticsService.recordEngagementEvent(userId, dto);
  }

  @Get('analytics/overview')
  async getAnalyticsOverview(
    @CurrentUser('userId') userId: string,
    @Query('days') days?: string,
  ): Promise<CreatorAnalyticsOverview> {
    const rangeDays = days ? parseInt(days, 10) : 30;
    return this.analyticsService.getAnalyticsOverview(userId, rangeDays);
  }

  @Get('analytics/audience-interests')
  async getViewsByInterestAudience(
    @CurrentUser('userId') userId: string,
    @Query('days') days?: string,
  ): Promise<CreatorAudienceInterest[]> {
    const rangeDays = days ? parseInt(days, 10) : 30;
    return this.analyticsService.getViewsByInterestAudience(userId, rangeDays);
  }

  @Get('analytics/retention')
  async getOverallRetentionCurve(
    @CurrentUser('userId') userId: string,
    @Query('days') days?: string,
    @Query('reelId') reelId?: string,
  ): Promise<RetentionPoint[]> {
    const rangeDays = days ? parseInt(days, 10) : 30;
    return this.analyticsService.getRetentionCurve(userId, reelId, rangeDays);
  }

  @Get('analytics/retention/:reelId')
  async getReelRetentionCurve(
    @CurrentUser('userId') userId: string,
    @Param('reelId', ParseUUIDPipe) reelId: string,
    @Query('days') days?: string,
  ): Promise<RetentionPoint[]> {
    const rangeDays = days ? parseInt(days, 10) : 30;
    return this.analyticsService.getRetentionCurve(userId, reelId, rangeDays);
  }

  @Get('analytics/followers-growth')
  async getFollowersGrowth(
    @CurrentUser('userId') userId: string,
    @Query('days') days?: string,
  ): Promise<FollowerGrowthPoint[]> {
    const rangeDays = days ? parseInt(days, 10) : 30;
    return this.analyticsService.getFollowersGrowth(userId, rangeDays);
  }

  @Get('analytics/top-reels')
  async getTopReels(
    @CurrentUser('userId') userId: string,
    @Query('limit') limit?: string,
  ): Promise<CreatorTopReel[]> {
    const lim = limit ? parseInt(limit, 10) : 5;
    return this.analyticsService.getTopReels(userId, lim);
  }
}
