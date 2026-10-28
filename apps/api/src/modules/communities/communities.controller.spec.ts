import { Test, TestingModule } from '@nestjs/testing';
import { CommunitiesController } from './communities.controller';
import { CommunitiesService } from './communities.service';
import { CommunityItem, CommunityMemberItem } from '@shared/types';

describe('CommunitiesController', () => {
  let controller: CommunitiesController;
  let service: CommunitiesService;

  const mockCommunitiesService = {
    createCommunity: jest.fn(),
    listCommunities: jest.fn(),
    getCommunity: jest.fn(),
    updateCommunity: jest.fn(),
    joinCommunity: jest.fn(),
    leaveCommunity: jest.fn(),
    inviteUser: jest.fn(),
    respondToInvitation: jest.fn(),
    reviewJoinRequest: jest.fn(),
    updateMemberRole: jest.fn(),
    moderateMember: jest.fn(),
    handoverOwnership: jest.fn(),
    createPost: jest.fn(),
    listPosts: jest.fn(),
    respondToCollaboration: jest.fn(),
    togglePinPost: jest.fn(),
    createCollection: jest.fn(),
    listCollections: jest.fn(),
    addReelToCollection: jest.fn(),
    reportTarget: jest.fn(),
    getModerationQueue: jest.fn(),
    reviewReport: jest.fn(),
    submitAppeal: jest.fn(),
    listAppeals: jest.fn(),
    reviewAppeal: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommunitiesController],
      providers: [
        {
          provide: CommunitiesService,
          useValue: mockCommunitiesService,
        },
      ],
    }).compile();

    controller = module.get<CommunitiesController>(CommunitiesController);
    service = module.get<CommunitiesService>(CommunitiesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('createCommunity delegates to service', async () => {
    const mockComm: CommunityItem = {
      id: 'comm-1',
      creatorId: 'user-1',
      name: 'Game Devs',
      slug: 'game-devs',
      description: 'Game developers community',
      visibility: 'PUBLIC',
      guidelines: [],
      membersCount: 1,
      postsCount: 0,
      isActive: true,
      userRole: 'OWNER',
      userStatus: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockCommunitiesService.createCommunity.mockResolvedValueOnce(mockComm);

    const res = await controller.createCommunity('user-1', {
      name: 'Game Devs',
      description: 'Game developers community',
    });

    expect(res.name).toBe('Game Devs');
    expect(mockCommunitiesService.createCommunity).toHaveBeenCalledWith('user-1', {
      name: 'Game Devs',
      description: 'Game developers community',
    });
  });

  it('joinCommunity delegates to service', async () => {
    const mockMember: CommunityMemberItem = {
      id: 'mem-1',
      communityId: 'comm-1',
      userId: 'user-2',
      user: { id: 'user-2', username: 'dev2', displayName: 'Dev 2' },
      role: 'MEMBER',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
    mockCommunitiesService.joinCommunity.mockResolvedValueOnce(mockMember);

    const res = await controller.joinCommunity('user-2', 'comm-1');
    expect(res.status).toBe('ACTIVE');
    expect(mockCommunitiesService.joinCommunity).toHaveBeenCalledWith('user-2', 'comm-1');
  });
});
