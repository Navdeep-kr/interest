import { ModerationService } from './moderation.service';
import {
  ReportTargetType,
  ReportCategory,
  ModerationActionType,
  AppealStatus,
  AiLabelType,
} from '@shared/types';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';

describe('ModerationService', () => {
  let service: ModerationService;
  let mockDatabaseService: any;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
      release: jest.fn(),
    };

    mockDatabaseService = {
      query: jest.fn(),
      getClient: jest.fn().mockResolvedValue(mockClient),
    };

    service = new ModerationService(mockDatabaseService as any);
  });

  describe('Report Flow', () => {
    it('should create report with high priority score for Minor Safety', async () => {
      // 1. Reel check
      mockDatabaseService.query
        .mockResolvedValueOnce({
          rows: [{ id: 'reel-100', creator_id: 'creator-99' }],
        })
        // 2. Existing report check
        .mockResolvedValueOnce({ rows: [] })
        // 3. Insert report
        .mockResolvedValueOnce({ rows: [{ id: 'rep-1' }] })
        // 4. Moderation queue check
        .mockResolvedValueOnce({ rows: [] })
        // 5. Insert queue
        .mockResolvedValueOnce({ rows: [{ id: 'q-1' }] });

      const result = await service.createReport('reporter-1', {
        targetType: ReportTargetType.REEL,
        targetId: 'reel-100',
        category: ReportCategory.MINOR_SAFETY,
        details: 'Underage exploitation reported',
      });

      expect(result.success).toBe(true);
      expect(result.reportId).toBe('rep-1');

      // Verify high priority base score 100.0 and is_urgent true was passed to DB
      const insertCall = mockDatabaseService.query.mock.calls[2];
      expect(insertCall[1][9]).toBe(100.0);
      expect(insertCall[1][10]).toBe(true);
    });

    it('should reject duplicate pending report by same user', async () => {
      mockDatabaseService.query
        .mockResolvedValueOnce({
          rows: [{ id: 'reel-100', creator_id: 'creator-99' }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'rep-existing' }],
        });

      await expect(
        service.createReport('reporter-1', {
          targetType: ReportTargetType.REEL,
          targetId: 'reel-100',
          category: ReportCategory.SPAM_SCAM,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Block and Mute', () => {
    it('should block user and sever mutual follow relationships', async () => {
      mockDatabaseService.query.mockResolvedValue({ rows: [], rowCount: 1 });

      const res = await service.blockUser('user-a', 'user-b');
      expect(res.success).toBe(true);

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO blocks'),
        ['user-a', 'user-b'],
      );
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM follows'),
        ['user-a', 'user-b'],
      );
    });

    it('should prevent blocking self', async () => {
      await expect(service.blockUser('user-a', 'user-a')).rejects.toThrow(BadRequestException);
    });

    it('should mute and unmute users', async () => {
      mockDatabaseService.query.mockResolvedValue({ rows: [], rowCount: 1 });

      const muteRes = await service.muteUser('user-a', 'user-b');
      expect(muteRes.success).toBe(true);

      const unmuteRes = await service.unmuteUser('user-a', 'user-b');
      expect(unmuteRes.success).toBe(true);
    });
  });

  describe('Comment and Keyword Filters', () => {
    it('should detect toxic profanities and trigger auto-hide', async () => {
      const result = await service.filterComment(
        'creator-1',
        'You are an idiot scammer fuck off',
      );

      expect(result.shouldHide).toBe(true);
      expect(result.reason).toBe('OFFENSIVE_PROFANITY');
    });

    it('should detect creator custom blocked keywords', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ keyword: 'crypto telegram', is_regex: false }],
      });

      const result = await service.filterComment(
        'creator-1',
        'Join my private crypto telegram group for 100x gains',
      );

      expect(result.shouldHide).toBe(true);
      expect(result.reason).toBe('USER_KEYWORD_FILTER');
    });

    it('should pass clean supportive comments', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ keyword: 'badword', is_regex: false }],
      });

      const result = await service.filterComment(
        'creator-1',
        'Loved the video! Can you do a tutorial on form?',
      );

      expect(result.shouldHide).toBe(false);
    });
  });

  describe('Moderator Queue & Actions', () => {
    it('should apply REMOVE action, takedown content, and record strike', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'q-10',
            entity_type: ReportTargetType.REEL,
            entity_id: 'reel-violating',
            creator_id: 'creator-1',
          },
        ],
      });

      const res = await service.applyModeratorAction('mod-1', 'q-10', {
        action: ModerationActionType.REMOVE,
        notes: 'Copyright violation takedown',
      });

      expect(res.success).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE reels'),
        expect.arrayContaining(['reel-violating']),
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_strikes'),
        expect.arrayContaining(['creator-1', 'q-10', 'REEL']),
      );
    });

    it('should apply LABEL_AI action to force AI disclosure', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'q-11',
            entity_type: ReportTargetType.REEL,
            entity_id: 'reel-synth',
            creator_id: 'creator-2',
          },
        ],
      });

      const res = await service.applyModeratorAction('mod-1', 'q-11', {
        action: ModerationActionType.LABEL_AI,
      });

      expect(res.success).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('ai_label_type = $1'),
        [AiLabelType.MODERATOR_ENFORCED, 'reel-synth'],
      );
    });
  });

  describe('Appeals Workflow', () => {
    it('should reinstate content and revoke strike on approved appeal', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'appeal-1',
            user_id: 'creator-1',
            entity_type: 'REEL',
            entity_id: 'reel-100',
            statement: 'Original fair use commentary',
            status: 'PENDING',
          },
        ],
      });

      const res = await service.resolveAppeal('mod-1', 'appeal-1', {
        decision: 'APPROVE',
        notes: 'Fair use confirmed, reinstating reel',
      });

      expect(res.success).toBe(true);
      expect(res.decision).toBe('APPROVE');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE reels'),
        ['PUBLISHED', 'reel-100'],
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM user_strikes'),
        ['creator-1', 'reel-100'],
      );
    });
  });

  describe('Minor Safety Defaults', () => {
    it('should block non-mutual stranger DMs to minor accounts', async () => {
      // 1. Check recipient is minor
      mockDatabaseService.query
        .mockResolvedValueOnce({
          rows: [{ is_minor: true }],
        })
        // 2. Check if minor follows stranger
        .mockResolvedValueOnce({
          rows: [],
        });

      await expect(
        service.verifyMinorDmPolicy('stranger-adult', 'minor-recipient'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow DMs if minor follows the counterparty', async () => {
      mockDatabaseService.query
        .mockResolvedValueOnce({
          rows: [{ is_minor: true }],
        })
        .mockResolvedValueOnce({
          rows: [{ 1: 1 }],
        });

      await expect(
        service.verifyMinorDmPolicy('friend-user', 'minor-recipient'),
      ).resolves.not.toThrow();
    });

    it('should prohibit enabling personalized ads for minors', async () => {
      mockDatabaseService.query
        .mockResolvedValueOnce({
          rows: [{ is_minor: true }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const res = await service.updateSafetySettings('minor-user', {
        personalizedAdsEnabled: true, // Attempt to turn on ads
      });

      expect(res.settings.personalizedAdsEnabled).toBe(false);
      expect(res.settings.isMinor).toBe(true);
    });
  });
});
