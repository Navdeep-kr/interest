import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { SafetyController } from './safety.controller';
import { ModerationService } from './moderation.service';
import { ContentScannerService } from './content-scanner.service';
import { CopyrightService } from './copyright.service';
import { BotDetectionService } from './bot-detection.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SafetyController],
  providers: [
    ModerationService,
    ContentScannerService,
    CopyrightService,
    BotDetectionService,
  ],
  exports: [
    ModerationService,
    ContentScannerService,
    CopyrightService,
    BotDetectionService,
  ],
})
export class SafetyModule {}
