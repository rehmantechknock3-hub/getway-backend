import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";

import { Roles } from "../auth/roles.decorator";
import { NotificationsService } from "./notifications.service";

const ListNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

@Controller("notifications")
@Roles("CUSTOMER", "PROVIDER")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(@Req() req: Request, @Query() rawQuery: Record<string, string | undefined>) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const parsed = ListNotificationsQuerySchema.safeParse(rawQuery);
    const q = parsed.success ? parsed.data : { page: 1, limit: 20 };

    return this.notificationsService.listForUser(clerkId, q.page, q.limit);
  }

  @Patch(":id/read")
  async markRead(@Req() req: Request, @Param("id") id: string) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    return this.notificationsService.markRead(clerkId, id);
  }
}
