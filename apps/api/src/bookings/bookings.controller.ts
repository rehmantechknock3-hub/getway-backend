import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { CreateBookingSchema } from "@repo/schemas";
import { z } from "zod";

import { Roles } from "../auth/roles.decorator";
import { BookingsService } from "./bookings.service";

const ListBookingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

@Controller("bookings")
@Roles("CUSTOMER")
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  async create(@Req() req: Request, @Body() body: unknown) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const parsed = CreateBookingSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid booking payload");

    return this.bookingsService.create(clerkId, parsed.data);
  }

  @Get()
  async list(@Req() req: Request, @Query() rawQuery: Record<string, string | undefined>) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const parsed = ListBookingsQuerySchema.safeParse(rawQuery);
    const q = parsed.success ? parsed.data : { page: 1, limit: 20 };

    return this.bookingsService.listForCustomer(clerkId, q.page, q.limit);
  }

  @Get(":id")
  async getOne(@Req() req: Request, @Param("id") id: string) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    return this.bookingsService.findOneForCustomer(clerkId, id);
  }
}
