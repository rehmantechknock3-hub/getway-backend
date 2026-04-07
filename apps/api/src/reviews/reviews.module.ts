import { Module } from "@nestjs/common";

import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";

import { ProviderReviewsController } from "./provider-reviews.controller";
import { PublicProviderReviewsController } from "./public-provider-reviews.controller";
import { ReviewsController } from "./reviews.controller";
import { ReviewsService } from "./reviews.service";

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [ReviewsController, ProviderReviewsController, PublicProviderReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
