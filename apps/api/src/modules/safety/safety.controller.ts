import {
  Controller,
  Post,
  Get,
  Delete,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ModerationService } from './moderation.service';
import {
  CreateReportDto,
  AddKeywordFilterDto,
  ModeratorActionDto,
  CreateAppealDto,
  ResolveAppealDto,
  UpdateSafetySettingsDto,
  GetModerationQueueDto,
  GetModeratorAuditLogsDto,
} from './dto/safety.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller('safety')
@UseGuards(JwtAuthGuard)
export class SafetyController {
  constructor(private readonly moderationService: ModerationService) {}

  // ==========================================================================
  // REPORTS
  // ==========================================================================

  @Post('reports')
  @HttpCode(HttpStatus.CREATED)
  async createReport(@Request() req: any, @Body() dto: CreateReportDto) {
    return this.moderationService.createReport(req.user.id, dto);
  }

  @Get('reports/my-reports')
  async getMyReports(@Request() req: any) {
    return this.moderationService.getUserReports(req.user.id);
  }

  // ==========================================================================
  // BLOCK & MUTE
  // ==========================================================================

  @Post('block/:userId')
  async blockUser(@Request() req: any, @Param('userId') targetUserId: string) {
    return this.moderationService.blockUser(req.user.id, targetUserId);
  }

  @Delete('block/:userId')
  async unblockUser(@Request() req: any, @Param('userId') targetUserId: string) {
    return this.moderationService.unblockUser(req.user.id, targetUserId);
  }

  @Get('blocks')
  async getBlockedUsers(@Request() req: any) {
    return this.moderationService.getBlockedUsers(req.user.id);
  }

  @Post('mute/:userId')
  async muteUser(@Request() req: any, @Param('userId') targetUserId: string) {
    return this.moderationService.muteUser(req.user.id, targetUserId);
  }

  @Delete('mute/:userId')
  async unmuteUser(@Request() req: any, @Param('userId') targetUserId: string) {
    return this.moderationService.unmuteUser(req.user.id, targetUserId);
  }

  @Get('mutes')
  async getMutedUsers(@Request() req: any) {
    return this.moderationService.getMutedUsers(req.user.id);
  }

  // ==========================================================================
  // KEYWORD FILTERS
  // ==========================================================================

  @Post('keywords')
  @HttpCode(HttpStatus.CREATED)
  async addKeyword(@Request() req: any, @Body() dto: AddKeywordFilterDto) {
    return this.moderationService.addKeywordFilter(req.user.id, dto);
  }

  @Delete('keywords/:keywordId')
  async removeKeyword(@Request() req: any, @Param('keywordId') keywordId: string) {
    return this.moderationService.removeKeywordFilter(req.user.id, keywordId);
  }

  @Get('keywords')
  async getKeywords(@Request() req: any) {
    return this.moderationService.getKeywordFilters(req.user.id);
  }

  // ==========================================================================
  // MODERATION QUEUE & ACTIONS (Admin / Moderator)
  // ==========================================================================

  @Get('moderation/queue')
  @UseGuards(RolesGuard)
  @Roles('MODERATOR', 'ADMIN', 'SUPERADMIN')
  async getQueue(@Query() query: GetModerationQueueDto) {
    return this.moderationService.getModeratorQueue(query);
  }

  @Post('moderation/queue/:queueId/action')
  @UseGuards(RolesGuard)
  @Roles('MODERATOR', 'ADMIN', 'SUPERADMIN')
  async applyAction(
    @Request() req: any,
    @Param('queueId') queueId: string,
    @Body() dto: ModeratorActionDto,
  ) {
    return this.moderationService.applyModeratorAction(req.user.id, queueId, dto);
  }

  @Get('moderation/audit-logs')
  @UseGuards(RolesGuard)
  @Roles('MODERATOR', 'ADMIN', 'SUPERADMIN')
  async getAuditLogs(@Query() query: GetModeratorAuditLogsDto) {
    return this.moderationService.getModeratorAuditLogs(query);
  }

  @Get('operational-sla')
  @UseGuards(RolesGuard)
  @Roles('MODERATOR', 'ADMIN', 'SUPERADMIN')
  async getOperationalSla() {
    return this.moderationService.getOperationalSlaStatus();
  }

  // ==========================================================================
  // APPEALS
  // ==========================================================================

  @Post('appeals')
  @HttpCode(HttpStatus.CREATED)
  async createAppeal(@Request() req: any, @Body() dto: CreateAppealDto) {
    return this.moderationService.createAppeal(req.user.id, dto);
  }

  @Get('moderation/appeals')
  @UseGuards(RolesGuard)
  @Roles('MODERATOR', 'ADMIN', 'SUPERADMIN')
  async getAppeals(
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.moderationService.getAppeals(status, limit, offset);
  }

  @Post('moderation/appeals/:appealId/resolve')
  @UseGuards(RolesGuard)
  @Roles('MODERATOR', 'ADMIN', 'SUPERADMIN')
  async resolveAppeal(
    @Request() req: any,
    @Param('appealId') appealId: string,
    @Body() dto: ResolveAppealDto,
  ) {
    return this.moderationService.resolveAppeal(req.user.id, appealId, dto);
  }

  // ==========================================================================
  // USER SAFETY STATUS & GUIDELINES
  // ==========================================================================

  @Get('status')
  async getUserStatus(@Request() req: any) {
    return this.moderationService.getUserSafetyStatus(req.user.id);
  }

  @Public()
  @Get('guidelines')
  async getGuidelines() {
    return this.moderationService.getCommunityGuidelines();
  }

  @Get('monetization-check/:reelId')
  async checkMonetization(@Param('reelId') reelId: string) {
    return this.moderationService.validateContentForMonetization(reelId);
  }

  // ==========================================================================
  // MINOR SAFETY & PROFILE DEFAULTS
  // ==========================================================================

  @Get('settings')
  async getSettings(@Request() req: any) {
    return this.moderationService.getSafetySettings(req.user.id);
  }

  @Put('settings')
  async updateSettings(@Request() req: any, @Body() dto: UpdateSafetySettingsDto) {
    return this.moderationService.updateSafetySettings(req.user.id, dto);
  }
}
