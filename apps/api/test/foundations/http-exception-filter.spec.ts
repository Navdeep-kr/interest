import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { ArgumentsHost, BadRequestException, NotFoundException, HttpStatus } from '@nestjs/common';

describe('HttpExceptionFilter Consistent Error Foundations', () => {
  let filter: HttpExceptionFilter;
  let mockRequest: any;
  let mockResponse: any;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();

    mockRequest = {
      id: 'req-uuid-test-1234',
      originalUrl: '/api/v1/auth/login',
      headers: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockHost = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as any;
  });

  it('should format standard NestJS HttpException correctly', () => {
    const exception = new NotFoundException('Reel not found.');
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'NOT_FOUND',
        message: 'Reel not found.',
        path: '/api/v1/auth/login',
        requestId: 'req-uuid-test-1234',
        timestamp: expect.any(String),
      }),
    );
  });

  it('should transform PostgreSQL unique violation (23505) into 409 Conflict', () => {
    const pgError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "users_email_key"',
    };

    filter.catch(pgError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.CONFLICT,
        errorCode: 'RESOURCE_ALREADY_EXISTS',
        requestId: 'req-uuid-test-1234',
      }),
    );
  });

  it('should transform PostgreSQL foreign key violation (23503) into 400 Bad Request', () => {
    const pgError = {
      code: '23503',
      message: 'insert or update on table "reels" violates foreign key constraint',
    };

    filter.catch(pgError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        errorCode: 'INVALID_FOREIGN_KEY_REFERENCE',
        requestId: 'req-uuid-test-1234',
      }),
    );
  });

  it('should sanitize internal database details in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const secretDbError = new Error('FATAL: password authentication failed for user "postgres"');
    filter.catch(secretDbError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errorCode: 'INTERNAL_SERVER_ERROR',
        message: 'An internal server error occurred.',
      }),
    );

    process.env.NODE_ENV = originalEnv;
  });
});
