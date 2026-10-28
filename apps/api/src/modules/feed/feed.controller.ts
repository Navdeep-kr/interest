import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { FeedService } from './feed.service';
import { GetFeedDto, FeedControlInputDto } from './dto/feed.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FeedControlAction, FeedControlResponse, FeedResponseDto } from '@shared/types';

@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  /**
   * GET /feed
   * Retrieves the personalized infinite feed with multi-source candidate generation,
   * multi-objective ranking, cold-start guarantees, Redis caching, and prefetching.
   * Supports modes: "FOR_YOU" (default), "FOLLOWING", and "INTEREST".
   */
  @Get()
  async getFeed(
    @CurrentUser('userId') userId: string,
    @Query() query: GetFeedDto,
  ): Promise<FeedResponseDto> {
    return this.feedService.getPersonalizedFeed(userId, query);
  }

  /**
   * POST /feed/controls
   * Unified endpoint for viewer controls ("Show less of this", "Not interested", "Pause this interest").
   */
  @Post('controls')
  @HttpCode(HttpStatus.OK)
  async applyControl(
    @CurrentUser('userId') userId: string,
    @Body() dto: FeedControlInputDto,
  ): Promise<FeedControlResponse> {
    return this.feedService.applyFeedControl(userId, dto);
  }

  /**
   * POST /feed/controls/show-less
   * Lowers user interest affinity weight and applies negative vector nudge.
   */
  @Post('controls/show-less')
  @HttpCode(HttpStatus.OK)
  async showLess(
    @CurrentUser('userId') userId: string,
    @Body() body: { reelId: string; interestId?: string },
  ): Promise<FeedControlResponse> {
    return this.feedService.applyFeedControl(userId, {
      reelId: body.reelId,
      action: FeedControlAction.SHOW_LESS,
      interestId: body.interestId,
    });
  }

  /**
   * POST /feed/controls/not-interested
   * Strongly suppresses topic, adds to seen filter, and applies negative vector nudge.
   */
  @Post('controls/not-interested')
  @HttpCode(HttpStatus.OK)
  async notInterested(
    @CurrentUser('userId') userId: string,
    @Body() body: { reelId: string; interestId?: string },
  ): Promise<FeedControlResponse> {
    return this.feedService.applyFeedControl(userId, {
      reelId: body.reelId,
      action: FeedControlAction.NOT_INTERESTED,
      interestId: body.interestId,
    });
  }

  /**
   * POST /feed/controls/pause-interest
   * Pauses weight adaptation and freezes recommendations for a specific interest topic.
   */
  @Post('controls/pause-interest')
  @HttpCode(HttpStatus.OK)
  async pauseInterest(
    @CurrentUser('userId') userId: string,
    @Body() body: { reelId: string; interestId: string },
  ): Promise<FeedControlResponse> {
    return this.feedService.applyFeedControl(userId, {
      reelId: body.reelId,
      action: FeedControlAction.PAUSE_INTEREST,
      interestId: body.interestId,
    });
  }

  /**
   * POST /feed/preferences/reset
   * Resets negative feedback signals, unpauses interests, and purges seen history.
   */
  @Post('preferences/reset')
  @HttpCode(HttpStatus.OK)
  async resetPreferences(
    @CurrentUser('userId') userId: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.feedService.resetFeedPreferences(userId);
  }
}
