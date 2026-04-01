import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

@WebSocketGateway({
  cors: { origin: process.env["SOCKET_CORS_ORIGIN"] ?? "http://localhost:3000" },
  namespace: "/bookings",
})
export class BookingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server = new Server();

  handleConnection(client: Socket) {
    const bookingId = client.handshake.query["bookingId"] as string;
    if (bookingId) client.join(`booking:${bookingId}`);
  }

  handleDisconnect(client: Socket) {
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
    @ConnectedSocket() _client: Socket
  ) {
    this.emitLocationUpdate(data.bookingId, data.latitude, data.longitude);
  }
}
