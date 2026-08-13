import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Body,
  forwardRef,
} from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";

import { SendMessageBodySchema } from "@repo/schemas";

import { Roles } from "../auth/roles.decorator";
import { ChatGateway } from "../realtime/chat.gateway";

import { MessagesService } from "./messages.service";

const ListMessagesQuerySchema = z.object({
  page:  z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(30),
});

@Controller("messages")
@Roles("CUSTOMER", "PROVIDER")
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway
  ) {}

  @Get("conversations")
  async listConversations(@Req() req: Request) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    return this.messagesService.listConversations(clerkId);
  }

  @Post("conversations/:bookingId")
  async getOrCreate(
    @Req() req: Request,
    @Param("bookingId") bookingId: string
  ) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    return this.messagesService.getOrCreateConversation(clerkId, bookingId, req.requestId);
  }

  @Get("conversations/:conversationId/messages")
  async listMessages(
    @Req() req: Request,
    @Param("conversationId") conversationId: string,
    @Query() rawQuery: Record<string, string | undefined>
  ) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const parsed = ListMessagesQuerySchema.safeParse(rawQuery);
    const q = parsed.success ? parsed.data : { page: 1, limit: 30 };

    return this.messagesService.listMessages(
      clerkId,
      conversationId,
      q.page,
      q.limit,
      req.requestId
    );
  }

  @Post("conversations/:conversationId/messages")
  async sendMessage(
    @Req() req: Request,
    @Param("conversationId") conversationId: string,
    @Body() body: unknown
  ) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const parsed = SendMessageBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const msg = await this.messagesService.sendMessage(
      clerkId,
      {
        conversationId,
        content: parsed.data.content,
        type: parsed.data.type,
      },
      req.requestId
    );

    // Fan-out to anyone currently in the room; offline peers pick this up via listMessages.
    this.chatGateway.emitMessage(conversationId, msg);
    return msg;
  }
}
