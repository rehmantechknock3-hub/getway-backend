import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";

import { ProviderReviewsController } from "./provider-reviews.controller";
import { ReviewsController } from "./reviews.controller";
import { ReviewsService } from "./reviews.service";

@Module({
  imports: [PrismaModule],
  controllers: [ReviewsController, ProviderReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
