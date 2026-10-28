import { Module } from '@nestjs/common';
import { ReelsService } from './reels.service';
import { ReelsController } from './reels.controller';
import { StorageModule } from '../storage/storage.module';
import { TranscodeModule } from '../transcode/transcode.module';
import { AiInterestSuggesterService } from './ai-interest-suggester.service';

import { DatabaseModule } from '../../database/database.module';
import { InteractionsModule } from '../interactions/interactions.module';

@Module({
  imports: [StorageModule, TranscodeModule, DatabaseModule, InteractionsModule],
  controllers: [ReelsController],
  providers: [ReelsService, AiInterestSuggesterService],
  exports: [ReelsService, AiInterestSuggesterService],
})
export class ReelsModule {}


