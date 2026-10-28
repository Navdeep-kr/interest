import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { StoriesService } from './stories.service';
import {
  CreateStoryInputDto,
  RecordStoryViewInputDto,
  ReactToStoryInputDto,
  ReplyToStoryInputDto,
  ReportStoryInputDto,
} from './dto/stories.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  StoryItem,
  CreatorStoryTrayItem,
} from '@shared/types';

@Controller('stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createStory(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateStoryInputDto,
  ): Promise<StoryItem> {
    return this.storiesService.createStory(userId, dto);
  }

  @Get('tray')
  async getStoriesTray(
    @CurrentUser('userId') userId: string,
  ): Promise<CreatorStoryTrayItem[]> {
    return this.storiesService.getStoriesTray(userId);
  }

  @Get('creators/:creatorId')
  async getCreatorStories(
    @CurrentUser('userId') userId: string,
    @Param('creatorId', ParseUUIDPipe) creatorId: string,
  ): Promise<StoryItem[]> {
    return this.storiesService.getCreatorStories(userId, creatorId);
  }

  @Get(':id')
  async getStoryById(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) storyId: string,
  ): Promise<StoryItem> {
    return this.storiesService.getStoryById(userId, storyId);
  }

  @Post(':id/views')
  @HttpCode(HttpStatus.OK)
  async recordView(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) storyId: string,
    @Body() dto: RecordStoryViewInputDto,
  ): Promise<{ recorded: boolean; storyId: string }> {
    return this.storiesService.recordView(userId, storyId, dto);
  }

  @Post(':id/reactions')
  @HttpCode(HttpStatus.OK)
  async reactToStory(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) storyId: string,
    @Body() dto: ReactToStoryInputDto,
  ): Promise<{ reacted: boolean; reaction: string; storyId: string }> {
    return this.storiesService.reactToStory(userId, storyId, dto);
  }

  @Post(':id/replies')
  @HttpCode(HttpStatus.OK)
  async replyToStory(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) storyId: string,
    @Body() dto: ReplyToStoryInputDto,
  ): Promise<{ sent: boolean; storyId: string; replyText: string }> {
    return this.storiesService.replyToStory(userId, storyId, dto);
  }

  @Post(':id/report')
  @HttpCode(HttpStatus.OK)
  async reportStory(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) storyId: string,
    @Body() dto: ReportStoryInputDto,
  ): Promise<{ reported: boolean; storyId: string }> {
    return this.storiesService.reportStory(userId, storyId, dto);
  }

  @Delete(':id')
  async deleteStory(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) storyId: string,
  ): Promise<{ deleted: boolean; storyId: string }> {
    return this.storiesService.deleteStory(userId, storyId);
  }

  @Post('close-friends/:friendId')
  @HttpCode(HttpStatus.OK)
  async addCloseFriend(
    @CurrentUser('userId') userId: string,
    @Param('friendId', ParseUUIDPipe) friendId: string,
  ): Promise<{ added: boolean; friendId: string }> {
    return this.storiesService.addCloseFriend(userId, friendId);
  }

  @Delete('close-friends/:friendId')
  async removeCloseFriend(
    @CurrentUser('userId') userId: string,
    @Param('friendId', ParseUUIDPipe) friendId: string,
  ): Promise<{ removed: boolean; friendId: string }> {
    return this.storiesService.removeCloseFriend(userId, friendId);
  }
}
