import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/telemetry',
})
export class TelemetryGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TelemetryGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to Telemetry socket: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from Telemetry socket: ${client.id}`);
  }

  @SubscribeMessage('join_user_stream')
  handleJoinUserStream(client: Socket, userId: string) {
    client.join(`user_${userId}`);
    return { status: 'joined', room: `user_${userId}` };
  }

  emitVectorUpdated(userId: string, data: any) {
    this.server.to(`user_${userId}`).emit('vector_drift_updated', data);
  }
}
