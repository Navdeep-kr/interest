import { Test, TestingModule } from '@nestjs/testing';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { FeedMode, FeedControlAction } from '@shared/types';

describe('FeedController', () => {
  let controller: FeedController;
  let mockFeedService: any;

  beforeEach(async () => {
    mockFeedService = {
      getPersonalizedFeed: jest.fn().mockResolvedValue({
        items: [{ id: 'reel-1', title: 'Modular Synth Patching' }],
        prefetch: [{ id: 'reel-2', hlsMasterUrl: '...', thumbnailUrl: '...', firstSegmentUrl: '...' }],
        nextCursor: 'eyJvZmZzZXQiOjEwfQ==',
        hasMore: true,
        batchTimestamp: Date.now(),
        mode: FeedMode.FOR_YOU,
        interestFilter: null,
      }),
      applyFeedControl: jest.fn().mockImplementation((userId, dto) =>
        Promise.resolve({
          success: true,
          action: dto.action,
          message: 'Control applied successfully',
          interestId: dto.interestId,
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeedController],
      providers: [
        {
          provide: FeedService,
          useValue: mockFeedService,
        },
      ],
    }).compile();

    controller = module.get<FeedController>(FeedController);
  });

  it('should call getPersonalizedFeed with query parameters', async () => {
    const result = await controller.getFeed('user-1', { limit: 10, mode: FeedMode.FOR_YOU });

    expect(result).toBeDefined();
    expect(result.items.length).toBe(1);
    expect(mockFeedService.getPersonalizedFeed).toHaveBeenCalledWith('user-1', {
      limit: 10,
      mode: FeedMode.FOR_YOU,
    });
  });

  it('should call applyFeedControl via unified controls endpoint', async () => {
    const result = await controller.applyControl('user-1', {
      reelId: 'reel-1',
      action: FeedControlAction.SHOW_LESS,
    });

    expect(result.success).toBe(true);
    expect(result.action).toBe(FeedControlAction.SHOW_LESS);
    expect(mockFeedService.applyFeedControl).toHaveBeenCalledWith('user-1', {
      reelId: 'reel-1',
      action: FeedControlAction.SHOW_LESS,
    });
  });

  it('should support shortcut endpoint for show-less', async () => {
    const result = await controller.showLess('user-1', { reelId: 'reel-1' });

    expect(result.success).toBe(true);
    expect(mockFeedService.applyFeedControl).toHaveBeenCalledWith('user-1', {
      reelId: 'reel-1',
      action: FeedControlAction.SHOW_LESS,
      interestId: undefined,
    });
  });

  it('should support shortcut endpoint for not-interested', async () => {
    const result = await controller.notInterested('user-1', { reelId: 'reel-1' });

    expect(result.success).toBe(true);
    expect(mockFeedService.applyFeedControl).toHaveBeenCalledWith('user-1', {
      reelId: 'reel-1',
      action: FeedControlAction.NOT_INTERESTED,
      interestId: undefined,
    });
  });

  it('should support shortcut endpoint for pause-interest', async () => {
    const result = await controller.pauseInterest('user-1', {
      reelId: 'reel-1',
      interestId: 'interest-1',
    });

    expect(result.success).toBe(true);
    expect(mockFeedService.applyFeedControl).toHaveBeenCalledWith('user-1', {
      reelId: 'reel-1',
      action: FeedControlAction.PAUSE_INTEREST,
      interestId: 'interest-1',
    });
  });
});
