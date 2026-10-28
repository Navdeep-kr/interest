import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { WsChatEvents } from '@interest/shared';
import { SendMessageDto } from './dto/chat.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Authenticates client connection via JWT handshake token.
   */
  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') ||
        (client.handshake.query?.token as string);

      if (!token) {
        this.logger.warn(`Unauthorized WebSocket connection rejected: Socket ${client.id}`);
        client.disconnect();
        return;
      }

      const secret = this.configService.get<string>('JWT_SECRET');
      if (process.env.NODE_ENV === 'production' && (!secret || secret.includes('dev-jwt') || secret.length < 32)) {
        this.logger.error('CRITICAL: Insecure or missing JWT_SECRET in production WebSocket gateway');
        client.disconnect();
        return;
      }
      const activeSecret = secret || 'dev-jwt-secret-key-interest-1234';
      const payload = await this.jwtService.verifyAsync(token, { secret: activeSecret });

      const userId = payload.sub || payload.userId;
      if (!userId) {
        client.disconnect();
        return;
      }

      client.data.userId = userId;
      // Join personal room for real-time notifications
      client.join(`user:${userId}`);
      this.logger.log(`User ${userId} connected via WebSocket (Socket: ${client.id})`);
    } catch (err: any) {
      this.logger.warn(`JWT verification failed for socket ${client.id}: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    if (userId) {
      this.logger.log(`User ${userId} disconnected from WebSocket (Socket: ${client.id})`);
    }
  }

  /**
   * Joins a conversation room to stream real-time messages.
   * Enforces server-side authorization: user must be an active participant.
   */
  @SubscribeMessage(WsChatEvents.JOIN_CONVERSATION)
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!data?.conversationId || !client.data?.userId) {
      return;
    }

    const isMember = await this.chatService.isUserParticipant(client.data.userId, data.conversationId);
    if (!isMember) {
      this.logger.warn(
        `BOLA Prevention: User ${client.data.userId} attempted unauthorized join to room conv:${data.conversationId}`,
      );
      client.emit(WsChatEvents.ERROR, {
        message: 'Unauthorized: You are not a participant in this conversation.',
      });
      return;
    }

    client.join(`conv:${data.conversationId}`);
    this.logger.debug(`User ${client.data.userId} joined room conv:${data.conversationId}`);
  }

  /**
   * Leaves a conversation room.
   */
  @SubscribeMessage(WsChatEvents.LEAVE_CONVERSATION)
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (data?.conversationId) {
      client.leave(`conv:${data.conversationId}`);
      this.logger.debug(`User ${client.data.userId} left room conv:${data.conversationId}`);
    }
  }

  /**
   * Real-time message dispatch: Text, Voice Note, or Shared Reel.
   */
  @SubscribeMessage(WsChatEvents.SEND_MESSAGE)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
  ) {
    try {
      const senderId = client.data.userId;
      const message = await this.chatService.sendMessage(senderId, dto);

      // Broadcast to room members
      this.server.to(`conv:${dto.conversationId}`).emit(WsChatEvents.MESSAGE_RECEIVED, message);

      // Acknowledge back to sender
      client.emit(WsChatEvents.MESSAGE_SENT, message);
    } catch (err: any) {
      client.emit(WsChatEvents.ERROR, { message: err.message });
    }
  }

  /**
   * Typing indicator start broadcast.
   */
  @SubscribeMessage(WsChatEvents.TYPING_START)
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!data?.conversationId || !client.data?.userId) return;
    const isMember = await this.chatService.isUserParticipant(client.data.userId, data.conversationId);
    if (!isMember) return;

    client.to(`conv:${data.conversationId}`).emit(WsChatEvents.USER_TYPING, {
      conversationId: data.conversationId,
      userId: client.data.userId,
      isTyping: true,
    });
  }

  /**
   * Typing indicator stop broadcast.
   */
  @SubscribeMessage(WsChatEvents.TYPING_STOP)
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!data?.conversationId || !client.data?.userId) return;
    const isMember = await this.chatService.isUserParticipant(client.data.userId, data.conversationId);
    if (!isMember) return;

    client.to(`conv:${data.conversationId}`).emit(WsChatEvents.USER_TYPING, {
      conversationId: data.conversationId,
      userId: client.data.userId,
      isTyping: false,
    });
  }

  /**
   * Mark as read event. Broadcasts receipt if reader has read receipts enabled.
   */
  @SubscribeMessage(WsChatEvents.MARK_READ)
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    try {
      const userId = client.data.userId;
      const res = await this.chatService.markAsRead(userId, data.conversationId);

      if (res.readReceiptEmitted) {
        this.server.to(`conv:${data.conversationId}`).emit(WsChatEvents.MESSAGE_READ, {
          conversationId: data.conversationId,
          userId,
          readAt: res.readAt,
        });
      }
    } catch (err: any) {
      this.logger.warn(`Mark read error: ${err.message}`);
    }
  }

  /**
   * Mark as delivered event. Broadcasts delivery receipt to conversation members.
   */
  @SubscribeMessage(WsChatEvents.MARK_DELIVERED)
  async handleMarkDelivered(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; messageId?: string; seqNum?: number },
  ) {
    try {
      const userId = client.data.userId;
      const res = await this.chatService.markAsDelivered(
        userId,
        data.conversationId,
        data.messageId,
        data.seqNum,
      );

      this.server.to(`conv:${data.conversationId}`).emit(WsChatEvents.MESSAGE_DELIVERED, {
        conversationId: data.conversationId,
        userId,
        messageId: data.messageId,
        seqNum: data.seqNum,
        deliveredAt: res.deliveredAt,
      });
    } catch (err: any) {
      this.logger.warn(`Mark delivered error: ${err.message}`);
    }
  }
}
