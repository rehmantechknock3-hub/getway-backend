import { BadRequestException, Body, Controller, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { CreateReviewSchema } from "@repo/schemas";

import { Roles } from "../auth/roles.decorator";
import { ReviewsService } from "./reviews.service";

@Controller("reviews")
@Roles("CUSTOMER")
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  async create(@Req() req: Request, @Body() body: unknown) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const parsed = CreateReviewSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid review payload");

    return this.reviewsService.create(clerkId, parsed.data, req.requestId);
  }
}
