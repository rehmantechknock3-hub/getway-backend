import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Server, Socket } from "socket.io";

import { authenticateSocket } from "./ws-auth.helper";

@WebSocketGateway({
  namespace: "/bookings",
})
export class BookingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(BookingGateway.name);
  private readonly locationBroadcastThrottleMs = 1_000;
  private readonly lastLocationBroadcastAtBySocketId = new Map<string, number>();

  constructor(private readonly configService: ConfigService) {}

  @WebSocketServer() server!: Server;

  async handleConnection(client: Socket) {
    if (!(await authenticateSocket(client, this.configService, this.logger))) return;

    const bookingId = client.handshake.query["bookingId"] as string;
    if (bookingId) client.join(`booking:${bookingId}`);
  }

  handleDisconnect(client: Socket) {
    this.lastLocationBroadcastAtBySocketId.delete(client.id);
    client.rooms.forEach((room) => client.leave(room));
  }

  /** Emit booking status change to all clients in the booking room. */
  emitStatusChange(bookingId: string, status: string) {
    this.server
      .to(`booking:${bookingId}`)
      .emit("booking:status_changed", { bookingId, status });
  }

  /** Emit provider location update. */
  emitLocationUpdate(bookingId: string, lat: number, lon: number) {
    this.server
      .to(`booking:${bookingId}`)
      .emit("location:updated", { latitude: lat, longitude: lon });
  }

  @SubscribeMessage("location:broadcast")
  handleLocationBroadcast(
    @MessageBody() data: { bookingId: string; latitude: number; longitude: number },
    @ConnectedSocket() client: Socket
  ) {
    if (!client.data?.clerkId) return;

    const now = Date.now();
    const last = this.lastLocationBroadcastAtBySocketId.get(client.id);
    if (last != null && now - last < this.locationBroadcastThrottleMs) {
      this.logger.warn(`Rate-limited location:broadcast for socket ${client.id}`);
      return;
    }
    this.lastLocationBroadcastAtBySocketId.set(client.id, now);

    this.emitLocationUpdate(data.bookingId, data.latitude, data.longitude);
  }
}
