import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { verifyToken } from "@clerk/backend";
import { Server, Socket } from "socket.io";

@WebSocketGateway({
  cors: { origin: true },
  namespace: "/chat",
})
export class ChatGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly configService: ConfigService) {}

  @WebSocketServer() server!: Server;

  async handleConnection(client: Socket) {
    const token = (client.handshake.auth?.token as string | undefined) ?? undefined;
    if (!token) return client.disconnect();
    const secretKey = this.configService.get<string>("CLERK_SECRET_KEY");
    if (!secretKey) {
      this.logger.error("CLERK_SECRET_KEY is missing; rejecting socket connection");
      return client.disconnect();
    }
    try {
      const payload = await verifyToken(token, { secretKey });
      client.data.clerkId = payload.sub;
    } catch {
      return client.disconnect();
    }
    const conversationId = client.handshake.query["conversationId"] as string;
    if (conversationId) client.join(`conversation:${conversationId}`);
  }

  @SubscribeMessage("message:send")
  handleMessage(
    @MessageBody() data: { conversationId: string; content: string; type: string },
    @ConnectedSocket() client: Socket
  ) {
    if (!client.data?.clerkId) return;
    this.server
      .to(`conversation:${data.conversationId}`)
      .emit("message:received", data);
  }
}
