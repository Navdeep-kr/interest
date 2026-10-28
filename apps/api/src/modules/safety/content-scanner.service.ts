import { Injectable, Logger } from '@nestjs/common';
import { CopyrightService } from './copyright.service';
import { ContentScanResult, AiLabelType } from '@shared/types';

export interface ReelScanMetadata {
  reelId: string;
  title: string;
  caption?: string;
  hashtags?: string[];
  transcriptText?: string;
  audioFingerprint?: string;
  isAiDeclared?: boolean;
}

@Injectable()
export class ContentScannerService {
  private readonly logger = new Logger(ContentScannerService.name);

  // Severe hate speech, terror, violent incitement patterns
  private readonly HATE_SPEECH_PATTERNS = [
    /\b(kill all|death to|wipe out)\s+(all\s+)?(jews|muslims|christians|blacks|whites|immigrants|gays)\b/i,
    /\b(nazi|hitler was right|white power|supremacist|terrorist attack|bombing)\b/i,
    /\b(subhuman|exterminate|lynch|gas chamber)\b/i,
    /\b(slur_[a-z0-9]+)\b/i, // Generic slur token matcher
  ];

  // Explicit adult / pornography patterns
  private readonly NUDITY_PATTERNS = [
    /\b(porn|porno|xxx|naked|nude|sex tape|erotic cam|onlyfans leak|hardcore sex)\b/i,
    /\b(strip club|masturbat|explicit nudity)\b/i,
  ];

  // Graphic violence / gore / self-harm patterns
  private readonly VIOLENCE_PATTERNS = [
    /\b(beheading|decapitat|torture video|snuff film|graphic gore|slashing throat)\b/i,
    /\b(mass shooting|school shooter|suicide tutorial|hang yourself)\b/i,
  ];

  // Synthetic AI content indicators
  private readonly AI_PATTERNS = [
    /\b(midjourney|sora ai|stable diffusion|dall-e|runwayml|deepfake|synthesia|pika labs)\b/i,
    /\b(ai generated|generative ai|created with ai|synthetic media|ai clone)\b/i,
  ];

  constructor(private readonly copyrightService: CopyrightService) {}

  /**
   * Performs an automated pre-publish multi-modal safety evaluation on a reel.
   */
  async scanReel(metadata: ReelScanMetadata): Promise<ContentScanResult> {
    const combinedText = [
      metadata.title || '',
      metadata.caption || '',
      (metadata.hashtags || []).join(' '),
      metadata.transcriptText || '',
    ]
      .join(' ')
      .toLowerCase();

    // 1. Text & Multimodal Risk Scoring
    const hateSpeechScore = this.evaluateTextRisk(combinedText, this.HATE_SPEECH_PATTERNS);
    const nudityScore = this.evaluateTextRisk(combinedText, this.NUDITY_PATTERNS);
    const violenceScore = this.evaluateTextRisk(combinedText, this.VIOLENCE_PATTERNS);

    // 2. Copyright Audio Check
    const copyrightRes = await this.copyrightService.checkAudioFingerprint(
      metadata.audioFingerprint,
      { title: metadata.title },
    );
    const copyrightMatchScore =
      copyrightRes.matched && !copyrightRes.track?.allowedForRemix ? 0.95 : 0.0;

    // 3. AI Generated Content Detection
    const aiTextMatch = this.AI_PATTERNS.some((pattern) => pattern.test(combinedText));
    const isAiDeclared = Boolean(metadata.isAiDeclared);
    const isAiDetected = aiTextMatch;
    const syntheticProbability = isAiDeclared ? 1.0 : isAiDetected ? 0.85 : 0.05;

    let aiLabelType = AiLabelType.NONE;
    if (isAiDeclared) {
      aiLabelType = AiLabelType.CREATOR_DISCLOSED;
    } else if (isAiDetected) {
      aiLabelType = AiLabelType.AI_DETECTED;
    }

    const reasons: string[] = [];

    if (nudityScore >= 0.85) reasons.push('Severe Nudity/Pornographic content detected');
    else if (nudityScore >= 0.5) reasons.push('Borderline adult/NSFW content flagged');

    if (violenceScore >= 0.85) reasons.push('Severe graphic violence/self-harm detected');
    else if (violenceScore >= 0.5) reasons.push('Borderline violence or dangerous content flagged');

    if (hateSpeechScore >= 0.85) reasons.push('Severe hate speech/violent extremism detected');
    else if (hateSpeechScore >= 0.5) reasons.push('Borderline harassment or toxic speech flagged');

    if (copyrightMatchScore >= 0.85) {
      reasons.push(
        `Copyrighted audio detected: "${copyrightRes.track?.title}" by ${copyrightRes.track?.artist} (${copyrightRes.track?.rightsHolder}) without sync license`,
      );
    }

    // 4. Determine Action
    let action: 'APPROVE' | 'FLAG' | 'REJECT' = 'APPROVE';

    const maxRiskScore = Math.max(
      nudityScore,
      violenceScore,
      hateSpeechScore,
      copyrightMatchScore,
    );

    if (maxRiskScore >= 0.85) {
      action = 'REJECT';
    } else if (maxRiskScore >= 0.5) {
      action = 'FLAG';
    } else {
      action = 'APPROVE';
    }

    this.logger.log(
      `Reel Safety Scan [${metadata.reelId}]: Decision=${action}, MaxScore=${maxRiskScore.toFixed(2)}, Reasons=[${reasons.join('; ')}]`,
    );

    return {
      action,
      reasons,
      scores: {
        nudity: nudityScore,
        violence: violenceScore,
        hateSpeech: hateSpeechScore,
        copyrightMatch: copyrightMatchScore,
        syntheticProbability,
      },
      isAiGenerated: isAiDeclared || isAiDetected,
      aiLabelType,
      copyrightMatchedTrack: copyrightRes.track
        ? {
            title: copyrightRes.track.title,
            artist: copyrightRes.track.artist,
            rightsHolder: copyrightRes.track.rightsHolder,
            allowedForRemix: copyrightRes.track.allowedForRemix,
          }
        : undefined,
    };
  }

  private evaluateTextRisk(text: string, patterns: RegExp[]): number {
    let score = 0.0;
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        score = 0.95;
        break;
      }
    }
    return score;
  }
}
