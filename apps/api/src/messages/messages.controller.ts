import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";

import { Roles } from "../auth/roles.decorator";

import { MessagesService } from "./messages.service";

const ListMessagesQuerySchema = z.object({
  page:  z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(30),
});

@Controller("messages")
@Roles("CUSTOMER", "PROVIDER")
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

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
}
