import { ContentScannerService } from './content-scanner.service';
import { CopyrightService } from './copyright.service';
import { AiLabelType } from '@shared/types';

describe('ContentScannerService (Pre-Publish Automated Safety Scanner)', () => {
  let service: ContentScannerService;
  let mockCopyrightService: any;

  beforeEach(() => {
    mockCopyrightService = {
      checkAudioFingerprint: jest.fn().mockResolvedValue({ matched: false, matchScore: 0.0 }),
    };
    service = new ContentScannerService(mockCopyrightService as any);
  });

  it('should approve clean, compliant educational content', async () => {
    const result = await service.scanReel({
      reelId: 'reel-clean-1',
      title: 'Beginner Guide to Calisthenics Progression',
      caption: 'Mastering push-ups, dips, and pull-ups step by step #fitness #workout',
      hashtags: ['fitness', 'calisthenics'],
      transcriptText: 'Start with proper scapular retraction and hollow body position.',
    });

    expect(result.action).toBe('APPROVE');
    expect(result.reasons.length).toBe(0);
    expect(result.scores.nudity).toBeLessThan(0.5);
    expect(result.scores.violence).toBeLessThan(0.5);
    expect(result.scores.hateSpeech).toBeLessThan(0.5);
    expect(result.isAiGenerated).toBe(false);
  });

  it('should reject content with explicit nudity or pornography', async () => {
    const result = await service.scanReel({
      reelId: 'reel-nsfw-1',
      title: 'Watch full adult porn video leaked sex tape',
      caption: 'Exclusive xxx nude cam video',
    });

    expect(result.action).toBe('REJECT');
    expect(result.scores.nudity).toBeGreaterThanOrEqual(0.85);
    expect(result.reasons.some((r) => r.toLowerCase().includes('nudity') || r.toLowerCase().includes('pornographic'))).toBe(true);
  });

  it('should reject content with severe violence and gore', async () => {
    const result = await service.scanReel({
      reelId: 'reel-violence-1',
      title: 'Graphic beheading decapitation execution video',
      caption: 'Real snuff film footage',
    });

    expect(result.action).toBe('REJECT');
    expect(result.scores.violence).toBeGreaterThanOrEqual(0.85);
    expect(result.reasons.some((r) => r.toLowerCase().includes('violence'))).toBe(true);
  });

  it('should reject content with severe hate speech and extremist incitement', async () => {
    const result = await service.scanReel({
      reelId: 'reel-hate-1',
      title: 'Death to all minorities white power supremacist attack',
      caption: 'Hitler was right exterminate everyone',
    });

    expect(result.action).toBe('REJECT');
    expect(result.scores.hateSpeech).toBeGreaterThanOrEqual(0.85);
    expect(result.reasons.some((r) => r.toLowerCase().includes('hate speech'))).toBe(true);
  });

  it('should reject content with unlicensed copyrighted commercial audio', async () => {
    mockCopyrightService.checkAudioFingerprint.mockResolvedValueOnce({
      matched: true,
      matchScore: 0.99,
      track: {
        title: 'Solar Flare Bassline',
        artist: 'Vapor Grid',
        rightsHolder: 'Sony Music Ent',
        allowedForRemix: false,
      },
    });

    const result = await service.scanReel({
      reelId: 'reel-copyright-1',
      title: 'Chill sunset driving vlog',
      caption: 'Vibes on the road',
      audioFingerprint: 'fp_vapor_grid_002_d3f1',
    });

    expect(result.action).toBe('REJECT');
    expect(result.scores.copyrightMatch).toBeGreaterThanOrEqual(0.85);
    expect(result.reasons.some((r) => r.includes('Copyrighted audio detected'))).toBe(true);
  });

  it('should label creator self-declared AI content with CREATOR_DISCLOSED badge', async () => {
    const result = await service.scanReel({
      reelId: 'reel-ai-1',
      title: 'Digital landscape painting study',
      caption: 'Prompt engineering experiment',
      isAiDeclared: true,
    });

    expect(result.action).toBe('APPROVE');
    expect(result.isAiGenerated).toBe(true);
    expect(result.aiLabelType).toBe(AiLabelType.CREATOR_DISCLOSED);
  });

  it('should automatically detect unlabeled AI content and apply AI_DETECTED badge', async () => {
    const result = await service.scanReel({
      reelId: 'reel-ai-2',
      title: 'Sora AI generated deepfake cinematic trailer',
      caption: 'Made with midjourney and runwayml synthetic media',
      isAiDeclared: false,
    });

    expect(result.action).toBe('APPROVE');
    expect(result.isAiGenerated).toBe(true);
    expect(result.aiLabelType).toBe(AiLabelType.AI_DETECTED);
  });
});
