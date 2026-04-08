import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { UpdateBookingStatusSchema } from "@repo/schemas";
import { z } from "zod";

import { Roles } from "../auth/roles.decorator";
import { BookingsService } from "./bookings.service";

const ListProviderBookingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  scope: z.enum(["queue", "history", "all"]).optional().default("queue"),
});

@Controller("provider/bookings")
@Roles("PROVIDER")
export class ProviderBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  async list(@Req() req: Request, @Query() rawQuery: Record<string, string | undefined>) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const parsed = ListProviderBookingsQuerySchema.safeParse(rawQuery);
    const q = parsed.success ? parsed.data : { page: 1, limit: 20, scope: "queue" as const };

    return this.bookingsService.listForProvider(clerkId, q.page, q.limit, q.scope);
  }

  @Get(":id")
  async getOne(@Req() req: Request, @Param("id") id: string) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    return this.bookingsService.findOneForProvider(clerkId, id);
  }

  @Patch(":id/status")
  async patchStatus(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: unknown
  ) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const parsed = UpdateBookingStatusSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid status payload");

    return this.bookingsService.updateStatusForProvider(clerkId, id, parsed.data);
  }
}
