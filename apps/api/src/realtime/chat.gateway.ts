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

import type { Message } from "@repo/schemas";

import { MessagesService } from "../messages/messages.service";

import { authenticateSocket } from "./ws-auth.helper";

@WebSocketGateway({
  namespace: "/chat",
})
export class ChatGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly messagesService: MessagesService
  ) {}

  @WebSocketServer() server!: Server;

  async handleConnection(client: Socket) {
    if (!(await authenticateSocket(client, this.configService, this.logger))) return;

    const conversationId = client.handshake.query["conversationId"] as string;
    if (conversationId) client.join(`conversation:${conversationId}`);
  }

  emitMessage(conversationId: string, message: Message) {
    this.server
      .to(`conversation:${conversationId}`)
      .emit("message:received", message);
  }

  @SubscribeMessage("message:send")
  async handleMessage(
    @MessageBody() data: { conversationId: string; content: string; type?: string },
    @ConnectedSocket() client: Socket
  ) {
    const clerkId = client.data?.clerkId as string | undefined;
    if (!clerkId) return;

    try {
      const msg = await this.messagesService.sendMessage(clerkId, {
        conversationId: data.conversationId,
        content: data.content,
        type: data.type ?? "TEXT",
      });
      this.emitMessage(data.conversationId, msg);
    } catch (error) {
      this.logger.warn(
        `message:send failed for conversation ${data.conversationId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      client.emit("message:error", { error: "Failed to send message" });
    }
  }
}
