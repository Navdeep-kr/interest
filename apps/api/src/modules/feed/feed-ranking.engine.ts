import { CandidateSource, ReelItem } from '@shared/types';

export interface CandidateReel {
  id: string;
  creatorId: string;
  creatorUsername: string;
  creatorDisplayName: string;
  creatorAvatarUrl?: string;
  title: string;
  caption?: string;
  hlsMasterUrl: string;
  thumbnailUrl: string;
  durationSeconds: number;
  primaryInterestId: string;
  interestTags: string[];
  viewCount: number;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  shareCount: number;
  quickSkipCount: number;
  testAudienceDelivered: number;
  cosineSimilarity: number;
  createdAt: Date;
  candidateSource: CandidateSource;
  isExplorationSlot?: boolean;
  isTestAudienceSlot?: boolean;
  isAiGenerated?: boolean;
  aiLabelType?: any;
  isAgeRestricted?: boolean;
  isLiked?: boolean;
  isSaved?: boolean;
  isFollowing?: boolean;
  explanation?: string;
}

export interface ScoredReel extends CandidateReel {
  interestMatchScore: number;
  predictedWatchTime: number;
  engagementQualityScore: number;
  freshnessScore: number;
  creatorDiversityPenalty: number;
  finalRankingScore: number;
}

export interface RankingWeightsConfig {
  weightMatch?: number;
  weightPwt?: number;
  weightEngagement?: number;
  weightFreshness?: number;
}

/**
 * FeedRankingEngine
 * Production ranking engine implementing multi-objective scoring:
 * FinalScore = w_match * Match + w_pwt * PWT + w_eng * EngQuality + w_fresh * Freshness - Penalty_creator
 * STRICT ARCHITECTURAL INVARIANT: Location is NEVER an input feature.
 */
export class FeedRankingEngine {
  // Feature Weights (Sum = 1.00)
  static readonly WEIGHT_MATCH = 0.40;
  static readonly WEIGHT_PWT = 0.25;
  static readonly WEIGHT_ENGAGEMENT = 0.20;
  static readonly WEIGHT_FRESHNESS = 0.15;

  // Freshness half-life parameter: 72 hours (3 days)
  static readonly FRESHNESS_HALF_LIFE_HOURS = 72.0;

  /**
   * Scores and ranks a candidate pool, applying dynamic creator diversity penalties
   * to guarantee no creator monopolizes the viewer's immediate feed window.
   */
  static rankCandidates(
    candidates: CandidateReel[],
    userAffinities: Map<string, number>,
    referenceNow: Date = new Date(),
    customWeights?: RankingWeightsConfig,
  ): ScoredReel[] {
    const scoredList: ScoredReel[] = [];
    const creatorAppearanceCount = new Map<string, number>();

    const wMatch = customWeights?.weightMatch ?? this.WEIGHT_MATCH;
    const wPwt = customWeights?.weightPwt ?? this.WEIGHT_PWT;
    const wEng = customWeights?.weightEngagement ?? this.WEIGHT_ENGAGEMENT;
    const wFresh = customWeights?.weightFreshness ?? this.WEIGHT_FRESHNESS;

    // 1. Calculate static feature scores for each candidate
    const preparedCandidates = candidates.map((cand) => {
      const matchScore = this.calculateInterestMatchScore(cand, userAffinities);
      const pwtScore = this.calculatePredictedWatchTime(cand, matchScore);
      const engScore = this.calculateEngagementQuality(cand);
      const freshScore = this.calculateFreshness(cand, referenceNow);

      const baseScore =
        wMatch * matchScore +
        wPwt * pwtScore +
        wEng * engScore +
        wFresh * freshScore;

      return {
        ...cand,
        interestMatchScore: matchScore,
        predictedWatchTime: pwtScore,
        engagementQualityScore: engScore,
        freshnessScore: freshScore,
        baseScore,
      };
    });

    // 2. Greedy selection with dynamic creator diversity demotion
    // Items are picked sequentially; picking a creator increases their penalty for subsequent picks
    const remaining = [...preparedCandidates];

    while (remaining.length > 0) {
      // Evaluate each remaining candidate with current creator counts
      let bestIndex = 0;
      let highestPenalizedScore = -Infinity;
      let chosenPenalty = 0;

      for (let i = 0; i < remaining.length; i++) {
        const item = remaining[i];
        const existingCount = creatorAppearanceCount.get(item.creatorId) || 0;
        const penalty = this.calculateCreatorDiversityPenalty(existingCount);
        const finalScore = item.baseScore - penalty;

        if (finalScore > highestPenalizedScore) {
          highestPenalizedScore = finalScore;
          bestIndex = i;
          chosenPenalty = penalty;
        }
      }

      const selected = remaining.splice(bestIndex, 1)[0];
      const currentCount = creatorAppearanceCount.get(selected.creatorId) || 0;
      creatorAppearanceCount.set(selected.creatorId, currentCount + 1);

      scoredList.push({
        ...selected,
        creatorDiversityPenalty: chosenPenalty,
        finalRankingScore: Math.max(0, parseFloat(highestPenalizedScore.toFixed(4))),
      });
    }

    return scoredList;
  }

  /**
   * Interest Match Score S_match in [0, 1]
   * Blends vector cosine similarity (70%) with explicit user affinity weights (30%)
   */
  static calculateInterestMatchScore(
    candidate: CandidateReel,
    userAffinities: Map<string, number>,
  ): number {
    const cosSim = Math.max(0, candidate.cosineSimilarity);
    const affinityWeight = userAffinities.get(candidate.primaryInterestId) || 1.0;
    // Normalize affinity weight: typical range 0.1 to 5.0 -> [0, 1]
    const normalizedAffinity = Math.min(1.0, Math.max(0, affinityWeight / 5.0));

    const blended = 0.70 * cosSim + 0.30 * normalizedAffinity;
    return parseFloat(Math.min(1.0, Math.max(0, blended)).toFixed(4));
  }

  /**
   * Predicted Watch Time S_pwt in [0, 1]
   * Estimates completion ratio based on historical completion, duration decay, and interest match
   */
  static calculatePredictedWatchTime(candidate: CandidateReel, interestMatch: number): number {
    let completionRatio: number;

    if (candidate.viewCount > 0) {
      // Completion ratio discounted by quick skips
      completionRatio =
        candidate.viewCount / (candidate.viewCount + 1.5 * candidate.quickSkipCount);
    } else {
      // Unseen / cold-start baseline prior
      completionRatio = 0.65;
    }

    // Moderate duration decay: longer videos have naturally lower 100% completion
    const durationPenalty =
      candidate.durationSeconds > 30
        ? Math.min(0.20, ((candidate.durationSeconds - 30) / 120) * 0.20)
        : 0;

    const adjustedCompletion = Math.max(0.15, completionRatio - durationPenalty);
    const pwt = adjustedCompletion * (0.75 + 0.25 * interestMatch);

    return parseFloat(Math.min(1.0, Math.max(0, pwt)).toFixed(4));
  }

  /**
   * Engagement Quality Score S_eng in [0, 1]
   * Positive actions (likes, saves, shares) scaled logarithmically, penalized by quick skip ratio
   */
  static calculateEngagementQuality(candidate: CandidateReel): number {
    const views = Math.max(1, candidate.viewCount);

    // Weighted positive interactions per view (saves & shares are high-intent signals)
    const posRate =
      (1.0 * candidate.likeCount + 2.5 * candidate.saveCount + 3.0 * candidate.shareCount) / views;
    const skipRate = candidate.quickSkipCount / views;

    // Log-saturation curve for positive interaction rate
    const posScore = Math.log(1.0 + 8.0 * posRate) / (Math.log(1.0 + 8.0 * posRate) + 1.0);
    const skipFactor = Math.max(0.10, 1.0 - 0.90 * skipRate);

    const rawQuality = posScore * skipFactor;

    // Empirical Bayesian smoothing for low view counts (< 20 views)
    const smoothedQuality =
      views < 20 ? (views / 20) * rawQuality + ((20 - views) / 20) * 0.50 : rawQuality;

    return parseFloat(Math.min(1.0, Math.max(0, smoothedQuality)).toFixed(4));
  }

  /**
   * Freshness Score S_fresh in [0, 1]
   * Exponential half-life decay: 2^(-deltaT / tau) where tau = 72 hours
   */
  static calculateFreshness(candidate: CandidateReel, now: Date): number {
    const ageMs = Math.max(0, now.getTime() - candidate.createdAt.getTime());
    const ageHours = ageMs / (1000 * 60 * 60);

    const freshness = Math.pow(2, -ageHours / this.FRESHNESS_HALF_LIFE_HOURS);
    return parseFloat(Math.min(1.0, Math.max(0, freshness)).toFixed(4));
  }

  /**
   * Creator Diversity Penalty in [0, 1.0]
   * Increases exponentially for repeat creator appearances in the current feed window
   */
  static calculateCreatorDiversityPenalty(existingCount: number): number {
    if (existingCount <= 0) return 0;
    // 1st repeat = 0.25, 2nd repeat = 0.50, 3rd repeat = 1.00
    return parseFloat((0.25 * Math.pow(2, existingCount - 1)).toFixed(4));
  }

  /**
   * Converts a scored reel into the public API ReelItem format.
   */
  static mapToReelItem(scored: ScoredReel): ReelItem {
    return {
      id: scored.id,
      creatorId: scored.creatorId,
      creator: {
        id: scored.creatorId,
        username: scored.creatorUsername,
        displayName: scored.creatorDisplayName,
        avatarUrl: scored.creatorAvatarUrl,
      },
      title: scored.title,
      caption: scored.caption,
      hlsMasterUrl: scored.hlsMasterUrl,
      thumbnailUrl: scored.thumbnailUrl,
      durationSeconds: scored.durationSeconds,
      primaryInterestId: scored.primaryInterestId,
      interestTags: scored.interestTags || [],
      viewCount: scored.viewCount,
      likeCount: scored.likeCount,
      commentCount: scored.commentCount,
      saveCount: scored.saveCount,
      shareCount: scored.shareCount,
      isLiked: scored.isLiked || false,
      isSaved: scored.isSaved || false,
      isFollowing: scored.isFollowing || false,
      explanation: scored.explanation,
      similarityScore: scored.cosineSimilarity,
      rankingScore: scored.finalRankingScore,
      predictedWatchTime: scored.predictedWatchTime,
      isExplorationSlot: scored.isExplorationSlot || false,
      isTestAudienceSlot: scored.isTestAudienceSlot || false,
      isAiGenerated: scored.isAiGenerated || false,
      aiLabelType: scored.aiLabelType,
      isAgeRestricted: scored.isAgeRestricted || false,
      candidateSource: scored.candidateSource,
      createdAt: scored.createdAt.toISOString(),
    };
  }
}
