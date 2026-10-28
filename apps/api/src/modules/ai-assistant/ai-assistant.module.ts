import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { SafetyModule } from '../safety/safety.module';
import { SearchModule } from '../search/search.module';
import { LearnModule } from '../learn/learn.module';
import { AiAssistantController } from './ai-assistant.controller';
import { AiAssistantService } from './ai-assistant.service';
import { GeminiGroundingProvider } from './providers/gemini-grounding.provider';
import { DeterministicGroundingProvider } from './providers/deterministic-grounding.provider';

@Module({
  imports: [DatabaseModule, SafetyModule, SearchModule, LearnModule],
  controllers: [AiAssistantController],
  providers: [
    DeterministicGroundingProvider,
    GeminiGroundingProvider,
    AiAssistantService,
  ],
  exports: [AiAssistantService],
})
export class AiAssistantModule {}
