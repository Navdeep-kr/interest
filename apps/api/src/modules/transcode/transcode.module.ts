import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TranscodeProcessor } from './transcode.processor';
import { StorageModule } from '../storage/storage.module';
import { SafetyModule } from '../safety/safety.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'video-transcode',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { age: 604800, count: 5000 },
      },
    }),
    StorageModule,
    SafetyModule,
  ],
  providers: [TranscodeProcessor],
  exports: [BullModule],
})
export class TranscodeModule {}
