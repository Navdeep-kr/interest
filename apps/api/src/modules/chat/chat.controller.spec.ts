import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

describe('ChatController', () => {
  let controller: ChatController;
  let chatService: any;

  beforeEach(async () => {
    chatService = {
      getConversations: jest.fn(),
      getConversationDetails: jest.fn(),
      createDirectChat: jest.fn(),
      createGroupChat: jest.fn(),
      sendMessage: jest.fn(),
      getMessages: jest.fn(),
      markAsRead: jest.fn(),
      updateDisappearingTimer: jest.fn(),
      respondToRequest: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [{ provide: ChatService, useValue: chatService }],
    }).compile();

    controller = module.get<ChatController>(ChatController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getConversations', () => {
    it('delegates to chatService with folder and pagination', async () => {
      chatService.getConversations.mockResolvedValueOnce([]);

      const res = await controller.getConversations('user-1', {
        folder: 'requests',
        limit: 10,
        offset: 0,
      });

      expect(res).toEqual([]);
      expect(chatService.getConversations).toHaveBeenCalledWith(
        'user-1',
        'requests',
        10,
        0,
      );
    });
  });

  describe('createDirectChat', () => {
    it('creates direct chat and returns conversation', async () => {
      chatService.createDirectChat.mockResolvedValueOnce({ id: 'c-new' });

      const res = await controller.createDirectChat('user-1', {
        targetUserId: 'user-2',
        initialText: 'Hello',
      });

      expect(res.id).toBe('c-new');
      expect(chatService.createDirectChat).toHaveBeenCalledWith('user-1', {
        targetUserId: 'user-2',
        initialText: 'Hello',
      });
    });
  });

  describe('respondToRequest', () => {
    it('delegates ACCEPT action to chatService', async () => {
      chatService.respondToRequest.mockResolvedValueOnce({ status: 'ACCEPTED' });

      const res = await controller.respondToRequest('user-1', 'conv-123', {
        action: 'ACCEPT',
      });

      expect(res.status).toBe('ACCEPTED');
      expect(chatService.respondToRequest).toHaveBeenCalledWith(
        'user-1',
        'conv-123',
        { action: 'ACCEPT' },
      );
    });
  });
});
