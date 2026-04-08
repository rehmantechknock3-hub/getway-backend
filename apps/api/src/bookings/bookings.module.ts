import { Module } from "@nestjs/common";

import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";

import { AdminBookingsController } from "./admin-bookings.controller";
import { BookingsController } from "./bookings.controller";
import { BookingsService } from "./bookings.service";
import { ProviderBookingsController } from "./provider-bookings.controller";

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [BookingsController, AdminBookingsController, ProviderBookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
