import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ChatService } from '../../src/modules/chat/chat.service';
import { ChatController } from '../../src/modules/chat/chat.controller';
import { DatabaseService } from '../../src/database/database.service';
import { ChatSpamFilterService } from '../../src/modules/chat/chat-spam-filter.service';
import {
  ConversationType,
  ParticipantRole,
  MessageType,
  MessageStatus,
} from '@interest/shared';

describe('Prompt 12 — Messaging, Ordering, Cross-Device Sync & Controls Gate', () => {
  let chatService: ChatService;
  let chatController: ChatController;
  let mockDatabaseService: any;
  let mockSpamFilter: any;

  const userAlice = 'user-alice-1111-4111-a111-111111111111';
  const userBob = 'user-bob-2222-4222-a222-222222222222';
  const userCharlie = 'user-charlie-3333-4333-a333-333333333333';
  const userBlocked = 'user-blocked-9999-4999-a999-999999999999';
  const conversationId = 'conv-1111-2222-3333-444444444444';

  beforeEach(async () => {
    mockDatabaseService = {
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
      controllers: [ChatController],
      providers: [
        ChatService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: ChatSpamFilterService, useValue: mockSpamFilter },
      ],
    }).compile();

    chatService = module.get<ChatService>(ChatService);
    chatController = module.get<ChatController>(ChatController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Server-Side Authorization & BOLA Prevention', () => {
    it('rejects message sending if sender is not an accepted participant', async () => {
      // Membership check returns empty
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        chatService.sendMessage(userCharlie, {
          conversationId,
          text: 'Unauthorized payload',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects history and sync access for non-participants', async () => {
      // isUserParticipant check returns empty
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        chatService.syncMessages(userCharlie, conversationId, 0, 50),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('2. Idempotency & Duplicate Send Prevention on Network Retry', () => {
    it('returns existing message without inserting row when clientMsgId matches', async () => {
      const clientMsgId = 'client-uuid-send-retry-123';

      // 1. Deduplication lookup finds existing message
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ id: 'msg-existing-1' }],
      });

      // 2. getMessageById returns full message
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'msg-existing-1',
            conversation_id: conversationId,
            sender_id: userAlice,
            text: 'Hello, this was already persisted',
            message_type: 'TEXT',
            seq_num: 14,
            client_msg_id: clientMsgId,
            status: 'SENT',
            is_edited: false,
            is_read: false,
            created_at: new Date(),
            sender_username: 'alice',
            sender_display_name: 'Alice',
          },
        ],
      });

      const res = await chatService.sendMessage(userAlice, {
        conversationId,
        text: 'Hello, this was already persisted',
        clientMsgId,
      });

      expect(res.id).toBe('msg-existing-1');
      expect(res.seqNum).toBe(14);
      expect(res.clientMsgId).toBe(clientMsgId);
      // Ensure no INSERT was called (only SELECT deduplication and SELECT getMessageById)
      expect(mockDatabaseService.query).toHaveBeenCalledTimes(2);
      expect(mockDatabaseService.query.mock.calls[0][0]).toContain('SELECT id FROM messages WHERE conversation_id = $1 AND client_msg_id = $2');
    });
  });

  describe('3. GATE VERIFICATION: Cross-Device Sync & Recovery from Network Disconnect', () => {
    it('synchronizes missed messages in strict sequence order after reconnecting with sinceSeq', async () => {
      // 1. isUserParticipant check
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] });

      // 2. Query messages with seq_num > sinceSeq (sinceSeq = 10)
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'msg-11',
            conversation_id: conversationId,
            sender_id: userAlice,
            text: 'Message 11',
            message_type: 'TEXT',
            seq_num: 11,
            status: 'SENT',
            is_edited: false,
            is_read: false,
            created_at: new Date(Date.now() - 3000),
            sender_username: 'alice',
            sender_display_name: 'Alice',
          },
          {
            id: 'msg-12',
            conversation_id: conversationId,
            sender_id: userBob,
            text: 'Message 12',
            message_type: 'TEXT',
            seq_num: 12,
            status: 'SENT',
            is_edited: false,
            is_read: false,
            created_at: new Date(Date.now() - 2000),
            sender_username: 'bob',
            sender_display_name: 'Bob',
          },
          {
            id: 'msg-13',
            conversation_id: conversationId,
            sender_id: userAlice,
            text: 'Message 13',
            message_type: 'TEXT',
            seq_num: 13,
            status: 'SENT',
            is_edited: false,
            is_read: false,
            created_at: new Date(Date.now() - 1000),
            sender_username: 'alice',
            sender_display_name: 'Alice',
          },
        ],
      });

      // 3. Query latest_seq from conversations
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ latest_seq: 13 }],
      });

      const sync = await chatService.syncMessages(userBob, conversationId, 10, 50);

      expect(sync.conversationId).toBe(conversationId);
      expect(sync.messages.length).toBe(3);
      expect(sync.messages.map((m) => m.seqNum)).toEqual([11, 12, 13]);
      expect(sync.latestSeqNum).toBe(13);
      expect(sync.hasMore).toBe(false);
    });
  });

  describe('4. Delivery & Read Receipts with Privacy Toggles', () => {
    it('marks messages delivered and records delivered_to array', async () => {
      // 1. isUserParticipant
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] });
      // 2. update messages status to DELIVERED
      mockDatabaseService.query.mockResolvedValueOnce({ rowCount: 2 });
      // 3. update cp last_delivered_message_id
      mockDatabaseService.query.mockResolvedValueOnce({ rowCount: 1 });

      const res = await chatService.markAsDelivered(userBob, conversationId, 'msg-11', 11);

      expect(res.deliveredAt).toBeDefined();
      expect(mockDatabaseService.query.mock.calls[1][0]).toContain("status = CASE WHEN status = 'SENT' THEN 'DELIVERED'");
    });

    it('emits read receipt when reader has read_receipts_enabled = true', async () => {
      // 1. profile check
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [{ read_receipts_enabled: true }] });
      // 2. update cp last_read_at and last_read_seq
      mockDatabaseService.query.mockResolvedValueOnce({ rowCount: 1 });
      // 3. update messages status = 'READ'
      mockDatabaseService.query.mockResolvedValueOnce({ rowCount: 2 });

      const res = await chatService.markAsRead(userBob, conversationId);

      expect(res.readReceiptEmitted).toBe(true);
      expect(mockDatabaseService.query.mock.calls[2][0]).toContain("status = 'READ'");
    });

    it('suppresses read receipts when reader has read_receipts_enabled = false', async () => {
      // 1. profile check
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [{ read_receipts_enabled: false }] });
      // 2. update cp last_read_at only
      mockDatabaseService.query.mockResolvedValueOnce({ rowCount: 1 });

      const res = await chatService.markAsRead(userBob, conversationId);

      expect(res.readReceiptEmitted).toBe(false);
      // Ensure messages table was not updated with reader ID
      expect(mockDatabaseService.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('5. Message Editing & Deletion Rules', () => {
    it('permits editing within 15 minutes by the original sender', async () => {
      // 1. Lookup message
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'msg-edit-1',
            sender_id: userAlice,
            created_at: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
            is_deleted_for_everyone: false,
          },
        ],
      });
      // 2. Update message
      mockDatabaseService.query.mockResolvedValueOnce({ rowCount: 1 });
      // 3. getMessageById
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'msg-edit-1',
            conversation_id: conversationId,
            sender_id: userAlice,
            text: 'Edited text update',
            message_type: 'TEXT',
            seq_num: 5,
            is_edited: true,
            edited_at: new Date(),
            status: 'SENT',
            is_read: false,
            created_at: new Date(Date.now() - 5 * 60 * 1000),
            sender_username: 'alice',
            sender_display_name: 'Alice',
          },
        ],
      });

      const res = await chatService.editMessage(userAlice, 'msg-edit-1', 'Edited text update');

      expect(res.text).toBe('Edited text update');
      expect(res.isEdited).toBe(true);
      expect(res.editedAt).toBeDefined();
    });

    it('rejects editing if message is older than 15 minutes', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'msg-old',
            sender_id: userAlice,
            created_at: new Date(Date.now() - 20 * 60 * 1000), // 20 min ago
            is_deleted_for_everyone: false,
          },
        ],
      });

      await expect(
        chatService.editMessage(userAlice, 'msg-old', 'Too late'),
      ).rejects.toThrow('within 15 minutes');
    });

    it('allows deleting for everyone within 24 hours and replaces content with deleted banner', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'msg-del-1',
            sender_id: userAlice,
            created_at: new Date(Date.now() - 2 * 3600 * 1000), // 2 hrs ago
          },
        ],
      });
      mockDatabaseService.query.mockResolvedValueOnce({ rowCount: 1 });

      const res = await chatService.deleteMessage(userAlice, 'msg-del-1', true);

      expect(res.success).toBe(true);
      expect(res.deleteForEveryone).toBe(true);
      expect(mockDatabaseService.query.mock.calls[1][0]).toContain("text = 'This message was deleted.'");
    });

    it('soft deletes message for caller only when deleteForEveryone is false', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ id: 'msg-del-2', sender_id: userAlice, created_at: new Date() }],
      });
      mockDatabaseService.query.mockResolvedValueOnce({ rowCount: 1 });

      const res = await chatService.deleteMessage(userBob, 'msg-del-2', false);

      expect(res.success).toBe(true);
      expect(res.deleteForEveryone).toBe(false);
      expect(mockDatabaseService.query.mock.calls[1][0]).toContain("deleted_for = array_append(deleted_for, $1::uuid)");
    });
  });

  describe('6. Contact Controls, Message Privacy & Blocking Invariants', () => {
    it('rejects starting direct chat if target user has blocked caller', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ 1: 1 }], // Block exists
      });

      await expect(
        chatService.createDirectChat(userAlice, { targetUserId: userBlocked }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects starting direct chat if recipient contact privacy is NOBODY', async () => {
      // 1. Block check returns empty
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [] });
      // 2. Existing chat check returns empty
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [] });
      // 3. Privacy check returns NOBODY
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ message_privacy: 'NOBODY' }],
      });

      await expect(
        chatService.createDirectChat(userAlice, { targetUserId: userBob }),
      ).rejects.toThrow('does not accept direct messages');
    });

    it('rejects direct chat if recipient contact privacy is FOLLOWERS_ONLY and caller is not a follower', async () => {
      // 1. Block check returns empty
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [] });
      // 2. Existing chat check returns empty
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [] });
      // 3. Privacy check returns FOLLOWERS_ONLY
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ message_privacy: 'FOLLOWERS_ONLY' }],
      });
      // 4. Follow check returns empty
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        chatService.createDirectChat(userAlice, { targetUserId: userBob }),
      ).rejects.toThrow('only accepts direct messages from their followers');
    });
  });

  describe('7. Group Administration & Membership Changes', () => {
    it('allows group ADMIN to add participant and inserts system event', async () => {
      // 1. Admin role check
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ type: 'GROUP', role: 'ADMIN' }],
      });
      // 2. Block check
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [] });
      // 3. Insert participant
      mockDatabaseService.query.mockResolvedValueOnce({ rowCount: 1 });
      // 4. Insert system message
      mockDatabaseService.query.mockResolvedValueOnce({ rowCount: 1 });
      // 5. getConversationDetails
      mockDatabaseService.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: conversationId,
              type: 'GROUP',
              title: 'Distributed Systems Study Group',
              creator_id: userAlice,
              status: 'ACTIVE',
              last_seq_num: 2,
              created_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await chatService.addParticipant(userAlice, conversationId, userCharlie);

      expect(res.id).toBe(conversationId);
      expect(mockDatabaseService.query.mock.calls[3][0]).toContain("'SYSTEM'");
    });

    it('rejects non-admin from removing other participants from group', async () => {
      // Role check returns MEMBER
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ type: 'GROUP', role: 'MEMBER' }],
      });

      await expect(
        chatService.removeParticipant(userBob, conversationId, userCharlie),
      ).rejects.toThrow('Only group admins can remove other participants.');
    });
  });

  describe('8. Conversation Controls: Mute, Archive & Reporting', () => {
    it('mutes conversation notifications', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({ rowCount: 1 });

      const res = await chatService.toggleMute(userAlice, conversationId, true);
      expect(res.success).toBe(true);
      expect(res.isMuted).toBe(true);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('notifications_muted = $1'),
        [true, conversationId, userAlice],
      );
    });

    it('archives conversation and moves to archived folder', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({ rowCount: 1 });

      const res = await chatService.toggleArchive(userAlice, conversationId, true);
      expect(res.success).toBe(true);
      expect(res.isArchived).toBe(true);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('is_archived = $1'),
        [true, conversationId, userAlice],
      );
    });

    it('reports message to trust & safety moderation queue', async () => {
      mockDatabaseService.query
        .mockResolvedValueOnce({ rows: [{ conversation_id: conversationId }] })
        .mockResolvedValueOnce({ rows: [{ id: 'report-msg-1' }] });

      const res = await chatService.reportMessage(userBob, 'msg-1', {
        reason: 'spam',
        details: 'Unsolicited promotion',
      });

      expect(res.success).toBe(true);
      expect(res.reportId).toBe('report-msg-1');
    });
  });
});
