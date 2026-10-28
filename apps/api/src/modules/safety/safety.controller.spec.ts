import { Test, TestingModule } from '@nestjs/testing';
import { SafetyController } from './safety.controller';
import { ModerationService } from './moderation.service';
import { ReportTargetType, ReportCategory, ModerationActionType } from '@shared/types';

describe('SafetyController', () => {
  let controller: SafetyController;
  let mockModerationService: any;

  beforeEach(async () => {
    mockModerationService = {
      createReport: jest.fn().mockResolvedValue({ success: true, reportId: 'rep-1' }),
      getUserReports: jest.fn().mockResolvedValue([{ id: 'rep-1' }]),
      blockUser: jest.fn().mockResolvedValue({ success: true }),
      unblockUser: jest.fn().mockResolvedValue({ success: true }),
      getBlockedUsers: jest.fn().mockResolvedValue([]),
      muteUser: jest.fn().mockResolvedValue({ success: true }),
      unmuteUser: jest.fn().mockResolvedValue({ success: true }),
      getMutedUsers: jest.fn().mockResolvedValue([]),
      addKeywordFilter: jest.fn().mockResolvedValue({ id: 'kw-1', keyword: 'bad' }),
      removeKeywordFilter: jest.fn().mockResolvedValue({ success: true }),
      getKeywordFilters: jest.fn().mockResolvedValue([]),
      getModeratorQueue: jest.fn().mockResolvedValue([]),
      applyModeratorAction: jest.fn().mockResolvedValue({ success: true }),
      createAppeal: jest.fn().mockResolvedValue({ id: 'app-1' }),
      getAppeals: jest.fn().mockResolvedValue([]),
      resolveAppeal: jest.fn().mockResolvedValue({ success: true }),
      getSafetySettings: jest.fn().mockResolvedValue({ isMinor: false }),
      updateSafetySettings: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SafetyController],
      providers: [
        {
          provide: ModerationService,
          useValue: mockModerationService,
        },
      ],
    }).compile();

    controller = module.get<SafetyController>(SafetyController);
  });

  it('should create report with authenticated user', async () => {
    const req = { user: { id: 'user-1' } };
    const dto = {
      targetType: ReportTargetType.REEL,
      targetId: 'reel-1',
      category: ReportCategory.NUDITY_SEXUAL,
    };

    const res = await controller.createReport(req, dto);
    expect(res.success).toBe(true);
    expect(mockModerationService.createReport).toHaveBeenCalledWith('user-1', dto);
  });

  it('should block and unblock target user', async () => {
    const req = { user: { id: 'user-1' } };
    await controller.blockUser(req, 'target-2');
    expect(mockModerationService.blockUser).toHaveBeenCalledWith('user-1', 'target-2');

    await controller.unblockUser(req, 'target-2');
    expect(mockModerationService.unblockUser).toHaveBeenCalledWith('user-1', 'target-2');
  });

  it('should add and list custom keyword filters', async () => {
    const req = { user: { id: 'user-1' } };
    const dto = { keyword: 'crypto telegram' };

    await controller.addKeyword(req, dto);
    expect(mockModerationService.addKeywordFilter).toHaveBeenCalledWith('user-1', dto);

    await controller.getKeywords(req);
    expect(mockModerationService.getKeywordFilters).toHaveBeenCalledWith('user-1');
  });

  it('should fetch moderator queue and apply moderator action', async () => {
    await controller.getQueue({ status: 'PENDING' });
    expect(mockModerationService.getModeratorQueue).toHaveBeenCalledWith({ status: 'PENDING' });

    const req = { user: { id: 'mod-1' } };
    const actionDto = { action: ModerationActionType.REMOVE };
    await controller.applyAction(req, 'q-10', actionDto);
    expect(mockModerationService.applyModeratorAction).toHaveBeenCalledWith('mod-1', 'q-10', actionDto);
  });
});
