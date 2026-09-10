import { BadRequestException, Controller, Param, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { CreatePaymentIntentResponseSchema } from "@repo/schemas";

import { Roles } from "../auth/roles.decorator";
import { PaymentsService } from "./payments.service";

@Controller("payments")
@Roles("CUSTOMER")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("bookings/:bookingId/intent")
  async createIntent(@Req() req: Request, @Param("bookingId") bookingId: string) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const result = await this.paymentsService.createPaymentIntentForBooking(
      clerkId,
      bookingId,
      req.requestId
    );
    return CreatePaymentIntentResponseSchema.parse(result);
  }
}
