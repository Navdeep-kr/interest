import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
  Optional,
  Inject,
} from '@nestjs/common';
import { Observable, TimeoutError, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly timeoutMs: number;

  constructor(@Optional() @Inject('TIMEOUT_MS') timeoutMs?: number) {
    this.timeoutMs = timeoutMs ?? 30000;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(this.timeoutMs),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(
            () =>
              new RequestTimeoutException(
                `The request processing exceeded the timeout threshold of ${this.timeoutMs / 1000}s.`,
              ),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}
