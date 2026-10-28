import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  DataExportRequest,
  DataExportStatus,
} from '@shared/types';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

@Injectable()
export class ComplianceExportService {
  private readonly logger = new Logger(ComplianceExportService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Submits a request for a complete GDPR / DPDP machine-readable data export
   */
  async requestDataExport(userId: string): Promise<DataExportRequest> {
    const requestId = uuidv4();
    const downloadToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 2); // 48-hour expiration

    await this.databaseService.query(
      `INSERT INTO data_export_requests (id, user_id, status, format, download_token, expires_at, requested_at)
       VALUES ($1, $2, 'PENDING', 'JSON', $3, $4, NOW())`,
      [requestId, userId, downloadToken, expiresAt],
    );

    this.logger.log(`Data export requested for user [${userId}], ticket: ${requestId}`);

    return {
      id: requestId,
      userId,
      status: DataExportStatus.PENDING,
      format: 'JSON',
      downloadToken,
      expiresAt: expiresAt.toISOString(),
      requestedAt: new Date().toISOString(),
    };
  }

  /**
   * Generates the comprehensive GDPR / DPDP data bundle
   */
  async generateExportBundle(userId: string): Promise<Record<string, any>> {
    // 1. Account Profile
    const userRes = await this.databaseService.query(
      `SELECT id, username, display_name, email, bio, avatar_url, preferred_languages,
              is_minor, is_verified, created_at, updated_at
       FROM users WHERE id = $1`,
      [userId],
    );

    const user = userRes.rows[0];
    if (!user) {
      throw new NotFoundException('User account not found');
    }

    // 2. User Interests & Affinities
    const interestsRes = await this.databaseService.query(
      `SELECT ui.interest_id, i.title, i.slug, ui.affinity_weight, ui.interaction_count, ui.is_muted, ui.is_paused, ui.created_at
       FROM user_interests ui
       JOIN interests i ON ui.interest_id = i.id
       WHERE ui.user_id = $1`,
      [userId],
    );

    // 3. User Reels
    const reelsRes = await this.databaseService.query(
      `SELECT id, title, caption, duration_seconds, view_count, like_count, comment_count, save_count, share_count,
              status, is_ai_generated, created_at
       FROM reels WHERE creator_id = $1`,
      [userId],
    );

    // 4. Comments Authored
    const commentsRes = await this.databaseService.query(
      `SELECT id, reel_id, text, like_count, created_at
       FROM comments WHERE user_id = $1`,
      [userId],
    );

    // 5. Saved Collections
    const collectionsRes = await this.databaseService.query(
      `SELECT sc.id, sc.name, sc.is_private, sc.created_at, COUNT(sci.reel_id) as items_count
       FROM saved_collections sc
       LEFT JOIN saved_collection_items sci ON sc.id = sci.collection_id
       WHERE sc.user_id = $1
       GROUP BY sc.id`,
      [userId],
    );

    // 6. Consents Ledger
    const consentsRes = await this.databaseService.query(
      `SELECT purpose, status, version, jurisdiction, consented_at, withdrawn_at
       FROM user_consents WHERE user_id = $1`,
      [userId],
    );

    // 7. Monetization Transactions & Invoices
    const invoicesRes = await this.databaseService.query(
      `SELECT invoice_number, period_start, period_end, gross_amount_cents, tax_withheld_cents, net_payout_cents, currency, status, created_at
       FROM creator_payout_invoices WHERE user_id = $1`,
      [userId],
    );

    const exportBundle = {
      complianceMetadata: {
        regulationStandards: ['GDPR Art. 20 (Data Portability)', 'India DPDP Act 2023 Sec. 11', 'CCPA/CPRA'],
        exportTimestamp: new Date().toISOString(),
        format: 'JSON Machine-Readable',
        zeroLocationStatement: 'This platform strictly stores zero GPS, zero IP-derived locations, and zero country coordinates.',
      },
      account: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        bio: user.bio,
        avatarUrl: user.avatar_url,
        preferredLanguages: user.preferred_languages,
        isMinor: user.is_minor,
        isVerified: user.is_verified,
        createdAt: user.created_at,
      },
      interestTaxonomyProfile: interestsRes.rows.map((r) => ({
        interestId: r.interest_id,
        title: r.title,
        slug: r.slug,
        affinityWeight: Number(r.affinity_weight),
        interactionCount: r.interaction_count,
        isMuted: r.is_muted,
        isPaused: r.is_paused,
      })),
      contentAndCreations: {
        reelsCount: reelsRes.rows.length,
        reels: reelsRes.rows,
        commentsCount: commentsRes.rows.length,
        comments: commentsRes.rows,
        savedCollections: collectionsRes.rows,
      },
      consentsHistory: consentsRes.rows,
      financialAndInvoices: invoicesRes.rows,
    };

    return exportBundle;
  }

  /**
   * Checks status of an export request
   */
  async getExportStatus(requestId: string): Promise<DataExportRequest> {
    const res = await this.databaseService.query(
      `SELECT id, user_id, status, format, download_token, expires_at, requested_at, completed_at
       FROM data_export_requests WHERE id = $1`,
      [requestId],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException('Data export request not found');
    }

    const row = res.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      status: row.status as DataExportStatus,
      format: 'JSON',
      downloadToken: row.download_token,
      downloadUrl: `/api/v1/compliance/export/${row.id}/download?token=${row.download_token}`,
      expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : undefined,
      requestedAt: new Date(row.requested_at).toISOString(),
      completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : undefined,
    };
  }
}
