import { Test, TestingModule } from '@nestjs/testing';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';

describe('StoriesController', () => {
  let controller: StoriesController;

  const mockService = {
    createStory: jest.fn().mockResolvedValue({
      id: 'story-1',
      mediaType: 'PHOTO',
      mediaUrl: 'https://cdn.interest.app/stories/photo1.jpg',
      caption: 'Hello Stories',
    }),
    getStoriesTray: jest.fn().mockResolvedValue([
      {
        creatorId: 'creator-1',
        username: 'alice',
        displayName: 'Alice',
        hasUnviewedStories: true,
        stories: [],
      },
    ]),
    getCreatorStories: jest.fn().mockResolvedValue([]),
    getStoryById: jest.fn().mockResolvedValue({
      id: 'story-1',
      caption: 'Hello',
    }),
    recordView: jest.fn().mockResolvedValue({ recorded: true, storyId: 'story-1' }),
    reactToStory: jest.fn().mockResolvedValue({ reacted: true, reaction: '🔥', storyId: 'story-1' }),
    replyToStory: jest.fn().mockResolvedValue({ sent: true, storyId: 'story-1', replyText: 'Cool!' }),
    reportStory: jest.fn().mockResolvedValue({ reported: true, storyId: 'story-1' }),
    deleteStory: jest.fn().mockResolvedValue({ deleted: true, storyId: 'story-1' }),
    addCloseFriend: jest.fn().mockResolvedValue({ added: true, friendId: 'friend-1' }),
    removeCloseFriend: jest.fn().mockResolvedValue({ removed: true, friendId: 'friend-1' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StoriesController],
      providers: [
        {
          provide: StoriesService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<StoriesController>(StoriesController);
  });

  it('creates story via controller', async () => {
    const res = await controller.createStory('user-1', {
      mediaType: 'PHOTO',
      mediaUrl: 'https://cdn.interest.app/stories/photo1.jpg',
      caption: 'Hello Stories',
    });
    expect(res.id).toBe('story-1');
  });

  it('retrieves stories tray', async () => {
    const tray = await controller.getStoriesTray('user-1');
    expect(tray.length).toBe(1);
    expect(tray[0].username).toBe('alice');
    expect(tray[0].hasUnviewedStories).toBe(true);
  });

  it('records view and reactions', async () => {
    const viewRes = await controller.recordView('user-1', '00000000-0000-0000-0000-000000000001', {
      progressPercent: 1.0,
      completed: true,
    });
    expect(viewRes.recorded).toBe(true);

    const reactRes = await controller.reactToStory('user-1', '00000000-0000-0000-0000-000000000001', {
      reaction: '🔥',
    });
    expect(reactRes.reacted).toBe(true);
    expect(reactRes.reaction).toBe('🔥');
  });

  it('manages close friends', async () => {
    const addRes = await controller.addCloseFriend('user-1', '00000000-0000-0000-0000-000000000002');
    expect(addRes.added).toBe(true);

    const remRes = await controller.removeCloseFriend('user-1', '00000000-0000-0000-0000-000000000002');
    expect(remRes.removed).toBe(true);
  });
});
