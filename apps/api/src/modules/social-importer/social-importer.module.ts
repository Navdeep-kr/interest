import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { ReelsModule } from '../reels/reels.module';
import { SocialImporterService } from './social-importer.service';
import { SocialImporterController } from './social-importer.controller';

@Module({
  imports: [DatabaseModule, AuthModule, ReelsModule],
  controllers: [SocialImporterController],
  providers: [SocialImporterService],
  exports: [SocialImporterService],
})
export class SocialImporterModule {}
