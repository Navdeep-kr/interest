import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  private redisClient: Redis | null = null;
  private readonly fallbackMemoryStore = new Map<string, { count: number; expiresAt: number }>();

  // Thresholds
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOGIN_LOCKOUT_SECONDS = 15 * 60; // 15 minutes
  private readonly MAX_OTP_REQUESTS = 3;
  private readonly OTP_WINDOW_SECONDS = 10 * 60; // 10 minutes

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    try {
      this.redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
      this.redisClient.connect().catch(() => {
        this.logger.warn('Redis unavailable for RateLimiter; using in-memory fallback.');
        this.redisClient = null;
      });
    } catch {
      this.redisClient = null;
    }
  }

  /**
   * Checks if an identifier (email, username, phone) is locked due to repeated brute-force failures.
   */
  async checkLoginAttempts(identifier: string): Promise<void> {
    const key = `auth:failed_login:${identifier.toLowerCase()}`;

    if (this.redisClient && this.redisClient.status === 'ready') {
      const attempts = await this.redisClient.get(key);
      if (attempts && parseInt(attempts, 10) >= this.MAX_LOGIN_ATTEMPTS) {
        const ttl = await this.redisClient.ttl(key);
        throw new HttpException(
          `Account temporarily locked due to multiple failed attempts. Try again in ${Math.ceil(ttl / 60)} minutes.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } else {
      const record = this.fallbackMemoryStore.get(key);
      if (record && record.expiresAt > Date.now() && record.count >= this.MAX_LOGIN_ATTEMPTS) {
        const remainingMinutes = Math.ceil((record.expiresAt - Date.now()) / (1000 * 60));
        throw new HttpException(
          `Account temporarily locked due to multiple failed attempts. Try again in ${remainingMinutes} minutes.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  /**
   * Increments failed attempt counter for brute-force tracking.
   */
  async recordFailedLogin(identifier: string): Promise<number> {
    const key = `auth:failed_login:${identifier.toLowerCase()}`;

    if (this.redisClient && this.redisClient.status === 'ready') {
      const count = await this.redisClient.incr(key);
      if (count === 1) {
        await this.redisClient.expire(key, this.LOGIN_LOCKOUT_SECONDS);
      }
      return count;
    } else {
      const existing = this.fallbackMemoryStore.get(key);
      let count = 1;
      if (existing && existing.expiresAt > Date.now()) {
        count = existing.count + 1;
      }
      this.fallbackMemoryStore.set(key, {
        count,
        expiresAt: Date.now() + this.LOGIN_LOCKOUT_SECONDS * 1000,
      });
      return count;
    }
  }

  /**
   * Clears failed attempt counter upon successful login.
   */
  async clearFailedLogins(identifier: string): Promise<void> {
    const key = `auth:failed_login:${identifier.toLowerCase()}`;
    if (this.redisClient && this.redisClient.status === 'ready') {
      await this.redisClient.del(key);
    } else {
      this.fallbackMemoryStore.delete(key);
    }
  }

  /**
   * Enforces rate limiting on SMS OTP generation.
   */
  async checkAndIncrementOtpLimit(phone: string): Promise<void> {
    const key = `auth:otp_rate:${phone}`;

    if (this.redisClient && this.redisClient.status === 'ready') {
      const count = await this.redisClient.incr(key);
      if (count === 1) {
        await this.redisClient.expire(key, this.OTP_WINDOW_SECONDS);
      }
      if (count > this.MAX_OTP_REQUESTS) {
        const ttl = await this.redisClient.ttl(key);
        throw new HttpException(
          `Too many OTP requests for this phone number. Please wait ${Math.ceil(ttl / 60)} minutes before retrying.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } else {
      const existing = this.fallbackMemoryStore.get(key);
      let count = 1;
      if (existing && existing.expiresAt > Date.now()) {
        count = existing.count + 1;
      }
      if (count > this.MAX_OTP_REQUESTS) {
        throw new HttpException(
          'Too many OTP requests for this phone number. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      this.fallbackMemoryStore.set(key, {
        count,
        expiresAt: Date.now() + this.OTP_WINDOW_SECONDS * 1000,
      });
    }
  }
}
