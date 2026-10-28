import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  PrivacySettingsDto,
  UpdatePrivacySettingsDto,
  UserSessionItem,
} from '@shared/types';

@Injectable()
export class CompliancePrivacyService {
  private readonly logger = new Logger(CompliancePrivacyService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Retrieves privacy and discoverability settings for an authenticated user.
   */
  async getPrivacySettings(userId: string): Promise<PrivacySettingsDto> {
    const res = await this.databaseService.query(
      `SELECT u.is_minor, p.is_private_account, p.allow_search_discovery,
              p.messaging_permission, p.commenting_permission,
              p.activity_status_visible, p.personalized_ads_enabled
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [userId],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException('User profile not found.');
    }

    const row = res.rows[0];
    const isMinor = Boolean(row.is_minor);

    return {
      isPrivateAccount: Boolean(row.is_private_account),
      allowSearchDiscovery: Boolean(row.allow_search_discovery),
      messagingPermission: (row.messaging_permission || 'EVERYONE') as 'EVERYONE' | 'FOLLOWERS_ONLY' | 'NOBODY',
      commentingPermission: (row.commenting_permission || 'EVERYONE') as 'EVERYONE' | 'FOLLOWERS_ONLY' | 'OFF',
      activityStatusVisible: Boolean(row.activity_status_visible),
      // Minors can NEVER have personalized ads enabled
      personalizedAdsConsent: isMinor ? false : Boolean(row.personalized_ads_enabled),
      isMinor,
    };
  }

  /**
   * Updates user privacy settings.
   * Strictly enforces COPPA / DPDP child safety rule: minors cannot enable targeted ads.
   */
  async updatePrivacySettings(
    userId: string,
    dto: UpdatePrivacySettingsDto,
  ): Promise<PrivacySettingsDto> {
    const userRes = await this.databaseService.query(
      `SELECT is_minor FROM users WHERE id = $1`,
      [userId],
    );
    if (userRes.rows.length === 0) {
      throw new NotFoundException('User not found.');
    }
    const isMinor = Boolean(userRes.rows[0].is_minor);

    if (isMinor && dto.personalizedAdsConsent === true) {
      throw new ForbiddenException(
        'Child Safety & COPPA/DPDP Violation: Accounts under 18 cannot opt-in to personalized advertising.',
      );
    }

    const fields: string[] = ['updated_at = NOW()'];
    const params: any[] = [];

    if (dto.isPrivateAccount !== undefined) {
      params.push(dto.isPrivateAccount);
      fields.push(`is_private_account = $${params.length}`);
    }
    if (dto.allowSearchDiscovery !== undefined) {
      params.push(dto.allowSearchDiscovery);
      fields.push(`allow_search_discovery = $${params.length}`);
    }
    if (dto.messagingPermission !== undefined) {
      params.push(dto.messagingPermission);
      fields.push(`messaging_permission = $${params.length}`);
    }
    if (dto.commentingPermission !== undefined) {
      params.push(dto.commentingPermission);
      fields.push(`commenting_permission = $${params.length}`);
    }
    if (dto.activityStatusVisible !== undefined) {
      params.push(dto.activityStatusVisible);
      fields.push(`activity_status_visible = $${params.length}`);
    }
    if (dto.personalizedAdsConsent !== undefined) {
      const adsConsent = isMinor ? false : dto.personalizedAdsConsent;
      params.push(adsConsent);
      fields.push(`personalized_ads_enabled = $${params.length}`);
    }

    params.push(userId);
    const updateSql = `
      UPDATE profiles
      SET ${fields.join(', ')}
      WHERE user_id = $${params.length}
    `;

    await this.databaseService.query(updateSql, params);

    this.logger.log(`Updated privacy settings for user [${userId}]`);
    return this.getPrivacySettings(userId);
  }

  // ==========================================================================
  // SESSION MANAGEMENT & REVOCATION
  // ==========================================================================

  /**
   * Retrieves active device sessions for user.
   * Strictly Zero-Location: NO IP addresses or geolocation columns.
   */
  async getUserSessions(
    userId: string,
    currentSessionId?: string,
  ): Promise<UserSessionItem[]> {
    const res = await this.databaseService.query(
      `SELECT id, device_name, user_agent, last_active_at, created_at
       FROM user_sessions
       WHERE user_id = $1 AND revoked = FALSE AND expires_at > NOW()
       ORDER BY last_active_at DESC`,
      [userId],
    );

    return res.rows.map((row) => ({
      id: row.id,
      deviceName: row.device_name || 'Unknown Device',
      userAgent: row.user_agent || undefined,
      isCurrentSession: currentSessionId ? row.id === currentSessionId : false,
      lastActiveAt: new Date(row.last_active_at).toISOString(),
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  /**
   * Revokes a specific device session (force logout on remote device).
   */
  async revokeSession(userId: string, sessionId: string): Promise<{ success: boolean }> {
    const res = await this.databaseService.query(
      `UPDATE user_sessions
       SET revoked = TRUE, last_active_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [sessionId, userId],
    );

    if (res.rowCount === 0) {
      throw new NotFoundException('Session not found or already revoked.');
    }

    this.logger.log(`Session [${sessionId}] revoked by user [${userId}]`);
    return { success: true };
  }

  /**
   * Revokes all active device sessions except the current one.
   */
  async revokeAllOtherSessions(
    userId: string,
    currentSessionId?: string,
  ): Promise<{ revokedCount: number }> {
    const conditions = ['user_id = $1', 'revoked = FALSE'];
    const params: any[] = [userId];

    if (currentSessionId) {
      params.push(currentSessionId);
      conditions.push(`id != $2`);
    }

    const res = await this.databaseService.query(
      `UPDATE user_sessions
       SET revoked = TRUE, last_active_at = NOW()
       WHERE ${conditions.join(' AND ')}
       RETURNING id`,
      params,
    );

    const revokedCount = res.rowCount || 0;
    this.logger.log(`Revoked ${revokedCount} other session(s) for user [${userId}]`);
    return { revokedCount };
  }
}
