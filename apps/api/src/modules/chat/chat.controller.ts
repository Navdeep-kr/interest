import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import {
  CreateDirectChatDto,
  CreateGroupChatDto,
  SendMessageDto,
  EditMessageDto,
  DeleteMessageDto,
  MarkDeliveredDto,
  SyncMessagesQueryDto,
  AddParticipantDto,
  UpdateParticipantRoleDto,
  ReportMessageDto,
  ToggleConversationControlDto,
  UpdateContactPrivacyDto,
  UpdateDisappearingTimerDto,
  RespondRequestDto,
  GetConversationsQueryDto,
  GetMessagesQueryDto,
} from './dto/chat.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * List conversations partitioned into primary, requests, or archived folders.
   */
  @Get('conversations')
  async getConversations(
    @CurrentUser('userId') userId: string,
    @Query() query: GetConversationsQueryDto,
  ) {
    return this.chatService.getConversations(
      userId,
      query.folder || 'primary',
      query.limit ? Number(query.limit) : 20,
      query.offset ? Number(query.offset) : 0,
    );
  }

  /**
   * Global unread badge count for messaging navigation icon.
   */
  @Get('unread-count')
  async getGlobalUnreadCount(@CurrentUser('userId') userId: string) {
    const unreadCount = await this.chatService.getGlobalUnreadCount(userId);
    return { unreadCount };
  }

  /**
   * Fetch specific conversation thread metadata.
   */
  @Get('conversations/:id')
  async getConversationDetails(
    @CurrentUser('userId') userId: string,
    @Param('id') conversationId: string,
  ) {
    return this.chatService.getConversationDetails(userId, conversationId);
  }

  /**
   * Initiate or retrieve a 1:1 direct conversation.
   */
  @Post('direct')
  async createDirectChat(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateDirectChatDto,
  ) {
    return this.chatService.createDirectChat(userId, dto);
  }

  /**
   * Create a multi-participant group chat.
   */
  @Post('group')
  async createGroupChat(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateGroupChatDto,
  ) {
    return this.chatService.createGroupChat(userId, dto);
  }

  /**
   * Send a message (Text, Media, Voice note, or shared Reel) with client idempotency key.
   */
  @Post('messages')
  async sendMessage(
    @CurrentUser('userId') userId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(userId, dto);
  }

  /**
   * Fetch message history for a conversation (excluding expired disappearing messages).
   */
  @Get('conversations/:id/messages')
  async getMessages(
    @CurrentUser('userId') userId: string,
    @Param('id') conversationId: string,
    @Query() query: GetMessagesQueryDto,
  ) {
    return this.chatService.getMessages(
      userId,
      conversationId,
      query.limit ? Number(query.limit) : 50,
      query.beforeCursor,
    );
  }

  /**
   * Cross-device synchronization endpoint: catch up on messages after network disconnect.
   */
  @Get('conversations/:id/sync')
  async syncMessages(
    @CurrentUser('userId') userId: string,
    @Param('id') conversationId: string,
    @Query() query: SyncMessagesQueryDto,
  ) {
    return this.chatService.syncMessages(
      userId,
      conversationId,
      query.sinceSeq ? Number(query.sinceSeq) : 0,
      query.limit ? Number(query.limit) : 50,
    );
  }

  /**
   * Mark messages as delivered.
   */
  @Post('conversations/:id/delivery')
  async markAsDelivered(
    @CurrentUser('userId') userId: string,
    @Param('id') conversationId: string,
    @Body() dto: MarkDeliveredDto,
  ) {
    return this.chatService.markAsDelivered(
      userId,
      conversationId,
      dto.messageId,
      dto.seqNum ? Number(dto.seqNum) : undefined,
    );
  }

  /**
   * Mark conversation as read (evaluates user's read receipts toggle).
   */
  @Patch('conversations/:id/read')
  async markAsRead(
    @CurrentUser('userId') userId: string,
    @Param('id') conversationId: string,
  ) {
    return this.chatService.markAsRead(userId, conversationId);
  }

  /**
   * Edit a message (within 15-minute window, sender only).
   */
  @Patch('messages/:id')
  async editMessage(
    @CurrentUser('userId') userId: string,
    @Param('id') messageId: string,
    @Body() dto: EditMessageDto,
  ) {
    return this.chatService.editMessage(userId, messageId, dto.text);
  }

  /**
   * Delete a message (delete for everyone within 24 hours, or soft delete for me).
   */
  @Delete('messages/:id')
  async deleteMessage(
    @CurrentUser('userId') userId: string,
    @Param('id') messageId: string,
    @Query('deleteForEveryone') deleteForEveryone?: string,
    @Body() dto?: DeleteMessageDto,
  ) {
    const isEveryone = deleteForEveryone === 'true' || Boolean(dto?.deleteForEveryone);
    return this.chatService.deleteMessage(userId, messageId, isEveryone);
  }

  /**
   * Add participant to group (Group Admin only).
   */
  @Post('conversations/:id/participants')
  async addParticipant(
    @CurrentUser('userId') userId: string,
    @Param('id') conversationId: string,
    @Body() dto: AddParticipantDto,
  ) {
    return this.chatService.addParticipant(userId, conversationId, dto.userId);
  }

  /**
   * Remove participant or leave group.
   */
  @Delete('conversations/:id/participants/:targetUserId')
  async removeParticipant(
    @CurrentUser('userId') userId: string,
    @Param('id') conversationId: string,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.chatService.removeParticipant(userId, conversationId, targetUserId);
  }

  /**
   * Promote/demote participant role in group.
   */
  @Patch('conversations/:id/participants/:targetUserId/role')
  async updateParticipantRole(
    @CurrentUser('userId') userId: string,
    @Param('id') conversationId: string,
    @Param('targetUserId') targetUserId: string,
    @Body() dto: UpdateParticipantRoleDto,
  ) {
    return this.chatService.updateParticipantRole(userId, conversationId, targetUserId, dto.role);
  }

  /**
   * Toggle mute notifications on conversation.
   */
  @Patch('conversations/:id/mute')
  async toggleMute(
    @CurrentUser('userId') userId: string,
    @Param('id') conversationId: string,
    @Body() dto: ToggleConversationControlDto,
  ) {
    return this.chatService.toggleMute(userId, conversationId, Boolean(dto.isMuted));
  }

  /**
   * Toggle archive thread.
   */
  @Patch('conversations/:id/archive')
  async toggleArchive(
    @CurrentUser('userId') userId: string,
    @Param('id') conversationId: string,
    @Body() dto: ToggleConversationControlDto,
  ) {
    return this.chatService.toggleArchive(userId, conversationId, Boolean(dto.isArchived));
  }

  /**
   * Soft delete conversation history for user.
   */
  @Delete('conversations/:id')
  async deleteConversation(
    @CurrentUser('userId') userId: string,
    @Param('id') conversationId: string,
  ) {
    return this.chatService.deleteConversation(userId, conversationId);
  }

  /**
   * Report a message for trust & safety.
   */
  @Post('messages/:id/report')
  async reportMessage(
    @CurrentUser('userId') userId: string,
    @Param('id') messageId: string,
    @Body() dto: ReportMessageDto,
  ) {
    return this.chatService.reportMessage(userId, messageId, dto);
  }

  /**
   * Update user contact privacy setting (EVERYONE, FOLLOWERS_ONLY, NOBODY).
   */
  @Patch('privacy/contact')
  async updateContactPrivacy(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateContactPrivacyDto,
  ) {
    return this.chatService.updateContactPrivacy(userId, dto.messagePrivacy);
  }

  /**
   * Configure disappearing messages expiration timer for thread.
   */
  @Patch('conversations/:id/disappearing')
  async updateDisappearingTimer(
    @CurrentUser('userId') userId: string,
    @Param('id') conversationId: string,
    @Body() dto: UpdateDisappearingTimerDto,
  ) {
    return this.chatService.updateDisappearingTimer(
      userId,
      conversationId,
      dto.ttlSeconds !== undefined ? dto.ttlSeconds : null,
    );
  }

  /**
   * Respond to a message request: ACCEPT, DECLINE, or BLOCK.
   */
  @Post('conversations/:id/respond')
  async respondToRequest(
    @CurrentUser('userId') userId: string,
    @Param('id') conversationId: string,
    @Body() dto: RespondRequestDto,
  ) {
    return this.chatService.respondToRequest(userId, conversationId, dto);
  }
}
