import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { SafetyModule } from '../safety/safety.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LiveController } from './live.controller';
import { LiveService } from './live.service';

@Module({
  imports: [DatabaseModule, SafetyModule, NotificationsModule],
  controllers: [LiveController],
  providers: [LiveService],
  exports: [LiveService],
})
export class LiveModule {}
