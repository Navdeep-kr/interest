import { BadRequestException, UnauthorizedException, HttpException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';

describe('AuthService (Unit Tests)', () => {
  let authService: AuthService;
  let mockDatabaseService: any;
  let mockJwtService: any;
  let mockConfigService: any;
  let mockRateLimiter: any;

  beforeEach(() => {
    mockDatabaseService = {
      query: jest.fn(),
      getClient: jest.fn().mockResolvedValue({
        query: jest.fn().mockImplementation((sql: string) => {
          if (sql.includes('INSERT INTO users')) {
            return Promise.resolve({
              rows: [
                {
                  id: 'user-uuid-1',
                  username: 'testuser',
                  email: 'test@interest.app',
                  is_minor: false,
                },
              ],
            });
          }
          return Promise.resolve({ rows: [] });
        }),
        release: jest.fn(),
      }),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      verify: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultVal: string) => defaultVal),
    };

    mockRateLimiter = {
      checkLoginAttempts: jest.fn().mockResolvedValue(undefined),
      recordFailedLogin: jest.fn().mockResolvedValue(1),
      clearFailedLogins: jest.fn().mockResolvedValue(undefined),
      checkAndIncrementOtpLimit: jest.fn().mockResolvedValue(undefined),
    };

    authService = new AuthService(
      mockDatabaseService,
      mockJwtService,
      mockConfigService,
      mockRateLimiter,
    );
  });

  describe('Age Gate Evaluation', () => {
    it('should reject users under 13 years old (COPPA compliance)', () => {
      // 10 years old
      const under13 = new Date();
      under13.setFullYear(under13.getFullYear() - 10);
      const birthdateStr = under13.toISOString().split('T')[0];

      expect(() => authService.evaluateAge(birthdateStr)).toThrow(BadRequestException);
    });

    it('should classify users between 13 and 17 as minors with restricted defaults', () => {
      // 15 years old
      const teen = new Date();
      teen.setFullYear(teen.getFullYear() - 15);
      const birthdateStr = teen.toISOString().split('T')[0];

      const result = authService.evaluateAge(birthdateStr);
      expect(result.age).toBe(15);
      expect(result.isMinor).toBe(true);
    });

    it('should classify users 18 and older as adults (isMinor = false)', () => {
      // 25 years old
      const adult = new Date();
      adult.setFullYear(adult.getFullYear() - 25);
      const birthdateStr = adult.toISOString().split('T')[0];

      const result = authService.evaluateAge(birthdateStr);
      expect(result.age).toBe(25);
      expect(result.isMinor).toBe(false);
    });
  });

  describe('User Registration', () => {
    it('should register a valid user, hash password, create session, and return tokens', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [] }); // Uniqueness check

      const dto: RegisterDto = {
        username: 'horology_fan',
        email: 'horology@interest.app',
        displayName: 'Precision Maker',
        password: 'SecurePassword123!',
        birthdate: '2000-05-15',
        deviceName: 'MacBook Pro',
      };

      const result = await authService.register(dto, 'Mozilla/5.0');

      expect(result.tokens).toBeDefined();
      expect(result.tokens.accessToken).toBe('mock-jwt-token');
      expect(result.user.username).toBe('testuser');
      expect(mockDatabaseService.getClient).toHaveBeenCalled();
    });

    it('should reject registration if age is under 13', async () => {
      const under13 = new Date();
      under13.setFullYear(under13.getFullYear() - 11);

      const dto: RegisterDto = {
        username: 'young_user',
        email: 'young@interest.app',
        displayName: 'Young User',
        password: 'Password123!',
        birthdate: under13.toISOString().split('T')[0],
      };

      await expect(authService.register(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('Password Login & Brute-Force Protection', () => {
    it('should log in successfully with valid credentials and clear failed attempts', async () => {
      const password = 'CorrectPassword123!';
      const hash = await bcrypt.hash(password, 10);

      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'user-1',
            username: 'synthmaker',
            email: 'synth@interest.app',
            password_hash: hash,
            is_active: true,
            is_minor: false,
            display_name: 'Synth Maker',
          },
        ],
      });

      const dto: LoginDto = {
        identifier: 'synthmaker',
        password: 'CorrectPassword123!',
      };

      const result = await authService.login(dto);

      expect(result.tokens).toBeDefined();
      expect(result.user.username).toBe('synthmaker');
      expect(mockRateLimiter.checkLoginAttempts).toHaveBeenCalledWith('synthmaker');
      expect(mockRateLimiter.clearFailedLogins).toHaveBeenCalledWith('synthmaker');
    });

    it('should record failed attempt and throw UnauthorizedException on invalid password', async () => {
      const hash = await bcrypt.hash('ActualPassword!', 10);

      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'user-1',
            username: 'synthmaker',
            email: 'synth@interest.app',
            password_hash: hash,
            is_active: true,
          },
        ],
      });

      const dto: LoginDto = {
        identifier: 'synthmaker',
        password: 'WrongPassword!',
      };

      await expect(authService.login(dto)).rejects.toThrow(UnauthorizedException);
      expect(mockRateLimiter.recordFailedLogin).toHaveBeenCalledWith('synthmaker');
    });

    it('should block login if rate limiter flags brute-force lockout', async () => {
      mockRateLimiter.checkLoginAttempts.mockRejectedValueOnce(
        new HttpException('Account temporarily locked', 429),
      );

      const dto: LoginDto = {
        identifier: 'locked_user',
        password: 'AnyPassword!',
      };

      await expect(authService.login(dto)).rejects.toThrow(HttpException);
    });
  });

  describe('Refresh Token Rotation & Security Reuse Detection', () => {
    it('should rotate refresh token and return new session', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-1', jti: 'session-old' });

      // Valid unrevoked session
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'session-old',
            user_id: 'user-1',
            revoked: false,
            expires_at: new Date(Date.now() + 100000).toISOString(),
          },
        ],
      });

      // User lookup
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [] }); // Update old session revoked
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ id: 'user-1', username: 'synthmaker', email: 'synth@interest.app' }],
      });

      const tokens = await authService.refreshTokens('valid-refresh-token');
      expect(tokens.accessToken).toBe('mock-jwt-token');
    });

    it('should detect token reuse on revoked session and terminate all user sessions', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-1', jti: 'session-stolen' });

      // Stolen session is already revoked
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'session-stolen',
            user_id: 'user-1',
            revoked: true,
            expires_at: new Date(Date.now() + 100000).toISOString(),
          },
        ],
      });

      await expect(authService.refreshTokens('stolen-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );

      // Verify all sessions revoked query was fired
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_sessions SET revoked = TRUE WHERE user_id = $1'),
        ['user-1'],
      );
    });
  });

  describe('Password Reset & Email Verification', () => {
    it('should verify email successfully when valid token is provided', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 'user-1' }],
      });

      const res = await authService.verifyEmail({ token: 'valid-crypto-token' });
      expect(res.success).toBe(true);
      expect(res.message).toContain('verified');
    });

    it('should reject email verification with expired or invalid token', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rowCount: 0,
        rows: [],
      });

      await expect(authService.verifyEmail({ token: 'bad-token' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
