import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { SafetyModule } from '../safety/safety.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LearnService } from './learn.service';
import { LearnController } from './learn.controller';

@Module({
  imports: [DatabaseModule, SafetyModule, NotificationsModule],
  controllers: [LearnController],
  providers: [LearnService],
  exports: [LearnService],
})
export class LearnModule {}
