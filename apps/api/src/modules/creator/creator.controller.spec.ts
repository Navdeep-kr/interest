import { Test, TestingModule } from '@nestjs/testing';
import { CreatorController } from './creator.controller';
import { CreatorDraftsService } from './creator-drafts.service';
import { CreatorSchedulingService } from './creator-scheduling.service';
import { CreatorAnalyticsService } from './creator-analytics.service';
import { CreatorStudioService } from './creator-studio.service';

describe('CreatorController', () => {
  let controller: CreatorController;

  const mockDrafts = {
    saveDraft: jest.fn().mockResolvedValue({ id: 'draft-1', title: 'Test' }),
    getDrafts: jest.fn().mockResolvedValue([]),
    getDraftById: jest.fn().mockResolvedValue({ id: 'draft-1' }),
    deleteDraft: jest.fn().mockResolvedValue({ deleted: true, draftId: 'draft-1' }),
  };

  const mockScheduling = {
    scheduleReel: jest.fn().mockResolvedValue({ scheduled: true, scheduledAt: '2026-10-15T10:00:00Z', reelId: 'reel-1' }),
    getScheduledReels: jest.fn().mockResolvedValue([]),
    cancelSchedule: jest.fn().mockResolvedValue({ cancelled: true, reelId: 'reel-1' }),
  };

  const mockAnalytics = {
    getVerifiedAnalytics: jest.fn().mockResolvedValue({
      totalViews: 100,
      totalWatchHours: 2.5,
      hasSufficientData: true,
      countingRules: { minWatchSecondsForView: 1.5 },
      earnings: { grossRevenueCents: 500, isFinancialAuthoritative: true },
    }),
    recordEngagementEvent: jest.fn().mockResolvedValue({
      recorded: true,
      isQualifyingView: true,
      isDuplicate: false,
      isQuarantined: false,
    }),
    getAnalyticsOverview: jest.fn().mockResolvedValue({ totalViews: 100, zeroLocationGuarantee: 'Zero Location' }),
    getViewsByInterestAudience: jest.fn().mockResolvedValue([]),
    getRetentionCurve: jest.fn().mockResolvedValue([]),
    getFollowersGrowth: jest.fn().mockResolvedValue([]),
    getTopReels: jest.fn().mockResolvedValue([]),
  };

  const mockStudio = {
    getLicensedSounds: jest.fn().mockResolvedValue({
      sounds: [
        { id: 'sound-1', title: 'Chill Lo-Fi', artist: 'BeatMaster', isLicensed: true, durationSeconds: 30 },
      ],
      total: 1,
    }),
    publishOrSchedule: jest.fn().mockResolvedValue({
      sessionId: 'sess-1',
      clientPublicationId: 'client-pub-123',
      status: 'PUBLISHED',
      stage: 'READY',
      progressPercent: 100,
    }),
    getPublishingStatus: jest.fn().mockResolvedValue({
      sessionId: 'sess-1',
      clientPublicationId: 'client-pub-123',
      status: 'PROCESSING',
      stage: 'TRANSCODING',
      progressPercent: 65,
    }),
    updatePublishedReel: jest.fn().mockResolvedValue({ updated: true, reelId: 'reel-1' }),
    deleteReel: jest.fn().mockResolvedValue({ deleted: true, reelId: 'reel-1' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CreatorController],
      providers: [
        { provide: CreatorDraftsService, useValue: mockDrafts },
        { provide: CreatorSchedulingService, useValue: mockScheduling },
        { provide: CreatorAnalyticsService, useValue: mockAnalytics },
        { provide: CreatorStudioService, useValue: mockStudio },
      ],
    }).compile();

    controller = module.get<CreatorController>(CreatorController);
  });

  it('should call drafts service on saveDraft', async () => {
    const res = await controller.createDraft('user-1', {
      title: 'Draft',
      editorState: { clips: [], textOverlays: [], stickers: [], filter: 'none', autoCaptions: false, playbackSpeed: 1 },
    });
    expect(res.id).toBe('draft-1');
  });

  it('should call scheduling service on scheduleReel', async () => {
    const res = await controller.scheduleReel('user-1', {
      reelId: 'reel-1',
      scheduledAt: '2026-10-15T10:00:00Z',
    });
    expect(res.scheduled).toBe(true);
  });

  it('should call analytics overview', async () => {
    const res = await controller.getAnalyticsOverview('user-1', '30');
    expect(res.totalViews).toBe(100);
    expect(res.zeroLocationGuarantee).toBe('Zero Location');
  });

  it('should return licensed sounds for creator studio', async () => {
    const res = await controller.getLicensedSounds('lofi', '10', '0');
    expect(res.sounds.length).toBe(1);
    expect(res.sounds[0].isLicensed).toBe(true);
    expect(mockStudio.getLicensedSounds).toHaveBeenCalledWith('lofi', 10, 0);
  });

  it('should publish or schedule reel with idempotency token', async () => {
    const res = await controller.publishOrSchedule('user-1', {
      clientPublicationId: 'client-pub-123',
      title: 'My Studio Reel',
      visibility: 'PUBLIC',
    });
    expect(res.clientPublicationId).toBe('client-pub-123');
    expect(res.status).toBe('PUBLISHED');
  });

  it('should recover publishing status for active session', async () => {
    const res = await controller.getPublishingStatus('user-1', 'client-pub-123');
    expect(res.status).toBe('PROCESSING');
    expect(res.progressPercent).toBe(65);
  });

  it('should update published reel metadata and delete reel', async () => {
    const updateRes = await controller.updatePublishedReel('user-1', '00000000-0000-0000-0000-000000000001', {
      title: 'New Title',
      visibility: 'FOLLOWERS_ONLY',
    });
    expect(updateRes.updated).toBe(true);

    const deleteRes = await controller.deleteReel('user-1', '00000000-0000-0000-0000-000000000001');
    expect(deleteRes.deleted).toBe(true);
  });

  it('should get verified analytics with documented counting rules and earnings', async () => {
    const res = await controller.getVerifiedAnalytics('user-1', { range: '30d' });
    expect(res.totalViews).toBe(100);
    expect(res.earnings.isFinancialAuthoritative).toBe(true);
    expect(mockAnalytics.getVerifiedAnalytics).toHaveBeenCalledWith('user-1', { range: '30d' });
  });

  it('should record engagement event and return qualifying view status', async () => {
    const res = await controller.recordEngagementEvent('user-1', {
      reelId: '00000000-0000-0000-0000-000000000001',
      durationMs: 15000,
      watchedMs: 12000,
      action: 'WATCH_COMPLETE',
      discoverySource: 'FOR_YOU',
    });
    expect(res.recorded).toBe(true);
    expect(res.isQualifyingView).toBe(true);
    expect(mockAnalytics.recordEngagementEvent).toHaveBeenCalled();
  });
});
