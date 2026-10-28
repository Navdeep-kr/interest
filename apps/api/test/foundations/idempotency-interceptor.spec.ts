import { IdempotencyInterceptor } from '../../src/common/interceptors/idempotency.interceptor';
import { ExecutionContext, CallHandler, ConflictException, BadRequestException } from '@nestjs/common';
import { of, throwError } from 'rxjs';

describe('IdempotencyInterceptor Foundations', () => {
  let interceptor: IdempotencyInterceptor;
  let mockContext: ExecutionContext;
  let mockRequest: any;
  let mockResponse: any;
  let mockCallHandler: CallHandler;

  beforeEach(() => {
    IdempotencyInterceptor.clearCache();
    interceptor = new IdempotencyInterceptor();

    mockRequest = {
      method: 'POST',
      headers: {},
      user: { userId: 'user-test-1' },
      url: '/api/v1/monetization/tips',
    };

    mockResponse = {
      statusCode: 200,
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as any;

    mockCallHandler = {
      handle: jest.fn().mockReturnValue(of({ tipId: 'tip-100', amount: 500 })),
    };
  });

  it('should ignore safe GET requests even if header is present', (done) => {
    mockRequest.method = 'GET';
    mockRequest.headers['idempotency-key'] = 'idem-unique-key-12345';

    interceptor.intercept(mockContext, mockCallHandler).subscribe((res) => {
      expect(res).toEqual({ tipId: 'tip-100', amount: 500 });
      expect(mockResponse.setHeader).not.toHaveBeenCalledWith('X-Cache-Lookup', 'HIT');
      done();
    });
  });

  it('should ignore POST requests without idempotency-key header', (done) => {
    interceptor.intercept(mockContext, mockCallHandler).subscribe((res) => {
      expect(res).toEqual({ tipId: 'tip-100', amount: 500 });
      expect(mockCallHandler.handle).toHaveBeenCalledTimes(1);
      done();
    });
  });

  it('should reject malformed idempotency keys shorter than 8 chars', () => {
    mockRequest.headers['idempotency-key'] = 'short';
    expect(() => interceptor.intercept(mockContext, mockCallHandler)).toThrow(
      BadRequestException,
    );
  });

  it('should execute first request, cache result, and replay cached result on duplicate', (done) => {
    mockRequest.headers['idempotency-key'] = 'idem-key-first-pass-1234';

    interceptor.intercept(mockContext, mockCallHandler).subscribe((firstRes) => {
      expect(firstRes).toEqual({ tipId: 'tip-100', amount: 500 });
      expect(mockCallHandler.handle).toHaveBeenCalledTimes(1);

      // Now issue duplicate request with same key
      const secondHandler: CallHandler = {
        handle: jest.fn().mockReturnValue(of({ tipId: 'tip-DIFFERENT', amount: 999 })),
      };

      interceptor.intercept(mockContext, secondHandler).subscribe((secondRes) => {
        // Must return cached response without calling secondHandler
        expect(secondRes).toEqual({ tipId: 'tip-100', amount: 500 });
        expect(secondHandler.handle).not.toHaveBeenCalled();
        expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Cache-Lookup', 'HIT');
        expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Idempotent-Replay', 'true');
        done();
      });
    });
  });

  it('should throw ConflictException (409) if duplicate request arrives while previous is IN_PROGRESS', () => {
    mockRequest.headers['idempotency-key'] = 'idem-in-progress-key-999';

    // Simulate slow in-flight request
    const slowHandler: CallHandler = {
      handle: () => of({ pending: true }),
    };

    // First call begins
    interceptor.intercept(mockContext, slowHandler);

    // Concurrent call arrives
    expect(() => interceptor.intercept(mockContext, mockCallHandler)).toThrow(
      ConflictException,
    );
  });
});
