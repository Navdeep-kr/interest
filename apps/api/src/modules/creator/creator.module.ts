import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CreatorController } from './creator.controller';
import { CreatorDraftsService } from './creator-drafts.service';
import { CreatorSchedulingService } from './creator-scheduling.service';
import { CreatorAnalyticsService } from './creator-analytics.service';
import { CreatorStudioService } from './creator-studio.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CreatorController],
  providers: [
    CreatorDraftsService,
    CreatorSchedulingService,
    CreatorAnalyticsService,
    CreatorStudioService,
  ],
  exports: [
    CreatorDraftsService,
    CreatorSchedulingService,
    CreatorAnalyticsService,
    CreatorStudioService,
  ],
})
export class CreatorModule {}
