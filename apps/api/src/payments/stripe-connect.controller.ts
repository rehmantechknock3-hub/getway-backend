import { BadRequestException, Controller, Get, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { StripeConnectOnboardingLinkSchema, StripeConnectStatusSchema } from "@repo/schemas";

import { Roles } from "../auth/roles.decorator";
import { PaymentsService } from "./payments.service";

@Controller("payments/connect")
@Roles("PROVIDER")
export class StripeConnectController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("onboarding-link")
  async createOnboardingLink(@Req() req: Request) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const result = await this.paymentsService.createConnectOnboardingLink(clerkId, req.requestId);
    return StripeConnectOnboardingLinkSchema.parse(result);
  }

  @Get("status")
  async getStatus(@Req() req: Request) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const result = await this.paymentsService.getConnectStatus(clerkId);
    return StripeConnectStatusSchema.parse(result);
  }
}
