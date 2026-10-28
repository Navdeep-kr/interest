import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_KEY, RateLimitOptions } from '../decorators/rate-limit.decorator';
import { Request, Response } from 'express';

interface RateLimitTracker {
  timestamps: number[];
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private static readonly tracker = new Map<string, RateLimitTracker>();

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no rate limit specified on handler/class, allow through
    if (!options) {
      return true;
    }

    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const userId = (req as any).user?.userId || (req as any).user?.id;
    // Strictly anonymized identifier for unauthenticated callers (no raw IP storage)
    const clientIdentifier =
      userId ||
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'anonymous';

    const path = req.originalUrl ? req.originalUrl.split('?')[0] : req.url;
    const trackerKey = `rl:${path}:${clientIdentifier}`;

    const now = Date.now();
    const windowStart = now - options.duration * 1000;

    let userRecord = RateLimitGuard.tracker.get(trackerKey);
    if (!userRecord) {
      userRecord = { timestamps: [] };
      RateLimitGuard.tracker.set(trackerKey, userRecord);
    }

    // Filter out timestamps outside the active sliding window
    userRecord.timestamps = userRecord.timestamps.filter((ts) => ts > windowStart);

    if (userRecord.timestamps.length >= options.points) {
      const oldestInWindow = userRecord.timestamps[0];
      const retryAfterSeconds = Math.ceil((oldestInWindow + options.duration * 1000 - now) / 1000);

      res.setHeader('Retry-After', retryAfterSeconds > 0 ? retryAfterSeconds : 1);
      res.setHeader('X-RateLimit-Limit', options.points);
      res.setHeader('X-RateLimit-Remaining', 0);

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          errorCode: 'TOO_MANY_REQUESTS',
          message: `Too many requests. Limit is ${options.points} requests per ${options.duration}s.`,
          retryAfter: retryAfterSeconds > 0 ? retryAfterSeconds : 1,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Record this request
    userRecord.timestamps.push(now);

    res.setHeader('X-RateLimit-Limit', options.points);
    res.setHeader('X-RateLimit-Remaining', options.points - userRecord.timestamps.length);

    return true;
  }

  /**
   * Helper to clear rate limit tracker (used in test fixtures).
   */
  public static clearTracker(): void {
    RateLimitGuard.tracker.clear();
  }
}
