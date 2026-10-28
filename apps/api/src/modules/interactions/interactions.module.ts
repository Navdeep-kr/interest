import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { SafetyModule } from '../safety/safety.module';
import { InteractionsController } from './interactions.controller';
import { InteractionsService } from './interactions.service';
import { RedisCounterService } from './redis-counter.service';
import { AntiSpamService } from './anti-spam.service';
import { MentionsService } from './mentions.service';

@Module({
  imports: [DatabaseModule, SafetyModule],
  controllers: [InteractionsController],
  providers: [
    InteractionsService,
    RedisCounterService,
    AntiSpamService,
    MentionsService,
  ],
  exports: [
    InteractionsService,
    RedisCounterService,
    AntiSpamService,
    MentionsService,
  ],
})
export class InteractionsModule {}
