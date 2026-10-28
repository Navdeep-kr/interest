import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  Optional,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { MetricsService } from '../../modules/metrics/metrics.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(@Optional() private readonly metricsService?: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const startTime = Date.now();
    const { method, originalUrl } = req;
    const requestId = (req as any).id || req.headers['x-request-id'] || crypto.randomUUID();

    // W3C TraceContext traceparent: version (00) - 32-hex traceId - 16-hex spanId - traceFlags (01)
    const incomingTrace = req.headers['traceparent'] as string | undefined;
    let traceId: string;
    let spanId: string;
    let traceparent: string;

    if (incomingTrace && /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/.test(incomingTrace)) {
      const parts = incomingTrace.split('-');
      traceId = parts[1];
      spanId = crypto.randomBytes(8).toString('hex');
      traceparent = `00-${traceId}-${spanId}-01`;
    } else {
      traceId = crypto.randomBytes(16).toString('hex');
      spanId = crypto.randomBytes(8).toString('hex');
      traceparent = `00-${traceId}-${spanId}-01`;
    }

    // Attach tracing headers for client correlation
    res.setHeader('traceparent', traceparent);
    res.setHeader('x-trace-id', traceId);
    res.setHeader('x-request-id', requestId);

    const userId = (req as any).user?.userId || (req as any).user?.id || 'anonymous';

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - startTime;
          const statusCode = res.statusCode;
          const cleanPath = this.sanitizeUrl(originalUrl);

          // Feed into Prometheus metrics collector
          this.metricsService?.recordHttpRequest({
            method,
            path: cleanPath,
            statusCode,
            durationMs,
          });

          const logPayload = {
            timestamp: new Date().toISOString(),
            traceId,
            spanId,
            requestId,
            userId,
            method,
            path: cleanPath,
            statusCode,
            durationMs,
          };

          if (process.env.NODE_ENV === 'production') {
            this.logger.log(JSON.stringify(logPayload));
          } else {
            this.logger.log(
              `[${traceId.slice(0, 8)}][${requestId.slice(0, 8)}] ${method} ${cleanPath} -> ${statusCode} (${durationMs}ms) [User: ${userId}]`,
            );
          }
        },
        error: (err) => {
          const durationMs = Date.now() - startTime;
          const statusCode = err.status || 500;
          const cleanPath = this.sanitizeUrl(originalUrl);

          // Record error metric
          this.metricsService?.recordHttpRequest({
            method,
            path: cleanPath,
            statusCode,
            durationMs,
          });

          const errorPayload = {
            timestamp: new Date().toISOString(),
            traceId,
            spanId,
            requestId,
            userId,
            method,
            path: cleanPath,
            statusCode,
            durationMs,
            errorMessage: this.sanitizeErrorMessage(err.message),
          };

          if (process.env.NODE_ENV === 'production') {
            this.logger.error(JSON.stringify(errorPayload));
          } else {
            this.logger.error(
              `[${traceId.slice(0, 8)}][${requestId.slice(0, 8)}] ${method} ${cleanPath} -> ${statusCode} (${durationMs}ms) Error: ${errorPayload.errorMessage}`,
            );
          }
        },
      }),
    );
  }

  /**
   * Strips query string parameters that might contain tokens or credentials.
   */
  private sanitizeUrl(url: string): string {
    const urlObj = new URL(url, 'http://localhost');
    const sensitiveKeys = ['token', 'password', 'secret', 'key', 'auth', 'access_token', 'refresh_token'];
    for (const key of sensitiveKeys) {
      if (urlObj.searchParams.has(key)) {
        urlObj.searchParams.set(key, '[REDACTED]');
      }
    }
    return `${urlObj.pathname}${urlObj.search}`;
  }

  /**
   * Redacts potential database connection strings or tokens from error messages.
   */
  private sanitizeErrorMessage(msg: string): string {
    if (!msg) return 'Unknown error';
    return msg
      .replace(/postgres:\/\/[^@]+@/g, 'postgres://[REDACTED]@')
      .replace(/redis:\/\/[^@]+@/g, 'redis://[REDACTED]@')
      .replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED]');
  }
}
