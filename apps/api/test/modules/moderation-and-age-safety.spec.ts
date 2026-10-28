import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ModerationService } from '../../src/modules/safety/moderation.service';
import { AuthService } from '../../src/modules/auth/auth.service';
import { DatabaseService } from '../../src/database/database.service';
import {
  ReportTargetType,
  ReportCategory,
  ModerationActionType,
  AppealStatus,
  AiLabelType,
  ReelStatus,
} from '@shared/types';

describe('Prompt 19 — Moderation and Age Safety Gate Test Suite', () => {
  let moderationService: ModerationService;
  let mockDb: any;
  let mockClient: any;

  beforeEach(async () => {
    mockClient = {
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
      release: jest.fn(),
    };

    mockDb = {
      query: jest.fn(),
      getClient: jest.fn().mockResolvedValue(mockClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationService,
        {
          provide: DatabaseService,
          useValue: mockDb,
        },
      ],
    }).compile();

    moderationService = module.get<ModerationService>(ModerationService);
  });

  // ==========================================================================
  // 1. REAL REPORTING ACROSS ALL SURFACES (PROFILES, REELS, COMMENTS, MESSAGES, COMMUNITIES)
  // ==========================================================================
  describe('1. Real Reporting Across All Surfaces & Categories', () => {
    it('reports a user profile for IMPERSONATION', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'target-user-1' }] }) // User exists
        .mockResolvedValueOnce({ rows: [] }) // No duplicate pending report
        .mockResolvedValueOnce({ rows: [{ id: 'rep-user-1' }] }) // Insert report
        .mockResolvedValueOnce({ rows: [] }) // Check moderation queue
        .mockResolvedValueOnce({ rows: [{ id: 'q-user-1' }] }); // Insert queue

      const res = await moderationService.createReport('reporter-1', {
        targetType: ReportTargetType.USER,
        targetId: 'target-user-1',
        category: ReportCategory.IMPERSONATION,
        details: 'Impersonating official Interest brand account',
      });

      expect(res.success).toBe(true);
      expect(res.reportId).toBe('rep-user-1');
      expect(res.isUrgent).toBe(false);

      // Verify category and details passed
      const insertCall = mockDb.query.mock.calls[2];
      expect(insertCall[1][7]).toBe(ReportCategory.IMPERSONATION);
      expect(insertCall[1][8]).toBe('Impersonating official Interest brand account');
    });

    it('reports a reel / post for NUDITY_SEXUAL', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'reel-101', creator_id: 'creator-1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'rep-reel-1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'q-reel-1' }] });

      const res = await moderationService.createReport('reporter-1', {
        targetType: ReportTargetType.REEL,
        targetId: 'reel-101',
        category: ReportCategory.NUDITY_SEXUAL,
        details: 'Explicit adult imagery detected in video',
      });

      expect(res.success).toBe(true);
      expect(res.reportId).toBe('rep-reel-1');
    });

    it('reports a comment for HARASSMENT_BULLYING', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'comment-202', user_id: 'troll-1', reel_id: 'reel-1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'rep-comm-1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'q-comm-1' }] });

      const res = await moderationService.createReport('victim-1', {
        targetType: ReportTargetType.COMMENT,
        targetId: 'comment-202',
        category: ReportCategory.HARASSMENT_BULLYING,
        details: 'Repeated death threats and targeted harassment',
      });

      expect(res.success).toBe(true);
      expect(res.reportId).toBe('rep-comm-1');
    });

    it('reports a direct message for SCAM_FRAUD', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'msg-303', sender_id: 'scammer-1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'rep-msg-1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'q-msg-1' }] });

      const res = await moderationService.createReport('recipient-1', {
        targetType: ReportTargetType.MESSAGE,
        targetId: 'msg-303',
        category: ReportCategory.SCAM_FRAUD,
        details: 'Phishing link disguised as crypto giveaway',
      });

      expect(res.success).toBe(true);
      expect(res.reportId).toBe('rep-msg-1');
    });

    it('reports a community for SPAM_SCAM', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'comm-404', creator_id: 'spammer-creator' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'rep-community-1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'q-community-1' }] });

      const res = await moderationService.createReport('reporter-1', {
        targetType: ReportTargetType.COMMUNITY,
        targetId: 'comm-404',
        category: ReportCategory.SPAM_SCAM,
        details: 'Automated bot farm community posting fake affiliate links',
      });

      expect(res.success).toBe(true);
      expect(res.reportId).toBe('rep-community-1');
      const insertCall = mockDb.query.mock.calls[2];
      expect(insertCall[1][5]).toBe('comm-404'); // reported_community_id
    });

    it('rejects duplicate pending reports on the same entity by the same reporter', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'reel-101', creator_id: 'creator-1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'existing-rep-id' }] }); // Already exists

      await expect(
        moderationService.createReport('reporter-1', {
          targetType: ReportTargetType.REEL,
          targetId: 'reel-101',
          category: ReportCategory.SPAM_SCAM,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects self-reporting on user profiles', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'user-self' }] });

      await expect(
        moderationService.createReport('user-self', {
          targetType: ReportTargetType.USER,
          targetId: 'user-self',
          category: ReportCategory.SPAM_SCAM,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================================================================
  // 2. URGENT SAFETY ESCALATION & OPERATIONAL SLA TARGETS
  // ==========================================================================
  describe('2. Urgent Safety Escalation & Operational SLA Targets', () => {
    it('escalates MINOR_SAFETY report with priority 100, isUrgent = true, and 1-hour SLA', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'reel-csam', creator_id: 'bad-actor' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'rep-urgent-1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'q-urgent-1' }] });

      const res = await moderationService.createReport('reporter-1', {
        targetType: ReportTargetType.REEL,
        targetId: 'reel-csam',
        category: ReportCategory.MINOR_SAFETY,
        details: 'Exploitative child content detected',
      });

      expect(res.success).toBe(true);
      expect(res.isUrgent).toBe(true);

      const insertReport = mockDb.query.mock.calls[2];
      expect(insertReport[1][9]).toBe(100.0); // Base priority score
      expect(insertReport[1][10]).toBe(true); // is_urgent
      // SLA due within 1 hour
      const slaDate = new Date(insertReport[1][11]);
      const diffMinutes = (slaDate.getTime() - Date.now()) / (1000 * 60);
      expect(diffMinutes).toBeGreaterThan(50);
      expect(diffMinutes).toBeLessThanOrEqual(61);
    });

    it('escalates SELF_HARM_SUICIDE with priority 98.0, isUrgent = true, and 1-hour SLA', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'reel-self-harm', creator_id: 'distressed-user' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'rep-self-harm' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'q-self-harm' }] });

      const res = await moderationService.createReport('friend-1', {
        targetType: ReportTargetType.REEL,
        targetId: 'reel-self-harm',
        category: ReportCategory.SELF_HARM_SUICIDE,
      });

      expect(res.success).toBe(true);
      expect(res.isUrgent).toBe(true);
      const insertReport = mockDb.query.mock.calls[2];
      expect(insertReport[1][9]).toBe(98.0);
      expect(insertReport[1][10]).toBe(true);
    });

    it('calculates operational SLA compliance metrics accurately', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ total_pending: '15', urgent_pending: '3', breached_sla: '1' }],
        })
        .mockResolvedValueOnce({
          rows: [{ avg_res_mins: '18', total_resolved: '100', on_time_count: '95' }],
        });

      const metrics = await moderationService.getOperationalSlaStatus();
      expect(metrics.pendingReportsCount).toBe(15);
      expect(metrics.urgentReportsCount).toBe(3);
      expect(metrics.breachedSlaCount).toBe(1);
      expect(metrics.avgResolutionTimeMinutes).toBe(18);
      expect(metrics.complianceRatePercent).toBe(95);
    });
  });

  // ==========================================================================
  // 3. MODERATOR QUEUE TRIAGE, ROLES & CONTENT PREVIEW
  // ==========================================================================
  describe('3. Moderator Queue Triage, Roles & Content Previews', () => {
    it('retrieves moderation queue with urgent items prioritized and previews resolved', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'q-1',
              entity_type: ReportTargetType.REEL,
              entity_id: 'reel-101',
              creator_id: 'creator-1',
              status: 'PENDING',
              priority_score: 100.0,
              reasons: ['MINOR_SAFETY'],
              report_count: 3,
              is_urgent: true,
              sla_due_at: new Date(Date.now() + 30 * 60 * 1000),
              assigned_moderator_id: null,
              created_at: new Date(),
              updated_at: new Date(),
              creator_username: 'creator123',
            },
            {
              id: 'q-2',
              entity_type: ReportTargetType.COMMUNITY,
              entity_id: 'comm-202',
              creator_id: 'creator-2',
              status: 'PENDING',
              priority_score: 40.0,
              reasons: ['SPAM_SCAM'],
              report_count: 1,
              is_urgent: false,
              sla_due_at: new Date(Date.now() + 20 * 60 * 60 * 1000),
              assigned_moderator_id: null,
              created_at: new Date(),
              updated_at: new Date(),
              creator_username: 'spammer456',
            },
          ],
        })
        // Preview query for reel-101
        .mockResolvedValueOnce({
          rows: [{ title: 'Reported Reel', caption: 'Capt', thumbnail_url: 'https://cdn/thumb.jpg' }],
        })
        // Preview query for comm-202
        .mockResolvedValueOnce({
          rows: [{ name: 'Spam Club', description: 'Free crypto', avatar_url: 'https://cdn/comm.jpg' }],
        });

      const queue = await moderationService.getModeratorQueue({ status: 'PENDING' });
      expect(queue.length).toBe(2);
      expect(queue[0].isUrgent).toBe(true);
      expect(queue[0].priorityScore).toBe(100.0);
      expect(queue[0].contentPreview?.title).toBe('Reported Reel');

      expect(queue[1].isUrgent).toBe(false);
      expect(queue[1].contentPreview?.name).toBe('Spam Club');
    });
  });

  // ==========================================================================
  // 4. REPORT RESOLUTION & TAMPER-EVIDENT AUDIT LOGS
  // ==========================================================================
  describe('4. Report Resolution & Tamper-Evident Audit Trail', () => {
    it('applies REMOVE action: takes down reel, resolves reports, and records in audit trail', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'q-remove-1',
            entity_type: ReportTargetType.REEL,
            entity_id: 'reel-takedown-1',
            creator_id: 'violator-1',
            status: 'PENDING',
            reasons: ['HARASSMENT_BULLYING'],
          },
        ],
      });

      // Strike count query in repeat-offender check
      mockClient.query.mockResolvedValue({ rows: [{ strike_count: 1 }], rowCount: 1 });

      const res = await moderationService.applyModeratorAction('mod-super-1', 'q-remove-1', {
        action: ModerationActionType.REMOVE,
        notes: 'Confirmed severe harassment violation',
      });

      expect(res.success).toBe(true);
      expect(res.actionApplied).toBe(ModerationActionType.REMOVE);

      // Verify transaction queries
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      // 1. Reel updated to REMOVED
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = $1, moderation_status = 'REMOVED'"),
        [ReelStatus.FAILED, 'reel-takedown-1'],
      );
      // 2. Strike issued to creator
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_strikes'),
        expect.arrayContaining(['violator-1', 'q-remove-1']),
      );
      // 3. Queue item marked RESOLVED
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'RESOLVED'"),
        ['mod-super-1', 'q-remove-1'],
      );
      // 4. Linked reports marked RESOLVED
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE reports"),
        expect.arrayContaining(['mod-super-1', 'Confirmed severe harassment violation', ModerationActionType.REMOVE]),
      );
      // 5. Tamper-evident Audit log recorded
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO moderator_audit_logs'),
        expect.arrayContaining(['mod-super-1', ModerationActionType.REMOVE, 'REEL', 'reel-takedown-1', 'violator-1']),
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('applies RESTRICT_USER action: restricts posting for specified duration', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'q-restrict-1',
            entity_type: ReportTargetType.USER,
            entity_id: 'user-restricted-1',
            creator_id: 'user-restricted-1',
            status: 'PENDING',
            reasons: ['SPAM_SCAM'],
          },
        ],
      });

      const res = await moderationService.applyModeratorAction('mod-super-1', 'q-restrict-1', {
        action: ModerationActionType.RESTRICT_USER,
        restrictionType: 'POSTING',
        restrictionDays: 3,
        notes: '3-day posting restriction for spam behavior',
      });

      expect(res.success).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SET is_posting_restricted = TRUE'),
        ['3', 'user-restricted-1'],
      );
    });

    it('applies SUSPEND_USER action: suspends account for specified days', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'q-suspend-1',
            entity_type: ReportTargetType.USER,
            entity_id: 'user-suspended-1',
            creator_id: 'user-suspended-1',
            status: 'PENDING',
            reasons: ['HATE_SPEECH_HARASSMENT'],
          },
        ],
      });

      const res = await moderationService.applyModeratorAction('mod-super-1', 'q-suspend-1', {
        action: ModerationActionType.SUSPEND_USER,
        suspensionDays: 14,
        notes: '14-day suspension for hate speech violation',
      });

      expect(res.success).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('is_suspended = TRUE'),
        ['14', '14-day suspension for hate speech violation', 'user-suspended-1'],
      );
    });
  });

  // ==========================================================================
  // 5. SERVER-ENFORCED RESTRICTIONS & ANTI-BYPASS GATE
  // ==========================================================================
  describe('5. Server-Enforced Restrictions & Anti-Bypass Gate', () => {
    it('blocks suspended user from posting reels via API', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            is_active: false,
            is_suspended: true,
            suspension_expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days remaining
            suspension_reason: 'Account suspended for policy violations',
            is_posting_restricted: false,
          },
        ],
      });

      await expect(
        moderationService.checkUserActionAllowed('suspended-user-1', 'POST_REEL'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks user with active posting restriction from publishing reels', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            is_active: true,
            is_suspended: false,
            is_posting_restricted: true,
            posting_restricted_until: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day remaining
            is_commenting_restricted: false,
            is_messaging_restricted: false,
          },
        ],
      });

      await expect(
        moderationService.checkUserActionAllowed('restricted-user-1', 'POST_REEL'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks user with active commenting restriction from adding comments', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            is_active: true,
            is_suspended: false,
            is_posting_restricted: false,
            is_commenting_restricted: true,
            commenting_restricted_until: new Date(Date.now() + 12 * 60 * 60 * 1000),
            is_messaging_restricted: false,
          },
        ],
      });

      await expect(
        moderationService.checkUserActionAllowed('restricted-user-2', 'CREATE_COMMENT'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks messaging when either user has blocked the other', async () => {
      // 1. Check user action allowed (sender not restricted)
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ is_active: true, is_suspended: false, is_messaging_restricted: false }],
        })
        // 2. Check blocks table -> blocked exists!
        .mockResolvedValueOnce({ rows: [{ 1: 1 }] });

      await expect(
        moderationService.verifyMessagePermissions('sender-1', 'recipient-blocked'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('auto-lifts expired restrictions and allows action when time has passed', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              is_active: true,
              is_suspended: false,
              is_posting_restricted: true,
              posting_restricted_until: new Date(Date.now() - 1000), // Expired 1 second ago!
              is_commenting_restricted: false,
              is_messaging_restricted: false,
            },
          ],
        })
        // Auto-lift update query
        .mockResolvedValueOnce({ rows: [] });

      await expect(
        moderationService.checkUserActionAllowed('reformed-user-1', 'POST_REEL'),
      ).resolves.not.toThrow();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SET is_posting_restricted = FALSE'),
        ['reformed-user-1'],
      );
    });
  });

  // ==========================================================================
  // 6. AGE-APPROPRIATE ACCESS, MINOR SAFETY & ADULT CONTENT GATE
  // ==========================================================================
  describe('6. Age-Appropriate Access & Minor Safety Controls', () => {
    it('blocks minor account (< 18) from accessing age-restricted mature reel', async () => {
      mockDb.query
        // 1. Reel is age restricted
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'mature-reel-1',
              creator_id: 'creator-x',
              is_age_restricted: true,
              is_prohibited_adult: false,
              moderation_status: 'APPROVED',
            },
          ],
        })
        // 2. Viewer check -> viewer is minor!
        .mockResolvedValueOnce({
          rows: [{ is_minor: true }],
        });

      await expect(
        moderationService.enforceContentRestrictions('minor-user-1', 'mature-reel-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows adult account (>= 18) to access age-restricted mature reel', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'mature-reel-1',
              creator_id: 'creator-x',
              is_age_restricted: true,
              is_prohibited_adult: false,
              moderation_status: 'APPROVED',
            },
          ],
        })
        // Viewer is adult
        .mockResolvedValueOnce({
          rows: [{ is_minor: false }],
        });

      await expect(
        moderationService.enforceContentRestrictions('adult-user-1', 'mature-reel-1'),
      ).resolves.not.toThrow();
    });

    it('strictly blocks prohibited adult content from ALL users unconditionally', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'hardcore-reel-1',
            creator_id: 'violator-x',
            is_age_restricted: true,
            is_prohibited_adult: true, // Prohibited adult content!
            moderation_status: 'REMOVED',
          },
        ],
      });

      await expect(
        moderationService.enforceContentRestrictions('any-adult-user', 'hardcore-reel-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('enforces minor DM protection: blocks stranger direct messages to minors', async () => {
      mockDb.query
        // 1. Sender permissions check
        .mockResolvedValueOnce({
          rows: [{ is_active: true, is_suspended: false, is_messaging_restricted: false }],
        })
        // 2. Block check -> none
        .mockResolvedValueOnce({ rows: [] })
        // 3. Minor check on recipient -> is_minor = true
        .mockResolvedValueOnce({ rows: [{ is_minor: true }] })
        // 4. Follow check -> minor does NOT follow stranger!
        .mockResolvedValueOnce({ rows: [] });

      await expect(
        moderationService.verifyMessagePermissions('stranger-adult', 'minor-recipient'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ==========================================================================
  // 7. ADULT & PROHIBITED CONTENT RULES BEFORE MONETIZATION
  // ==========================================================================
  describe('7. Adult & Prohibited Content Rules Before Monetization', () => {
    it('disqualifies prohibited adult content from monetization', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'reel-adult-monetize',
            is_prohibited_adult: true,
            is_age_restricted: true,
            moderation_status: 'REJECTED',
          },
        ],
      });

      const res = await moderationService.validateContentForMonetization('reel-adult-monetize');
      expect(res.isEligible).toBe(false);
      expect(res.rejectionReason).toContain('Prohibited adult content');
    });

    it('disqualifies unapproved content from monetization', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'reel-pending-scan',
            is_prohibited_adult: false,
            is_age_restricted: false,
            moderation_status: 'PENDING_SCAN',
          },
        ],
      });

      const res = await moderationService.validateContentForMonetization('reel-pending-scan');
      expect(res.isEligible).toBe(false);
      expect(res.rejectionReason).toContain('PENDING_SCAN');
    });

    it('approves compliant clean reel for monetization', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'reel-clean',
            is_prohibited_adult: false,
            is_age_restricted: false,
            moderation_status: 'APPROVED',
          },
        ],
      });

      const res = await moderationService.validateContentForMonetization('reel-clean');
      expect(res.isEligible).toBe(true);
    });
  });

  // ==========================================================================
  // 8. REPEAT-OFFENDER AUTOMATED STRIKE ESCALATION
  // ==========================================================================
  describe('8. Repeat-Offender Automated Strike Escalation', () => {
    it('escalates 2 strikes to automated 48-hour posting and commenting restriction', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ strike_count: 2 }] }) // 2 active strikes
        .mockResolvedValueOnce({ rows: [] }) // update strikes_count
        .mockResolvedValueOnce({ rows: [] }); // update 48h restriction

      const strikes = await moderationService.escalateRepeatOffender('strike-user-2');
      expect(strikes).toBe(2);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('is_posting_restricted = TRUE'),
        ['strike-user-2'],
      );
    });

    it('escalates 3 strikes to automated 7-day account suspension', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ strike_count: 3 }] }) // 3 active strikes
        .mockResolvedValueOnce({ rows: [] }) // update strikes_count
        .mockResolvedValueOnce({ rows: [] }); // update 7-day suspension

      const strikes = await moderationService.escalateRepeatOffender('strike-user-3');
      expect(strikes).toBe(3);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("suspension_expires_at = NOW() + INTERVAL '7 days'"),
        ['strike-user-3'],
      );
    });
  });

  // ==========================================================================
  // 9. APPEALS WORKFLOW LIFECYCLE (REINSTATEMENT & STRIKE EXPUNGEMENT)
  // ==========================================================================
  describe('9. Appeals Workflow Lifecycle', () => {
    it('reinstates content, expunges strike, and restores account standing on approved appeal', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'appeal-101',
            user_id: 'penalized-creator',
            entity_type: 'REEL',
            entity_id: 'falsely-flagged-reel',
            statement: 'This was a false positive scan of theatrical makeup',
            status: 'PENDING',
          },
        ],
      });

      // Remaining strikes query returns 0 strikes remaining
      mockClient.query.mockResolvedValue({ rows: [{ count: 0 }], rowCount: 1 });

      const res = await moderationService.resolveAppeal('mod-chief-1', 'appeal-101', {
        decision: 'APPROVE',
        notes: 'Verified false positive makeup FX, content restored',
      });

      expect(res.success).toBe(true);
      expect(res.decision).toBe('APPROVE');

      // 1. Reel restored to PUBLISHED
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = $1, moderation_status = 'APPROVED'"),
        [ReelStatus.PUBLISHED, 'falsely-flagged-reel'],
      );
      // 2. Strike expunged
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM user_strikes'),
        ['penalized-creator', 'falsely-flagged-reel'],
      );
      // 3. User account suspension lifted
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('is_suspended = FALSE'),
        ['penalized-creator'],
      );
      // 4. Appeal updated to APPROVED_REINSTATED
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE moderation_appeals'),
        expect.arrayContaining([AppealStatus.APPROVED_REINSTATED, 'mod-chief-1', 'appeal-101']),
      );
    });
  });

  // ==========================================================================
  // 10. PLATFORM COMMUNITY GUIDELINES
  // ==========================================================================
  describe('10. Platform Community Guidelines Registry', () => {
    it('serves platform guidelines covering minor safety, adult content, and harassment', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'guide_minor_safety',
            title: 'Child Safety & Protection Against Exploitation',
            category: 'SAFETY_CRITICAL',
            description: 'Zero tolerance for CSAM or child exploitation',
            enforcement_action: 'Immediate permanent ban',
            updated_at: new Date(),
          },
          {
            id: 'guide_adult_prohibited',
            title: 'Prohibited Adult Content',
            category: 'ADULT_POLICY',
            description: 'Explicit pornographic content is strictly prohibited',
            enforcement_action: 'Immediate takedown and strike',
            updated_at: new Date(),
          },
        ],
      });

      const guidelines = await moderationService.getCommunityGuidelines();
      expect(guidelines.length).toBe(2);
      expect(guidelines[0].id).toBe('guide_minor_safety');
      expect(guidelines[1].category).toBe('ADULT_POLICY');
    });
  });
});
