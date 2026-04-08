import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { AdminCreateBookingSchema } from "@repo/schemas";
import { z } from "zod";

import { Roles } from "../auth/roles.decorator";
import { BookingsService } from "./bookings.service";

const AdminListBookingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

@Controller("admin/bookings")
@Roles("ADMIN")
export class AdminBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  async create(@Req() req: Request, @Body() body: unknown) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const parsed = AdminCreateBookingSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid admin booking payload");

    const { customerId, ...rest } = parsed.data;
    return this.bookingsService.createForCustomer(customerId, rest);
  }

  @Get()
  async list(@Query() rawQuery: Record<string, string | undefined>) {
    const parsed = AdminListBookingsQuerySchema.safeParse(rawQuery);
    const q = parsed.success ? parsed.data : { page: 1, limit: 20 };

    return this.bookingsService.listAll(q.page, q.limit);
  }
}
