import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import { DatabaseService } from '../../database/database.service';

export interface BotDetectionResult {
  isBot: boolean;
  confidence: number; // 0.0 to 1.0
  reasons: string[];
  shouldDiscountEngagement: boolean;
}

@Injectable()
export class BotDetectionService {
  private readonly logger = new Logger(BotDetectionService.name);
  private readonly redisClient: Redis;
  private isRedisConnected = false;

  // In-memory fallback tracking for unit tests or offline Redis
  private readonly userActionTimestamps = new Map<string, number[]>();
  private readonly userCommentHashes = new Map<string, Array<{ hash: string; timestamp: number }>>();
  private readonly flaggedBotUsers = new Set<string>();

  // Thresholds
  private readonly MAX_LIKES_PER_MINUTE = 35;
  private readonly MAX_DUPLICATE_COMMENTS = 4;
  private readonly DUPLICATE_WINDOW_MS = 5 * 60 * 1000; // 5 mins

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      retryStrategy: (times) => (times > 2 ? null : 500),
    });

    this.redisClient
      .connect()
      .then(() => {
        this.isRedisConnected = true;
      })
      .catch(() => {
        this.isRedisConnected = false;
      });
  }

  /**
   * Evaluates an interaction for robotic / automated bot behavior.
   */
  async evaluateInteraction(
    userId: string,
    action: 'LIKE' | 'VIEW' | 'COMMENT' | 'SHARE',
    metadata?: { commentText?: string; durationMs?: number; reelId?: string },
  ): Promise<BotDetectionResult> {
    const reasons: string[] = [];
    const now = Date.now();

    // 1. Check known flagged bot status
    if (this.flaggedBotUsers.has(userId)) {
      return {
        isBot: true,
        confidence: 0.98,
        reasons: ['User account previously marked as automated bot'],
        shouldDiscountEngagement: true,
      };
    }

    // 2. High-frequency velocity check
    const key = `user_actions:${userId}:${action}`;
    let actionTimestamps: number[] = [];

    if (this.isRedisConnected) {
      try {
        const redisKey = `bot:actions:${userId}:${action}`;
        const windowStart = now - 60 * 1000;
        const multi = this.redisClient.multi();
        multi.zremrangebyscore(redisKey, 0, windowStart);
        multi.zadd(redisKey, now, `${now}-${Math.random()}`);
        multi.zcard(redisKey);
        multi.expire(redisKey, 120);
        const results = await multi.exec();
        const count = (results?.[2]?.[1] as number) || 0;
        if (action === 'LIKE' && count > this.MAX_LIKES_PER_MINUTE) {
          reasons.push(`Superhuman like velocity: ${count} likes in 60 seconds`);
        }
      } catch (err: any) {
        this.logger.debug(`Redis bot velocity error: ${err.message}`);
      }
    } else {
      const timestamps = this.userActionTimestamps.get(key) || [];
      const valid = timestamps.filter((t) => t > now - 60 * 1000);
      valid.push(now);
      this.userActionTimestamps.set(key, valid);

      if (action === 'LIKE' && valid.length > this.MAX_LIKES_PER_MINUTE) {
        reasons.push(`Superhuman like velocity: ${valid.length} likes in 60 seconds`);
      }
    }

    // 3. Duplicate Comment Spam Check across reels
    if (action === 'COMMENT' && metadata?.commentText) {
      const textHash = crypto
        .createHash('md5')
        .update(metadata.commentText.trim().toLowerCase())
        .digest('hex');

      const userComments = this.userCommentHashes.get(userId) || [];
      const activeComments = userComments.filter((c) => c.timestamp > now - this.DUPLICATE_WINDOW_MS);
      activeComments.push({ hash: textHash, timestamp: now });
      this.userCommentHashes.set(userId, activeComments);

      const duplicates = activeComments.filter((c) => c.hash === textHash);
      if (duplicates.length >= this.MAX_DUPLICATE_COMMENTS) {
        reasons.push(
          `Coordinated comment spam: identical message posted ${duplicates.length} times across reels`,
        );
      }
    }

    // 4. Zero-duration loop / telemetry anomaly check
    if (action === 'VIEW' && metadata?.durationMs !== undefined && metadata.durationMs < 200) {
      reasons.push('Micro-view telemetry burst (<200ms) without screen rendering');
    }

    const isBot = reasons.length > 0;
    if (isBot) {
      this.flaggedBotUsers.add(userId);
      this.logger.warn(`Bot detected for user [${userId}]: ${reasons.join('; ')}`);
    }

    return {
      isBot,
      confidence: isBot ? 0.92 : 0.05,
      reasons,
      shouldDiscountEngagement: isBot,
    };
  }

  /**
   * Resets or clears a user's bot flag (e.g. upon captcha or verification).
   */
  clearBotStatus(userId: string) {
    this.flaggedBotUsers.delete(userId);
  }
}
