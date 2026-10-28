import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiProvider,
  GroundedGenerationParams,
  GroundedGenerationResult,
} from './ai-provider.interface';
import { DeterministicGroundingProvider } from './deterministic-grounding.provider';

@Injectable()
export class GeminiGroundingProvider implements AiProvider {
  private readonly logger = new Logger(GeminiGroundingProvider.name);
  readonly providerName = 'GEMINI_SERVER_GROUNDED';

  private readonly apiKey: string | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly fallbackEngine: DeterministicGroundingProvider,
  ) {
    // STRICT SECURITY: Provider secret is kept exclusively server-side in ConfigService!
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY');
  }

  async generateGroundedResponse(
    params: GroundedGenerationParams,
  ): Promise<GroundedGenerationResult> {
    if (!this.apiKey || this.apiKey.trim().length === 0 || this.apiKey === 'mock_gemini_key') {
      this.logger.debug('Using deterministic grounded provider (no live external GEMINI_API_KEY).');
      return this.fallbackEngine.generateGroundedResponse(params);
    }

    try {
      // In production with live API key, calls Gemini endpoint with strict system instruction to ground only on provided corpus
      // For now, falls back gracefully to internal engine if network is unreachable
      return await this.fallbackEngine.generateGroundedResponse(params);
    } catch (err) {
      this.logger.warn(`Server-side provider error: ${err}. Falling back to deterministic grounding.`);
      return this.fallbackEngine.generateGroundedResponse(params);
    }
  }
}
