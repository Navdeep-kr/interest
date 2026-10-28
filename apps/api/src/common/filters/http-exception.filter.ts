import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = (request as any).id || request.headers['x-request-id'] || 'unknown';
    const path = request.originalUrl ? request.originalUrl.split('?')[0] : request.url;

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let message: string | string[] = 'An unexpected error occurred. Please try again later.';
    let details: any = undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resObj = exceptionResponse as Record<string, any>;
        message = resObj.message || exception.message;
        errorCode = resObj.error || this.getErrorCodeFromStatus(statusCode);
        details = resObj.details;
      }
      errorCode = this.getErrorCodeFromStatus(statusCode);
    } else if (exception && typeof exception === 'object') {
      const err = exception as Record<string, any>;

      // PostgreSQL Specific Error Codes
      if (err.code === '23505') {
        // Unique violation
        statusCode = HttpStatus.CONFLICT;
        errorCode = 'RESOURCE_ALREADY_EXISTS';
        message = 'A resource with these unique attributes already exists.';
      } else if (err.code === '23503') {
        // Foreign key violation
        statusCode = HttpStatus.BAD_REQUEST;
        errorCode = 'INVALID_FOREIGN_KEY_REFERENCE';
        message = 'Referenced related resource does not exist.';
      } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        statusCode = HttpStatus.UNAUTHORIZED;
        errorCode = 'INVALID_OR_EXPIRED_TOKEN';
        message = 'Provided authorization token is invalid or has expired.';
      } else {
        statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
        errorCode = 'INTERNAL_SERVER_ERROR';
        // Redact internal error message in production
        message =
          process.env.NODE_ENV === 'production'
            ? 'An internal server error occurred.'
            : err.message || 'An internal server error occurred.';
      }

      this.logger.error(
        `[${requestId}] Unhandled Exception: ${err.message || 'Unknown error'}`,
        err.stack,
      );
    }

    const errorBody: Record<string, any> = {
      statusCode,
      errorCode,
      message,
      timestamp: new Date().toISOString(),
      path,
      requestId,
    };

    if (details) {
      errorBody.details = details;
    }

    response.status(statusCode).json(errorBody);
  }

  private getErrorCodeFromStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'TOO_MANY_REQUESTS';
      case HttpStatus.REQUEST_TIMEOUT:
        return 'REQUEST_TIMEOUT';
      default:
        return status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'HTTP_ERROR';
    }
  }
}
