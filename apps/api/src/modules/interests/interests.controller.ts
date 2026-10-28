import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InterestsService } from './interests.service';
import {
  SelectInterestsDto,
  AddInterestDto,
  ToggleMuteDto,
  TogglePauseDto,
  CreateTopicDto,
} from './dto/select-interests.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller('interests')
export class InterestsController {
  constructor(private readonly interestsService: InterestsService) {}

  @Public()
  @Get('tree')
  async getTaxonomyTree() {
    return this.interestsService.getTaxonomyTree();
  }

  @Public()
  @Post('seed')
  async seedTaxonomy() {
    return this.interestsService.seedTaxonomy();
  }

  @Public()
  @Get('search')
  async searchInterests(
    @Query('q') query: string,
    @Query('limit') limit?: number,
  ) {
    return this.interestsService.searchInterests(query, limit ? Number(limit) : 20);
  }

  @Public()
  @Get('related')
  async getRelatedInterests(
    @Query('ids') ids?: string,
    @Query('limit') limit?: number,
  ) {
    const selectedIds = ids ? ids.split(',').map((id) => id.trim()).filter(Boolean) : [];
    return this.interestsService.getRelatedInterests(selectedIds, limit ? Number(limit) : 6);
  }

  @Public()
  @Get(':idOrSlug/page')
  async getTopicPage(
    @Param('idOrSlug') idOrSlug: string,
    @CurrentUser('userId') userId?: string,
  ) {
    return this.interestsService.getTopicPage(idOrSlug, userId || null);
  }

  @Public()
  @Get(':idOrSlug/details')
  async getTopicDetails(
    @Param('idOrSlug') idOrSlug: string,
    @CurrentUser('userId') userId?: string,
  ) {
    return this.interestsService.getTopicPage(idOrSlug, userId || null);
  }

  @Post('create')
  async createTopic(@Body() dto: CreateTopicDto) {
    return this.interestsService.createTopic(dto);
  }

  @Post('select')
  async selectInterests(
    @CurrentUser('userId') userId: string,
    @Body() dto: SelectInterestsDto,
  ) {
    return this.interestsService.selectInterests(userId, dto.interestIds);
  }

  @Get('mine')
  async getMyInterests(@CurrentUser('userId') userId: string) {
    return this.interestsService.getUserInterests(userId);
  }

  @Post('add')
  async addInterest(
    @CurrentUser('userId') userId: string,
    @Body() dto: AddInterestDto,
  ) {
    return this.interestsService.addInterest(userId, dto.interestId);
  }

  @Post(':id/follow')
  async followInterest(
    @CurrentUser('userId') userId: string,
    @Param('id') interestId: string,
  ) {
    return this.interestsService.followInterest(userId, interestId);
  }

  @Delete(':id/follow')
  async unfollowInterest(
    @CurrentUser('userId') userId: string,
    @Param('id') interestId: string,
  ) {
    return this.interestsService.unfollowInterest(userId, interestId);
  }

  @Delete(':id')
  async removeInterest(
    @CurrentUser('userId') userId: string,
    @Param('id') interestId: string,
  ) {
    return this.interestsService.removeInterest(userId, interestId);
  }

  @Patch(':id/mute')
  async toggleMute(
    @CurrentUser('userId') userId: string,
    @Param('id') interestId: string,
    @Body() dto: ToggleMuteDto,
  ) {
    return this.interestsService.toggleMute(userId, interestId, dto.isMuted);
  }

  @Post(':id/mute')
  async muteInterest(
    @CurrentUser('userId') userId: string,
    @Param('id') interestId: string,
  ) {
    return this.interestsService.toggleMute(userId, interestId, true);
  }

  @Delete(':id/mute')
  async unmuteInterest(
    @CurrentUser('userId') userId: string,
    @Param('id') interestId: string,
  ) {
    return this.interestsService.toggleMute(userId, interestId, false);
  }

  @Patch(':id/pause')
  async togglePause(
    @CurrentUser('userId') userId: string,
    @Param('id') interestId: string,
    @Body() dto: TogglePauseDto,
  ) {
    return this.interestsService.togglePause(userId, interestId, dto.isPaused);
  }

  @Post(':id/pause')
  async pauseInterest(
    @CurrentUser('userId') userId: string,
    @Param('id') interestId: string,
  ) {
    return this.interestsService.togglePause(userId, interestId, true);
  }

  @Delete(':id/pause')
  async unpauseInterest(
    @CurrentUser('userId') userId: string,
    @Param('id') interestId: string,
  ) {
    return this.interestsService.togglePause(userId, interestId, false);
  }
}

