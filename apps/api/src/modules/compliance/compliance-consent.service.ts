import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  UpdateConsentsDto,
  CcpaOptOutDto,
} from './dto/compliance.dto';
import {
  ConsentPurpose,
  ConsentStatus,
  ComplianceJurisdiction,
  UserConsentRecord,
} from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ComplianceConsentService {
  private readonly logger = new Logger(ComplianceConsentService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Retrieves active consent records for a user
   */
  async getUserConsents(userId: string): Promise<UserConsentRecord[]> {
    const res = await this.databaseService.query(
      `SELECT id, user_id, purpose, status, version, jurisdiction, consented_at, withdrawn_at
       FROM user_consents
       WHERE user_id = $1`,
      [userId],
    );

    return res.rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      purpose: r.purpose as ConsentPurpose,
      status: r.status as ConsentStatus,
      version: r.version,
      jurisdiction: r.jurisdiction as ComplianceJurisdiction,
      consentedAt: r.consented_at ? new Date(r.consented_at).toISOString() : new Date().toISOString(),
      withdrawnAt: r.withdrawn_at ? new Date(r.withdrawn_at).toISOString() : undefined,
    }));
  }

  /**
   * Updates or inserts granular user consents (GDPR Art. 7, DPDP Sec. 6)
   * Enforces COPPA minor protection defaults: minors cannot consent to targeted ads.
   */
  async updateConsents(userId: string, dto: UpdateConsentsDto): Promise<{ success: boolean; count: number }> {
    // 1. Check if user is a minor (COPPA & DPDP minor safety rule)
    const userRes = await this.databaseService.query(
      `SELECT is_minor, birth_year FROM users WHERE id = $1`,
      [userId],
    );

    const isMinor = userRes.rows[0]?.is_minor || false;

    const client = await this.databaseService.getClient();
    try {
      await client.query('BEGIN');

      for (const item of dto.consents) {
        // COPPA & DPDP Rule: Minors cannot receive targeted ads under any circumstances
        let status = item.status;
        if (isMinor && item.purpose === ConsentPurpose.INTEREST_ADS) {
          status = ConsentStatus.WITHDRAWN;
          this.logger.warn(`Rejected targeted ad consent for minor user [${userId}] per COPPA/DPDP rules.`);
        }

        const now = new Date();
        const consentedAt = status === ConsentStatus.CONSENTED ? now : null;
        const withdrawnAt = status === ConsentStatus.WITHDRAWN ? now : null;

        await client.query(
          `INSERT INTO user_consents (id, user_id, purpose, status, version, jurisdiction, user_agent, consented_at, withdrawn_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (user_id, purpose) DO UPDATE
           SET status = $4,
               version = $5,
               jurisdiction = $6,
               user_agent = COALESCE($7, user_consents.user_agent),
               consented_at = CASE WHEN $4 = 'CONSENTED' THEN NOW() ELSE user_consents.consented_at END,
               withdrawn_at = CASE WHEN $4 = 'WITHDRAWN' THEN NOW() ELSE user_consents.withdrawn_at END`,
          [
            uuidv4(),
            userId,
            item.purpose,
            status,
            item.version || 'v1.0',
            item.jurisdiction || ComplianceJurisdiction.GLOBAL,
            dto.userAgent || null,
            consentedAt || now,
            withdrawnAt,
          ],
        );
      }

      await client.query('COMMIT');
      return { success: true, count: dto.consents.length };
    } catch (err: any) {
      await client.query('ROLLBACK');
      this.logger.error(`Consent update failed: ${err.message}`, err.stack);
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * CCPA / CPRA "Do Not Sell or Share My Personal Information" (DNS)
   * Disables interest-targeted ads and restricts cross-context analytics.
   */
  async processCcpaOptOut(userId: string, dto: CcpaOptOutDto): Promise<{ success: boolean; optOutActive: boolean }> {
    const status = dto.doNotSellOrShare ? ConsentStatus.WITHDRAWN : ConsentStatus.CONSENTED;

    await this.databaseService.query(
      `INSERT INTO user_consents (id, user_id, purpose, status, version, jurisdiction, consented_at, withdrawn_at)
       VALUES ($1, $2, $3, $4, 'ccpa_opt_out_v1', $5, NOW(), NOW())
       ON CONFLICT (user_id, purpose) DO UPDATE
       SET status = $4,
           jurisdiction = $5,
           withdrawn_at = NOW()`,
      [uuidv4(), userId, ConsentPurpose.INTEREST_ADS, status, ComplianceJurisdiction.CCPA],
    );

    this.logger.log(`User [${userId}] CCPA Opt-Out updated: doNotSellOrShare=${dto.doNotSellOrShare}`);
    return { success: true, optOutActive: dto.doNotSellOrShare };
  }

  /**
   * COPPA Age Verification & Minor Safety Guard
   * Verifies age during onboarding. Rejects users under 13 without verifiable parental consent.
   */
  validateCoppaEligibility(birthYear: number): { allowed: boolean; isMinor: boolean; reason?: string } {
    const currentYear = new Date().getFullYear();
    const age = currentYear - birthYear;

    if (age < 13) {
      return {
        allowed: false,
        isMinor: true,
        reason: 'Under COPPA guidelines, users under 13 cannot create an account without verified parental consent.',
      };
    }

    const isMinor = age < 18;
    return {
      allowed: true,
      isMinor,
    };
  }
}
