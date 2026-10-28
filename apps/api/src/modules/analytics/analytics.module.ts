import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { PostHogClientAdapter } from './posthog-client.adapter';

@Module({
  imports: [DatabaseModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, PostHogClientAdapter],
  exports: [AnalyticsService, PostHogClientAdapter],
})
export class AnalyticsModule {}
