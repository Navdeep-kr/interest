import { Test, TestingModule } from '@nestjs/testing';
import { InteractionsController } from './interactions.controller';
import { InteractionsService } from './interactions.service';

describe('InteractionsController', () => {
  let controller: InteractionsController;
  let service: InteractionsService;

  const mockInteractionsService = {
    toggleReelLike: jest.fn().mockResolvedValue({ liked: true, likeCount: 42, reelId: 'reel-uuid' }),
    toggleCommentLike: jest.fn().mockResolvedValue({ liked: true, likeCount: 7, commentId: 'comm-uuid' }),
    getComments: jest.fn().mockResolvedValue({ items: [], totalCount: 0, hasMore: false }),
    addComment: jest.fn().mockResolvedValue({ id: 'comm-uuid', text: 'Hello' }),
    pinComment: jest.fn().mockResolvedValue({ pinned: true, commentId: 'comm-uuid' }),
    moderateComment: jest.fn().mockResolvedValue({ success: true, action: 'hide', commentId: 'comm-uuid' }),
    toggleReelSave: jest.fn().mockResolvedValue({ saved: true, saveCount: 15, reelId: 'reel-uuid' }),
    getUserCollections: jest.fn().mockResolvedValue([]),
    createCollection: jest.fn().mockResolvedValue({ id: 'col-uuid', name: 'My Reads' }),
    getCollectionReels: jest.fn().mockResolvedValue({ collection: {}, reels: [], totalCount: 0 }),
    addReelToCollection: jest.fn().mockResolvedValue({ added: true, collectionId: 'col-uuid', reelId: 'reel-uuid' }),
    removeReelFromCollection: jest.fn().mockResolvedValue({ removed: true, collectionId: 'col-uuid', reelId: 'reel-uuid' }),
    recordShare: jest.fn().mockResolvedValue({ shared: true, shareCount: 9, shareUrl: 'https://interest.app/reel/reel-uuid' }),
    toggleFollow: jest.fn().mockResolvedValue({ following: true, isMutual: false, followersCount: 100, followingCount: 50 }),
    getFollowers: jest.fn().mockResolvedValue([]),
    getFollowing: jest.fn().mockResolvedValue([]),
    getReelRemixes: jest.fn().mockResolvedValue({ originalReelId: 'reel-uuid', totalRemixes: 0, remixes: [] }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InteractionsController],
      providers: [
        {
          provide: InteractionsService,
          useValue: mockInteractionsService,
        },
      ],
    }).compile();

    controller = module.get<InteractionsController>(InteractionsController);
    service = module.get<InteractionsService>(InteractionsService);
  });

  it('should toggle reel like', async () => {
    const res = await controller.toggleReelLike('user-1', '11111111-1111-4111-a111-000000000001');
    expect(res.liked).toBe(true);
    expect(service.toggleReelLike).toHaveBeenCalledWith('user-1', '11111111-1111-4111-a111-000000000001');
  });

  it('should toggle comment like', async () => {
    const res = await controller.toggleCommentLike('user-1', '11111111-1111-4111-a111-000000000002');
    expect(res.liked).toBe(true);
    expect(service.toggleCommentLike).toHaveBeenCalledWith('user-1', '11111111-1111-4111-a111-000000000002');
  });

  it('should pin comment', async () => {
    const res = await controller.pinComment('creator-1', '11111111-1111-4111-a111-000000000002');
    expect(res.pinned).toBe(true);
  });

  it('should record share and return deep link', async () => {
    const res = await controller.recordShare('user-1', '11111111-1111-4111-a111-000000000001', { platform: 'twitter' });
    expect(res.shareUrl).toBe('https://interest.app/reel/reel-uuid');
  });

  it('should toggle user follow', async () => {
    const res = await controller.toggleFollow('user-1', '11111111-1111-4111-a111-000000000003');
    expect(res.following).toBe(true);
  });
});
