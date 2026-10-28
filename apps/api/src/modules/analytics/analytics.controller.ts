import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import {
  TrackEventDto,
  TrackBatchEventsDto,
  FunnelFilterDto,
  RetentionFilterDto,
  SatisfactionFilterDto,
} from './dto/analytics.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Ingest a batch of analytics events from mobile/web clients
   */
  @Post('events')
  @HttpCode(HttpStatus.OK)
  async trackBatch(@Body() dto: TrackBatchEventsDto) {
    return this.analyticsService.trackBatch(dto);
  }

  /**
   * Ingest a single analytics event
   */
  @Post('event')
  @HttpCode(HttpStatus.OK)
  async trackEvent(@Body() dto: TrackEventDto) {
    return this.analyticsService.trackEvent(dto);
  }

  /**
   * Get the Activation & Creation Funnel
   * (Install -> Onboarding -> First Reel -> First Post)
   */
  @Get('funnels/install-to-post')
  async getInstallToPostFunnel(@Query() filter: FunnelFilterDto) {
    return this.analyticsService.getInstallToPostFunnel(filter);
  }

  /**
   * Get N-Day Cohort Retention Heatmap and Depth Breakdown
   */
  @Get('retention/cohorts')
  async getRetentionCohorts(@Query() filter: RetentionFilterDto) {
    return this.analyticsService.getRetentionCohorts(filter);
  }

  /**
   * Get Interest-Match Satisfaction Telemetry and Calibration Scores
   */
  @Get('satisfaction/interest-match')
  async getInterestMatchSatisfaction(@Query() filter: SatisfactionFilterDto) {
    return this.analyticsService.getInterestMatchSatisfaction(filter);
  }
}
