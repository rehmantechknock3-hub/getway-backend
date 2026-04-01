import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

@WebSocketGateway({
  cors: { origin: process.env["SOCKET_CORS_ORIGIN"] ?? "http://localhost:3000" },
  namespace: "/chat",
})
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server = new Server();

  handleConnection(client: Socket) {
    const conversationId = client.handshake.query["conversationId"] as string;
    if (conversationId) client.join(`conversation:${conversationId}`);
  }

  @SubscribeMessage("message:send")
  handleMessage(
    @MessageBody() data: { conversationId: string; content: string; type: string },
    @ConnectedSocket() _client: Socket
  ) {
    this.server
      .to(`conversation:${data.conversationId}`)
      .emit("message:received", data);
  }
}
