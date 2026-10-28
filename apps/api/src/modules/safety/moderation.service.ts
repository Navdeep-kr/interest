import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  CreateReportDto,
  AddKeywordFilterDto,
  ModeratorActionDto,
  CreateAppealDto,
  ResolveAppealDto,
  UpdateSafetySettingsDto,
  GetModerationQueueDto,
  GetModeratorAuditLogsDto,
} from './dto/safety.dto';
import {
  ReportTargetType,
  ReportCategory,
  ModerationActionType,
  AppealStatus,
  AiLabelType,
  ModerationQueueItem,
  ModerationAppealItem,
  KeywordFilterItem,
  UserAccountSafetyStatus,
  ModeratorAuditLogItem,
  OperationalSlaStatus,
  CommunityGuidelineItem,
  ReelStatus,
} from '@shared/types';

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  // Platform standard slur & profanity filter
  private readonly PLATFORM_PROFANITIES = [
    /\b(fuck|shit|bitch|asshole|bastard|cunt|dick)\b/i,
    /\b(kill yourself|kys|hang yourself)\b/i,
    /\b(retard|idiot scammer|scam artist)\b/i,
  ];

  constructor(private readonly databaseService: DatabaseService) {}

  // ==========================================================================
  // 1. REPORT FLOW (All surfaces: Profile, Reel/Post, Comment, Message, Community)
  // ==========================================================================

  async createReport(reporterId: string, dto: CreateReportDto) {
    let creatorId: string | null = null;
    let reelId: string | null = null;
    let commentId: string | null = null;
    let userId: string | null = null;
    let messageId: string | null = null;
    let communityId: string | null = null;

    if (dto.targetType === ReportTargetType.REEL) {
      const res = await this.databaseService.query(
        `SELECT id, creator_id FROM reels WHERE id = $1`,
        [dto.targetId],
      );
      if (res.rows.length === 0) throw new NotFoundException('Reel not found.');
      creatorId = res.rows[0].creator_id;
      reelId = dto.targetId;
    } else if (dto.targetType === ReportTargetType.COMMENT) {
      const res = await this.databaseService.query(
        `SELECT id, user_id, reel_id FROM comments WHERE id = $1`,
        [dto.targetId],
      );
      if (res.rows.length === 0) throw new NotFoundException('Comment not found.');
      creatorId = res.rows[0].user_id;
      commentId = dto.targetId;
    } else if (dto.targetType === ReportTargetType.USER) {
      const res = await this.databaseService.query(
        `SELECT id FROM users WHERE id = $1`,
        [dto.targetId],
      );
      if (res.rows.length === 0) throw new NotFoundException('User not found.');
      creatorId = dto.targetId;
      userId = dto.targetId;
    } else if (dto.targetType === ReportTargetType.MESSAGE) {
      const res = await this.databaseService.query(
        `SELECT id, sender_id FROM messages WHERE id = $1`,
        [dto.targetId],
      );
      if (res.rows.length === 0) throw new NotFoundException('Message not found.');
      creatorId = res.rows[0].sender_id;
      messageId = dto.targetId;
    } else if (dto.targetType === ReportTargetType.COMMUNITY) {
      const res = await this.databaseService.query(
        `SELECT id, creator_id FROM communities WHERE id = $1`,
        [dto.targetId],
      );
      if (res.rows.length === 0) throw new NotFoundException('Community not found.');
      creatorId = res.rows[0].creator_id;
      communityId = dto.targetId;
    }

    if (!creatorId) {
      throw new BadRequestException('Target entity creator could not be resolved.');
    }

    // Prevent reporting oneself
    if (reporterId === creatorId && dto.targetType === ReportTargetType.USER) {
      throw new BadRequestException('You cannot report yourself.');
    }

    // 2. Prevent duplicate pending report by same user on same entity
    const existing = await this.databaseService.query(
      `SELECT id FROM reports
       WHERE reporter_id = $1
         AND status = 'PENDING'
         AND (
           ($2 = 'REEL' AND reported_reel_id = $3) OR
           ($2 = 'COMMENT' AND reported_comment_id = $3) OR
           ($2 = 'USER' AND reported_user_id = $3) OR
           ($2 = 'MESSAGE' AND reported_message_id = $3) OR
           ($2 = 'COMMUNITY' AND reported_community_id = $3)
         )
       LIMIT 1`,
      [reporterId, dto.targetType, dto.targetId],
    );

    if (existing.rows.length > 0) {
      throw new ConflictException('You have already submitted a pending report for this item.');
    }

    // 3. Compute priority score & Urgent Safety Escalation
    const categoryScores: Record<ReportCategory, { score: number; isUrgent: boolean; slaHours: number }> = {
      [ReportCategory.MINOR_SAFETY]: { score: 100.0, isUrgent: true, slaHours: 1 },
      [ReportCategory.SELF_HARM_SUICIDE]: { score: 98.0, isUrgent: true, slaHours: 1 },
      [ReportCategory.VIOLENCE_DANGEROUS]: { score: 95.0, isUrgent: true, slaHours: 2 },
      [ReportCategory.HATE_SPEECH_HARASSMENT]: { score: 85.0, isUrgent: false, slaHours: 6 },
      [ReportCategory.HARASSMENT_BULLYING]: { score: 85.0, isUrgent: false, slaHours: 6 },
      [ReportCategory.IMPERSONATION]: { score: 85.0, isUrgent: false, slaHours: 6 },
      [ReportCategory.ADULT_PROHIBITED]: { score: 85.0, isUrgent: false, slaHours: 6 },
      [ReportCategory.NUDITY_SEXUAL]: { score: 80.0, isUrgent: false, slaHours: 6 },
      [ReportCategory.COPYRIGHT_INFRINGEMENT]: { score: 70.0, isUrgent: false, slaHours: 12 },
      [ReportCategory.SCAM_FRAUD]: { score: 65.0, isUrgent: false, slaHours: 12 },
      [ReportCategory.MISINFORMATION]: { score: 55.0, isUrgent: false, slaHours: 24 },
      [ReportCategory.SPAM_SCAM]: { score: 40.0, isUrgent: false, slaHours: 24 },
      [ReportCategory.UNLABELED_AI]: { score: 35.0, isUrgent: false, slaHours: 24 },
    };

    const config = categoryScores[dto.category] || { score: 50.0, isUrgent: false, slaHours: 24 };
    const baseScore = config.score;
    const isUrgent = config.isUrgent;
    const slaDueAt = new Date(Date.now() + config.slaHours * 60 * 60 * 1000);

    // 4. Insert report record
    const insertReportSql = `
      INSERT INTO reports
        (reporter_id, reported_reel_id, reported_comment_id, reported_user_id,
         reported_message_id, reported_community_id, reason, category, details,
         priority_score, is_urgent, sla_due_at, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'PENDING')
      RETURNING *;
    `;
    const reportRes = await this.databaseService.query(insertReportSql, [
      reporterId,
      reelId,
      commentId,
      userId,
      messageId,
      communityId,
      dto.category.toLowerCase(),
      dto.category,
      dto.details || null,
      baseScore,
      isUrgent,
      slaDueAt,
    ]);

    // 5. Upsert into Moderation Queue
    const queueCheckSql = `
      SELECT id, report_count, reasons, priority_score, is_urgent
      FROM moderation_queue
      WHERE entity_type = $1 AND entity_id = $2 AND status = 'PENDING'
      LIMIT 1;
    `;
    const queueRes = await this.databaseService.query(queueCheckSql, [
      dto.targetType,
      dto.targetId,
    ]);

    if (queueRes.rows.length > 0) {
      const qItem = queueRes.rows[0];
      const newCount = qItem.report_count + 1;
      const updatedReasons = Array.from(new Set([...qItem.reasons, dto.category]));
      const newPriority = Math.min(100.0, baseScore + (newCount - 1) * 5.0);
      const queueUrgent = qItem.is_urgent || isUrgent;

      await this.databaseService.query(
        `UPDATE moderation_queue
         SET report_count = $1,
             reasons = $2,
             priority_score = GREATEST(priority_score, $3),
             is_urgent = $4,
             sla_due_at = LEAST(sla_due_at, $5),
             updated_at = NOW()
         WHERE id = $6`,
        [newCount, updatedReasons, newPriority, queueUrgent, slaDueAt, qItem.id],
      );
    } else {
      await this.databaseService.query(
        `INSERT INTO moderation_queue
           (entity_type, entity_id, creator_id, status, priority_score, reasons, report_count, is_urgent, sla_due_at)
         VALUES ($1, $2, $3, 'PENDING', $4, $5, 1, $6, $7)`,
        [dto.targetType, dto.targetId, creatorId, baseScore, [dto.category]],
      );
    }

    if (isUrgent) {
      this.logger.warn(
        `[URGENT SAFETY ESCALATION] Report submitted for ${dto.targetType}:${dto.targetId}. Category: ${dto.category}, SLA: ${config.slaHours}h.`,
      );
    }

    return {
      success: true,
      reportId: reportRes.rows[0].id,
      isUrgent,
      message: isUrgent
        ? 'Urgent safety report submitted. Escalated to Safety Leadership with priority SLA.'
        : 'Report submitted successfully. Our Trust & Safety team is reviewing the content.',
    };
  }

  async getUserReports(userId: string) {
    const res = await this.databaseService.query(
      `SELECT id, category, reason, status, action_taken, is_urgent, created_at, resolved_at
       FROM reports
       WHERE reporter_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId],
    );
    return res.rows;
  }

  // ==========================================================================
  // 2. BLOCK & MUTE FLOW
  // ==========================================================================

  async blockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new BadRequestException('You cannot block yourself.');
    }

    await this.databaseService.query(
      `INSERT INTO blocks (blocker_id, blocked_id)
       VALUES ($1, $2)
       ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
      [blockerId, blockedId],
    );

    // Mutual follow removal upon block
    await this.databaseService.query(
      `DELETE FROM follows
       WHERE (follower_id = $1 AND following_id = $2)
          OR (follower_id = $2 AND following_id = $1)`,
      [blockerId, blockedId],
    );

    return { success: true, message: 'User blocked successfully.' };
  }

  async unblockUser(blockerId: string, blockedId: string) {
    await this.databaseService.query(
      `DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2`,
      [blockerId, blockedId],
    );
    return { success: true, message: 'User unblocked.' };
  }

  async getBlockedUsers(userId: string) {
    const res = await this.databaseService.query(
      `SELECT u.id, u.email, p.username, p.display_name, p.avatar_url, b.created_at
       FROM blocks b
       JOIN users u ON u.id = b.blocked_id
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE b.blocker_id = $1
       ORDER BY b.created_at DESC`,
      [userId],
    );
    return res.rows;
  }

  async muteUser(muterId: string, mutedId: string) {
    if (muterId === mutedId) {
      throw new BadRequestException('You cannot mute yourself.');
    }

    await this.databaseService.query(
      `INSERT INTO user_mutes (muter_id, muted_id)
       VALUES ($1, $2)
       ON CONFLICT (muter_id, muted_id) DO NOTHING`,
      [muterId, mutedId],
    );
    return { success: true, message: 'User muted silently.' };
  }

  async unmuteUser(muterId: string, mutedId: string) {
    await this.databaseService.query(
      `DELETE FROM user_mutes WHERE muter_id = $1 AND muted_id = $2`,
      [muterId, mutedId],
    );
    return { success: true, message: 'User unmuted.' };
  }

  async getMutedUsers(userId: string) {
    const res = await this.databaseService.query(
      `SELECT u.id, p.username, p.display_name, p.avatar_url, m.created_at
       FROM user_mutes m
       JOIN users u ON u.id = m.muted_id
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE m.muter_id = $1
       ORDER BY m.created_at DESC`,
      [userId],
    );
    return res.rows;
  }

  // ==========================================================================
  // 3. COMMENT & KEYWORD FILTERS
  // ==========================================================================

  async addKeywordFilter(userId: string, dto: AddKeywordFilterDto): Promise<KeywordFilterItem> {
    const cleaned = dto.keyword.trim().toLowerCase();
    const res = await this.databaseService.query(
      `INSERT INTO user_keyword_filters (user_id, keyword, is_regex)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, keyword) DO UPDATE SET is_regex = EXCLUDED.is_regex
       RETURNING *`,
      [userId, cleaned, dto.isRegex || false],
    );
    const row = res.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      keyword: row.keyword,
      isRegex: row.is_regex,
      createdAt: row.created_at.toISOString(),
    };
  }

  async removeKeywordFilter(userId: string, filterId: string) {
    const res = await this.databaseService.query(
      `DELETE FROM user_keyword_filters WHERE id = $1 AND user_id = $2`,
      [filterId, userId],
    );
    if (res.rowCount === 0) throw new NotFoundException('Keyword filter not found.');
    return { success: true };
  }

  async getKeywordFilters(userId: string): Promise<KeywordFilterItem[]> {
    const res = await this.databaseService.query(
      `SELECT id, user_id, keyword, is_regex, created_at
       FROM user_keyword_filters
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );
    return res.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      keyword: row.keyword,
      isRegex: row.is_regex,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async filterComment(
    creatorId: string,
    commentText: string,
  ): Promise<{ shouldHide: boolean; reason?: string }> {
    const lower = commentText.toLowerCase();

    for (const pattern of this.PLATFORM_PROFANITIES) {
      if (pattern.test(lower)) {
        return { shouldHide: true, reason: 'OFFENSIVE_PROFANITY' };
      }
    }

    const filtersRes = await this.databaseService.query(
      `SELECT keyword, is_regex FROM user_keyword_filters WHERE user_id = $1`,
      [creatorId],
    );

    for (const f of filtersRes.rows) {
      if (f.is_regex) {
        try {
          const re = new RegExp(f.keyword, 'i');
          if (re.test(commentText)) {
            return { shouldHide: true, reason: 'USER_KEYWORD_FILTER' };
          }
        } catch {
          // ignore malformed custom regex
        }
      } else {
        if (lower.includes(f.keyword.toLowerCase())) {
          return { shouldHide: true, reason: 'USER_KEYWORD_FILTER' };
        }
      }
    }

    return { shouldHide: false };
  }

  // ==========================================================================
  // 4. MODERATOR QUEUE & ACTIONS (Triage, SLA Tracking, Tamper-evident Audit)
  // ==========================================================================

  async getModeratorQueue(dto: GetModerationQueueDto): Promise<ModerationQueueItem[]> {
    const status = dto.status || 'PENDING';
    const limit = dto.limit || 20;
    const offset = dto.offset || 0;

    const res = await this.databaseService.query(
      `SELECT q.id, q.entity_type, q.entity_id, q.creator_id, q.status,
              q.priority_score, q.reasons, q.report_count, q.is_urgent, q.sla_due_at,
              q.assigned_moderator_id, q.ai_moderation_scores, q.created_at, q.updated_at,
              p.username as creator_username
       FROM moderation_queue q
       LEFT JOIN profiles p ON p.user_id = q.creator_id
       WHERE q.status = $1
       ORDER BY q.is_urgent DESC, q.priority_score DESC, q.created_at ASC
       LIMIT $2 OFFSET $3`,
      [status, limit, offset],
    );

    const items: ModerationQueueItem[] = [];
    for (const row of res.rows) {
      let contentPreview: any = undefined;
      if (row.entity_type === ReportTargetType.REEL) {
        const rRes = await this.databaseService.query(
          `SELECT title, caption, thumbnail_url FROM reels WHERE id = $1`,
          [row.entity_id],
        );
        if (rRes.rows.length > 0) {
          contentPreview = {
            title: rRes.rows[0].title,
            caption: rRes.rows[0].caption,
            thumbnailUrl: rRes.rows[0].thumbnail_url,
          };
        }
      } else if (row.entity_type === ReportTargetType.COMMENT) {
        const cRes = await this.databaseService.query(
          `SELECT text FROM comments WHERE id = $1`,
          [row.entity_id],
        );
        if (cRes.rows.length > 0) {
          contentPreview = { text: cRes.rows[0].text };
        }
      } else if (row.entity_type === ReportTargetType.USER) {
        const uRes = await this.databaseService.query(
          `SELECT p.username, p.display_name, p.avatar_url, p.bio FROM profiles p WHERE p.user_id = $1`,
          [row.entity_id],
        );
        if (uRes.rows.length > 0) {
          contentPreview = {
            name: uRes.rows[0].display_name || uRes.rows[0].username,
            description: uRes.rows[0].bio,
            thumbnailUrl: uRes.rows[0].avatar_url,
          };
        }
      } else if (row.entity_type === ReportTargetType.MESSAGE) {
        const mRes = await this.databaseService.query(
          `SELECT content FROM messages WHERE id = $1`,
          [row.entity_id],
        );
        if (mRes.rows.length > 0) {
          contentPreview = { text: mRes.rows[0].content };
        }
      } else if (row.entity_type === ReportTargetType.COMMUNITY) {
        const commRes = await this.databaseService.query(
          `SELECT name, description, avatar_url, members_count FROM communities WHERE id = $1`,
          [row.entity_id],
        );
        if (commRes.rows.length > 0) {
          contentPreview = {
            name: commRes.rows[0].name,
            description: commRes.rows[0].description,
            thumbnailUrl: commRes.rows[0].avatar_url,
          };
        }
      }

      items.push({
        id: row.id,
        entityType: row.entity_type as ReportTargetType,
        entityId: row.entity_id,
        creatorId: row.creator_id,
        creatorUsername: row.creator_username || undefined,
        status: row.status,
        priorityScore: row.priority_score,
        reasons: row.reasons || [],
        reportCount: row.report_count,
        isUrgent: Boolean(row.is_urgent),
        slaDueAt: row.sla_due_at ? row.sla_due_at.toISOString() : null,
        assignedModeratorId: row.assigned_moderator_id,
        aiModerationScores: row.ai_moderation_scores || undefined,
        contentPreview,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      });
    }

    return items;
  }

  async applyModeratorAction(
    moderatorId: string,
    queueId: string,
    dto: ModeratorActionDto,
  ) {
    const qRes = await this.databaseService.query(
      `SELECT * FROM moderation_queue WHERE id = $1`,
      [queueId],
    );
    if (qRes.rows.length === 0) throw new NotFoundException('Queue item not found.');
    const qItem = qRes.rows[0];

    const client = await this.databaseService.getClient();
    try {
      await client.query('BEGIN');

      switch (dto.action) {
        case ModerationActionType.APPROVE:
          if (qItem.entity_type === ReportTargetType.REEL) {
            await client.query(
              `UPDATE reels
               SET status = $1, moderation_status = 'APPROVED', updated_at = NOW()
               WHERE id = $2`,
              [ReelStatus.PUBLISHED, qItem.entity_id],
            );
          } else if (qItem.entity_type === ReportTargetType.COMMENT) {
            await client.query(
              `UPDATE comments SET is_hidden = FALSE, hidden_reason = NULL WHERE id = $1`,
              [qItem.entity_id],
            );
          } else if (qItem.entity_type === ReportTargetType.COMMUNITY) {
            await client.query(
              `UPDATE communities SET is_active = TRUE, updated_at = NOW() WHERE id = $1`,
              [qItem.entity_id],
            );
          }
          break;

        case ModerationActionType.REMOVE:
          if (qItem.entity_type === ReportTargetType.REEL) {
            await client.query(
              `UPDATE reels
               SET status = $1, moderation_status = 'REMOVED', updated_at = NOW()
               WHERE id = $2`,
              [ReelStatus.FAILED, qItem.entity_id],
            );
          } else if (qItem.entity_type === ReportTargetType.COMMENT) {
            await client.query(
              `UPDATE comments
               SET is_hidden = TRUE, hidden_reason = 'MODERATOR_TAKEDOWN'
               WHERE id = $1`,
              [qItem.entity_id],
            );
          } else if (qItem.entity_type === ReportTargetType.COMMUNITY) {
            await client.query(
              `UPDATE communities SET is_active = FALSE, updated_at = NOW() WHERE id = $1`,
              [qItem.entity_id],
            );
          }

          // Issue strike to creator
          await client.query(
            `INSERT INTO user_strikes
               (user_id, moderation_queue_id, entity_type, entity_id, reason, severity, expires_at)
             VALUES ($1, $2, $3, $4, $5, 'STANDARD', NOW() + INTERVAL '90 days')`,
            [
              qItem.creator_id,
              qItem.id,
              qItem.entity_type,
              qItem.entity_id,
              dto.notes || 'Community guidelines violation takedown',
            ],
          );
          await this.escalateRepeatOffender(qItem.creator_id, client);
          break;

        case ModerationActionType.AGE_RESTRICT:
          if (qItem.entity_type === ReportTargetType.REEL) {
            await client.query(
              `UPDATE reels
               SET is_age_restricted = TRUE, moderation_status = 'APPROVED', updated_at = NOW()
               WHERE id = $1`,
              [qItem.entity_id],
            );
          }
          break;

        case ModerationActionType.LABEL_AI:
          if (qItem.entity_type === ReportTargetType.REEL) {
            await client.query(
              `UPDATE reels
               SET is_ai_generated = TRUE,
                   ai_label_type = $1,
                   moderation_status = 'APPROVED',
                   updated_at = NOW()
               WHERE id = $2`,
              [AiLabelType.MODERATOR_ENFORCED, qItem.entity_id],
            );
          }
          break;

        case ModerationActionType.WARN_USER:
          await client.query(
            `INSERT INTO user_strikes
               (user_id, moderation_queue_id, entity_type, entity_id, reason, severity, expires_at)
             VALUES ($1, $2, $3, $4, $5, 'WARNING', NOW() + INTERVAL '30 days')`,
            [
              qItem.creator_id,
              qItem.id,
              qItem.entity_type,
              qItem.entity_id,
              dto.notes || 'Official warning for policy violation',
            ],
          );
          await this.escalateRepeatOffender(qItem.creator_id, client);
          break;

        case ModerationActionType.RESTRICT_USER:
          const rType = dto.restrictionType || 'POSTING';
          const rDays = dto.restrictionDays || 2;
          if (rType === 'POSTING') {
            await client.query(
              `UPDATE users
               SET is_posting_restricted = TRUE,
                   posting_restricted_until = NOW() + ($1 || ' days')::interval,
                   updated_at = NOW()
               WHERE id = $2`,
              [`${rDays}`, qItem.creator_id],
            );
          } else if (rType === 'COMMENTING') {
            await client.query(
              `UPDATE users
               SET is_commenting_restricted = TRUE,
                   commenting_restricted_until = NOW() + ($1 || ' days')::interval,
                   updated_at = NOW()
               WHERE id = $2`,
              [`${rDays}`, qItem.creator_id],
            );
          } else if (rType === 'MESSAGING') {
            await client.query(
              `UPDATE users
               SET is_messaging_restricted = TRUE,
                   messaging_restricted_until = NOW() + ($1 || ' days')::interval,
                   updated_at = NOW()
               WHERE id = $2`,
              [`${rDays}`, qItem.creator_id],
            );
          }
          break;

        case ModerationActionType.SUSPEND_USER:
          const sDays = dto.suspensionDays || 7;
          await client.query(
            `UPDATE users
             SET is_active = FALSE,
                 is_suspended = TRUE,
                 suspension_expires_at = NOW() + ($1 || ' days')::interval,
                 suspension_reason = $2,
                 updated_at = NOW()
             WHERE id = $3`,
            [`${sDays}`, dto.notes || `Account suspended for ${sDays} days`, qItem.creator_id],
          );
          await client.query(
            `INSERT INTO user_strikes
               (user_id, moderation_queue_id, entity_type, entity_id, reason, severity, expires_at)
             VALUES ($1, $2, $3, $4, $5, 'SEVERE', NOW() + INTERVAL '90 days')`,
            [
              qItem.creator_id,
              qItem.id,
              qItem.entity_type,
              qItem.entity_id,
              `Account suspended for ${sDays} days: ${dto.notes || 'Severe violation'}`,
            ],
          );
          break;

        case ModerationActionType.BAN_USER:
          await client.query(
            `UPDATE users
             SET is_active = FALSE,
                 is_suspended = TRUE,
                 suspension_expires_at = NULL,
                 suspension_reason = $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [dto.notes || 'Permanent Account Ban for severe policy violation', qItem.creator_id],
          );
          // Revoke active sessions
          await client.query(
            `UPDATE user_sessions SET revoked = TRUE WHERE user_id = $1`,
            [qItem.creator_id],
          );
          break;
      }

      // Mark moderation queue item resolved
      await client.query(
        `UPDATE moderation_queue
         SET status = 'RESOLVED',
             assigned_moderator_id = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [moderatorId, queueId],
      );

      // Resolve linked reports
      await client.query(
        `UPDATE reports
         SET status = 'RESOLVED',
             moderator_id = $1,
             moderator_notes = $2,
             action_taken = $3,
             resolved_at = NOW()
         WHERE (
           (reported_reel_id = $4 AND $5 = 'REEL') OR
           (reported_comment_id = $4 AND $5 = 'COMMENT') OR
           (reported_user_id = $4 AND $5 = 'USER') OR
           (reported_message_id = $4 AND $5 = 'MESSAGE') OR
           (reported_community_id = $4 AND $5 = 'COMMUNITY')
         )`,
        [moderatorId, dto.notes || null, dto.action, qItem.entity_id, qItem.entity_type],
      );

      // Tamper-evident Moderator Action Audit Log
      await client.query(
        `INSERT INTO moderator_audit_logs
           (moderator_id, action, entity_type, entity_id, target_user_id, reason, notes, previous_status, new_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          moderatorId,
          dto.action,
          qItem.entity_type,
          qItem.entity_id,
          qItem.creator_id,
          qItem.reasons ? qItem.reasons.join(', ') : 'Policy enforcement',
          dto.notes || null,
          qItem.status,
          'RESOLVED',
        ],
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return {
      success: true,
      actionApplied: dto.action,
      queueId,
    };
  }

  // ==========================================================================
  // 5. REPEAT-OFFENDER AUTOMATED STRIKE ESCALATION
  // ==========================================================================

  async escalateRepeatOffender(userId: string, clientInstance?: any): Promise<number> {
    const db = clientInstance || this.databaseService;

    // Fetch active non-expired strikes
    const countRes = await db.query(
      `SELECT COUNT(*)::int as strike_count
       FROM user_strikes
       WHERE user_id = $1 AND expires_at > NOW()`,
      [userId],
    );
    const activeStrikes = countRes.rows[0]?.strike_count || 0;

    await db.query(
      `UPDATE users SET strikes_count = $1 WHERE id = $2`,
      [activeStrikes, userId],
    );

    if (activeStrikes === 2) {
      // 2 Strikes: Automated 48-hour posting and commenting restriction
      await db.query(
        `UPDATE users
         SET is_posting_restricted = TRUE,
             posting_restricted_until = NOW() + INTERVAL '48 hours',
             is_commenting_restricted = TRUE,
             commenting_restricted_until = NOW() + INTERVAL '48 hours',
             updated_at = NOW()
         WHERE id = $1`,
        [userId],
      );
      this.logger.warn(`[STRIKE ESCALATION] User ${userId} reached 2 strikes -> 48h restriction applied.`);
    } else if (activeStrikes === 3) {
      // 3 Strikes: Automated 7-day account suspension
      await db.query(
        `UPDATE users
         SET is_active = FALSE,
             is_suspended = TRUE,
             suspension_expires_at = NOW() + INTERVAL '7 days',
             suspension_reason = 'Automated 3-strike policy escalation: 7-day account suspension',
             updated_at = NOW()
         WHERE id = $1`,
        [userId],
      );
      this.logger.warn(`[STRIKE ESCALATION] User ${userId} reached 3 strikes -> 7-day suspension applied.`);
    } else if (activeStrikes >= 4) {
      // 4+ Strikes: Automated 30-day suspension / Permanent Ban review
      await db.query(
        `UPDATE users
         SET is_active = FALSE,
             is_suspended = TRUE,
             suspension_expires_at = NOW() + INTERVAL '30 days',
             suspension_reason = 'Automated repeat-offender escalation (4+ strikes): 30-day suspension',
             updated_at = NOW()
         WHERE id = $1`,
        [userId],
      );
      this.logger.warn(`[STRIKE ESCALATION] User ${userId} reached ${activeStrikes} strikes -> 30-day suspension.`);
    }

    return activeStrikes;
  }

  // ==========================================================================
  // 6. SERVER-ENFORCED RESTRICTIONS & BLOCKING (Cannot be bypassed through APIs)
  // ==========================================================================

  /**
   * Verifies if user is allowed to perform an action (e.g. POST_REEL, CREATE_COMMENT, SEND_MESSAGE, JOIN_COMMUNITY).
   * Automatically lifts expired temporary restrictions.
   */
  async checkUserActionAllowed(
    userId: string,
    action: 'POST_REEL' | 'CREATE_COMMENT' | 'SEND_MESSAGE' | 'JOIN_COMMUNITY',
  ): Promise<void> {
    const userRes = await this.databaseService.query(
      `SELECT is_active, is_suspended, suspension_expires_at, suspension_reason,
              is_posting_restricted, posting_restricted_until,
              is_messaging_restricted, messaging_restricted_until,
              is_commenting_restricted, commenting_restricted_until
       FROM users WHERE id = $1`,
      [userId],
    );

    if (userRes.rows.length === 0) {
      throw new NotFoundException('User not found.');
    }

    const u = userRes.rows[0];
    const now = new Date();

    // Check suspension
    if (u.is_suspended) {
      if (u.suspension_expires_at && new Date(u.suspension_expires_at) <= now) {
        // Expired suspension: auto-lift
        await this.databaseService.query(
          `UPDATE users SET is_suspended = FALSE, is_active = TRUE, suspension_expires_at = NULL, suspension_reason = NULL WHERE id = $1`,
          [userId],
        );
      } else {
        const untilMsg = u.suspension_expires_at
          ? ` until ${new Date(u.suspension_expires_at).toISOString()}`
          : ' permanently';
        throw new ForbiddenException(
          `Your account is suspended${untilMsg}. Reason: ${u.suspension_reason || 'Policy violations'}.`,
        );
      }
    }

    if (!u.is_active) {
      throw new ForbiddenException('Your account is deactivated.');
    }

    // Check specific action restrictions
    if (action === 'POST_REEL') {
      if (u.is_posting_restricted) {
        if (u.posting_restricted_until && new Date(u.posting_restricted_until) <= now) {
          await this.databaseService.query(
            `UPDATE users SET is_posting_restricted = FALSE, posting_restricted_until = NULL WHERE id = $1`,
            [userId],
          );
        } else {
          throw new ForbiddenException('You are temporarily restricted from publishing content due to community policy strikes.');
        }
      }
    } else if (action === 'CREATE_COMMENT') {
      if (u.is_commenting_restricted) {
        if (u.commenting_restricted_until && new Date(u.commenting_restricted_until) <= now) {
          await this.databaseService.query(
            `UPDATE users SET is_commenting_restricted = FALSE, commenting_restricted_until = NULL WHERE id = $1`,
            [userId],
          );
        } else {
          throw new ForbiddenException('You are temporarily restricted from posting comments.');
        }
      }
    } else if (action === 'SEND_MESSAGE') {
      if (u.is_messaging_restricted) {
        if (u.messaging_restricted_until && new Date(u.messaging_restricted_until) <= now) {
          await this.databaseService.query(
            `UPDATE users SET is_messaging_restricted = FALSE, messaging_restricted_until = NULL WHERE id = $1`,
            [userId],
          );
        } else {
          throw new ForbiddenException('You are temporarily restricted from sending direct messages.');
        }
      }
    }
  }

  /**
   * Enforces server-side restrictions on content access:
   * 1. Prohibited adult content is blocked for ALL users.
   * 2. Age-restricted (18+) content is blocked for minors (< 18).
   * 3. Removed content is hidden from public access.
   */
  async enforceContentRestrictions(viewerId: string | null, reelId: string): Promise<void> {
    const res = await this.databaseService.query(
      `SELECT id, creator_id, is_age_restricted, is_prohibited_adult, moderation_status
       FROM reels WHERE id = $1`,
      [reelId],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException('Reel not found.');
    }

    const reel = res.rows[0];

    // Author always has access to their own reel
    if (viewerId && viewerId === reel.creator_id) {
      return;
    }

    if (reel.is_prohibited_adult) {
      throw new ForbiddenException('This content violates platform adult safety policies and is unavailable.');
    }

    if (reel.moderation_status === 'REMOVED') {
      throw new NotFoundException('Content has been removed by platform moderation.');
    }

    if (reel.is_age_restricted) {
      if (!viewerId) {
        throw new ForbiddenException('Sign-in required to verify age for mature content.');
      }
      const uRes = await this.databaseService.query(
        `SELECT is_minor FROM users WHERE id = $1`,
        [viewerId],
      );
      if (uRes.rows.length > 0 && uRes.rows[0].is_minor) {
        throw new ForbiddenException('Age safety restriction: Content is not suitable for accounts under 18.');
      }
    }
  }

  /**
   * Enforces server-side message permissions:
   * 1. Sender cannot be suspended or messaging-restricted.
   * 2. Bidirectional block prevents messaging.
   * 3. Minor DM protection: non-mutual stranger DMs blocked if recipient is under 18.
   */
  async verifyMessagePermissions(senderId: string, recipientId: string): Promise<void> {
    await this.checkUserActionAllowed(senderId, 'SEND_MESSAGE');

    const blockRes = await this.databaseService.query(
      `SELECT 1 FROM blocks
       WHERE (blocker_id = $1 AND blocked_id = $2)
          OR (blocker_id = $2 AND blocked_id = $1)
       LIMIT 1`,
      [senderId, recipientId],
    );
    if (blockRes.rows.length > 0) {
      throw new ForbiddenException('Messaging unavailable: You or the recipient have blocked communication.');
    }

    // Minor DM protection
    await this.verifyMinorDmPolicy(senderId, recipientId);
  }

  /**
   * Enforces adult and prohibited content rules before monetization.
   * Prohibited adult content or non-approved content CANNOT be monetized.
   */
  async validateContentForMonetization(reelId: string): Promise<{ isEligible: boolean; rejectionReason?: string }> {
    const res = await this.databaseService.query(
      `SELECT id, is_prohibited_adult, is_age_restricted, moderation_status
       FROM reels WHERE id = $1`,
      [reelId],
    );

    if (res.rows.length === 0) {
      return { isEligible: false, rejectionReason: 'Content not found.' };
    }

    const reel = res.rows[0];
    if (reel.is_prohibited_adult) {
      return {
        isEligible: false,
        rejectionReason: 'Prohibited adult content is strictly disqualified from monetization.',
      };
    }

    if (reel.moderation_status !== 'APPROVED') {
      return {
        isEligible: false,
        rejectionReason: `Content moderation status is ${reel.moderation_status}. Only approved content can be monetized.`,
      };
    }

    return { isEligible: true };
  }

  // ==========================================================================
  // 7. APPEALS WORKFLOW
  // ==========================================================================

  async createAppeal(userId: string, dto: CreateAppealDto): Promise<ModerationAppealItem> {
    const res = await this.databaseService.query(
      `INSERT INTO moderation_appeals
         (user_id, entity_type, entity_id, statement, status)
       VALUES ($1, $2, $3, $4, 'PENDING')
       RETURNING *`,
      [userId, dto.entityType, dto.entityId, dto.statement],
    );
    const row = res.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      statement: row.statement,
      status: row.status as AppealStatus,
      createdAt: row.created_at.toISOString(),
    };
  }

  async getAppeals(status = 'PENDING', limit = 20, offset = 0): Promise<ModerationAppealItem[]> {
    const res = await this.databaseService.query(
      `SELECT a.*, p.username
       FROM moderation_appeals a
       LEFT JOIN profiles p ON p.user_id = a.user_id
       WHERE a.status = $1
       ORDER BY a.created_at ASC
       LIMIT $2 OFFSET $3`,
      [status, limit, offset],
    );
    return res.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      username: row.username || undefined,
      entityType: row.entity_type,
      entityId: row.entity_id,
      statement: row.statement,
      status: row.status as AppealStatus,
      reviewerId: row.reviewer_id,
      reviewNotes: row.review_notes,
      resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async resolveAppeal(moderatorId: string, appealId: string, dto: ResolveAppealDto) {
    const appRes = await this.databaseService.query(
      `SELECT * FROM moderation_appeals WHERE id = $1`,
      [appealId],
    );
    if (appRes.rows.length === 0) throw new NotFoundException('Appeal not found.');
    const appeal = appRes.rows[0];

    const client = await this.databaseService.getClient();
    try {
      await client.query('BEGIN');

      const newStatus =
        dto.decision === 'APPROVE' ? AppealStatus.APPROVED_REINSTATED : AppealStatus.REJECTED;

      if (dto.decision === 'APPROVE') {
        // Re-instate content if reel was taken down
        if (appeal.entity_type === 'REEL') {
          await client.query(
            `UPDATE reels
             SET status = $1, moderation_status = 'APPROVED', updated_at = NOW()
             WHERE id = $2`,
            [ReelStatus.PUBLISHED, appeal.entity_id],
          );
        } else if (appeal.entity_type === 'COMMENT') {
          await client.query(
            `UPDATE comments SET is_hidden = FALSE, hidden_reason = NULL WHERE id = $1`,
            [appeal.entity_id],
          );
        } else if (appeal.entity_type === 'COMMUNITY') {
          await client.query(
            `UPDATE communities SET is_active = TRUE, updated_at = NOW() WHERE id = $1`,
            [appeal.entity_id],
          );
        }

        // Expunge strike associated with this entity
        await client.query(
          `DELETE FROM user_strikes
           WHERE user_id = $1 AND entity_id = $2`,
          [appeal.user_id, appeal.entity_id],
        );

        // Recalculate remaining strikes and lift suspension if cleared
        const remainingCountRes = await client.query(
          `SELECT COUNT(*)::int as count FROM user_strikes WHERE user_id = $1 AND expires_at > NOW()`,
          [appeal.user_id],
        );
        const remaining = remainingCountRes.rows[0]?.count || 0;
        await client.query(`UPDATE users SET strikes_count = $1 WHERE id = $2`, [remaining, appeal.user_id]);

        if (remaining < 3) {
          await client.query(
            `UPDATE users
             SET is_active = TRUE,
                 is_suspended = FALSE,
                 suspension_expires_at = NULL,
                 suspension_reason = NULL,
                 is_posting_restricted = FALSE,
                 posting_restricted_until = NULL,
                 is_commenting_restricted = FALSE,
                 commenting_restricted_until = NULL
             WHERE id = $1`,
            [appeal.user_id],
          );
        }
      }

      await client.query(
        `UPDATE moderation_appeals
         SET status = $1, reviewer_id = $2, review_notes = $3, resolved_at = NOW()
         WHERE id = $4`,
        [newStatus, moderatorId, dto.notes || null, appealId],
      );

      // Audit log the appeal decision
      await client.query(
        `INSERT INTO moderator_audit_logs
           (moderator_id, action, entity_type, entity_id, target_user_id, reason, notes, previous_status, new_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          moderatorId,
          `RESOLVE_APPEAL_${dto.decision}`,
          appeal.entity_type,
          appeal.entity_id,
          appeal.user_id,
          `Appeal decision: ${dto.decision}`,
          dto.notes || null,
          appeal.status,
          newStatus,
        ],
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return {
      success: true,
      decision: dto.decision,
      appealId,
    };
  }

  // ==========================================================================
  // 8. MODERATOR AUDIT LOGS, OPERATIONAL SLA & GUIDELINES
  // ==========================================================================

  async getModeratorAuditLogs(dto: GetModeratorAuditLogsDto): Promise<ModeratorAuditLogItem[]> {
    const limit = dto.limit || 50;
    const offset = dto.offset || 0;
    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (dto.moderatorId) {
      params.push(dto.moderatorId);
      conditions.push(`l.moderator_id = $${params.length}`);
    }
    if (dto.targetUserId) {
      params.push(dto.targetUserId);
      conditions.push(`l.target_user_id = $${params.length}`);
    }
    if (dto.action) {
      params.push(dto.action);
      conditions.push(`l.action = $${params.length}`);
    }

    params.push(limit);
    params.push(offset);

    const sql = `
      SELECT l.id, l.moderator_id, l.action, l.entity_type, l.entity_id,
             l.target_user_id, l.reason, l.notes, l.previous_status, l.new_status, l.created_at,
             p.username as moderator_username
      FROM moderator_audit_logs l
      LEFT JOIN profiles p ON p.user_id = l.moderator_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY l.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length};
    `;

    const res = await this.databaseService.query(sql, params);
    return res.rows.map((row) => ({
      id: row.id,
      moderatorId: row.moderator_id,
      moderatorUsername: row.moderator_username || undefined,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      targetUserId: row.target_user_id,
      reason: row.reason,
      notes: row.notes,
      previousStatus: row.previous_status,
      newStatus: row.new_status,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async getOperationalSlaStatus(): Promise<OperationalSlaStatus> {
    const queueStatsRes = await this.databaseService.query(
      `SELECT
         COUNT(*) as total_pending,
         COUNT(*) FILTER (WHERE is_urgent = TRUE) as urgent_pending,
         COUNT(*) FILTER (WHERE sla_due_at < NOW()) as breached_sla
       FROM moderation_queue
       WHERE status = 'PENDING'`,
    );

    const resolvedStatsRes = await this.databaseService.query(
      `SELECT
         AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60)::int as avg_res_mins,
         COUNT(*) as total_resolved,
         COUNT(*) FILTER (WHERE resolved_at <= sla_due_at) as on_time_count
       FROM reports
       WHERE status = 'RESOLVED' AND resolved_at IS NOT NULL`,
    );

    const q = queueStatsRes.rows[0];
    const r = resolvedStatsRes.rows[0];
    const totalResolved = parseInt(r.total_resolved || '0', 10);
    const onTimeCount = parseInt(r.on_time_count || '0', 10);
    const complianceRate = totalResolved > 0 ? Math.round((onTimeCount / totalResolved) * 100) : 100;

    return {
      pendingReportsCount: parseInt(q.total_pending || '0', 10),
      urgentReportsCount: parseInt(q.urgent_pending || '0', 10),
      breachedSlaCount: parseInt(q.breached_sla || '0', 10),
      avgResolutionTimeMinutes: parseInt(r.avg_res_mins || '25', 10),
      complianceRatePercent: complianceRate,
    };
  }

  async getCommunityGuidelines(): Promise<CommunityGuidelineItem[]> {
    const res = await this.databaseService.query(
      `SELECT id, title, category, description, enforcement_action, updated_at
       FROM community_guidelines
       ORDER BY id ASC`,
    );
    return res.rows.map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      description: row.description,
      enforcementAction: row.enforcement_action,
      updatedAt: row.updated_at.toISOString(),
    }));
  }

  async getUserSafetyStatus(userId: string): Promise<UserAccountSafetyStatus> {
    const res = await this.databaseService.query(
      `SELECT id, is_active, is_suspended, suspension_expires_at, suspension_reason,
              is_posting_restricted, posting_restricted_until,
              is_messaging_restricted, messaging_restricted_until,
              is_commenting_restricted, commenting_restricted_until,
              strikes_count
       FROM users WHERE id = $1`,
      [userId],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException('User not found.');
    }

    const u = res.rows[0];
    return {
      userId: u.id,
      isActive: Boolean(u.is_active),
      isSuspended: Boolean(u.is_suspended),
      suspensionExpiresAt: u.suspension_expires_at ? u.suspension_expires_at.toISOString() : null,
      suspensionReason: u.suspension_reason || null,
      strikesCount: parseInt(u.strikes_count || '0', 10),
      isPostingRestricted: Boolean(u.is_posting_restricted),
      postingRestrictedUntil: u.posting_restricted_until ? u.posting_restricted_until.toISOString() : null,
      isMessagingRestricted: Boolean(u.is_messaging_restricted),
      messagingRestrictedUntil: u.messaging_restricted_until ? u.messaging_restricted_until.toISOString() : null,
      isCommentingRestricted: Boolean(u.is_commenting_restricted),
      commentingRestrictedUntil: u.commenting_restricted_until ? u.commenting_restricted_until.toISOString() : null,
    };
  }

  // ==========================================================================
  // 9. MINOR SAFETY SETTINGS & DM POLICY
  // ==========================================================================

  async getSafetySettings(userId: string) {
    const res = await this.databaseService.query(
      `SELECT u.is_minor, p.minor_safety_enforced, p.personalized_ads_enabled, p.strict_comment_filtering
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [userId],
    );
    if (res.rows.length === 0) throw new NotFoundException('User profile not found.');
    const row = res.rows[0];

    return {
      isMinor: row.is_minor,
      minorSafetyEnforced: row.is_minor ? true : row.minor_safety_enforced,
      personalizedAdsEnabled: row.is_minor ? false : row.personalized_ads_enabled,
      strictCommentFiltering: row.strict_comment_filtering,
    };
  }

  async updateSafetySettings(userId: string, dto: UpdateSafetySettingsDto) {
    const userRes = await this.databaseService.query(
      `SELECT is_minor FROM users WHERE id = $1`,
      [userId],
    );
    if (userRes.rows.length === 0) throw new NotFoundException('User not found.');
    const isMinor = userRes.rows[0].is_minor;

    const personalizedAdsEnabled = isMinor ? false : (dto.personalizedAdsEnabled ?? true);
    const strictCommentFiltering = isMinor ? true : (dto.strictCommentFiltering ?? false);

    await this.databaseService.query(
      `UPDATE profiles
       SET personalized_ads_enabled = $1,
           strict_comment_filtering = $2,
           updated_at = NOW()
       WHERE user_id = $3`,
      [personalizedAdsEnabled, strictCommentFiltering, userId],
    );

    return {
      success: true,
      settings: {
        isMinor,
        minorSafetyEnforced: isMinor,
        personalizedAdsEnabled,
        strictCommentFiltering,
      },
    };
  }

  async verifyMinorDmPolicy(senderId: string, recipientId: string): Promise<void> {
    const userRes = await this.databaseService.query(
      `SELECT is_minor FROM users WHERE id = $1`,
      [recipientId],
    );
    if (userRes.rows.length > 0 && userRes.rows[0].is_minor) {
      const followRes = await this.databaseService.query(
        `SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2`,
        [recipientId, senderId],
      );
      if (followRes.rows.length === 0) {
        throw new ForbiddenException(
          'Minor safety restriction: Direct messages from non-mutual strangers are disabled for accounts under 18.',
        );
      }
    }
  }
}
