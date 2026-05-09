import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

export type RealtimeEvent =
  | { type: 'track:liked'; trackId: string; userId: number }
  | { type: 'track:unliked'; trackId: string; userId: number }
  | { type: 'track:deleted'; trackId: string }
  | { type: 'track:added'; track: Record<string, unknown> }
  | { type: 'track:updated'; track: Record<string, unknown> }
  | { type: 'notification'; message: string; kind: 'info' | 'success' | 'warning' };

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/realtime',
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    client.join('global');
  }

  handleDisconnect(_client: Socket) {}

  emit(event: RealtimeEvent) {
    this.server.to('global').emit(event.type, event);
  }
}
