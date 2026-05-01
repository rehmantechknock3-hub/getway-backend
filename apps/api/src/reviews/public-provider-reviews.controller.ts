import { Controller, Get, Param, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";

import { Public } from "../auth/public.decorator";
import { ReviewsService } from "./reviews.service";

const ListPublicProviderReviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

@Public()
@Controller("providers/:providerId/reviews")
export class PublicProviderReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  async list(
    @Param("providerId") providerId: string,
    @Query() rawQuery: Record<string, string | undefined>,
    @Req() req: Request
  ) {
    const parsed = ListPublicProviderReviewsQuerySchema.safeParse(rawQuery);
    const q = parsed.success ? parsed.data : { page: 1, limit: 20 };

    return this.reviewsService.listForPublicProvider(providerId, q.page, q.limit, req.requestId);
  }
}
