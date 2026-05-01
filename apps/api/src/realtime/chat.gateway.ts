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
import { Server, Socket } from "socket.io";

import { authenticateSocket } from "./ws-auth.helper";

@WebSocketGateway({
  namespace: "/chat",
})
export class ChatGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly configService: ConfigService) {}

  @WebSocketServer() server!: Server;

  async handleConnection(client: Socket) {
    if (!(await authenticateSocket(client, this.configService, this.logger))) return;

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
