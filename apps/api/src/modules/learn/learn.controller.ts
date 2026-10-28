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
import { LearnService } from './learn.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  CreateSkillPathDto,
  CreateLessonDto,
  RecordLessonProgressDto,
  SubmitDifficultyFeedbackDto,
  UpdateLearnReminderDto,
} from './dto/learn.dto';
import { SkillLevel } from '@shared/types';

@Controller('learn')
export class LearnController {
  constructor(private readonly learnService: LearnService) {}

  @Public()
  @Get('paths')
  async listPaths(
    @Query('level') level?: SkillLevel,
    @Query('interestId') interestId?: string,
    @Query('isVerifiedCredential') isVerifiedCredential?: string,
  ) {
    const verifiedBool =
      isVerifiedCredential === undefined
        ? undefined
        : isVerifiedCredential === 'true';
    return this.learnService.listPaths({
      level,
      interestId,
      isVerifiedCredential: verifiedBool,
    });
  }

  @Public()
  @Get('paths/:id')
  async getPathById(
    @Param('id') pathId: string,
    @CurrentUser('userId') userId?: string,
  ) {
    return this.learnService.getPathById(pathId, userId);
  }

  @Get('progress/resume')
  async getResumeProgress(@CurrentUser('userId') userId: string) {
    return this.learnService.getResumeProgress(userId || 'guest_user');
  }

  @Get('paths/:id/progress')
  async getPathProgress(
    @Param('id') pathId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.learnService.getProgress(userId || 'guest_user', pathId);
  }

  @Post('progress')
  @HttpCode(HttpStatus.OK)
  async recordLessonProgress(
    @CurrentUser('userId') userId: string,
    @Body() dto: RecordLessonProgressDto,
  ) {
    return this.learnService.recordLessonProgress(userId || 'guest_user', dto);
  }

  @Post('feedback')
  @HttpCode(HttpStatus.CREATED)
  async submitDifficultyFeedback(
    @CurrentUser('userId') userId: string,
    @Body() dto: SubmitDifficultyFeedbackDto,
  ) {
    return this.learnService.submitDifficultyFeedback(userId || 'guest_user', dto);
  }

  @Get('reminders')
  async getReminderSettings(@CurrentUser('userId') userId: string) {
    return this.learnService.getReminderSettings(userId || 'guest_user');
  }

  @Put('reminders')
  async updateReminderSettings(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateLearnReminderDto,
  ) {
    return this.learnService.updateReminderSettings(userId || 'guest_user', dto);
  }

  @Post('paths')
  @HttpCode(HttpStatus.CREATED)
  async createSkillPath(
    @CurrentUser('userId') userId: string,
    @CurrentUser('username') username: string,
    @Body() dto: CreateSkillPathDto,
  ) {
    return this.learnService.createSkillPath(
      userId || 'creator_user',
      username || 'Creator',
      dto,
    );
  }

  @Post('paths/:pathId/lessons')
  @HttpCode(HttpStatus.CREATED)
  async addLessonToPath(
    @Param('pathId') pathId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateLessonDto,
  ) {
    return this.learnService.addLessonToPath(pathId, userId || 'creator_user', dto);
  }

  @Delete('paths/:pathId/lessons/:lessonId')
  async deleteLesson(
    @Param('pathId') pathId: string,
    @Param('lessonId') lessonId: string,
  ) {
    return this.learnService.deleteLesson(pathId, lessonId);
  }
}
