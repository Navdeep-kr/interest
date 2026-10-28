import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WsChatEvents } from '@interest/shared';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let chatService: any;
  let jwtService: any;
  let configService: any;

  beforeEach(async () => {
    chatService = {
      sendMessage: jest.fn(),
      markAsRead: jest.fn(),
      isUserParticipant: jest.fn().mockResolvedValue(true),
    };

    jwtService = {
      verifyAsync: jest.fn(),
    };

    configService = {
      get: jest.fn().mockReturnValue('mock-jwt-secret'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: ChatService, useValue: chatService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
    gateway.server = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as any;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('authenticates valid JWT token and joins user room', async () => {
      const mockSocket: any = {
        id: 'sock-1',
        handshake: {
          auth: { token: 'valid-jwt-token' },
          headers: {},
        },
        data: {},
        join: jest.fn(),
        disconnect: jest.fn(),
      };

      jwtService.verifyAsync.mockResolvedValueOnce({ sub: 'user-123' });

      await gateway.handleConnection(mockSocket);

      expect(mockSocket.data.userId).toBe('user-123');
      expect(mockSocket.join).toHaveBeenCalledWith('user:user-123');
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });

    it('disconnects socket when token is missing', async () => {
      const mockSocket: any = {
        id: 'sock-2',
        handshake: { auth: {}, headers: {} },
        disconnect: jest.fn(),
      };

      await gateway.handleConnection(mockSocket);
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleSendMessage', () => {
    it('saves message and broadcasts to conversation room', async () => {
      const mockSocket: any = {
        data: { userId: 'sender-1' },
        emit: jest.fn(),
      };

      const mockMsg = {
        id: 'm-1',
        conversationId: 'c-100',
        senderId: 'sender-1',
        text: 'Hello world',
      };

      chatService.sendMessage.mockResolvedValueOnce(mockMsg);

      await gateway.handleSendMessage(mockSocket, {
        conversationId: 'c-100',
        text: 'Hello world',
      });

      expect(chatService.sendMessage).toHaveBeenCalledWith('sender-1', {
        conversationId: 'c-100',
        text: 'Hello world',
      });

      expect(gateway.server.to).toHaveBeenCalledWith('conv:c-100');
      expect(gateway.server.emit).toHaveBeenCalledWith(
        WsChatEvents.MESSAGE_RECEIVED,
        mockMsg,
      );
      expect(mockSocket.emit).toHaveBeenCalledWith(
        WsChatEvents.MESSAGE_SENT,
        mockMsg,
      );
    });
  });

  describe('handleJoinConversation', () => {
    it('allows join when user is verified participant', async () => {
      const mockSocket: any = {
        data: { userId: 'u-1' },
        join: jest.fn(),
        emit: jest.fn(),
      };

      chatService.isUserParticipant.mockResolvedValueOnce(true);
      await gateway.handleJoinConversation(mockSocket, { conversationId: 'c-1' });

      expect(mockSocket.join).toHaveBeenCalledWith('conv:c-1');
      expect(mockSocket.emit).not.toHaveBeenCalledWith(WsChatEvents.ERROR, expect.anything());
    });

    it('rejects join and emits error when user is not a participant (BOLA Defense)', async () => {
      const mockSocket: any = {
        data: { userId: 'eavesdropper' },
        join: jest.fn(),
        emit: jest.fn(),
      };

      chatService.isUserParticipant.mockResolvedValueOnce(false);
      await gateway.handleJoinConversation(mockSocket, { conversationId: 'c-secret' });

      expect(mockSocket.join).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith(WsChatEvents.ERROR, {
        message: 'Unauthorized: You are not a participant in this conversation.',
      });
    });
  });

  describe('handleTypingStart and handleTypingStop', () => {
    it('broadcasts typing status to conversation room', async () => {
      const mockSocket: any = {
        data: { userId: 'u-1' },
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };

      await gateway.handleTypingStart(mockSocket, { conversationId: 'c-1' });

      expect(mockSocket.to).toHaveBeenCalledWith('conv:c-1');
      expect(mockSocket.emit).toHaveBeenCalledWith(WsChatEvents.USER_TYPING, {
        conversationId: 'c-1',
        userId: 'u-1',
        isTyping: true,
      });
    });
  });

  describe('handleMarkRead', () => {
    it('broadcasts read receipt if enabled', async () => {
      const mockSocket: any = {
        data: { userId: 'reader-1' },
      };

      chatService.markAsRead.mockResolvedValueOnce({
        readReceiptEmitted: true,
        readAt: '2026-10-12T12:00:00.000Z',
      });

      await gateway.handleMarkRead(mockSocket, { conversationId: 'c-1' });

      expect(chatService.markAsRead).toHaveBeenCalledWith('reader-1', 'c-1');
      expect(gateway.server.to).toHaveBeenCalledWith('conv:c-1');
      expect(gateway.server.emit).toHaveBeenCalledWith(WsChatEvents.MESSAGE_READ, {
        conversationId: 'c-1',
        userId: 'reader-1',
        readAt: '2026-10-12T12:00:00.000Z',
      });
    });
  });
});
