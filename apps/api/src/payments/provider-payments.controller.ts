import { BadRequestException, Controller, Get, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { ProviderPayoutRangeSchema, ProviderPayoutSummarySchema } from "@repo/schemas";
import { z } from "zod";

import { Roles } from "../auth/roles.decorator";
import { PaymentsService } from "./payments.service";

const ProviderPayoutSummaryQuerySchema = z.object({
  range: ProviderPayoutRangeSchema.optional().default("all"),
});

@Controller("provider/payments")
@Roles("PROVIDER")
export class ProviderPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get("payout-summary")
  async payoutSummary(@Req() req: Request, @Query() rawQuery: Record<string, string | undefined>) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const parsed = ProviderPayoutSummaryQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new BadRequestException("Invalid payout summary query");

    const result = await this.paymentsService.getProviderPayoutSummary(
      clerkId,
      parsed.data.range,
      req.requestId
    );
    return ProviderPayoutSummarySchema.parse(result);
  }
}
