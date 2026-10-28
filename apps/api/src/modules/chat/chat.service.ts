import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  ConversationType,
  ConversationStatus,
  ParticipantRole,
  MessageType,
  MessageStatus,
  MessageItem,
  ConversationItem,
  ConversationParticipant,
  VoiceMetadata,
  AttachedReelPreview,
  SyncMessagesResponse,
} from '@interest/shared';
import {
  CreateDirectChatDto,
  CreateGroupChatDto,
  SendMessageDto,
  RespondRequestDto,
  ReportMessageDto,
} from './dto/chat.dto';
import { ChatSpamFilterService } from './chat-spam-filter.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly spamFilterService: ChatSpamFilterService,
  ) {}

  /**
   * Lists conversations for a user partitioned into folders:
   * - 'primary': Active chats
   * - 'requests': Non-mutual stranger message requests & spam filter queue
   * - 'archived': Archived threads
   */
  async getConversations(
    userId: string,
    folder: 'primary' | 'requests' | 'archived' = 'primary',
    limit = 20,
    offset = 0,
  ): Promise<ConversationItem[]> {
    let statusFilterClause = `cp.status = 'ACCEPTED' AND c.status = 'ACTIVE' AND cp.is_archived = FALSE`;
    if (folder === 'requests') {
      statusFilterClause = `(cp.status = 'PENDING' OR c.status = 'PENDING') AND c.status != 'REJECTED'`;
    } else if (folder === 'archived') {
      statusFilterClause = `(cp.is_archived = TRUE OR c.status = 'ARCHIVED')`;
    }

    const sql = `
      SELECT
        c.id,
        c.type,
        c.title,
        c.avatar_url,
        c.creator_id,
        c.status,
        c.disappearing_ttl_seconds,
        c.last_message_at,
        c.last_seq_num,
        c.last_message_preview,
        c.created_at,
        cp.last_read_at,
        cp.notifications_muted,
        cp.is_archived,
        -- Compute unread count
        (
          SELECT COUNT(*)
          FROM messages m
          WHERE m.conversation_id = c.id
            AND m.sender_id != $1
            AND (m.expires_at IS NULL OR m.expires_at > NOW())
            AND NOT ($1::uuid = ANY(m.deleted_for))
            AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)
        ) AS unread_count
      FROM conversations c
      JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = $1
      WHERE ${statusFilterClause}
        AND (cp.deleted_conversation_at IS NULL OR c.last_message_at > cp.deleted_conversation_at)
      ORDER BY c.last_message_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await this.databaseService.query(sql, [userId, limit, offset]);
    const conversations: ConversationItem[] = [];

    for (const row of result.rows) {
      const participants = await this.getConversationParticipants(row.id);
      const lastMessage = await this.getLastMessage(row.id);

      // Determine display title for direct chat
      let displayTitle = row.title;
      let displayAvatar = row.avatar_url;
      if (row.type === ConversationType.DIRECT) {
        const otherParticipant = participants.find((p) => p.userId !== userId);
        if (otherParticipant) {
          displayTitle = otherParticipant.displayName || otherParticipant.username;
          displayAvatar = otherParticipant.avatarUrl;
        }
      }

      conversations.push({
        id: row.id,
        type: row.type as ConversationType,
        title: displayTitle || 'Conversation',
        avatarUrl: displayAvatar || undefined,
        creatorId: row.creator_id || undefined,
        status: row.status as ConversationStatus,
        participants,
        lastMessage: lastMessage || undefined,
        lastMessageAt: (row.last_message_at || row.created_at).toISOString(),
        lastSeqNum: Number(row.last_seq_num || 0),
        lastMessagePreview: row.last_message_preview || undefined,
        unreadCount: Number(row.unread_count || 0),
        disappearingTtlSeconds: row.disappearing_ttl_seconds || null,
        isMuted: Boolean(row.notifications_muted),
        isArchived: Boolean(row.is_archived),
        isSpamRequest: folder === 'requests' && Number(row.unread_count || 0) > 0,
        createdAt: row.created_at.toISOString(),
      });
    }

    return conversations;
  }

  /**
   * Fetches full details for a conversation thread.
   */
  async getConversationDetails(
    userId: string,
    conversationId: string,
  ): Promise<ConversationItem> {
    const checkSql = `
      SELECT c.*, cp.last_read_at, cp.notifications_muted, cp.is_archived
      FROM conversations c
      JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = $1
      WHERE c.id = $2;
    `;
    const res = await this.databaseService.query(checkSql, [userId, conversationId]);
    if (res.rows.length === 0) {
      throw new NotFoundException('Conversation not found or access denied.');
    }

    const row = res.rows[0];
    const participants = await this.getConversationParticipants(conversationId);
    const lastMessage = await this.getLastMessage(conversationId);

    let displayTitle = row.title;
    let displayAvatar = row.avatar_url;
    if (row.type === ConversationType.DIRECT) {
      const otherParticipant = participants.find((p) => p.userId !== userId);
      if (otherParticipant) {
        displayTitle = otherParticipant.displayName || otherParticipant.username;
        displayAvatar = otherParticipant.avatarUrl;
      }
    }

    return {
      id: row.id,
      type: row.type as ConversationType,
      title: displayTitle || 'Chat',
      avatarUrl: displayAvatar || undefined,
      creatorId: row.creator_id || undefined,
      status: row.status as ConversationStatus,
      participants,
      lastMessage: lastMessage || undefined,
      lastMessageAt: (row.last_message_at || row.created_at).toISOString(),
      lastSeqNum: Number(row.last_seq_num || 0),
      lastMessagePreview: row.last_message_preview || undefined,
      unreadCount: 0,
      disappearingTtlSeconds: row.disappearing_ttl_seconds || null,
      isMuted: Boolean(row.notifications_muted),
      isArchived: Boolean(row.is_archived),
      createdAt: row.created_at.toISOString(),
    };
  }

  /**
   * Creates or resumes a 1:1 Direct Chat.
   * Enforces bidirectional block suppression and contact privacy controls.
   */
  async createDirectChat(
    senderId: string,
    dto: CreateDirectChatDto,
  ): Promise<ConversationItem> {
    if (senderId === dto.targetUserId) {
      throw new BadRequestException('Cannot start a direct conversation with yourself.');
    }

    // 1. Verify blocks constraint (bidirectional)
    const blockCheck = await this.databaseService.query(
      `SELECT 1 FROM blocks
       WHERE (blocker_id = $1 AND blocked_id = $2)
          OR (blocker_id = $2 AND blocked_id = $1)`,
      [senderId, dto.targetUserId],
    );
    if (blockCheck.rows.length > 0) {
      throw new ForbiddenException('Cannot start conversation due to block or privacy restrictions.');
    }

    // 2. Check if conversation already exists
    const existingSql = `
      SELECT c.id
      FROM conversations c
      JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = $1
      JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = $2
      WHERE c.type = 'DIRECT'
      LIMIT 1;
    `;
    const existingRes = await this.databaseService.query(existingSql, [senderId, dto.targetUserId]);

    if (existingRes.rows.length > 0) {
      const conversationId = existingRes.rows[0].id;
      if (dto.initialText || dto.initialReelId) {
        await this.sendMessage(senderId, {
          conversationId,
          text: dto.initialText,
          attachedReelId: dto.initialReelId,
          messageType: dto.initialReelId ? MessageType.REEL : MessageType.TEXT,
        });
      }
      return this.getConversationDetails(senderId, conversationId);
    }

    // 3. Contact privacy check on target user
    const targetProfileRes = await this.databaseService.query(
      `SELECT message_privacy, read_receipts_enabled FROM profiles WHERE user_id = $1`,
      [dto.targetUserId],
    );
    const targetPrivacy = targetProfileRes.rows[0]?.message_privacy || 'EVERYONE';

    if (targetPrivacy === 'NOBODY') {
      throw new ForbiddenException('This user does not accept direct messages.');
    }

    if (targetPrivacy === 'FOLLOWERS_ONLY') {
      const followRes = await this.databaseService.query(
        `SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2`,
        [senderId, dto.targetUserId],
      );
      if (followRes.rows.length === 0) {
        throw new ForbiddenException('This user only accepts direct messages from their followers.');
      }
    }

    // 4. Perform spam & message request analysis
    const spamAnalysis = await this.spamFilterService.analyzeMessage(
      senderId,
      dto.targetUserId,
      dto.initialText,
    );

    // 4b. Minor-safety policy: strangers cannot DM minors under 18
    const targetUserRes = await this.databaseService.query(
      `SELECT is_minor FROM users WHERE id = $1`,
      [dto.targetUserId],
    );
    if (
      targetUserRes.rows.length > 0 &&
      targetUserRes.rows[0].is_minor &&
      !spamAnalysis.isMutualFollow
    ) {
      throw new ForbiddenException(
        'Minor safety restriction: Direct messages from non-mutual strangers are disabled for accounts under 18.',
      );
    }

    const client = await this.databaseService.getClient();
    try {
      await client.query('BEGIN');

      const initialStatus = spamAnalysis.shouldRouteToRequests
        ? ConversationStatus.PENDING
        : ConversationStatus.ACTIVE;

      const convRes = await client.query(
        `INSERT INTO conversations (type, creator_id, status, last_message_at, last_seq_num)
         VALUES ('DIRECT', $1, $2, NOW(), 0)
         RETURNING id`,
        [senderId, initialStatus],
      );
      const conversationId = convRes.rows[0].id;

      // Add sender participant (accepted)
      await client.query(
        `INSERT INTO conversation_participants (conversation_id, user_id, role, status)
         VALUES ($1, $2, 'MEMBER', 'ACCEPTED')`,
        [conversationId, senderId],
      );

      // Add recipient participant (status depends on spam/request routing)
      const recipientStatus = spamAnalysis.shouldRouteToRequests ? 'PENDING' : 'ACCEPTED';
      await client.query(
        `INSERT INTO conversation_participants (conversation_id, user_id, role, status)
         VALUES ($1, $2, 'MEMBER', $3)`,
        [conversationId, dto.targetUserId, recipientStatus],
      );

      await client.query('COMMIT');

      // Send initial message if provided
      if (dto.initialText || dto.initialReelId) {
        await this.sendMessage(senderId, {
          conversationId,
          text: dto.initialText,
          attachedReelId: dto.initialReelId,
          messageType: dto.initialReelId ? MessageType.REEL : MessageType.TEXT,
        });
      }

      return this.getConversationDetails(senderId, conversationId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Creates a Multi-User Group Chat.
   */
  async createGroupChat(
    creatorId: string,
    dto: CreateGroupChatDto,
  ): Promise<ConversationItem> {
    const client = await this.databaseService.getClient();
    try {
      await client.query('BEGIN');

      const convRes = await client.query(
        `INSERT INTO conversations (type, title, avatar_url, creator_id, status, disappearing_ttl_seconds, last_message_at, last_seq_num)
         VALUES ('GROUP', $1, $2, $3, 'ACTIVE', $4, NOW(), 1)
         RETURNING id`,
        [dto.title, dto.avatarUrl || null, creatorId, dto.disappearingTtlSeconds || null],
      );
      const conversationId = convRes.rows[0].id;

      // Add creator as ADMIN
      await client.query(
        `INSERT INTO conversation_participants (conversation_id, user_id, role, status)
         VALUES ($1, $2, 'ADMIN', 'ACCEPTED')`,
        [conversationId, creatorId],
      );

      // Add other participants
      const uniqueParticipants = Array.from(new Set(dto.participantUserIds)).filter(
        (id) => id !== creatorId,
      );

      for (const pId of uniqueParticipants) {
        await client.query(
          `INSERT INTO conversation_participants (conversation_id, user_id, role, status)
           VALUES ($1, $2, 'MEMBER', 'ACCEPTED')
           ON CONFLICT DO NOTHING`,
          [conversationId, pId],
        );
      }

      // System greeting message
      await client.query(
        `INSERT INTO messages (conversation_id, sender_id, text, message_type, seq_num)
         VALUES ($1, $2, $3, 'SYSTEM', 1)`,
        [conversationId, creatorId, `Group "${dto.title}" created.`],
      );

      await client.query('COMMIT');
      return this.getConversationDetails(creatorId, conversationId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Sends a message with reliable ordering, sequence numbering, idempotency key,
   * and secure media/reel attachment.
   */
  async sendMessage(senderId: string, dto: SendMessageDto): Promise<MessageItem> {
    // 0. Idempotency deduplication check: if client_msg_id already delivered, return existing message
    if (dto.clientMsgId) {
      const existing = await this.databaseService.query(
        `SELECT id FROM messages WHERE conversation_id = $1 AND client_msg_id = $2`,
        [dto.conversationId, dto.clientMsgId],
      );
      if (existing.rows.length > 0) {
        return this.getMessageById(existing.rows[0].id);
      }
    }

    // 1. Verify sender is active participant in conversation
    const memberCheck = await this.databaseService.query(
      `SELECT c.id, c.disappearing_ttl_seconds, cp.status
       FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = $1
       WHERE c.id = $2`,
      [senderId, dto.conversationId],
    );

    if (memberCheck.rows.length === 0) {
      throw new ForbiddenException('You are not a participant in this conversation.');
    }

    const { disappearing_ttl_seconds } = memberCheck.rows[0];

    // Calculate disappearing message expiration timestamp
    const effectiveTtl = dto.expiresInSeconds || disappearing_ttl_seconds;
    let expiresAt: Date | null = null;
    let isEphemeral = false;

    if (effectiveTtl && effectiveTtl > 0) {
      expiresAt = new Date(Date.now() + effectiveTtl * 1000);
      isEphemeral = true;
    }

    const messageType = dto.messageType || MessageType.TEXT;
    const voiceWaveformJson = dto.voiceWaveform ? JSON.stringify(dto.voiceWaveform) : '[]';

    const insertSql = `
      INSERT INTO messages (
        conversation_id,
        sender_id,
        text,
        message_type,
        voice_url,
        voice_duration_seconds,
        voice_waveform,
        attached_reel_id,
        media_url,
        media_type,
        client_msg_id,
        seq_num,
        status,
        expires_at,
        is_ephemeral,
        read_by
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11,
        (SELECT COALESCE(MAX(seq_num), 0) + 1 FROM messages WHERE conversation_id = $1),
        'SENT',
        $12, $13, ARRAY[$2]::uuid[]
      )
      RETURNING id, created_at, seq_num;
    `;

    const res = await this.databaseService.query(insertSql, [
      dto.conversationId,
      senderId,
      dto.text || null,
      messageType,
      dto.voiceUrl || null,
      dto.voiceDurationSeconds || null,
      voiceWaveformJson,
      dto.attachedReelId || null,
      dto.mediaUrl || null,
      dto.mediaType || null,
      dto.clientMsgId || null,
      expiresAt,
      isEphemeral,
    ]);

    const messageId = res.rows[0].id;
    const createdAt = res.rows[0].created_at;
    const seqNum = Number(res.rows[0].seq_num || 0);

    // Update conversation last_message_at, preview, and sequence counter
    const preview = dto.text || (dto.voiceUrl ? '🎤 Voice note' : dto.attachedReelId ? '🎬 Shared reel' : 'Attachment');
    await this.databaseService.query(
      `UPDATE conversations
       SET last_message_at = $1,
           last_seq_num = GREATEST(last_seq_num, $2),
           last_message_preview = $3,
           last_message_sender_id = $4
       WHERE id = $5`,
      [createdAt, seqNum, preview, senderId, dto.conversationId],
    );

    // Fetch full populated message with sender info and reel preview
    return this.getMessageById(messageId);
  }

  /**
   * Cross-device synchronization endpoint:
   * Returns ordered messages after `sinceSeq` without duplicate sends or gaps.
   */
  async syncMessages(
    userId: string,
    conversationId: string,
    sinceSeq = 0,
    limit = 50,
  ): Promise<SyncMessagesResponse> {
    const isMember = await this.isUserParticipant(userId, conversationId);
    if (!isMember) {
      throw new ForbiddenException('Access denied to this conversation sync.');
    }

    const sql = `
      SELECT
        m.id, m.conversation_id, m.sender_id, m.text, m.message_type,
        m.voice_url, m.voice_duration_seconds, m.voice_waveform,
        m.attached_reel_id, m.media_url, m.media_type, m.seq_num,
        m.client_msg_id, m.status, m.is_edited, m.edited_at,
        m.is_read, m.read_by, m.read_at, m.delivered_to, m.delivered_at,
        m.is_ephemeral, m.expires_at, m.is_deleted_for_everyone, m.created_at,
        p.username AS sender_username,
        p.display_name AS sender_display_name,
        p.avatar_url AS sender_avatar_url,
        r.title AS reel_title,
        r.thumbnail_url AS reel_thumbnail_url,
        rp.username AS reel_creator_username,
        ri_title.title AS reel_interest_title
      FROM messages m
      JOIN profiles p ON p.user_id = m.sender_id
      LEFT JOIN reels r ON r.id = m.attached_reel_id
      LEFT JOIN profiles rp ON rp.user_id = r.creator_id
      LEFT JOIN reel_interests rim ON rim.reel_id = r.id AND rim.is_primary = TRUE
      LEFT JOIN interests ri_title ON ri_title.id = rim.interest_id
      WHERE m.conversation_id = $1
        AND m.seq_num > $2
        AND (m.expires_at IS NULL OR m.expires_at > NOW())
        AND NOT ($3::uuid = ANY(m.deleted_for))
      ORDER BY m.seq_num ASC
      LIMIT $4;
    `;

    const res = await this.databaseService.query(sql, [conversationId, sinceSeq, userId, limit]);
    const messages = res.rows.map((row) => this.mapMessageRow(row));

    const latestSeqRes = await this.databaseService.query(
      `SELECT COALESCE(last_seq_num, 0) AS latest_seq FROM conversations WHERE id = $1`,
      [conversationId],
    );
    const latestSeqNum = Number(latestSeqRes.rows[0]?.latest_seq || 0);
    const lastReturnedSeq = messages.length > 0 ? messages[messages.length - 1].seqNum : sinceSeq;
    const hasMore = lastReturnedSeq < latestSeqNum;

    return {
      conversationId,
      messages,
      latestSeqNum,
      hasMore,
    };
  }

  /**
   * Marks messages as delivered (updates status from SENT -> DELIVERED).
   */
  async markAsDelivered(
    userId: string,
    conversationId: string,
    messageId?: string,
    seqNum?: number,
  ): Promise<{ deliveredAt: string }> {
    const isMember = await this.isUserParticipant(userId, conversationId);
    if (!isMember) {
      throw new ForbiddenException('Access denied to conversation.');
    }

    const now = new Date();
    await this.databaseService.query(
      `UPDATE messages
       SET status = CASE WHEN status = 'SENT' THEN 'DELIVERED' ELSE status END,
           delivered_at = COALESCE(delivered_at, $1),
           delivered_to = array_append(delivered_to, $2::uuid)
       WHERE conversation_id = $3
         AND sender_id != $2
         AND NOT ($2::uuid = ANY(delivered_to))
         ${messageId ? 'AND id = $4::uuid' : seqNum ? 'AND seq_num <= $4' : ''}`,
      messageId ? [now, userId, conversationId, messageId] : seqNum ? [now, userId, conversationId, seqNum] : [now, userId, conversationId],
    );

    await this.databaseService.query(
      `UPDATE conversation_participants
       SET last_delivered_message_id = COALESCE($1::uuid, last_delivered_message_id)
       WHERE conversation_id = $2 AND user_id = $3`,
      [messageId || null, conversationId, userId],
    );

    return { deliveredAt: now.toISOString() };
  }

  /**
   * Edits a message (within 15-minute window, sender only).
   */
  async editMessage(
    userId: string,
    messageId: string,
    newText: string,
  ): Promise<MessageItem> {
    const cleanText = newText.trim();
    if (!cleanText) {
      throw new BadRequestException('Message text cannot be empty.');
    }

    const msgRes = await this.databaseService.query(
      `SELECT id, sender_id, created_at, is_deleted_for_everyone FROM messages WHERE id = $1`,
      [messageId],
    );

    if (msgRes.rows.length === 0) {
      throw new NotFoundException('Message not found.');
    }

    const msg = msgRes.rows[0];
    if (msg.sender_id !== userId) {
      throw new ForbiddenException('You can only edit messages sent by you.');
    }

    if (msg.is_deleted_for_everyone) {
      throw new BadRequestException('Cannot edit a deleted message.');
    }

    const ageMs = Date.now() - new Date(msg.created_at).getTime();
    if (ageMs > 15 * 60 * 1000) {
      throw new BadRequestException('Messages can only be edited within 15 minutes of sending.');
    }

    await this.databaseService.query(
      `UPDATE messages
       SET text = $1, is_edited = TRUE, edited_at = NOW()
       WHERE id = $2`,
      [cleanText, messageId],
    );

    return this.getMessageById(messageId);
  }

  /**
   * Deletes a message (delete for everyone within 24h, or soft-delete for me).
   */
  async deleteMessage(
    userId: string,
    messageId: string,
    deleteForEveryone = false,
  ): Promise<{ success: boolean; messageId: string; deleteForEveryone: boolean }> {
    const msgRes = await this.databaseService.query(
      `SELECT id, sender_id, created_at FROM messages WHERE id = $1`,
      [messageId],
    );

    if (msgRes.rows.length === 0) {
      throw new NotFoundException('Message not found.');
    }

    const msg = msgRes.rows[0];

    if (deleteForEveryone) {
      if (msg.sender_id !== userId) {
        throw new ForbiddenException('Only the sender can delete a message for everyone.');
      }

      const ageMs = Date.now() - new Date(msg.created_at).getTime();
      if (ageMs > 24 * 60 * 60 * 1000) {
        throw new BadRequestException('Messages can only be deleted for everyone within 24 hours.');
      }

      await this.databaseService.query(
        `UPDATE messages
         SET is_deleted_for_everyone = TRUE,
             text = 'This message was deleted.',
             media_url = NULL,
             voice_url = NULL
         WHERE id = $1`,
        [messageId],
      );
    } else {
      await this.databaseService.query(
        `UPDATE messages
         SET deleted_for = array_append(deleted_for, $1::uuid)
         WHERE id = $2 AND NOT ($1::uuid = ANY(deleted_for))`,
        [userId, messageId],
      );
    }

    return { success: true, messageId, deleteForEveryone };
  }

  /**
   * Adds participant to group (Admin only).
   */
  async addParticipant(adminUserId: string, conversationId: string, targetUserId: string) {
    const roleCheck = await this.databaseService.query(
      `SELECT c.type, cp.role
       FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = $1
       WHERE c.id = $2`,
      [adminUserId, conversationId],
    );

    if (roleCheck.rows.length === 0 || roleCheck.rows[0].type !== 'GROUP') {
      throw new BadRequestException('Participants can only be added to group conversations.');
    }

    if (roleCheck.rows[0].role !== 'ADMIN') {
      throw new ForbiddenException('Only group admins can add participants.');
    }

    // Check blocks
    const blockCheck = await this.databaseService.query(
      `SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`,
      [adminUserId, targetUserId],
    );
    if (blockCheck.rows.length > 0) {
      throw new ForbiddenException('Cannot add this user due to block restrictions.');
    }

    await this.databaseService.query(
      `INSERT INTO conversation_participants (conversation_id, user_id, role, status)
       VALUES ($1, $2, 'MEMBER', 'ACCEPTED')
       ON CONFLICT (conversation_id, user_id) DO UPDATE SET status = 'ACCEPTED'`,
      [conversationId, targetUserId],
    );

    // System event message
    await this.databaseService.query(
      `INSERT INTO messages (conversation_id, sender_id, text, message_type)
       VALUES ($1, $2, 'Participant added to group.', 'SYSTEM')`,
      [conversationId, adminUserId],
    );

    return this.getConversationDetails(adminUserId, conversationId);
  }

  /**
   * Removes participant or leaves group.
   */
  async removeParticipant(adminUserId: string, conversationId: string, targetUserId: string) {
    const roleCheck = await this.databaseService.query(
      `SELECT c.type, cp.role
       FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = $1
       WHERE c.id = $2`,
      [adminUserId, conversationId],
    );

    if (roleCheck.rows.length === 0 || roleCheck.rows[0].type !== 'GROUP') {
      throw new BadRequestException('Only applicable to group conversations.');
    }

    if (adminUserId !== targetUserId && roleCheck.rows[0].role !== 'ADMIN') {
      throw new ForbiddenException('Only group admins can remove other participants.');
    }

    await this.databaseService.query(
      `DELETE FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, targetUserId],
    );

    await this.databaseService.query(
      `INSERT INTO messages (conversation_id, sender_id, text, message_type)
       VALUES ($1, $2, 'Participant left the group.', 'SYSTEM')`,
      [conversationId, targetUserId],
    );

    return { success: true, removedUserId: targetUserId };
  }

  /**
   * Updates participant role (Admin promotion/demotion).
   */
  async updateParticipantRole(
    adminUserId: string,
    conversationId: string,
    targetUserId: string,
    role: ParticipantRole,
  ) {
    const adminCheck = await this.databaseService.query(
      `SELECT role FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, adminUserId],
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'ADMIN') {
      throw new ForbiddenException('Only group admins can change participant roles.');
    }

    await this.databaseService.query(
      `UPDATE conversation_participants SET role = $1 WHERE conversation_id = $2 AND user_id = $3`,
      [role, conversationId, targetUserId],
    );

    return { success: true, userId: targetUserId, role };
  }

  /**
   * Toggles notification mute for thread.
   */
  async toggleMute(userId: string, conversationId: string, isMuted: boolean) {
    await this.databaseService.query(
      `UPDATE conversation_participants SET notifications_muted = $1 WHERE conversation_id = $2 AND user_id = $3`,
      [isMuted, conversationId, userId],
    );
    return { success: true, isMuted };
  }

  /**
   * Toggles archive status for thread.
   */
  async toggleArchive(userId: string, conversationId: string, isArchived: boolean) {
    await this.databaseService.query(
      `UPDATE conversation_participants SET is_archived = $1 WHERE conversation_id = $2 AND user_id = $3`,
      [isArchived, conversationId, userId],
    );
    return { success: true, isArchived };
  }

  /**
   * Soft deletes conversation view for user.
   */
  async deleteConversation(userId: string, conversationId: string) {
    await this.databaseService.query(
      `UPDATE conversation_participants SET deleted_conversation_at = NOW() WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, userId],
    );
    return { success: true, conversationId };
  }

  /**
   * Reports a message for moderation.
   */
  async reportMessage(reporterId: string, messageId: string, dto: ReportMessageDto) {
    const msg = await this.databaseService.query(
      `SELECT conversation_id FROM messages WHERE id = $1`,
      [messageId],
    );
    if (msg.rows.length === 0) {
      throw new NotFoundException('Message not found.');
    }

    const res = await this.databaseService.query(
      `INSERT INTO message_reports (reporter_id, message_id, conversation_id, reason, details)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [reporterId, messageId, msg.rows[0].conversation_id, dto.reason, dto.details || null],
    );

    return { success: true, reportId: res.rows[0].id };
  }

  /**
   * Updates contact privacy controls in profile.
   */
  async updateContactPrivacy(userId: string, messagePrivacy: string) {
    await this.databaseService.query(
      `UPDATE profiles SET message_privacy = $1 WHERE user_id = $2`,
      [messagePrivacy, userId],
    );
    return { success: true, messagePrivacy };
  }

  /**
   * Global unread badge count across all active conversations.
   */
  async getGlobalUnreadCount(userId: string): Promise<number> {
    const res = await this.databaseService.query(
      `SELECT COUNT(*)::int AS count
       FROM messages m
       JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = $1
       WHERE cp.status = 'ACCEPTED'
         AND cp.is_archived = FALSE
         AND m.sender_id != $1
         AND (m.expires_at IS NULL OR m.expires_at > NOW())
         AND NOT ($1::uuid = ANY(m.deleted_for))
         AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)`,
      [userId],
    );
    return Number(res.rows[0]?.count || 0);
  }

  /**
   * Verifies if a user is an active, accepted participant in a conversation.
   * Defends against Broken Object Level Authorization (BOLA).
   */
  async isUserParticipant(userId: string, conversationId: string): Promise<boolean> {
    const res = await this.databaseService.query(
      `SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2 AND status = 'ACCEPTED'`,
      [conversationId, userId],
    );
    return res.rows.length > 0;
  }

  /**
   * Fetches message history for a conversation.
   * Automatically filters out expired disappearing messages.
   */
  async getMessages(
    userId: string,
    conversationId: string,
    limit = 50,
    beforeCursor?: string,
  ): Promise<MessageItem[]> {
    // Verify membership
    const isMember = await this.isUserParticipant(userId, conversationId);
    if (!isMember) {
      throw new ForbiddenException('Access denied to this conversation history.');
    }

    const cursorClause = beforeCursor ? `AND m.created_at < $4` : '';
    const params: any[] = [conversationId, limit, userId];
    if (beforeCursor) params.push(beforeCursor);

    const sql = `
      SELECT
        m.id,
        m.conversation_id,
        m.sender_id,
        m.text,
        m.message_type,
        m.voice_url,
        m.voice_duration_seconds,
        m.voice_waveform,
        m.attached_reel_id,
        m.media_url,
        m.media_type,
        m.seq_num,
        m.client_msg_id,
        m.status,
        m.is_edited,
        m.edited_at,
        m.is_read,
        m.read_by,
        m.read_at,
        m.delivered_to,
        m.delivered_at,
        m.is_ephemeral,
        m.expires_at,
        m.is_deleted_for_everyone,
        m.created_at,
        p.username AS sender_username,
        p.display_name AS sender_display_name,
        p.avatar_url AS sender_avatar_url,
        r.title AS reel_title,
        r.thumbnail_url AS reel_thumbnail_url,
        rp.username AS reel_creator_username,
        ri_title.title AS reel_interest_title
      FROM messages m
      JOIN profiles p ON p.user_id = m.sender_id
      LEFT JOIN reels r ON r.id = m.attached_reel_id
      LEFT JOIN profiles rp ON rp.user_id = r.creator_id
      LEFT JOIN reel_interests rim ON rim.reel_id = r.id AND rim.is_primary = TRUE
      LEFT JOIN interests ri_title ON ri_title.id = rim.interest_id
      WHERE m.conversation_id = $1
        AND (m.expires_at IS NULL OR m.expires_at > NOW())
        AND NOT ($3::uuid = ANY(m.deleted_for))
        ${cursorClause}
      ORDER BY m.seq_num ASC, m.created_at ASC
      LIMIT $2;
    `;

    const res = await this.databaseService.query(sql, params);
    return res.rows.map((row) => this.mapMessageRow(row));
  }

  /**
   * Marks messages as read.
   * Evaluates user's read_receipts_enabled privacy setting:
   * If enabled, appends user to read_by array and emits receipt.
   * If disabled, silently marks participant last_read_at without broadcasting receipts.
   */
  async markAsRead(
    userId: string,
    conversationId: string,
  ): Promise<{ readReceiptEmitted: boolean; readAt: string }> {
    const profileRes = await this.databaseService.query(
      `SELECT read_receipts_enabled FROM profiles WHERE user_id = $1`,
      [userId],
    );
    const readReceiptsEnabled = profileRes.rows[0]?.read_receipts_enabled !== false;
    const now = new Date();

    // 1. Update participant last_read_at and last_read_seq
    await this.databaseService.query(
      `UPDATE conversation_participants
       SET last_read_at = $1,
           last_read_seq = (SELECT COALESCE(MAX(seq_num), 0) FROM messages WHERE conversation_id = $2)
       WHERE conversation_id = $2 AND user_id = $3`,
      [now, conversationId, userId],
    );

    // 2. If user has read receipts enabled, record reader on messages and update status to READ
    if (readReceiptsEnabled) {
      await this.databaseService.query(
        `UPDATE messages
         SET is_read = TRUE,
             status = 'READ',
             read_at = COALESCE(read_at, $1),
             read_by = array_append(read_by, $2::uuid)
         WHERE conversation_id = $3
           AND sender_id != $2
           AND NOT ($2::uuid = ANY(read_by))`,
        [now, userId, conversationId],
      );
    }

    return {
      readReceiptEmitted: readReceiptsEnabled,
      readAt: now.toISOString(),
    };
  }

  /**
   * Updates disappearing message timer for a conversation.
   */
  async updateDisappearingTimer(
    userId: string,
    conversationId: string,
    ttlSeconds: number | null,
  ): Promise<{ disappearingTtlSeconds: number | null }> {
    await this.databaseService.query(
      `UPDATE conversations SET disappearing_ttl_seconds = $1 WHERE id = $2`,
      [ttlSeconds || null, conversationId],
    );

    // Insert system notification
    const ttlLabel =
      ttlSeconds === 86400
        ? '24 hours'
        : ttlSeconds === 604800
        ? '7 days'
        : ttlSeconds === 2592000
        ? '30 days'
        : ttlSeconds
        ? `${ttlSeconds} seconds`
        : 'off';

    await this.databaseService.query(
      `INSERT INTO messages (conversation_id, sender_id, text, message_type)
       VALUES ($1, $2, $3, 'SYSTEM')`,
      [conversationId, userId, `Disappearing messages set to ${ttlLabel}.`],
    );

    return { disappearingTtlSeconds: ttlSeconds || null };
  }

  /**
   * Responds to a Message Request: ACCEPT, DECLINE, or BLOCK.
   */
  async respondToRequest(
    userId: string,
    conversationId: string,
    dto: RespondRequestDto,
  ): Promise<{ status: string }> {
    if (dto.action === 'ACCEPT') {
      await this.databaseService.query(
        `UPDATE conversation_participants SET status = 'ACCEPTED' WHERE conversation_id = $1 AND user_id = $2`,
        [conversationId, userId],
      );
      await this.databaseService.query(
        `UPDATE conversations SET status = 'ACTIVE' WHERE id = $1`,
        [conversationId],
      );
      return { status: 'ACCEPTED' };
    }

    if (dto.action === 'DECLINE') {
      await this.databaseService.query(
        `UPDATE conversation_participants SET status = 'REJECTED' WHERE conversation_id = $1 AND user_id = $2`,
        [conversationId, userId],
      );
      await this.databaseService.query(
        `UPDATE conversations SET status = 'REJECTED' WHERE id = $1`,
        [conversationId],
      );
      return { status: 'REJECTED' };
    }

    if (dto.action === 'BLOCK') {
      // Find other participant
      const otherUserRes = await this.databaseService.query(
        `SELECT user_id FROM conversation_participants WHERE conversation_id = $1 AND user_id != $2 LIMIT 1`,
        [conversationId, userId],
      );
      if (otherUserRes.rows.length > 0) {
        const otherUserId = otherUserRes.rows[0].user_id;
        await this.databaseService.query(
          `INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [userId, otherUserId],
        );
      }
      await this.databaseService.query(
        `DELETE FROM conversations WHERE id = $1`,
        [conversationId],
      );
      return { status: 'BLOCKED' };
    }

    throw new BadRequestException('Invalid request action.');
  }

  // --------------------------------------------------------------------------
  // Private Helper Methods
  // --------------------------------------------------------------------------

  private async getMessageById(messageId: string): Promise<MessageItem> {
    const sql = `
      SELECT
        m.id, m.conversation_id, m.sender_id, m.text, m.message_type,
        m.voice_url, m.voice_duration_seconds, m.voice_waveform,
        m.attached_reel_id, m.media_url, m.media_type, m.seq_num,
        m.client_msg_id, m.status, m.is_edited, m.edited_at,
        m.is_read, m.read_by, m.read_at, m.delivered_to, m.delivered_at,
        m.is_ephemeral, m.expires_at, m.is_deleted_for_everyone, m.created_at,
        p.username AS sender_username,
        p.display_name AS sender_display_name,
        p.avatar_url AS sender_avatar_url,
        r.title AS reel_title,
        r.thumbnail_url AS reel_thumbnail_url,
        rp.username AS reel_creator_username,
        ri_title.title AS reel_interest_title
      FROM messages m
      JOIN profiles p ON p.user_id = m.sender_id
      LEFT JOIN reels r ON r.id = m.attached_reel_id
      LEFT JOIN profiles rp ON rp.user_id = r.creator_id
      LEFT JOIN reel_interests rim ON rim.reel_id = r.id AND rim.is_primary = TRUE
      LEFT JOIN interests ri_title ON ri_title.id = rim.interest_id
      WHERE m.id = $1;
    `;
    const res = await this.databaseService.query(sql, [messageId]);
    if (res.rows.length === 0) throw new NotFoundException('Message not found.');
    return this.mapMessageRow(res.rows[0]);
  }

  private async getLastMessage(conversationId: string): Promise<MessageItem | null> {
    const sql = `
      SELECT
        m.id, m.conversation_id, m.sender_id, m.text, m.message_type,
        m.voice_url, m.voice_duration_seconds, m.voice_waveform,
        m.attached_reel_id, m.media_url, m.media_type, m.seq_num,
        m.client_msg_id, m.status, m.is_edited, m.edited_at,
        m.is_read, m.read_by, m.read_at, m.delivered_to, m.delivered_at,
        m.is_ephemeral, m.expires_at, m.is_deleted_for_everyone, m.created_at,
        p.username AS sender_username,
        p.display_name AS sender_display_name,
        p.avatar_url AS sender_avatar_url,
        r.title AS reel_title,
        r.thumbnail_url AS reel_thumbnail_url,
        rp.username AS reel_creator_username,
        ri_title.title AS reel_interest_title
      FROM messages m
      JOIN profiles p ON p.user_id = m.sender_id
      LEFT JOIN reels r ON r.id = m.attached_reel_id
      LEFT JOIN profiles rp ON rp.user_id = r.creator_id
      LEFT JOIN reel_interests rim ON rim.reel_id = r.id AND rim.is_primary = TRUE
      LEFT JOIN interests ri_title ON ri_title.id = rim.interest_id
      WHERE m.conversation_id = $1
        AND (m.expires_at IS NULL OR m.expires_at > NOW())
        AND m.is_deleted_for_everyone = FALSE
      ORDER BY m.seq_num DESC, m.created_at DESC
      LIMIT 1;
    `;
    const res = await this.databaseService.query(sql, [conversationId]);
    if (res.rows.length === 0) return null;
    return this.mapMessageRow(res.rows[0]);
  }

  private async getConversationParticipants(
    conversationId: string,
  ): Promise<ConversationParticipant[]> {
    const sql = `
      SELECT
        cp.user_id,
        cp.role,
        cp.status,
        cp.notifications_muted,
        cp.is_archived,
        cp.last_delivered_message_id,
        cp.last_read_message_id,
        cp.last_read_seq,
        cp.last_read_at,
        cp.joined_at,
        p.username,
        p.display_name,
        p.avatar_url
      FROM conversation_participants cp
      JOIN profiles p ON p.user_id = cp.user_id
      WHERE cp.conversation_id = $1
      ORDER BY cp.joined_at ASC;
    `;
    const res = await this.databaseService.query(sql, [conversationId]);
    return res.rows.map((r) => ({
      userId: r.user_id,
      username: r.username,
      displayName: r.display_name,
      avatarUrl: r.avatar_url || undefined,
      role: r.role as ParticipantRole,
      status: r.status,
      isMuted: Boolean(r.notifications_muted),
      isArchived: Boolean(r.is_archived),
      lastDeliveredMessageId: r.last_delivered_message_id || undefined,
      lastReadMessageId: r.last_read_message_id || undefined,
      lastReadSeq: Number(r.last_read_seq || 0),
      lastReadAt: r.last_read_at?.toISOString() || undefined,
      joinedAt: r.joined_at.toISOString(),
    }));
  }

  private mapMessageRow(row: any): MessageItem {
    let voiceMetadata: VoiceMetadata | undefined = undefined;
    if (row.message_type === MessageType.VOICE && row.voice_url) {
      voiceMetadata = {
        url: row.voice_url,
        durationSeconds: Number(row.voice_duration_seconds || 0),
        waveform: Array.isArray(row.voice_waveform) ? row.voice_waveform : [],
      };
    }

    let attachedReel: AttachedReelPreview | undefined = undefined;
    if (row.attached_reel_id && row.reel_title) {
      attachedReel = {
        id: row.attached_reel_id,
        title: row.reel_title,
        thumbnailUrl: row.reel_thumbnail_url || undefined,
        creatorUsername: row.reel_creator_username || 'creator',
        primaryInterestTitle: row.reel_interest_title || 'General',
      };
    }

    return {
      id: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      sender: {
        id: row.sender_id,
        username: row.sender_username,
        displayName: row.sender_display_name,
        avatarUrl: row.sender_avatar_url || undefined,
      },
      text: row.text || undefined,
      messageType: row.message_type as MessageType,
      voiceMetadata,
      attachedReel,
      mediaUrl: row.media_url || undefined,
      mediaType: row.media_type || undefined,
      seqNum: Number(row.seq_num || 0),
      clientMsgId: row.client_msg_id || undefined,
      status: (row.status as MessageStatus) || MessageStatus.SENT,
      isEdited: Boolean(row.is_edited),
      editedAt: row.edited_at ? new Date(row.edited_at).toISOString() : undefined,
      isRead: Boolean(row.is_read),
      readBy: Array.isArray(row.read_by) ? row.read_by : [],
      readAt: row.read_at ? new Date(row.read_at).toISOString() : undefined,
      deliveredTo: Array.isArray(row.delivered_to) ? row.delivered_to : [],
      deliveredAt: row.delivered_at ? new Date(row.delivered_at).toISOString() : undefined,
      isEphemeral: Boolean(row.is_ephemeral),
      expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : undefined,
      isDeletedForEveryone: Boolean(row.is_deleted_for_everyone),
      createdAt: (row.created_at || new Date()).toISOString(),
    };
  }
}
