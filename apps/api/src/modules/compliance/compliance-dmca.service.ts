import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  SubmitDmcaNoticeDto,
  SubmitDmcaCounterNoticeDto,
} from './dto/compliance.dto';
import {
  DmcaStatus,
  DmcaTakedownRecord,
} from '@shared/types';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

@Injectable()
export class ComplianceDmcaService {
  private readonly logger = new Logger(ComplianceDmcaService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Submits a formal DMCA Takedown Notice (17 U.S.C. § 512(c))
   * Immediately disables access to the infringing reel.
   */
  async submitDmcaNotice(dto: SubmitDmcaNoticeDto): Promise<DmcaTakedownRecord> {
    if (!dto.goodFaithBeliefStatement || !dto.accuracyUnderPenaltyOfPerjury) {
      throw new BadRequestException(
        'DMCA notices require affirmative confirmation of good faith belief and penalty of perjury.',
      );
    }

    // Verify reel exists and retrieve creator
    const reelRes = await this.databaseService.query(
      `SELECT id, creator_id, title FROM reels WHERE id = $1`,
      [dto.reelId],
    );

    if (reelRes.rows.length === 0) {
      throw new NotFoundException(`Reel [${dto.reelId}] not found.`);
    }

    const reel = reelRes.rows[0];
    const ticketNumber = `DMCA-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const takedownId = uuidv4();

    const client = await this.databaseService.getClient();
    try {
      await client.query('BEGIN');

      // 1. Immediately disable reel access
      await client.query(
        `UPDATE reels SET status = 'ARCHIVED', updated_at = NOW() WHERE id = $1`,
        [dto.reelId],
      );

      // 2. Record DMCA takedown notice
      await client.query(
        `INSERT INTO dmca_takedowns
         (id, ticket_number, reel_id, creator_id, claimant_name, claimant_email,
          copyrighted_work_description, infringing_material_url, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'CONTENT_REMOVED', NOW(), NOW())`,
        [
          takedownId,
          ticketNumber,
          dto.reelId,
          reel.creator_id,
          dto.claimantName,
          dto.claimantEmail,
          dto.copyrightedWorkDescription,
          dto.infringingMaterialUrl,
        ],
      );

      // 3. Issue copyright strike check against creator (3-strikes rule)
      const strikesRes = await client.query(
        `SELECT COUNT(*) as strike_count FROM dmca_takedowns
         WHERE creator_id = $1 AND status IN ('CONTENT_REMOVED', 'RESOLVED_PERMANENT_TAKEDOWN')`,
        [reel.creator_id],
      );

      const strikes = parseInt(strikesRes.rows[0].strike_count, 10);
      if (strikes >= 3) {
        this.logger.warn(`Creator [${reel.creator_id}] reached ${strikes} copyright strikes! Suspending account.`);
        await client.query(
          `UPDATE users SET status = 'SUSPENDED', updated_at = NOW() WHERE id = $1`,
          [reel.creator_id],
        );
      }

      await client.query('COMMIT');

      this.logger.log(`Processed DMCA Notice ${ticketNumber} against Reel [${dto.reelId}]. Content removed.`);

      return {
        id: takedownId,
        ticketNumber,
        reelId: dto.reelId,
        creatorId: reel.creator_id,
        claimantName: dto.claimantName,
        claimantEmail: dto.claimantEmail,
        copyrightedWorkDescription: dto.copyrightedWorkDescription,
        infringingMaterialUrl: dto.infringingMaterialUrl,
        status: DmcaStatus.CONTENT_REMOVED,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      await client.query('ROLLBACK');
      this.logger.error(`DMCA Notice submission failed: ${err.message}`, err.stack);
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Submits a formal DMCA Counter-Notice (17 U.S.C. § 512(g))
   * Initiates the 10-14 business day restoration window.
   */
  async submitCounterNotice(dto: SubmitDmcaCounterNoticeDto): Promise<DmcaTakedownRecord> {
    if (!dto.consentToJurisdiction || !dto.statementUnderPenaltyOfPerjury) {
      throw new BadRequestException(
        'Counter-notice requires consent to federal court jurisdiction and penalty of perjury statement.',
      );
    }

    const res = await this.databaseService.query(
      `SELECT id, ticket_number, reel_id, creator_id, claimant_name, claimant_email,
              copyrighted_work_description, infringing_material_url, status, created_at
       FROM dmca_takedowns WHERE ticket_number = $1`,
      [dto.ticketNumber],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException(`DMCA ticket [${dto.ticketNumber}] not found.`);
    }

    const row = res.rows[0];

    // Compute statutory 14-day restoration date
    const restorationDate = new Date();
    restorationDate.setDate(restorationDate.getDate() + 14);

    await this.databaseService.query(
      `UPDATE dmca_takedowns
       SET status = 'RESTORATION_SCHEDULED',
           counter_notice_text = $1,
           counter_notice_at = NOW(),
           restoration_date = $2,
           updated_at = NOW()
       WHERE ticket_number = $3`,
      [dto.counterNoticeStatement, restorationDate, dto.ticketNumber],
    );

    this.logger.log(`Counter-Notice accepted for ${dto.ticketNumber}. Restoration scheduled on ${restorationDate.toISOString()}`);

    return {
      id: row.id,
      ticketNumber: row.ticket_number,
      reelId: row.reel_id,
      creatorId: row.creator_id,
      claimantName: row.claimant_name,
      claimantEmail: row.claimant_email,
      copyrightedWorkDescription: row.copyrighted_work_description,
      infringingMaterialUrl: row.infringing_material_url,
      status: DmcaStatus.RESTORATION_SCHEDULED,
      counterNoticeText: dto.counterNoticeStatement,
      counterNoticeAt: new Date().toISOString(),
      restorationDate: restorationDate.toISOString(),
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Finalizes restoration of content if claimant fails to file court action within 14 days
   */
  async restoreContent(ticketNumber: string): Promise<{ success: boolean; status: DmcaStatus }> {
    const res = await this.databaseService.query(
      `SELECT reel_id FROM dmca_takedowns WHERE ticket_number = $1`,
      [ticketNumber],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException(`DMCA ticket [${ticketNumber}] not found.`);
    }

    const reelId = res.rows[0].reel_id;

    await this.databaseService.query(
      `UPDATE reels SET status = 'PUBLISHED', updated_at = NOW() WHERE id = $1`,
      [reelId],
    );

    await this.databaseService.query(
      `UPDATE dmca_takedowns SET status = 'RESTORED', updated_at = NOW() WHERE ticket_number = $1`,
      [ticketNumber],
    );

    this.logger.log(`Restored Reel [${reelId}] under ticket ${ticketNumber} after 14-day window.`);
    return { success: true, status: DmcaStatus.RESTORED };
  }

  /**
   * Retrieves status of a DMCA takedown ticket
   */
  async getTakedownStatus(ticketNumber: string): Promise<DmcaTakedownRecord> {
    const res = await this.databaseService.query(
      `SELECT * FROM dmca_takedowns WHERE ticket_number = $1`,
      [ticketNumber],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException(`DMCA ticket [${ticketNumber}] not found.`);
    }

    const r = res.rows[0];
    return {
      id: r.id,
      ticketNumber: r.ticket_number,
      reelId: r.reel_id,
      creatorId: r.creator_id,
      claimantName: r.claimant_name,
      claimantEmail: r.claimant_email,
      copyrightedWorkDescription: r.copyrighted_work_description,
      infringingMaterialUrl: r.infringing_material_url,
      status: r.status as DmcaStatus,
      counterNoticeText: r.counter_notice_text,
      counterNoticeAt: r.counter_notice_at ? new Date(r.counter_notice_at).toISOString() : undefined,
      restorationDate: r.restoration_date ? new Date(r.restoration_date).toISOString() : undefined,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
    };
  }
}
