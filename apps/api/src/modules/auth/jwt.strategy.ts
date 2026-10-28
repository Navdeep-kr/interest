import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';

export interface JwtPayload {
  sub: string;
  username: string;
  email?: string;
  sessionId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (process.env.NODE_ENV === 'production') {
      if (!jwtSecret || jwtSecret.includes('replace-in-env') || jwtSecret.length < 32) {
        throw new Error('FATAL SECURITY ERROR: JWT_SECRET must be set to at least 32 characters in production');
      }
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret || 'interest-production-jwt-secret-replace-in-env',
    });
  }

  async validate(payload: JwtPayload) {
    const result = await this.databaseService.query(
      `SELECT u.id, u.username, u.email, u.is_minor, u.is_active,
              COALESCE(u.role, 'USER') as role,
              p.display_name, p.avatar_url, p.preferred_languages
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE u.id = $1`,
      [payload.sub],
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedException('User no longer exists or session expired.');
    }

    const user = result.rows[0];
    if (!user.is_active) {
      throw new UnauthorizedException('Account has been deactivated.');
    }

    return {
      id: user.id,
      userId: user.id,
      username: user.username,
      role: (user.role || 'USER').toUpperCase(),
      displayName: user.display_name,
      email: user.email,
      avatarUrl: user.avatar_url,
      isMinor: user.is_minor,
      preferredLanguages: user.preferred_languages,
      sessionId: payload.sessionId,
    };
  }
}
