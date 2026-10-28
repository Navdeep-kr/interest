import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { DatabaseService } from '../../database/database.service';

export type ReelCounterField = 'likes' | 'comments' | 'saves' | 'shares';
export type UserCounterField = 'followers' | 'following';

@Injectable()
export class RedisCounterService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCounterService.name);
  private readonly redisClient: Redis;
  private isRedisConnected = false;

  private readonly DIRTY_REELS_SET = 'counters:dirty:reels';
  private readonly DIRTY_COMMENTS_SET = 'counters:dirty:comments';

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {
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
        this.logger.log('Redis counter client connected.');
      })
      .catch((err) => {
        this.logger.warn(`Redis counter connection deferred: ${err.message}`);
        this.isRedisConnected = false;
      });

    this.redisClient.on('connect', () => {
      this.isRedisConnected = true;
    });

    this.redisClient.on('error', (err) => {
      this.logger.debug(`Redis counter error: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    try {
      if (this.isRedisConnected) {
        await this.flushDirtyCountersToDatabase();
        await this.redisClient.quit();
      }
    } catch (e) {
      this.logger.debug(`Redis disconnect error: ${e.message}`);
    }
  }

  private reelKey(reelId: string): string {
    return `reel:${reelId}:counters`;
  }

  private commentKey(commentId: string): string {
    return `comment:${commentId}:counters`;
  }

  private userKey(userId: string): string {
    return `user:${userId}:counters`;
  }

  /**
   * Fast atomic in-memory increment/decrement of a reel metric.
   * Marks the reel as dirty for write-behind batch persistence to PostgreSQL.
   */
  async incrementReelCounter(
    reelId: string,
    field: ReelCounterField,
    delta: number = 1,
  ): Promise<number> {
    if (!this.isRedisConnected) {
      return this.fallbackIncrementReelDb(reelId, field, delta);
    }

    try {
      const key = this.reelKey(reelId);
      const multi = this.redisClient.multi();
      multi.hincrby(key, field, delta);
      multi.sadd(this.DIRTY_REELS_SET, reelId);
      multi.expire(key, 86400 * 7); // 7-day TTL

      const results = await multi.exec();
      if (!results || results[0][0]) {
        throw results?.[0][0] || new Error('Multi execution failed');
      }

      const newVal = results[0][1] as number;
      // Ensure counter does not go below zero
      if (newVal < 0) {
        await this.redisClient.hset(key, field, 0);
        return 0;
      }
      return newVal;
    } catch (err) {
      this.logger.warn(`Redis reel counter failed for ${reelId}.${field}: ${err.message}`);
      return this.fallbackIncrementReelDb(reelId, field, delta);
    }
  }

  /**
   * Retrieves aggregated reel counters from Redis with DB fallback.
   */
  async getReelCounters(
    reelId: string,
    initialFallback?: { likes?: number; comments?: number; saves?: number; shares?: number },
  ): Promise<{ likes: number; comments: number; saves: number; shares: number }> {
    if (!this.isRedisConnected) {
      return {
        likes: Math.max(0, initialFallback?.likes || 0),
        comments: Math.max(0, initialFallback?.comments || 0),
        saves: Math.max(0, initialFallback?.saves || 0),
        shares: Math.max(0, initialFallback?.shares || 0),
      };
    }

    try {
      const key = this.reelKey(reelId);
      const raw = await this.redisClient.hgetall(key);

      if (raw && Object.keys(raw).length > 0) {
        return {
          likes: Math.max(0, parseInt(raw.likes || '0', 10)),
          comments: Math.max(0, parseInt(raw.comments || '0', 10)),
          saves: Math.max(0, parseInt(raw.saves || '0', 10)),
          shares: Math.max(0, parseInt(raw.shares || '0', 10)),
        };
      }

      // Cache miss: seed from fallback or database
      const likes = Math.max(0, initialFallback?.likes || 0);
      const comments = Math.max(0, initialFallback?.comments || 0);
      const saves = Math.max(0, initialFallback?.saves || 0);
      const shares = Math.max(0, initialFallback?.shares || 0);

      await this.redisClient.hmset(key, {
        likes: likes.toString(),
        comments: comments.toString(),
        saves: saves.toString(),
        shares: shares.toString(),
      });
      await this.redisClient.expire(key, 86400 * 7);

      return { likes, comments, saves, shares };
    } catch (err) {
      this.logger.debug(`Redis getReelCounters error: ${err.message}`);
      return {
        likes: Math.max(0, initialFallback?.likes || 0),
        comments: Math.max(0, initialFallback?.comments || 0),
        saves: Math.max(0, initialFallback?.saves || 0),
        shares: Math.max(0, initialFallback?.shares || 0),
      };
    }
  }

  /**
   * Fast atomic increment for comment like count.
   */
  async incrementCommentLikeCount(commentId: string, delta: number = 1): Promise<number> {
    if (!this.isRedisConnected) {
      return this.fallbackIncrementCommentDb(commentId, delta);
    }

    try {
      const key = this.commentKey(commentId);
      const multi = this.redisClient.multi();
      multi.hincrby(key, 'likes', delta);
      multi.sadd(this.DIRTY_COMMENTS_SET, commentId);
      multi.expire(key, 86400 * 3);

      const results = await multi.exec();
      if (!results || results[0][0]) {
        throw results?.[0][0] || new Error('Multi failed');
      }

      const newVal = results[0][1] as number;
      if (newVal < 0) {
        await this.redisClient.hset(key, 'likes', 0);
        return 0;
      }
      return newVal;
    } catch (err) {
      this.logger.warn(`Redis comment like counter failed for ${commentId}: ${err.message}`);
      return this.fallbackIncrementCommentDb(commentId, delta);
    }
  }

  async getCommentLikeCount(commentId: string, fallback: number = 0): Promise<number> {
    if (!this.isRedisConnected) return Math.max(0, fallback);

    try {
      const key = this.commentKey(commentId);
      const val = await this.redisClient.hget(key, 'likes');
      if (val !== null) {
        return Math.max(0, parseInt(val, 10));
      }
      await this.redisClient.hset(key, 'likes', fallback.toString());
      await this.redisClient.expire(key, 86400 * 3);
      return Math.max(0, fallback);
    } catch {
      return Math.max(0, fallback);
    }
  }

  /**
   * Fast atomic increment for follower/following counts.
   */
  async incrementUserCounter(
    userId: string,
    field: UserCounterField,
    delta: number = 1,
  ): Promise<number> {
    if (!this.isRedisConnected) return 0;

    try {
      const key = this.userKey(userId);
      const newVal = await this.redisClient.hincrby(key, field, delta);
      await this.redisClient.expire(key, 86400 * 7);
      return Math.max(0, newVal);
    } catch (err) {
      this.logger.debug(`Redis user counter failed for ${userId}: ${err.message}`);
      return 0;
    }
  }

  /**
   * Write-Behind Engine:
   * Flushes dirty Redis counters to PostgreSQL in batch.
   * Can be triggered on a schedule, shutdown, or after high viral bursts.
   */
  async flushDirtyCountersToDatabase(): Promise<{ reelsSynced: number; commentsSynced: number }> {
    if (!this.isRedisConnected) {
      return { reelsSynced: 0, commentsSynced: 0 };
    }

    let reelsSynced = 0;
    let commentsSynced = 0;

    try {
      // 1. Sync dirty reels
      const dirtyReels = await this.redisClient.smembers(this.DIRTY_REELS_SET);
      if (dirtyReels && dirtyReels.length > 0) {
        for (const reelId of dirtyReels) {
          const raw = await this.redisClient.hgetall(this.reelKey(reelId));
          if (raw && Object.keys(raw).length > 0) {
            const likes = Math.max(0, parseInt(raw.likes || '0', 10));
            const comments = Math.max(0, parseInt(raw.comments || '0', 10));
            const saves = Math.max(0, parseInt(raw.saves || '0', 10));
            const shares = Math.max(0, parseInt(raw.shares || '0', 10));

            await this.databaseService.query(
              `UPDATE reels 
               SET like_count = $1, comment_count = $2, save_count = $3, share_count = $4, updated_at = NOW() 
               WHERE id = $5`,
              [likes, comments, saves, shares, reelId],
            );
            reelsSynced++;
          }
        }
        await this.redisClient.del(this.DIRTY_REELS_SET);
      }

      // 2. Sync dirty comments
      const dirtyComments = await this.redisClient.smembers(this.DIRTY_COMMENTS_SET);
      if (dirtyComments && dirtyComments.length > 0) {
        for (const commentId of dirtyComments) {
          const raw = await this.redisClient.hget(this.commentKey(commentId), 'likes');
          if (raw !== null) {
            const likes = Math.max(0, parseInt(raw, 10));
            await this.databaseService.query(
              `UPDATE comments SET like_count = $1, updated_at = NOW() WHERE id = $2`,
              [likes, commentId],
            );
            commentsSynced++;
          }
        }
        await this.redisClient.del(this.DIRTY_COMMENTS_SET);
      }

      if (reelsSynced > 0 || commentsSynced > 0) {
        this.logger.log(
          `Flushed write-behind counters: ${reelsSynced} reels, ${commentsSynced} comments to PostgreSQL.`,
        );
      }
    } catch (err) {
      this.logger.error(`Error flushing dirty counters to PostgreSQL: ${err.message}`);
    }

    return { reelsSynced, commentsSynced };
  }

  // Fallbacks for direct PostgreSQL writes when Redis is unavailable
  private async fallbackIncrementReelDb(
    reelId: string,
    field: ReelCounterField,
    delta: number,
  ): Promise<number> {
    const columnMap: Record<ReelCounterField, string> = {
      likes: 'like_count',
      comments: 'comment_count',
      saves: 'save_count',
      shares: 'share_count',
    };
    const col = columnMap[field];
    const res = await this.databaseService.query(
      `UPDATE reels 
       SET ${col} = GREATEST(0, ${col} + $1), updated_at = NOW() 
       WHERE id = $2 
       RETURNING ${col}`,
      [delta, reelId],
    );
    return res.rows[0]?.[col] || 0;
  }

  private async fallbackIncrementCommentDb(commentId: string, delta: number): Promise<number> {
    const res = await this.databaseService.query(
      `UPDATE comments 
       SET like_count = GREATEST(0, like_count + $1), updated_at = NOW() 
       WHERE id = $2 
       RETURNING like_count`,
      [delta, commentId],
    );
    return res.rows[0]?.like_count || 0;
  }
}
