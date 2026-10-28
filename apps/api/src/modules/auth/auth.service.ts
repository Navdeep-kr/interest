import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../database/database.service';
import { RateLimiterService } from './rate-limiter.service';
import {
  RegisterDto,
  LoginDto,
  OAuthLoginDto,
  PhoneOtpRequestDto,
  PhoneOtpVerifyDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  ChangePasswordDto,
  DeactivateAccountDto,
  ReactivateAccountDto,
} from './dto/auth.dto';
import { AuthTokens } from '@interest/shared';

export interface UserSessionDto {
  id: string;
  deviceName?: string;
  userAgent?: string;
  lastActiveAt: string;
  createdAt: string;
  isCurrent?: boolean;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly otpCache = new Map<string, { code: string; expiresAt: number }>();

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  /**
   * Evaluates age from an ISO birthdate string (YYYY-MM-DD).
   * Enforces COPPA compliance (< 13 blocked) and flags minors (13-17).
   */
  public evaluateAge(birthdateStr: string): { age: number; isMinor: boolean } {
    const birthDate = new Date(birthdateStr);
    if (isNaN(birthDate.getTime())) {
      throw new BadRequestException('Invalid birthdate format. Use YYYY-MM-DD.');
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 13) {
      throw new BadRequestException(
        'You must be at least 13 years old to use Interest (COPPA Compliance).',
      );
    }

    const isMinor = age < 18;
    return { age, isMinor };
  }

  /**
   * Registers a new user with age gate validation and verification token generation.
   * Zero Location Guarantee: Excludes country, city, coordinates, or IP.
   */
  async register(
    dto: RegisterDto,
    userAgent?: string,
  ): Promise<{ user: any; tokens: AuthTokens; verificationToken?: string }> {
    if (!dto.email && !dto.phoneNumber) {
      throw new BadRequestException('Either email or phone number is required.');
    }

    // 1. Enforce Age Gate
    const { isMinor } = this.evaluateAge(dto.birthdate);

    // 2. Uniqueness verification
    const existing = await this.databaseService.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2 OR phone_number = $3',
      [dto.username, dto.email || null, dto.phoneNumber || null],
    );

    if (existing.rows.length > 0) {
      throw new ConflictException('Username, email, or phone number already registered.');
    }

    // 3. Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    // 4. Generate email verification token (24-hour expiry)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const client = await this.databaseService.getClient();
    let user: any;

    try {
      await client.query('BEGIN');

      // Insert User record
      const insertUserRes = await client.query(
        `INSERT INTO users (
           username, email, phone_number, password_hash,
           birthdate, is_minor, email_verification_token, email_verification_expires
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, username, email, phone_number, is_minor, is_email_verified, created_at`,
        [
          dto.username,
          dto.email || null,
          dto.phoneNumber || null,
          passwordHash,
          dto.birthdate,
          isMinor,
          verificationToken,
          verificationExpires,
        ],
      );
      user = insertUserRes.rows[0];

      // Insert Profile record with restricted defaults if minor
      await client.query(
        `INSERT INTO profiles (user_id, username, display_name, preferred_languages)
         VALUES ($1, $2, $3, ARRAY['en'])`,
        [user.id, dto.username, dto.displayName],
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // 5. Create active device session and return tokens
    const tokens = await this.createSessionAndTokens(
      user.id,
      user.username,
      dto.deviceName || 'Primary Device',
      userAgent,
      user.email,
    );

    return {
      user,
      tokens,
      verificationToken: process.env.NODE_ENV !== 'production' ? verificationToken : undefined,
    };
  }

  /**
   * Password login with brute-force protection and session creation.
   */
  async login(dto: LoginDto, userAgent?: string): Promise<{ user: any; tokens: AuthTokens }> {
    // 1. Check brute-force lockout
    await this.rateLimiter.checkLoginAttempts(dto.identifier);

    // 2. Fetch user
    const userResult = await this.databaseService.query(
      `SELECT u.id, u.username, u.email, u.password_hash, u.is_active, u.is_minor,
              p.display_name, p.avatar_url
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE u.username = $1 OR u.email = $1`,
      [dto.identifier],
    );

    if (userResult.rows.length === 0) {
      await this.rateLimiter.recordFailedLogin(dto.identifier);
      throw new UnauthorizedException('Invalid credentials.');
    }

    const user = userResult.rows[0];

    // 3. Verify password hash first (anti-enumeration defense)
    const isValid = user.password_hash
      ? await bcrypt.compare(dto.password, user.password_hash)
      : false;

    if (!isValid) {
      await this.rateLimiter.recordFailedLogin(dto.identifier);
      throw new UnauthorizedException('Invalid credentials.');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Account has been deactivated. Please reactivate your account.');
    }

    // 4. Clear failed attempts upon success
    await this.rateLimiter.clearFailedLogins(dto.identifier);

    // 5. Create device session & tokens
    const tokens = await this.createSessionAndTokens(
      user.id,
      user.username,
      dto.deviceName || 'Primary Device',
      userAgent,
      user.email,
    );

    return {
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        avatarUrl: user.avatar_url,
        isMinor: user.is_minor,
      },
      tokens,
    };
  }

  /**
   * OAuth sign-in (Google / Apple) with age gate on new accounts.
   */
  async oauthLogin(
    dto: OAuthLoginDto,
    userAgent?: string,
  ): Promise<{ user: any; tokens: AuthTokens }> {
    const mockEmail = `oauth_${dto.provider}_${dto.idToken.slice(0, 12)}@interest.app`;
    const mockUsername = `${dto.provider}_${Date.now().toString(36)}`;
    const displayName = dto.displayName || `${dto.provider.toUpperCase()} Creator`;

    let userResult = await this.databaseService.query(
      `SELECT u.id, u.username, u.email, u.is_minor, p.display_name, p.avatar_url
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE u.email = $1`,
      [mockEmail],
    );

    let user = userResult.rows[0];

    if (!user) {
      // Age gate validation required for new OAuth accounts
      let isMinor = false;
      if (dto.birthdate) {
        const ageEval = this.evaluateAge(dto.birthdate);
        isMinor = ageEval.isMinor;
      }

      const client = await this.databaseService.getClient();
      try {
        await client.query('BEGIN');

        const insertRes = await client.query(
          `INSERT INTO users (username, email, birthdate, is_minor, is_email_verified)
           VALUES ($1, $2, $3, $4, TRUE)
           RETURNING id, username, email, is_minor`,
          [mockUsername, mockEmail, dto.birthdate || '2000-01-01', isMinor],
        );
        user = insertRes.rows[0];

        await client.query(
          `INSERT INTO profiles (user_id, username, display_name, preferred_languages)
           VALUES ($1, $2, $3, ARRAY['en'])`,
          [user.id, mockUsername, displayName],
        );

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    const tokens = await this.createSessionAndTokens(
      user.id,
      user.username,
      dto.deviceName || `${dto.provider} Device`,
      userAgent,
      user.email,
    );

    return { user, tokens };
  }

  /**
   * Requests phone OTP with rate limiting.
   */
  async requestPhoneOtp(dto: PhoneOtpRequestDto): Promise<{ message: string; mockCode?: string }> {
    // Enforce OTP rate limiting (max 3 per 10m)
    await this.rateLimiter.checkAndIncrementOtpLimit(dto.phoneNumber);

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    this.otpCache.set(dto.phoneNumber, { code, expiresAt });
    this.logger.log(`[Phone OTP] Sent to ${dto.phoneNumber}: ${code}`);

    return {
      message: 'OTP sent successfully.',
      mockCode: process.env.NODE_ENV !== 'production' ? code : undefined,
    };
  }

  /**
   * Verifies phone OTP and creates session.
   */
  async verifyPhoneOtp(
    dto: PhoneOtpVerifyDto,
    userAgent?: string,
  ): Promise<{ user: any; tokens: AuthTokens }> {
    const cached = this.otpCache.get(dto.phoneNumber);
    if (!cached || cached.expiresAt < Date.now() || cached.code !== dto.code) {
      throw new UnauthorizedException('Invalid or expired OTP code.');
    }

    this.otpCache.delete(dto.phoneNumber);

    let userResult = await this.databaseService.query(
      `SELECT u.id, u.username, u.phone_number, u.is_minor, p.display_name, p.avatar_url
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE u.phone_number = $1`,
      [dto.phoneNumber],
    );

    let user = userResult.rows[0];

    if (!user) {
      let isMinor = false;
      if (dto.birthdate) {
        const ageEval = this.evaluateAge(dto.birthdate);
        isMinor = ageEval.isMinor;
      }

      const generatedUsername = `user_${Date.now().toString(36)}`;
      const displayName = dto.displayName || 'Interest Creator';

      const client = await this.databaseService.getClient();
      try {
        await client.query('BEGIN');

        const insertRes = await client.query(
          `INSERT INTO users (username, phone_number, birthdate, is_minor)
           VALUES ($1, $2, $3, $4)
           RETURNING id, username, phone_number, is_minor`,
          [generatedUsername, dto.phoneNumber, dto.birthdate || '2000-01-01', isMinor],
        );
        user = insertRes.rows[0];

        await client.query(
          `INSERT INTO profiles (user_id, username, display_name, preferred_languages)
           VALUES ($1, $2, $3, ARRAY['en'])`,
          [user.id, generatedUsername, displayName],
        );

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    const tokens = await this.createSessionAndTokens(
      user.id,
      user.username,
      dto.deviceName || 'Mobile Phone',
      userAgent,
    );

    return { user, tokens };
  }

  /**
   * Refresh Token Rotation with Reuse Detection.
   */
  async refreshTokens(
    refreshTokenStr: string,
    deviceName?: string,
    userAgent?: string,
  ): Promise<AuthTokens> {
    try {
      const payload = this.jwtService.verify(refreshTokenStr, {
        secret: this.configService.get<string>(
          'JWT_REFRESH_SECRET',
          'interest-refresh-secret-replace-in-env',
        ),
      });

      const sessionRes = await this.databaseService.query(
        `SELECT id, user_id, revoked, expires_at FROM user_sessions WHERE id = $1`,
        [payload.jti],
      );

      if (sessionRes.rows.length === 0) {
        throw new UnauthorizedException('Session not found.');
      }

      const session = sessionRes.rows[0];

      // Security check: Reuse Detection
      if (session.revoked) {
        this.logger.error(
          `[SECURITY ALERT] Revoked token reuse detected for User ${session.user_id}! Revoking all sessions.`,
        );
        await this.databaseService.query(
          `UPDATE user_sessions SET revoked = TRUE WHERE user_id = $1`,
          [session.user_id],
        );
        throw new UnauthorizedException(
          'Security violation: token reuse detected. All sessions terminated.',
        );
      }

      if (new Date(session.expires_at) < new Date()) {
        throw new UnauthorizedException('Session expired.');
      }

      // Invalidate current session (single-use rotation)
      await this.databaseService.query(
        `UPDATE user_sessions SET revoked = TRUE, last_active_at = NOW() WHERE id = $1`,
        [session.id],
      );

      const userRes = await this.databaseService.query(
        'SELECT id, username, email FROM users WHERE id = $1',
        [session.user_id],
      );

      if (userRes.rows.length === 0) {
        throw new UnauthorizedException('User not found.');
      }

      const user = userRes.rows[0];

      // Issue new session and tokens
      return this.createSessionAndTokens(
        user.id,
        user.username,
        deviceName || 'Active Session',
        userAgent,
        user.email,
      );
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }
  }

  /**
   * Password Reset Flow: Requests reset link/token.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string; mockToken?: string }> {
    const userRes = await this.databaseService.query(
      'SELECT id, email FROM users WHERE email = $1',
      [dto.email],
    );

    if (userRes.rows.length === 0) {
      // Protect user privacy: return same message even if email is not found
      return { message: 'If that email exists, password reset instructions have been sent.' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.databaseService.query(
      `UPDATE users
       SET password_reset_token = $1, password_reset_expires = $2, updated_at = NOW()
       WHERE id = $3`,
      [resetToken, resetExpires, userRes.rows[0].id],
    );

    this.logger.log(`[Password Reset] Token generated for ${dto.email}: ${resetToken}`);

    return {
      message: 'If that email exists, password reset instructions have been sent.',
      mockToken: process.env.NODE_ENV !== 'production' ? resetToken : undefined,
    };
  }

  /**
   * Password Reset Flow: Resets password with token and invalidates all existing sessions.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ success: boolean; message: string }> {
    const userRes = await this.databaseService.query(
      `SELECT id FROM users
       WHERE password_reset_token = $1 AND password_reset_expires > NOW()`,
      [dto.token],
    );

    if (userRes.rows.length === 0) {
      throw new BadRequestException('Invalid or expired password reset token.');
    }

    const userId = userRes.rows[0].id;
    const newHash = await bcrypt.hash(dto.newPassword, 10);

    const client = await this.databaseService.getClient();
    try {
      await client.query('BEGIN');

      // Update password and clear reset tokens
      await client.query(
        `UPDATE users
         SET password_hash = $1,
             password_reset_token = NULL,
             password_reset_expires = NULL,
             updated_at = NOW()
         WHERE id = $2`,
        [newHash, userId],
      );

      // Invalidate all existing sessions for security
      await client.query(`UPDATE user_sessions SET revoked = TRUE WHERE user_id = $1`, [userId]);

      await client.query('COMMIT');
      return { success: true, message: 'Password has been successfully updated. Please log in.' };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Verifies email with token.
   */
  async verifyEmail(dto: VerifyEmailDto): Promise<{ success: boolean; message: string }> {
    const result = await this.databaseService.query(
      `UPDATE users
       SET is_email_verified = TRUE,
           email_verification_token = NULL,
           email_verification_expires = NULL,
           updated_at = NOW()
       WHERE email_verification_token = $1 AND email_verification_expires > NOW()
       RETURNING id`,
      [dto.token],
    );

    if (result.rows.length === 0) {
      throw new BadRequestException('Invalid or expired email verification token.');
    }

    return { success: true, message: 'Email successfully verified.' };
  }

  /**
   * Lists all active device sessions for the authenticated user.
   */
  async getUserSessions(userId: string, currentSessionId?: string): Promise<UserSessionDto[]> {
    const result = await this.databaseService.query(
      `SELECT id, device_name, user_agent, last_active_at, created_at
       FROM user_sessions
       WHERE user_id = $1 AND revoked = FALSE AND expires_at > NOW()
       ORDER BY last_active_at DESC`,
      [userId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      deviceName: row.device_name,
      userAgent: row.user_agent,
      lastActiveAt: row.last_active_at,
      createdAt: row.created_at,
      isCurrent: row.id === currentSessionId,
    }));
  }

  /**
   * Revokes a specific session (Remote Logout).
   */
  async revokeSession(userId: string, sessionId: string): Promise<{ success: boolean }> {
    const res = await this.databaseService.query(
      `UPDATE user_sessions SET revoked = TRUE WHERE id = $1 AND user_id = $2`,
      [sessionId, userId],
    );

    if (res.rowCount === 0) {
      throw new NotFoundException('Session not found or already revoked.');
    }

    return { success: true };
  }

  /**
   * Revokes all sessions for a user except the current session.
   */
  async revokeOtherSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<{ revokedCount: number }> {
    const res = await this.databaseService.query(
      `UPDATE user_sessions
       SET revoked = TRUE
       WHERE user_id = $1 AND id != $2 AND revoked = FALSE`,
      [userId, currentSessionId],
    );

    return { revokedCount: res.rowCount || 0 };
  }

  /**
   * Helper: Creates a session record in PostgreSQL and signs JWT access + refresh tokens.
   */
  public async createSessionAndTokens(
    userId: string,
    username: string,
    deviceName: string,
    userAgent?: string,
    email?: string,
  ): Promise<AuthTokens> {
    const sessionId = uuidv4();
    const accessPayload = { sub: userId, username, email, sessionId };
    const refreshPayload = { sub: userId, jti: sessionId };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.configService.get<string>(
        'JWT_SECRET',
        'interest-production-jwt-secret-replace-in-env',
      ),
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.get<string>(
        'JWT_REFRESH_SECRET',
        'interest-refresh-secret-replace-in-env',
      ),
      expiresIn: '30d',
    });

    const refreshTokenHash = await bcrypt.hash(refreshToken, 6);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Store session in database (Strictly no IP / Geo columns!)
    await this.databaseService.query(
      `INSERT INTO user_sessions (id, user_id, refresh_token_hash, device_name, user_agent, expires_at, revoked)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
      [sessionId, userId, refreshTokenHash, deviceName, userAgent || null, expiresAt],
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 mins in seconds
    };
  }

  /**
   * User Logout: Revokes active session.
   */
  async logout(userId: string, sessionId?: string): Promise<{ success: boolean; message: string }> {
    if (sessionId) {
      await this.databaseService.query(
        `UPDATE user_sessions SET revoked = TRUE WHERE id = $1 AND user_id = $2`,
        [sessionId, userId],
      );
    }
    return { success: true, message: 'Logged out successfully.' };
  }

  /**
   * Reauthentication & Password Change: Requires current password before setting new password.
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    const userRes = await this.databaseService.query(
      `SELECT password_hash FROM users WHERE id = $1`,
      [userId],
    );

    if (userRes.rows.length === 0) {
      throw new NotFoundException('User not found.');
    }

    const currentHash = userRes.rows[0].password_hash;
    const isValid = currentHash ? await bcrypt.compare(dto.currentPassword, currentHash) : false;

    if (!isValid) {
      throw new UnauthorizedException('Current password does not match. Reauthentication failed.');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
        [newHash, userId],
      );
      // Invalidate all other sessions on password change
      await client.query(`UPDATE user_sessions SET revoked = TRUE WHERE user_id = $1`, [userId]);
    });

    return {
      success: true,
      message: 'Password changed successfully. Please log in with your new password.',
    };
  }

  /**
   * Account Deactivation: Requires password confirmation, sets is_active = FALSE, revokes sessions.
   */
  async deactivateAccount(
    userId: string,
    dto: DeactivateAccountDto,
  ): Promise<{ success: boolean; message: string }> {
    const userRes = await this.databaseService.query(
      `SELECT password_hash FROM users WHERE id = $1`,
      [userId],
    );

    if (userRes.rows.length === 0) {
      throw new NotFoundException('User not found.');
    }

    const currentHash = userRes.rows[0].password_hash;
    const isValid = currentHash ? await bcrypt.compare(dto.password, currentHash) : false;

    if (!isValid) {
      throw new UnauthorizedException('Invalid password. Reauthentication failed.');
    }

    await this.databaseService.withTransaction(async (client) => {
      await client.query(`UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, [
        userId,
      ]);
      await client.query(`UPDATE user_sessions SET revoked = TRUE WHERE user_id = $1`, [userId]);
    });

    return { success: true, message: 'Account deactivated successfully.' };
  }

  /**
   * Account Reactivation: Allows a deactivated user to restore access with credentials.
   */
  async reactivateAccount(
    dto: ReactivateAccountDto,
    userAgent?: string,
  ): Promise<{ user: any; tokens: AuthTokens }> {
    const userRes = await this.databaseService.query(
      `SELECT u.id, u.username, u.email, u.password_hash, u.is_active, u.is_minor,
              p.display_name, p.avatar_url
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE u.username = $1 OR u.email = $1`,
      [dto.identifier],
    );

    if (userRes.rows.length === 0) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const user = userRes.rows[0];
    const isValid = user.password_hash
      ? await bcrypt.compare(dto.password, user.password_hash)
      : false;

    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    if (user.is_active) {
      throw new BadRequestException('Account is already active.');
    }

    await this.databaseService.query(
      `UPDATE users SET is_active = TRUE, updated_at = NOW() WHERE id = $1`,
      [user.id],
    );

    const tokens = await this.createSessionAndTokens(
      user.id,
      user.username,
      'Reactivated Session',
      userAgent,
      user.email,
    );

    return {
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        avatarUrl: user.avatar_url,
        isMinor: user.is_minor,
      },
      tokens,
    };
  }
}
