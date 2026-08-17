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

import { OpenAdminThreadSchema, SendMessageBodySchema } from "@repo/schemas";

import { Roles } from "../auth/roles.decorator";
import { ChatGateway } from "../realtime/chat.gateway";

import { MessagesService } from "./messages.service";

const ListQuerySchema = z.object({
  page:  z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(30),
});

@Controller("admin/messages")
@Roles("ADMIN")
export class AdminMessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get()
  async listThreads(
    @Req() req: Request,
    @Query() rawQuery: Record<string, string | undefined>,
  ) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const parsed = ListQuerySchema.safeParse(rawQuery);
    const q = parsed.success ? parsed.data : { page: 1, limit: 30 };

    return this.messagesService.listAdminThreads(clerkId, q.page, q.limit, req.requestId);
  }

  @Post("threads")
  async openThread(@Req() req: Request, @Body() body: unknown) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const parsed = OpenAdminThreadSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.messagesService.getOrCreateAdminThreadForProvider(
      clerkId,
      parsed.data.providerUserId,
      req.requestId,
    );
  }

  @Get(":conversationId/messages")
  async listMessages(
    @Req() req: Request,
    @Param("conversationId") conversationId: string,
    @Query() rawQuery: Record<string, string | undefined>,
  ) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const parsed = ListQuerySchema.safeParse(rawQuery);
    const q = parsed.success ? parsed.data : { page: 1, limit: 30 };

    return this.messagesService.listMessages(
      clerkId,
      conversationId,
      q.page,
      q.limit,
      req.requestId,
    );
  }

  @Post(":conversationId/messages")
  async sendMessage(
    @Req() req: Request,
    @Param("conversationId") conversationId: string,
    @Body() body: unknown,
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
      req.requestId,
    );

    this.chatGateway.emitMessage(conversationId, msg);
    return msg;
  }
}
