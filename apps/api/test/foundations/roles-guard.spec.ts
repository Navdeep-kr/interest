import { RolesGuard } from '../../src/common/guards/roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

describe('RolesGuard RBAC Authorization Foundations', () => {
  let guard: RolesGuard;
  let reflector: Reflector;
  let mockContext: ExecutionContext;
  let mockRequest: any;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);

    mockRequest = {
      user: { userId: 'u-1', role: 'USER' },
    };

    mockContext = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as any;
  });

  it('should allow access when no roles are required on handler or class', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const canActivate = guard.canActivate(mockContext);
    expect(canActivate).toBe(true);
  });

  it('should throw ForbiddenException if user object is missing on request', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    mockRequest.user = null;
    expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
  });

  it('should allow user with matching role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['MODERATOR']);
    mockRequest.user = { userId: 'u-mod', role: 'MODERATOR' };
    const canActivate = guard.canActivate(mockContext);
    expect(canActivate).toBe(true);
  });

  it('should allow SUPERADMIN regardless of required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['MODERATOR']);
    mockRequest.user = { userId: 'u-root', role: 'SUPERADMIN' };
    const canActivate = guard.canActivate(mockContext);
    expect(canActivate).toBe(true);
  });

  it('should allow ADMIN to access MODERATOR or CREATOR routes', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['MODERATOR', 'CREATOR']);
    mockRequest.user = { userId: 'u-admin', role: 'ADMIN' };
    const canActivate = guard.canActivate(mockContext);
    expect(canActivate).toBe(true);
  });

  it('should deny standard USER from accessing MODERATOR or ADMIN routes', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['MODERATOR', 'ADMIN']);
    mockRequest.user = { userId: 'u-regular', role: 'USER' };
    expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
  });
});
