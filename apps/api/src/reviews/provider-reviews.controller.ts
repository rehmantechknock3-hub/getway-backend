import { BadRequestException, Controller, Get, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";

import { Roles } from "../auth/roles.decorator";
import { ReviewsService } from "./reviews.service";

const ListProviderReviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

@Controller("provider/reviews")
@Roles("PROVIDER")
export class ProviderReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  async list(@Req() req: Request, @Query() rawQuery: Record<string, string | undefined>) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const parsed = ListProviderReviewsQuerySchema.safeParse(rawQuery);
    const q = parsed.success ? parsed.data : { page: 1, limit: 20 };

    return this.reviewsService.listForProvider(clerkId, q.page, q.limit);
  }
}
