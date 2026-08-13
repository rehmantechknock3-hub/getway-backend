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
import { AdminCreateBookingSchema, BookingStatus } from "@repo/schemas";
import { z } from "zod";

import { Roles } from "../auth/roles.decorator";
import { BookingsService } from "./bookings.service";

const DateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

const AdminListBookingsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
    status: BookingStatus.optional(),
    from: DateOnlySchema.optional(),
    to: DateOnlySchema.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.from && val.to && val.from > val.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "`from` must be on or before `to`",
        path: ["from"],
      });
    }
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
    if (!parsed.success) {
      throw new BadRequestException("Invalid booking list filters");
    }
    const q = parsed.data;
    return this.bookingsService.listAll(q.page, q.limit, q.status, q.from, q.to);
  }
}
