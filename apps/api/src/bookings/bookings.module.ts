import { Module } from "@nestjs/common";

import { NotificationsModule } from "../notifications/notifications.module";
import { PaymentsModule } from "../payments/payments.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RealtimeModule } from "../realtime/realtime.module";

import { AdminBookingsController } from "./admin-bookings.controller";
import { BookingsController } from "./bookings.controller";
import { BookingsService } from "./bookings.service";
import { ProviderBookingsController } from "./provider-bookings.controller";

@Module({
  imports: [PrismaModule, NotificationsModule, RealtimeModule, PaymentsModule],
  controllers: [BookingsController, AdminBookingsController, ProviderBookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
