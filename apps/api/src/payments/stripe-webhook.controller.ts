import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  RawBodyRequest,
  Req,
} from "@nestjs/common";
import type { Request } from "express";

import { Public } from "../auth/public.decorator";
import { PaymentsService } from "./payments.service";

@Controller("payments/webhook")
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Public()
  @Post("stripe")
  @HttpCode(200)
  async handleStripeWebhook(
    @Headers("stripe-signature") signature: string,
    @Req() req: RawBodyRequest<Request>
  ) {
    const payload = req.rawBody;
    if (!payload) throw new BadRequestException("Missing raw body");
    if (!signature) throw new BadRequestException("Missing stripe-signature header");

    let event;
    try {
      event = this.paymentsService.constructWebhookEvent(payload, signature);
    } catch (error) {
      this.logger.warn(
        `[rid:${req.requestId}] Stripe webhook signature verification failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw new BadRequestException("Invalid webhook signature");
    }

    await this.paymentsService.handleStripeEvent(event, req.requestId);

    return { received: true };
  }
}
