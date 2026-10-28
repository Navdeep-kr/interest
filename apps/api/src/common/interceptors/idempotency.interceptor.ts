import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

export interface CachedIdempotentResponse {
  statusCode: number;
  body: any;
  createdAt: number;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);
  // Fast in-memory cache fallback for single-node / testing
  private static readonly memoryCache = new Map<string, CachedIdempotentResponse | 'IN_PROGRESS'>();
  private static readonly ttlMs = 24 * 60 * 60 * 1000; // 24 hours

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const method = req.method.toUpperCase();
    if (!['POST', 'PUT', 'PATCH'].includes(method)) {
      return next.handle();
    }

    const rawKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
    if (!rawKey) {
      return next.handle();
    }

    const idempotencyKey = Array.isArray(rawKey) ? rawKey[0] : rawKey;
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
      throw new BadRequestException('Idempotency-Key must be a string between 8 and 128 characters.');
    }

    const userId = (req as any).user?.userId || (req as any).user?.id || 'anonymous';
    const cacheKey = `idemp:${userId}:${idempotencyKey}`;

    const cached = IdempotencyInterceptor.memoryCache.get(cacheKey);

    if (cached === 'IN_PROGRESS') {
      throw new ConflictException(
        'A request with this idempotency key is currently being processed. Please retry shortly.',
      );
    }

    if (cached && typeof cached === 'object') {
      if (Date.now() - cached.createdAt < IdempotencyInterceptor.ttlMs) {
        this.logger.log(`Idempotency cache HIT for key: [${idempotencyKey}]`);
        res.setHeader('X-Cache-Lookup', 'HIT');
        res.setHeader('X-Idempotent-Replay', 'true');
        res.status(cached.statusCode);
        return of(cached.body);
      } else {
        IdempotencyInterceptor.memoryCache.delete(cacheKey);
      }
    }

    // Mark as IN_PROGRESS
    IdempotencyInterceptor.memoryCache.set(cacheKey, 'IN_PROGRESS');

    return next.handle().pipe(
      tap({
        next: (body) => {
          const statusCode = res.statusCode || 200;
          IdempotencyInterceptor.memoryCache.set(cacheKey, {
            statusCode,
            body,
            createdAt: Date.now(),
          });
        },
        error: () => {
          // Allow retry on failed execution
          IdempotencyInterceptor.memoryCache.delete(cacheKey);
        },
      }),
    );
  }

  /**
   * Helper to clear memory cache (used in testing).
   */
  public static clearCache(): void {
    IdempotencyInterceptor.memoryCache.clear();
  }
}
