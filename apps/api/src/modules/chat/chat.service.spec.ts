import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { DatabaseService } from '../../database/database.service';
import { ChatSpamFilterService } from './chat-spam-filter.service';
import { MessageType, ConversationType } from '@interest/shared';

describe('ChatService', () => {
  let service: ChatService;
  let mockDb: any;
  let mockSpamFilter: any;

  beforeEach(async () => {
    mockDb = {
      query: jest.fn(),
      getClient: jest.fn(),
    };

    mockSpamFilter = {
      analyzeMessage: jest.fn().mockResolvedValue({
        isSpam: false,
        spamScore: 0.0,
        isMutualFollow: true,
        shouldRouteToRequests: false,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: ChatSpamFilterService, useValue: mockSpamFilter },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createGroupChat', () => {
    it('creates a multi-user group chat with creator as ADMIN and system greeting', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      mockDb.getClient.mockResolvedValue(mockClient);

      // Begin, Insert Conv, Insert Admin, Insert Member, Insert System Msg, Commit
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'group-1' }] }) // Conv
        .mockResolvedValueOnce({}) // Admin
        .mockResolvedValueOnce({}) // Member
        .mockResolvedValueOnce({}) // System msg
        .mockResolvedValueOnce({}); // COMMIT

      // getConversationDetails queries
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'group-1',
              type: 'GROUP',
              title: 'Autonomous AI Researchers',
              creator_id: 'user-admin',
              status: 'ACTIVE',
              disappearing_ttl_seconds: 86400,
              created_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // participants
        .mockResolvedValueOnce({ rows: [] }); // last message

      const res = await service.createGroupChat('user-admin', {
        title: 'Autonomous AI Researchers',
        participantUserIds: ['user-2'],
        disappearingTtlSeconds: 86400,
      });

      expect(res.id).toBe('group-1');
      expect(res.type).toBe(ConversationType.GROUP);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });
  });

  describe('sendMessage', () => {
    it('sends a voice note with waveform amplitudes and duration', async () => {
      // 1. Membership check
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'c-1', disappearing_ttl_seconds: null, status: 'ACCEPTED' }],
      });
      // 2. Insert message
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'msg-voice-1', created_at: new Date() }],
      });
      // 3. Update conv last_message_at
      mockDb.query.mockResolvedValueOnce({});
      // 4. getMessageById
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'msg-voice-1',
            conversation_id: 'c-1',
            sender_id: 'user-1',
            message_type: 'VOICE',
            voice_url: 'https://cdn.interest.app/voice/note1.aac',
            voice_duration_seconds: 14.5,
            voice_waveform: [20, 50, 85, 40, 60],
            created_at: new Date(),
            sender_username: 'dev_user',
            sender_display_name: 'Dev User',
          },
        ],
      });

      const msg = await service.sendMessage('user-1', {
        conversationId: 'c-1',
        messageType: MessageType.VOICE,
        voiceUrl: 'https://cdn.interest.app/voice/note1.aac',
        voiceDurationSeconds: 14.5,
        voiceWaveform: [20, 50, 85, 40, 60],
      });

      expect(msg.id).toBe('msg-voice-1');
      expect(msg.messageType).toBe(MessageType.VOICE);
      expect(msg.voiceMetadata).toBeDefined();
      expect(msg.voiceMetadata?.durationSeconds).toBe(14.5);
      expect(msg.voiceMetadata?.waveform).toEqual([20, 50, 85, 40, 60]);
    });

    it('sends an embedded reel in chat', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ id: 'c-1', disappearing_ttl_seconds: null, status: 'ACCEPTED' }],
        })
        .mockResolvedValueOnce({ rows: [{ id: 'msg-reel-1', created_at: new Date() }] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'msg-reel-1',
              conversation_id: 'c-1',
              sender_id: 'user-1',
              message_type: 'REEL',
              attached_reel_id: 'reel-999',
              reel_title: 'Calisthenics Form Check',
              reel_thumbnail_url: 'https://cdn.interest.app/t.jpg',
              reel_creator_username: 'bar_athlete',
              reel_interest_title: 'Calisthenics',
              created_at: new Date(),
              sender_username: 'dev_user',
              sender_display_name: 'Dev User',
            },
          ],
        });

      const msg = await service.sendMessage('user-1', {
        conversationId: 'c-1',
        messageType: MessageType.REEL,
        attachedReelId: 'reel-999',
      });

      expect(msg.messageType).toBe(MessageType.REEL);
      expect(msg.attachedReel).toBeDefined();
      expect(msg.attachedReel?.title).toBe('Calisthenics Form Check');
      expect(msg.attachedReel?.primaryInterestTitle).toBe('Calisthenics');
    });

    it('applies disappearing message TTL expiry calculation', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ id: 'c-1', disappearing_ttl_seconds: 86400, status: 'ACCEPTED' }], // 24h
        })
        .mockResolvedValueOnce({ rows: [{ id: 'msg-ephemeral-1', created_at: new Date() }] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'msg-ephemeral-1',
              conversation_id: 'c-1',
              sender_id: 'user-1',
              text: 'This message will self-destruct in 24 hours',
              message_type: 'TEXT',
              is_ephemeral: true,
              expires_at: new Date(Date.now() + 86400 * 1000),
              created_at: new Date(),
              sender_username: 'dev_user',
              sender_display_name: 'Dev User',
            },
          ],
        });

      const msg = await service.sendMessage('user-1', {
        conversationId: 'c-1',
        text: 'This message will self-destruct in 24 hours',
      });

      expect(msg.isEphemeral).toBe(true);
      expect(msg.expiresAt).toBeDefined();
    });
  });

  describe('markAsRead & Read Receipts', () => {
    it('emits read receipt if user has read_receipts_enabled = true', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ read_receipts_enabled: true }] }) // profile
        .mockResolvedValueOnce({}) // update cp
        .mockResolvedValueOnce({}); // update messages

      const res = await service.markAsRead('user-1', 'c-1');
      expect(res.readReceiptEmitted).toBe(true);
      expect(res.readAt).toBeDefined();
    });

    it('suppresses read receipt if user has read_receipts_enabled = false', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ read_receipts_enabled: false }] })
        .mockResolvedValueOnce({}); // update cp only

      const res = await service.markAsRead('user-1', 'c-1');
      expect(res.readReceiptEmitted).toBe(false);
    });
  });

  describe('respondToRequest', () => {
    it('accepts a message request moving it to ACTIVE', async () => {
      mockDb.query
        .mockResolvedValueOnce({}) // update participant
        .mockResolvedValueOnce({}); // update conv

      const res = await service.respondToRequest('user-1', 'c-1', { action: 'ACCEPT' });
      expect(res.status).toBe('ACCEPTED');
    });

    it('declines a message request moving it to REJECTED', async () => {
      mockDb.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const res = await service.respondToRequest('user-1', 'c-1', { action: 'DECLINE' });
      expect(res.status).toBe('REJECTED');
    });
  });
});
