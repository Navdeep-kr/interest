import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../src/modules/auth/auth.service';
import { DatabaseService } from '../../src/database/database.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RateLimiterService } from '../../src/modules/auth/rate-limiter.service';
import { UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('Auth & Session Management Foundations (Prompt 5)', () => {
  let authService: AuthService;
  let mockDatabaseService: any;
  let mockJwtService: any;
  let mockRateLimiter: any;

  const sampleUserId = 'uuid-user-1234';
  const sampleSessionId = 'sess-active-5678';
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('CorrectPassword123!', 10);
  });

  beforeEach(async () => {
    mockDatabaseService = {
      query: jest.fn().mockImplementation((queryText: string, params?: any[]) => {
        if (queryText.includes('SELECT password_hash FROM users WHERE id = $1')) {
          return Promise.resolve({
            rows: [{ password_hash: passwordHash }],
            rowCount: 1,
          });
        }
        if (queryText.includes('WHERE u.username = $1 OR u.email = $1')) {
          // Check for deactivated user scenario
          if (params?.[0] === 'deactivated_user') {
            return Promise.resolve({
              rows: [
                {
                  id: sampleUserId,
                  username: 'deactivated_user',
                  email: 'deactivated@interest.app',
                  password_hash: passwordHash,
                  is_active: false,
                  is_minor: false,
                  display_name: 'Deactivated User',
                  avatar_url: null,
                },
              ],
              rowCount: 1,
            });
          }
          return Promise.resolve({
            rows: [
              {
                id: sampleUserId,
                username: 'alice',
                email: 'alice@interest.app',
                password_hash: passwordHash,
                is_active: true,
                is_minor: false,
                display_name: 'Alice Creator',
                avatar_url: null,
              },
            ],
            rowCount: 1,
          });
        }
        return Promise.resolve({ rows: [], rowCount: 1 });
      }),
      withTransaction: jest.fn().mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
        };
        return callback(mockClient);
      }),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock.signed.jwt'),
    };

    mockRateLimiter = {
      checkLoginAttempts: jest.fn().mockResolvedValue(undefined),
      recordFailedLogin: jest.fn().mockResolvedValue(undefined),
      clearFailedLogins: jest.fn().mockResolvedValue(undefined),
      checkAndIncrementOtpLimit: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: JwtService, useValue: mockJwtService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, def?: any) => def || 'test-secret'),
          },
        },
        { provide: RateLimiterService, useValue: mockRateLimiter },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('User Logout', () => {
    it('should revoke the active session on logout', async () => {
      const res = await authService.logout(sampleUserId, sampleSessionId);
      expect(res.success).toBe(true);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        'UPDATE user_sessions SET revoked = TRUE WHERE id = $1 AND user_id = $2',
        [sampleSessionId, sampleUserId],
      );
    });
  });

  describe('Reauthentication & Password Change', () => {
    it('should reject password change when current password is wrong (reauthentication failure)', async () => {
      await expect(
        authService.changePassword(sampleUserId, {
          currentPassword: 'WrongPassword!',
          newPassword: 'BrandNewPassword123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should change password and revoke all sessions when current password is verified', async () => {
      const res = await authService.changePassword(sampleUserId, {
        currentPassword: 'CorrectPassword123!',
        newPassword: 'BrandNewPassword123!',
      });

      expect(res.success).toBe(true);
      expect(mockDatabaseService.withTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Account Deactivation & Reactivation Flow', () => {
    it('should reject deactivation when password confirmation is invalid', async () => {
      await expect(
        authService.deactivateAccount(sampleUserId, {
          password: 'IncorrectPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should deactivate account and revoke all sessions when password matches', async () => {
      const res = await authService.deactivateAccount(sampleUserId, {
        password: 'CorrectPassword123!',
        reason: 'Taking a digital detox',
      });

      expect(res.success).toBe(true);
      expect(mockDatabaseService.withTransaction).toHaveBeenCalledTimes(1);
    });

    it('should reject login with anti-enumeration defense for deactivated accounts', async () => {
      // 1. Wrong password on deactivated account returns generic Invalid credentials
      await expect(
        authService.login({
          identifier: 'deactivated_user',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow('Invalid credentials.');

      // 2. Correct password on deactivated account informs user of deactivated status
      await expect(
        authService.login({
          identifier: 'deactivated_user',
          password: 'CorrectPassword123!',
        }),
      ).rejects.toThrow('Account has been deactivated. Please reactivate your account.');
    });

    it('should reactivate account and issue new session tokens on valid reactivation request', async () => {
      const res = await authService.reactivateAccount({
        identifier: 'deactivated_user',
        password: 'CorrectPassword123!',
      });

      expect(res.user.id).toBe(sampleUserId);
      expect(res.tokens.accessToken).toBe('mock.signed.jwt');
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        'UPDATE users SET is_active = TRUE, updated_at = NOW() WHERE id = $1',
        [sampleUserId],
      );
    });
  });
});
