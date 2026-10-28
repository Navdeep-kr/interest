import { Injectable } from '@nestjs/common';
import {
  AiProvider,
  GroundedGenerationParams,
  GroundedGenerationResult,
  GroundedCorpusItem,
} from './ai-provider.interface';

@Injectable()
export class DeterministicGroundingProvider implements AiProvider {
  readonly providerName = 'DETERMINISTIC_GROUNDED_ENGINE';

  async generateGroundedResponse(
    params: GroundedGenerationParams,
  ): Promise<GroundedGenerationResult> {
    const { userQuery, groundingCorpus, relatedInterests, includeSummaries } = params;

    // Filter to verified public sources only
    const validPublicSources: GroundedCorpusItem[] = groundingCorpus.filter(
      (item) => item.isPublic,
    );

    const matchedTopics = relatedInterests.map((t) => t.title).slice(0, 3);
    const topSources = validPublicSources.slice(0, 4);

    let content = '';
    let summary: string | undefined;

    if (topSources.length > 0) {
      const sourceListStr = topSources
        .map((s, idx) => `[${idx + 1}] **${s.title}** (${s.type}): ${s.snippet}`)
        .join('\n');

      content =
        `Based on verified public content on Interest for "${userQuery}", here are the top curated discussions and resources:\n\n` +
        `${sourceListStr}\n\n` +
        `Explore these verified interest paths to dive deeper into ${matchedTopics.join(', ') || 'this topic'}.`;

      if (includeSummaries) {
        summary =
          `Key Takeaways: The community focuses on practical implementations in ${matchedTopics[0] || 'this domain'}, emphasizing reproducible workflows and structured skill paths.`;
      }
    } else {
      content =
        `I explored our interest taxonomy for "${userQuery}". While there are no direct matching public posts yet, related active topics include: ${matchedTopics.join(', ') || 'Software Engineering, UI/UX Design, and Photography'}.`;
    }

    const suggestedActions = [
      `Explore ${matchedTopics[0] || 'related'} community`,
      `View trending reels in ${matchedTopics[0] || 'this topic'}`,
      'Start beginner skill path',
    ];

    // Calculate token metrics
    const promptTokens = Math.max(15, Math.round(userQuery.length / 3) + 60);
    const completionTokens = Math.max(25, Math.round(content.length / 4));
    const totalTokens = promptTokens + completionTokens;
    // Estimated cost: ~150 microcents ($0.0015) per 1000 tokens
    const estimatedCostMicrocents = Math.round((totalTokens / 1000) * 150);

    return {
      content,
      summary,
      groundedSources: topSources,
      suggestedActions,
      tokenUsage: {
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostMicrocents,
      },
    };
  }
}
