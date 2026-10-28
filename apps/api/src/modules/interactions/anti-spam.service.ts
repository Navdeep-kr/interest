import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import * as crypto from 'crypto';

@Injectable()
export class AntiSpamService {
  private readonly logger = new Logger(AntiSpamService.name);
  private readonly redisClient: Redis;
  private isRedisConnected = false;

  // In-memory sliding window fallback for unit tests or when Redis is offline
  private readonly memoryWindows = new Map<string, number[]>();
  private readonly memoryCommentHashes = new Map<string, number>();

  // Rate limit thresholds
  private readonly LIKE_MAX = 30;
  private readonly LIKE_WINDOW_SEC = 60;

  private readonly COMMENT_MAX = 5;
  private readonly COMMENT_WINDOW_SEC = 60;
  private readonly COMMENT_DUPLICATE_TTL_SEC = 600; // 10 minutes

  private readonly FOLLOW_MAX = 20;
  private readonly FOLLOW_WINDOW_SEC = 3600; // 1 hour

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 100, 1000);
      },
    });

    this.redisClient
      .connect()
      .then(() => {
        this.isRedisConnected = true;
      })
      .catch(() => {
        this.isRedisConnected = false;
      });

    this.redisClient.on('connect', () => {
      this.isRedisConnected = true;
    });
  }

  /**
   * Generic sliding-window rate limit checker using Redis Sorted Sets.
   */
  private async checkSlidingWindow(
    action: string,
    userId: string,
    maxLimit: number,
    windowSec: number,
    errorMessage: string,
  ): Promise<void> {
    const now = Date.now();
    const windowStart = now - windowSec * 1000;

    if (!this.isRedisConnected) {
      // In-memory sliding window fallback with auto-pruning
      if (this.memoryWindows.size > 200) {
        for (const [k, ts] of this.memoryWindows.entries()) {
          if (ts.length === 0 || now - ts[ts.length - 1] > 3600 * 1000) {
            this.memoryWindows.delete(k);
          }
        }
      }

      const key = `${action}:${userId}`;
      const timestamps = this.memoryWindows.get(key) || [];
      const validTimestamps = timestamps.filter((t) => t > windowStart);

      if (validTimestamps.length >= maxLimit) {
        throw new HttpException(errorMessage, HttpStatus.TOO_MANY_REQUESTS);
      }

      validTimestamps.push(now);
      this.memoryWindows.set(key, validTimestamps);
      return;
    }

    try {
      const key = `spam:rl:${action}:${userId}`;
      const multi = this.redisClient.multi();
      multi.zremrangebyscore(key, 0, windowStart);
      multi.zcard(key);
      const results = await multi.exec();

      const currentCount = (results?.[1]?.[1] as number) || 0;
      if (currentCount >= maxLimit) {
        throw new HttpException(errorMessage, HttpStatus.TOO_MANY_REQUESTS);
      }

      const addMulti = this.redisClient.multi();
      addMulti.zadd(key, now, `${now}-${Math.random()}`);
      addMulti.expire(key, windowSec + 10);
      await addMulti.exec();
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.debug(`AntiSpam sliding window check exception: ${err.message}`);
    }
  }

  /**
   * Enforces fast-like limit: max 30 likes per 60 seconds per user.
   */
  async checkLikeRateLimit(userId: string): Promise<void> {
    await this.checkSlidingWindow(
      'like',
      userId,
      this.LIKE_MAX,
      this.LIKE_WINDOW_SEC,
      'You are liking reels too quickly. Please slow down.',
    );
  }

  /**
   * Enforces comment rate limit: max 5 comments per 60 seconds per user.
   */
  async checkCommentRateLimit(userId: string): Promise<void> {
    await this.checkSlidingWindow(
      'comment',
      userId,
      this.COMMENT_MAX,
      this.COMMENT_WINDOW_SEC,
      'You are commenting too quickly. Please wait a minute before posting again.',
    );
  }

  /**
   * Detects duplicate comments within a 10-minute sliding window.
   */
  async checkDuplicateComment(userId: string, text: string): Promise<void> {
    const normalized = text.trim().toLowerCase();
    const hash = crypto.createHash('sha256').update(normalized).digest('hex');
    const now = Date.now();

    if (!this.isRedisConnected) {
      if (this.memoryCommentHashes.size > 200) {
        for (const [k, ts] of this.memoryCommentHashes.entries()) {
          if (now - ts > this.COMMENT_DUPLICATE_TTL_SEC * 1000) {
            this.memoryCommentHashes.delete(k);
          }
        }
      }

      const memKey = `${userId}:${hash}`;
      const lastSeen = this.memoryCommentHashes.get(memKey);
      if (lastSeen && now - lastSeen < this.COMMENT_DUPLICATE_TTL_SEC * 1000) {
        throw new HttpException(
          'Duplicate comment detected. You recently posted an identical comment.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      this.memoryCommentHashes.set(memKey, now);
      return;
    }

    try {
      const key = `spam:dupe_comment:${userId}:${hash}`;
      const exists = await this.redisClient.exists(key);
      if (exists) {
        throw new HttpException(
          'Duplicate comment detected. You recently posted an identical comment.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      await this.redisClient.set(key, '1', 'EX', this.COMMENT_DUPLICATE_TTL_SEC);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.debug(`AntiSpam duplicate comment check exception: ${err.message}`);
    }
  }

  /**
   * Enforces follow churn rate limit: max 20 follows per 1 hour per user.
   */
  async checkFollowRateLimit(userId: string): Promise<void> {
    await this.checkSlidingWindow(
      'follow',
      userId,
      this.FOLLOW_MAX,
      this.FOLLOW_WINDOW_SEC,
      'Follow limit reached. To prevent follow churn, please wait before following more creators.',
    );
  }

  /**
   * Clear test data for in-memory windows (used in unit tests).
   */
  clearMemoryWindows(): void {
    this.memoryWindows.clear();
    this.memoryCommentHashes.clear();
  }
}
