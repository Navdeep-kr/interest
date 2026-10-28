import { RateLimitGuard } from '../../src/common/guards/rate-limit.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';

describe('RateLimitGuard Sliding Window Foundations', () => {
  let guard: RateLimitGuard;
  let reflector: Reflector;
  let mockContext: ExecutionContext;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    RateLimitGuard.clearTracker();
    reflector = new Reflector();
    guard = new RateLimitGuard(reflector);

    mockRequest = {
      user: { userId: 'u-rate-limited' },
      originalUrl: '/api/v1/auth/login',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    };

    mockResponse = {
      setHeader: jest.fn(),
    };

    mockContext = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as any;
  });

  it('should allow unlimited requests if no RateLimit options are specified', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(mockContext)).toBe(true);
  });

  it('should allow requests within configured threshold', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({ points: 3, duration: 60 });

    expect(guard.canActivate(mockContext)).toBe(true);
    expect(guard.canActivate(mockContext)).toBe(true);
    expect(guard.canActivate(mockContext)).toBe(true);
    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 3);
    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);
  });

  it('should throw 429 Too Many Requests and set Retry-After when limit exceeded', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({ points: 2, duration: 60 });

    // 2 allowed
    expect(guard.canActivate(mockContext)).toBe(true);
    expect(guard.canActivate(mockContext)).toBe(true);

    // 3rd should throw
    try {
      guard.canActivate(mockContext);
      fail('Should have thrown HttpException');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
    }
  });
});
