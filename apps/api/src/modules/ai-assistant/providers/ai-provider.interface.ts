export interface GroundedCorpusItem {
  id: string;
  title: string;
  snippet: string;
  deepLinkUrl: string;
  type: 'REEL' | 'INTEREST' | 'COMMUNITY' | 'LEARN_PATH' | 'CREATOR' | 'PLAYLIST';
  isPublic: boolean;
  authorName?: string;
}

export interface GroundedGenerationParams {
  userQuery: string;
  groundingCorpus: GroundedCorpusItem[];
  relatedInterests: Array<{ id: string; slug: string; title: string; vectorSimilarity: number }>;
  includeSummaries?: boolean;
}

export interface GroundedGenerationResult {
  content: string;
  summary?: string;
  groundedSources: GroundedCorpusItem[];
  suggestedActions: string[];
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostMicrocents: number;
  };
}

export interface AiProvider {
  readonly providerName: string;
  generateGroundedResponse(params: GroundedGenerationParams): Promise<GroundedGenerationResult>;
}
