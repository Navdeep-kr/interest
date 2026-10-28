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
} from '@nestjs/common';
import { LiveService } from './live.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  CreateLiveEventDto,
  UpdateStreamHealthDto,
  InviteCoHostDto,
  RespondCoHostInviteDto,
  SubmitLiveQuestionDto,
  ModerateQuestionDto,
  EmitReactionDto,
  ReportLiveStreamDto,
} from './dto/live.dto';
import { LiveStreamStatus } from '@shared/types';

@Controller('live')
export class LiveController {
  constructor(private readonly liveService: LiveService) {}

  @Public()
  @Get('events')
  async listEvents(
    @Query('status') status?: LiveStreamStatus,
    @Query('interestId') interestId?: string,
  ) {
    return this.liveService.listEvents({ status, interestId });
  }

  @Public()
  @Get('events/:id')
  async getEventById(
    @Param('id') eventId: string,
    @CurrentUser('userId') userId?: string,
  ) {
    return this.liveService.getEventById(eventId, userId);
  }

  @Post('events')
  @HttpCode(HttpStatus.CREATED)
  async createEvent(
    @CurrentUser('userId') userId: string,
    @CurrentUser('username') username: string,
    @Body() dto: CreateLiveEventDto,
  ) {
    return this.liveService.createEvent(userId || 'host_user', username || 'Host', dto);
  }

  @Post('events/:id/remind')
  @HttpCode(HttpStatus.OK)
  async toggleReminder(
    @CurrentUser('userId') userId: string,
    @Param('id') eventId: string,
  ) {
    return this.liveService.toggleEventReminder(userId || 'viewer_user', eventId);
  }

  @Post('events/:id/co-host/invite')
  @HttpCode(HttpStatus.OK)
  async inviteCoHost(
    @CurrentUser('userId') userId: string,
    @Param('id') eventId: string,
    @Body() dto: InviteCoHostDto,
  ) {
    return this.liveService.inviteCoHost(userId || 'host_user', eventId, dto);
  }

  @Post('events/:id/co-host/respond')
  @HttpCode(HttpStatus.OK)
  async respondCoHostInvite(
    @CurrentUser('userId') userId: string,
    @Param('id') eventId: string,
    @Body() dto: RespondCoHostInviteDto,
  ) {
    return this.liveService.respondCoHostInvite(userId || 'guest_user', eventId, dto.accept);
  }

  @Delete('events/:id/co-host')
  @HttpCode(HttpStatus.OK)
  async terminateCoHost(
    @CurrentUser('userId') userId: string,
    @Param('id') eventId: string,
  ) {
    return this.liveService.terminateCoHost(userId || 'user_id', eventId);
  }

  @Public()
  @Get('events/:id/questions')
  async listQuestions(
    @Param('id') eventId: string,
    @CurrentUser('userId') userId?: string,
  ) {
    return this.liveService.listQuestions(eventId, userId);
  }

  @Post('events/:id/questions')
  @HttpCode(HttpStatus.CREATED)
  async submitQuestion(
    @CurrentUser('userId') userId: string,
    @CurrentUser('username') username: string,
    @Param('id') eventId: string,
    @Body() dto: SubmitLiveQuestionDto,
  ) {
    return this.liveService.submitQuestion(userId || 'viewer_user', username || 'Viewer', eventId, dto);
  }

  @Put('events/:id/questions/:questionId')
  @HttpCode(HttpStatus.OK)
  async moderateQuestion(
    @CurrentUser('userId') userId: string,
    @Param('id') eventId: string,
    @Param('questionId') questionId: string,
    @Body() dto: ModerateQuestionDto,
  ) {
    return this.liveService.moderateQuestion(userId || 'host_user', eventId, questionId, dto);
  }

  @Post('events/:id/questions/:questionId/upvote')
  @HttpCode(HttpStatus.OK)
  async upvoteQuestion(
    @CurrentUser('userId') userId: string,
    @Param('id') eventId: string,
    @Param('questionId') questionId: string,
  ) {
    return this.liveService.upvoteQuestion(userId || 'viewer_user', eventId, questionId);
  }

  @Post('events/:id/reactions')
  @HttpCode(HttpStatus.OK)
  async emitReaction(
    @CurrentUser('userId') userId: string,
    @Param('id') eventId: string,
    @Body() dto: EmitReactionDto,
  ) {
    return this.liveService.emitReaction(userId || 'viewer_user', eventId, dto.reaction);
  }

  @Put('events/:id/health')
  @HttpCode(HttpStatus.OK)
  async updateStreamHealth(
    @CurrentUser('userId') userId: string,
    @Param('id') eventId: string,
    @Body() dto: UpdateStreamHealthDto,
  ) {
    return this.liveService.updateStreamHealth(userId || 'host_user', eventId, dto);
  }

  @Post('events/:id/report')
  @HttpCode(HttpStatus.OK)
  async reportLiveStream(
    @CurrentUser('userId') userId: string,
    @Param('id') eventId: string,
    @Body() dto: ReportLiveStreamDto,
  ) {
    return this.liveService.reportLiveStream(userId || 'reporter_user', eventId, dto);
  }

  @Post('events/:id/end')
  @HttpCode(HttpStatus.OK)
  async endLiveStream(
    @CurrentUser('userId') userId: string,
    @Param('id') eventId: string,
  ) {
    return this.liveService.endLiveStream(userId || 'host_user', eventId);
  }
}
