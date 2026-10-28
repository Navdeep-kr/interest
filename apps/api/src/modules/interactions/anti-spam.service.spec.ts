import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AntiSpamService } from './anti-spam.service';

describe('AntiSpamService', () => {
  let service: AntiSpamService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AntiSpamService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('redis://localhost:6379'),
          },
        },
      ],
    }).compile();

    service = module.get<AntiSpamService>(AntiSpamService);
    service.clearMemoryWindows();
  });

  afterEach(() => {
    service.clearMemoryWindows();
  });

  it('should allow up to 30 likes in 60 seconds and block the 31st', async () => {
    const userId = 'user-spam-like-1';

    for (let i = 0; i < 30; i++) {
      await expect(service.checkLikeRateLimit(userId)).resolves.not.toThrow();
    }

    // 31st like must be blocked with HTTP 429
    await expect(service.checkLikeRateLimit(userId)).rejects.toThrow(HttpException);
    try {
      await service.checkLikeRateLimit(userId);
    } catch (err) {
      expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(err.message).toContain('liking reels too quickly');
    }
  });

  it('should allow up to 5 comments in 60 seconds and block the 6th', async () => {
    const userId = 'user-spam-comment-1';

    for (let i = 0; i < 5; i++) {
      await expect(service.checkCommentRateLimit(userId)).resolves.not.toThrow();
    }

    // 6th comment must be blocked
    await expect(service.checkCommentRateLimit(userId)).rejects.toThrow(HttpException);
    try {
      await service.checkCommentRateLimit(userId);
    } catch (err) {
      expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(err.message).toContain('commenting too quickly');
    }
  });

  it('should block duplicate comments posted within the 10-minute window', async () => {
    const userId = 'user-dupe-comment';
    const commentText = 'Check out this amazing interest reel! #learning';

    // First attempt succeeds
    await expect(service.checkDuplicateComment(userId, commentText)).resolves.not.toThrow();

    // Exact duplicate (even with leading/trailing spaces and varying casing) must be blocked
    await expect(
      service.checkDuplicateComment(userId, '  CHECK OUT THIS AMAZING INTEREST REEL! #learning  '),
    ).rejects.toThrow(HttpException);

    try {
      await service.checkDuplicateComment(userId, commentText);
    } catch (err) {
      expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(err.message).toContain('Duplicate comment detected');
    }

    // Different comment should succeed
    await expect(
      service.checkDuplicateComment(userId, 'A completely different perspective on the topic.'),
    ).resolves.not.toThrow();
  });

  it('should allow up to 20 follows in 1 hour and block follow churn beyond that', async () => {
    const userId = 'user-churn-follow-1';

    for (let i = 0; i < 20; i++) {
      await expect(service.checkFollowRateLimit(userId)).resolves.not.toThrow();
    }

    // 21st follow attempt must be blocked
    await expect(service.checkFollowRateLimit(userId)).rejects.toThrow(HttpException);
    try {
      await service.checkFollowRateLimit(userId);
    } catch (err) {
      expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(err.message).toContain('Follow limit reached');
    }
  });
});
