import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiAssistantService } from './ai-assistant.service';
import { DatabaseService } from '../../database/database.service';
import { ContentScannerService } from '../safety/content-scanner.service';
import { SearchService } from '../search/search.service';
import { LearnService } from '../learn/learn.service';
import { GeminiGroundingProvider } from './providers/gemini-grounding.provider';
import { DeterministicGroundingProvider } from './providers/deterministic-grounding.provider';

describe('AiAssistantService (Prompt 26 — AI Interest Assistant)', () => {
  let service: AiAssistantService;
  let mockDatabaseService: any;
  let mockContentScanner: any;
  let mockSearchService: any;
  let mockLearnService: any;
  let mockAiProvider: any;

  const testUserId = 'test-ai-user-001';

  beforeEach(async () => {
    mockDatabaseService = {
      query: jest.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('FROM interests')) {
          return {
            rows: [
              {
                id: 'int_uiux',
                slug: 'ui-ux-design',
                title: 'UI/UX Design',
                description: 'Mobile interface architecture and spatial grids.',
                similarity: '0.94',
              },
              {
                id: 'int_eng',
                slug: 'software-engineering',
                title: 'Software Engineering',
                description: 'Distributed architectures and resilient systems.',
                similarity: '0.89',
              },
            ],
          };
        }
        return { rows: [] };
      }),
    };

    mockContentScanner = {
      scanReel: jest.fn().mockImplementation(async (metadata: any) => {
        const text = (metadata.title + ' ' + (metadata.caption || '')).toLowerCase();
        if (text.includes('prohibited_violation') || text.includes('hate_speech_test')) {
          return {
            action: 'REJECT',
            reasons: ['VIOLATION_DETECTED'],
            scores: { nudity: 0, violence: 0.9, hateSpeech: 0.9, copyrightMatch: 0, syntheticProbability: 0 },
            isAiGenerated: true,
          };
        }
        return {
          action: 'APPROVE',
          reasons: [],
          scores: { nudity: 0, violence: 0, hateSpeech: 0, copyrightMatch: 0, syntheticProbability: 0 },
          isAiGenerated: true,
        };
      }),
    };

    mockSearchService = {
      search: jest.fn().mockResolvedValue({
        reels: [
          {
            id: 'reel_public_101',
            title: 'Design Systems in Flutter',
            caption: '8pt spatial grid demonstration.',
            creatorUsername: 'alex_designer',
          },
        ],
        interests: [
          {
            id: 'int_uiux',
            slug: 'ui-ux-design',
            title: 'UI/UX Design',
            description: 'Mobile design guidelines.',
          },
        ],
        communities: [
          {
            id: 'comm_uiux',
            name: 'Mobile Designers Guild',
            description: 'Public community of 450 designers.',
            membersCount: 450,
          },
        ],
      }),
    };

    mockLearnService = {
      listPaths: jest.fn().mockResolvedValue([
        {
          id: 'path-uiux-foundations',
          title: 'Mobile UI/UX Design System Foundations',
          description: 'Accredited professional certification.',
          isVerifiedCredential: true,
          issuingOrganization: 'Interaction Design Institute',
        },
      ]),
    };

    const deterministicEngine = new DeterministicGroundingProvider();
    const configService = new ConfigService({ GEMINI_API_KEY: 'mock_gemini_key' });
    const geminiProvider = new GeminiGroundingProvider(configService, deterministicEngine);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiAssistantService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: ContentScannerService, useValue: mockContentScanner },
        { provide: SearchService, useValue: mockSearchService },
        { provide: LearnService, useValue: mockLearnService },
        { provide: GeminiGroundingProvider, useValue: geminiProvider },
      ],
    }).compile();

    service = module.get<AiAssistantService>(AiAssistantService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('1. Grounded Content Discovery & Zero Hallucination Sources', () => {
    it('should generate grounded answers citing verified platform content and deep links', async () => {
      const response = await service.queryAssistant(testUserId, {
        query: 'How do I learn mobile design systems and spatial grids?',
        includeSummaries: true,
      });

      expect(response).toBeDefined();
      expect(response.role).toBe('assistant');
      expect(response.content).toContain('Based on verified public content');
      expect(response.groundedSources.length).toBeGreaterThan(0);

      // Verify sources are strictly valid public platform content with canonical deep links
      const sources = response.groundedSources;
      expect(sources.every((s) => s.isPublic)).toBe(true);
      expect(sources.some((s) => s.deepLinkUrl.startsWith('interest://'))).toBe(true);

      // Verify related interests are surfaced from taxonomy
      expect(response.relatedInterests.length).toBeGreaterThan(0);
      expect(response.relatedInterests.some((i) => i.title === 'UI/UX Design')).toBe(true);

      // Verify public summary generated
      expect(response.summary).toBeDefined();
      expect(response.summary).toContain('Key Takeaways');

      // Verify token cost metrics
      expect(response.tokenUsage.totalTokens).toBeGreaterThan(0);
      expect(response.tokenUsage.estimatedCostMicrocents).toBeGreaterThan(0);
      expect(response.isFallbackToSearch).toBe(false);
    });
  });

  describe('2. Privacy Safeguards & Zero-Location Invariant', () => {
    it('should strip geographic entities from prompts and reject purely geo queries', async () => {
      // Query containing coordinates / location terms should have them stripped
      const response = await service.queryAssistant(testUserId, {
        query: 'Best coffee roasting tips in Tokyo Japan at 35.6762, 139.6503',
      });

      // Location must be sanitized out
      expect(response.content).not.toContain('35.6762');
      expect(response.content).not.toContain('Tokyo Japan');
      expect(response.groundedSources.every((s) => !s.snippet.includes('35.6762'))).toBe(true);
    });

    it('should reject queries containing only location coordinates', async () => {
      await expect(
        service.queryAssistant(testUserId, {
          query: '35.6762, 139.6503',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('3. Rate Limits & Token Budget Controls', () => {
    const rateLimitUser = 'test-rate-limit-user-404';

    it('should track remaining queries and throttle when hourly ceiling is exceeded', async () => {
      const initialStatus = service.getRateLimitStatus(rateLimitUser);
      expect(initialStatus.queriesRemainingThisHour).toBe(20);

      // Execute queries up to limit
      for (let i = 0; i < 20; i++) {
        await service.queryAssistant(rateLimitUser, { query: `Test query iteration ${i}` });
      }

      const statusAfter20 = service.getRateLimitStatus(rateLimitUser);
      expect(statusAfter20.queriesRemainingThisHour).toBe(0);

      // 21st query should seamlessly fall back to conventional search without crashing
      const fallbackResponse = await service.queryAssistant(rateLimitUser, {
        query: 'Exceeded rate limit query',
      });

      expect(fallbackResponse.isFallbackToSearch).toBe(true);
      expect(fallbackResponse.content).toContain('[Search Mode]');
      expect(fallbackResponse.tokenUsage.totalTokens).toBe(0); // 0 token cost for fallback
    });
  });

  describe('4. Safe Output Handling', () => {
    it('should sanitize and fall back to safe search if LLM output fails content scanner', async () => {
      const safeResponse = await service.queryAssistant(testUserId, {
        query: 'trigger prohibited_violation in output generation',
      });

      expect(safeResponse.isFallbackToSearch).toBe(true);
      expect(safeResponse.content).toContain('[Search Mode]');
    });
  });

  describe('5. Conventional Search Fallback', () => {
    it('should seamlessly execute search fallback when AI provider throws an error', async () => {
      // Create service with a failing provider
      const failingProvider = {
        providerName: 'FAILING_PROVIDER',
        generateGroundedResponse: jest.fn().mockRejectedValue(new Error('503 Service Unavailable')),
      } as any;

      const fallbackModule: TestingModule = await Test.createTestingModule({
        providers: [
          AiAssistantService,
          { provide: DatabaseService, useValue: mockDatabaseService },
          { provide: ContentScannerService, useValue: mockContentScanner },
          { provide: SearchService, useValue: mockSearchService },
          { provide: LearnService, useValue: mockLearnService },
          { provide: GeminiGroundingProvider, useValue: failingProvider },
        ],
      }).compile();

      const testService = fallbackModule.get<AiAssistantService>(AiAssistantService);
      const res = await testService.queryAssistant('user-fb', {
        query: 'Software engineering architecture patterns',
      });

      expect(res.isFallbackToSearch).toBe(true);
      expect(res.content).toContain('[Search Mode]');
      expect(res.groundedSources.length).toBeGreaterThan(0);
    });
  });

  describe('6. Limited Beta & Quality/Cost Telemetry', () => {
    const betaUser = 'test-beta-user-777';

    it('should allow beta enrollment toggle', () => {
      const enrolled = service.enrollBeta(betaUser, true);
      expect(enrolled.isBetaEnrolled).toBe(true);

      const unenrolled = service.enrollBeta(betaUser, false);
      expect(unenrolled.isBetaEnrolled).toBe(false);
    });

    it('should record user helpfulness ratings and hallucination telemetry', () => {
      const res1 = service.submitQualityFeedback(testUserId, {
        messageId: 'msg_1',
        isHelpful: true,
      });
      expect(res1.success).toBe(true);

      const res2 = service.submitQualityFeedback(testUserId, {
        messageId: 'msg_2',
        isHelpful: false,
        feedbackCategory: 'HALLUCINATION',
        comments: 'Source title differed slightly.',
      });
      expect(res2.success).toBe(true);

      const metrics = service.getFeedbackMetrics();
      expect(metrics.totalFeedback).toBe(2);
      expect(metrics.helpfulRatio).toBe(0.5);
      expect(metrics.hallucinationReportsCount).toBe(1);
    });
  });
});
