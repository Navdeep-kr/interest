import { BotDetectionService } from './bot-detection.service';

describe('BotDetectionService (Bot & Fake-Engagement Detection)', () => {
  let service: BotDetectionService;
  let mockConfigService: any;
  let mockDatabaseService: any;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn().mockReturnValue('redis://localhost:6379'),
    };
    mockDatabaseService = {
      query: jest.fn(),
    };
    service = new BotDetectionService(mockConfigService as any, mockDatabaseService as any);
  });

  it('should pass normal human interaction velocities', async () => {
    const result = await service.evaluateInteraction('user-human-1', 'LIKE');

    expect(result.isBot).toBe(false);
    expect(result.shouldDiscountEngagement).toBe(false);
    expect(result.confidence).toBeLessThan(0.2);
  });

  it('should detect and flag superhuman like bursts', async () => {
    const userId = 'user-bot-likes';
    for (let i = 0; i < 35; i++) {
      await service.evaluateInteraction(userId, 'LIKE');
    }

    // 36th like in same window triggers bot detection
    const result = await service.evaluateInteraction(userId, 'LIKE');

    expect(result.isBot).toBe(true);
    expect(result.shouldDiscountEngagement).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.reasons.some((r) => r.includes('Superhuman like velocity'))).toBe(true);
  });

  it('should detect duplicate comment spam across multiple reels', async () => {
    const userId = 'user-bot-spammer';
    const spamComment = 'Check out this amazing cryptocurrency link now!';

    for (let i = 0; i < 3; i++) {
      await service.evaluateInteraction(userId, 'COMMENT', {
        commentText: spamComment,
        reelId: `reel-${i}`,
      });
    }

    // 4th identical comment triggers duplicate spam detection
    const result = await service.evaluateInteraction(userId, 'COMMENT', {
      commentText: spamComment,
      reelId: 'reel-4',
    });

    expect(result.isBot).toBe(true);
    expect(result.reasons.some((r) => r.includes('Coordinated comment spam'))).toBe(true);
  });

  it('should flag micro-view telemetry bursts without screen rendering', async () => {
    const result = await service.evaluateInteraction('user-headless-scraper', 'VIEW', {
      durationMs: 50,
      reelId: 'reel-123',
    });

    expect(result.isBot).toBe(true);
    expect(result.reasons.some((r) => r.includes('Micro-view telemetry burst'))).toBe(true);
  });
});
