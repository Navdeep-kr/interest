import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ContentScannerService } from '../safety/content-scanner.service';
import { SearchService } from '../search/search.service';
import { LearnService } from '../learn/learn.service';
import { GeminiGroundingProvider } from './providers/gemini-grounding.provider';
import { GroundedCorpusItem } from './providers/ai-provider.interface';
import { stripGeoEntities } from '@shared/geo-sanitizer';
import { generateDeterministicUnitVector } from '@shared/vector-math';
import {
  AiAssistantMessage,
  AiGroundedSource,
  AiRelatedInterest,
  AiRateLimitAndCostStatus,
  AiQualityFeedbackDto,
} from '@shared/types';
import { QueryAiAssistantDto, SubmitAiQualityFeedbackDto } from './dto/ai-assistant.dto';

interface UserUsageRecord {
  hourlyTimestamps: number[];
  dailyTokens: number;
  lastResetDay: string;
}

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);

  // Rate Limits & Budget Constants
  private readonly MAX_QUERIES_PER_HOUR = 20;
  private readonly MAX_DAILY_TOKENS_PER_USER = 50000;
  private readonly GLOBAL_DAILY_BUDGET_MICROCENTS = 5000000; // $50.00 / day ceiling

  // In-memory state tracking for beta, rate limiting, and feedback
  private readonly betaUsers = new Set<string>(['test-user-learner-001', 'user-1', 'creator_user', 'interest_creator']);
  private readonly userUsage = new Map<string, UserUsageRecord>();
  private readonly feedbackStore: Array<AiQualityFeedbackDto & { userId: string; createdAt: string }> = [];
  private globalCostMicrocentsToday = 0;
  private globalCostResetDay: string = new Date().toISOString().split('T')[0];

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly contentScanner: ContentScannerService,
    private readonly searchService: SearchService,
    private readonly learnService: LearnService,
    private readonly aiProvider: GeminiGroundingProvider,
  ) {}

  // ==========================================================================
  // 1. RATE LIMITING & COST CONTROLS
  // ==========================================================================

  private getUserUsage(userId: string): UserUsageRecord {
    const today = new Date().toISOString().split('T')[0];
    let record = this.userUsage.get(userId);

    if (!record || record.lastResetDay !== today) {
      record = {
        hourlyTimestamps: [],
        dailyTokens: 0,
        lastResetDay: today,
      };
      this.userUsage.set(userId, record);
    }

    // Periodic auto-prune stale usage records from previous days
    if (this.userUsage.size > 200) {
      for (const [uid, u] of this.userUsage.entries()) {
        if (u.lastResetDay !== today) {
          this.userUsage.delete(uid);
        }
      }
    }

    // Clean up hourly timestamps older than 60 minutes
    const oneHourAgo = Date.now() - 3600 * 1000;
    record.hourlyTimestamps = record.hourlyTimestamps.filter((t) => t > oneHourAgo);

    return record;
  }

  private checkBudgetAndRateLimit(userId: string): {
    canProceed: boolean;
    reason?: 'HOURLY_LIMIT_EXCEEDED' | 'DAILY_TOKEN_LIMIT_EXCEEDED' | 'GLOBAL_BUDGET_EXCEEDED';
  } {
    const today = new Date().toISOString().split('T')[0];
    if (this.globalCostResetDay !== today) {
      this.globalCostMicrocentsToday = 0;
      this.globalCostResetDay = today;
    }

    if (this.globalCostMicrocentsToday >= this.GLOBAL_DAILY_BUDGET_MICROCENTS) {
      return { canProceed: false, reason: 'GLOBAL_BUDGET_EXCEEDED' };
    }

    const usage = this.getUserUsage(userId);

    if (usage.hourlyTimestamps.length >= this.MAX_QUERIES_PER_HOUR) {
      return { canProceed: false, reason: 'HOURLY_LIMIT_EXCEEDED' };
    }

    if (usage.dailyTokens >= this.MAX_DAILY_TOKENS_PER_USER) {
      return { canProceed: false, reason: 'DAILY_TOKEN_LIMIT_EXCEEDED' };
    }

    return { canProceed: true };
  }

  getRateLimitStatus(userId: string): AiRateLimitAndCostStatus {
    const usage = this.getUserUsage(userId);
    const queriesRemaining = Math.max(0, this.MAX_QUERIES_PER_HOUR - usage.hourlyTimestamps.length);
    const budgetExceeded =
      usage.dailyTokens >= this.MAX_DAILY_TOKENS_PER_USER ||
      this.globalCostMicrocentsToday >= this.GLOBAL_DAILY_BUDGET_MICROCENTS;

    return {
      userId,
      queriesRemainingThisHour: queriesRemaining,
      dailyTokenUsage: usage.dailyTokens,
      dailyTokenLimit: this.MAX_DAILY_TOKENS_PER_USER,
      isBudgetExceeded: budgetExceeded,
      isBetaEnrolled: this.betaUsers.has(userId) || true, // default opt-in for testing
    };
  }

  enrollBeta(userId: string, enrolled: boolean): { userId: string; isBetaEnrolled: boolean } {
    if (enrolled) {
      this.betaUsers.add(userId);
    } else {
      this.betaUsers.delete(userId);
    }
    return { userId, isBetaEnrolled: enrolled };
  }

  // ==========================================================================
  // 2. GROUNDED QUERY DISCOVERY & PROCESSING
  // ==========================================================================

  async queryAssistant(userId: string, dto: QueryAiAssistantDto): Promise<AiAssistantMessage> {
    const startTime = Date.now();

    // 2.1 Privacy Safeguard: Strict Zero-Location Sanitization
    // Location names, city names, and coordinates are stripped before any LLM processing
    const sanitizedQuery = stripGeoEntities(dto.query).trim();

    if (!sanitizedQuery) {
      throw new BadRequestException('Query cannot be empty or solely geographic terms.');
    }

    // 2.2 Cost & Rate-Limit Evaluation
    const limitCheck = this.checkBudgetAndRateLimit(userId);
    if (!limitCheck.canProceed) {
      this.logger.warn(`AI query throttled for user ${userId}: ${limitCheck.reason}. Falling back to search.`);
      return this.executeSearchFallback(
        userId,
        sanitizedQuery,
        dto.conversationId,
        `Rate limit or token budget reached (${limitCheck.reason}).`,
        startTime,
      );
    }

    try {
      // 2.3 Grounding Corpus Assembly (Public Content Only)
      const { corpus, relatedInterests } = await this.assembleGroundingCorpus(sanitizedQuery, dto.targetInterestSlug);

      // 2.4 Server-Side Grounded Synthesis
      const generationResult = await this.aiProvider.generateGroundedResponse({
        userQuery: sanitizedQuery,
        groundingCorpus: corpus,
        relatedInterests,
        includeSummaries: dto.includeSummaries,
      });

      // 2.5 Safe Output Handling (Content Moderation Scan)
      const outputScan = await this.contentScanner.scanReel({
        reelId: 'ai_output',
        title: sanitizedQuery,
        caption: generationResult.content,
      });

      if (outputScan.action === 'REJECT') {
        this.logger.warn(`AI output flagged by moderation scanner: ${outputScan.reasons.join(', ')}. Sanitizing.`);
        return this.executeSearchFallback(
          userId,
          sanitizedQuery,
          dto.conversationId,
          'Filtered sensitive output to maintain community safety.',
          startTime,
        );
      }

      // 2.6 Record Token Usage & Cost
      const usage = this.getUserUsage(userId);
      usage.hourlyTimestamps.push(Date.now());
      usage.dailyTokens += generationResult.tokenUsage.totalTokens;
      this.globalCostMicrocentsToday += generationResult.tokenUsage.estimatedCostMicrocents;

      const latencyMs = Date.now() - startTime;
      const conversationId = dto.conversationId || `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      return {
        id: `msg_ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        conversationId,
        role: 'assistant',
        content: generationResult.content,
        summary: generationResult.summary,
        groundedSources: generationResult.groundedSources,
        relatedInterests,
        suggestedActions: generationResult.suggestedActions,
        isFallbackToSearch: false,
        tokenUsage: generationResult.tokenUsage,
        latencyMs,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      this.logger.error(`AI Provider error: ${err}. Executing graceful search fallback.`);
      return this.executeSearchFallback(
        userId,
        sanitizedQuery,
        dto.conversationId,
        'Provider temporarily unavailable.',
        startTime,
      );
    }
  }

  // ==========================================================================
  // 3. GROUNDING CORPUS RETRIEVAL (Zero-Location & Public Content Only)
  // ==========================================================================

  private async assembleGroundingCorpus(
    query: string,
    targetInterestSlug?: string,
  ): Promise<{
    corpus: GroundedCorpusItem[];
    relatedInterests: AiRelatedInterest[];
  }> {
    const corpus: GroundedCorpusItem[] = [];
    const relatedInterests: AiRelatedInterest[] = [];

    // 3.1 Taxonomy Match via Vector Graph
    const queryVector = generateDeterministicUnitVector(query);
    const queryVectorPg = DatabaseService.vectorToPg(queryVector);

    try {
      const taxonomyRes = await this.databaseService.query(
        `SELECT id, slug, title, description,
                1 - (vector <=> $1::vector) as similarity
         FROM interests
         WHERE level >= 1
         ORDER BY (vector <=> $1::vector) ASC
         LIMIT 6;`,
        [queryVectorPg],
      );

      for (const row of taxonomyRes.rows) {
        relatedInterests.push({
          id: row.id,
          slug: row.slug,
          title: row.title,
          vectorSimilarity: Number(parseFloat(row.similarity).toFixed(2)),
        });

        corpus.push({
          id: row.id,
          title: row.title,
          snippet: row.description || `Explore ${row.title} on Interest`,
          deepLinkUrl: `interest://interests/${row.slug}`,
          type: 'INTEREST',
          isPublic: true,
        });
      }
    } catch (_) {
      // In-memory fallback if database vector search is idle
      relatedInterests.push(
        { id: 'int_uiux', slug: 'ui-ux-design', title: 'UI/UX Design', vectorSimilarity: 0.92 },
        { id: 'int_eng', slug: 'software-engineering', title: 'Software Engineering', vectorSimilarity: 0.88 },
        { id: 'int_film', slug: 'filmmaking', title: 'Filmmaking', vectorSimilarity: 0.85 },
      );
      corpus.push({
        id: 'int_uiux',
        title: 'UI/UX Design',
        snippet: 'Comprehensive mobile and design system patterns.',
        deepLinkUrl: 'interest://interests/ui-ux-design',
        type: 'INTEREST',
        isPublic: true,
      });
    }

    // 3.2 Public Skill Paths from LearnService
    try {
      const skillPaths = await this.learnService.listPaths();
      const relevantPaths = skillPaths.slice(0, 3);
      for (const path of relevantPaths) {
        corpus.push({
          id: path.id,
          title: path.title,
          snippet: `${path.isVerifiedCredential ? 'Accredited Credential' : 'Creator Guide'}: ${path.description}`,
          deepLinkUrl: `interest://learn/paths/${path.id}`,
          type: 'LEARN_PATH',
          isPublic: true,
          authorName: path.isVerifiedCredential ? path.issuingOrganization : path.creatorName,
        });
      }
    } catch (_) {}

    // 3.3 Public Content Search (Reels & Communities)
    try {
      const searchRes = await this.searchService.search(null, { q: query, limit: 5 });
      if (searchRes.reels && searchRes.reels.length > 0) {
        for (const reel of searchRes.reels.slice(0, 3)) {
          corpus.push({
            id: reel.id,
            title: reel.title || 'Featured Reel',
            snippet: reel.caption || 'Verified public community demonstration.',
            deepLinkUrl: `interest://reels/${reel.id}`,
            type: 'REEL',
            isPublic: true,
            authorName: reel.creatorUsername,
          });
        }
      }
      if (searchRes.communities && searchRes.communities.length > 0) {
        for (const comm of searchRes.communities.slice(0, 2)) {
          corpus.push({
            id: comm.id,
            title: comm.name,
            snippet: comm.description || `Community with ${comm.membersCount || 100} members`,
            deepLinkUrl: `interest://communities/${comm.id}`,
            type: 'COMMUNITY',
            isPublic: true,
          });
        }
      }
    } catch (_) {}

    return { corpus, relatedInterests };
  }

  // ==========================================================================
  // 4. CONVENTIONAL SEARCH FALLBACK (Zero User Disruption)
  // ==========================================================================

  private async executeSearchFallback(
    userId: string,
    query: string,
    conversationId: string | undefined,
    reason: string,
    startTime: number,
  ): Promise<AiAssistantMessage> {
    const searchResults = await this.searchService.search(userId, { q: query, limit: 5 });
    const groundedSources: AiGroundedSource[] = [];

    if (searchResults.reels) {
      for (const r of searchResults.reels.slice(0, 3)) {
        groundedSources.push({
          id: r.id,
          title: r.title || 'Community Reel',
          type: 'REEL',
          deepLinkUrl: `interest://reels/${r.id}`,
          snippet: r.caption || 'Public community demonstration.',
          isPublic: true,
          authorName: r.creatorUsername,
        });
      }
    }

    if (searchResults.interests) {
      for (const i of searchResults.interests.slice(0, 3)) {
        groundedSources.push({
          id: i.id,
          title: i.title,
          type: 'INTEREST',
          deepLinkUrl: `interest://interests/${i.slug}`,
          snippet: i.description || `Explore ${i.title} on Interest`,
          isPublic: true,
        });
      }
    }

    const relatedInterests: AiRelatedInterest[] = (searchResults.interests || []).slice(0, 3).map((i: any) => ({
      id: i.id,
      slug: i.slug,
      title: i.title,
      vectorSimilarity: 0.85,
    }));

    const content =
      `[Search Mode]: Showing verified public search results for "${query}" (${reason}):\n\n` +
      groundedSources.map((s, idx) => `[${idx + 1}] **${s.title}** (${s.type}): ${s.snippet}`).join('\n');

    return {
      id: `msg_fallback_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      conversationId: conversationId || `conv_fb_${Date.now()}`,
      role: 'assistant',
      content,
      groundedSources,
      relatedInterests,
      suggestedActions: ['Search trending hashtags', 'Explore popular creators'],
      isFallbackToSearch: true,
      tokenUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCostMicrocents: 0,
      },
      latencyMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // 5. QUALITY FEEDBACK & TELEMETRY
  // ==========================================================================

  submitQualityFeedback(
    userId: string,
    dto: SubmitAiQualityFeedbackDto,
  ): { success: boolean; recordedAt: string } {
    const record = {
      ...dto,
      userId,
      createdAt: new Date().toISOString(),
    };
    this.feedbackStore.push(record);
    if (this.feedbackStore.length > 100) {
      this.feedbackStore.shift();
    }

    this.logger.log(
      `AI Quality Feedback from ${userId} on ${dto.messageId}: Helpful=${dto.isHelpful}, Category=${dto.feedbackCategory || 'N/A'}`,
    );

    return { success: true, recordedAt: record.createdAt };
  }

  getFeedbackMetrics(): {
    totalFeedback: number;
    helpfulRatio: number;
    hallucinationReportsCount: number;
  } {
    if (this.feedbackStore.length === 0) {
      return { totalFeedback: 0, helpfulRatio: 1.0, hallucinationReportsCount: 0 };
    }

    const helpfulCount = this.feedbackStore.filter((f) => f.isHelpful).length;
    const hallucinations = this.feedbackStore.filter((f) => f.feedbackCategory === 'HALLUCINATION').length;

    return {
      totalFeedback: this.feedbackStore.length,
      helpfulRatio: Number((helpfulCount / this.feedbackStore.length).toFixed(2)),
      hallucinationReportsCount: hallucinations,
    };
  }
}
