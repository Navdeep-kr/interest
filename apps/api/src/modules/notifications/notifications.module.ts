import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '../../database/database.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushNotificationService } from './push-notification.service';
import { EmailNotificationService } from './email-notification.service';
import { NotificationBatchProcessor } from './notification-batch.processor';
import { DeepLinkService } from './deep-link.service';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({
      name: 'notification-batch',
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        removeOnComplete: { age: 86400, count: 5000 },
        removeOnFail: { age: 604800, count: 10000 },
      },
    }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    PushNotificationService,
    EmailNotificationService,
    NotificationBatchProcessor,
    DeepLinkService,
  ],
  exports: [
    NotificationsService,
    PushNotificationService,
    EmailNotificationService,
    DeepLinkService,
  ],
})
export class NotificationsModule {}
