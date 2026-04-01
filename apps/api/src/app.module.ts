import { Module }   from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ClerkAuthGuard } from "./auth/clerk.guard";
import { RolesGuard }     from "./auth/roles.guard";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule }        from "./prisma/prisma.module";
import { AuthModule }          from "./auth/auth.module";
import { UsersModule }         from "./users/users.module";
import { ProvidersModule }     from "./providers/providers.module";
import { BookingsModule }      from "./bookings/bookings.module";
import { PaymentsModule }      from "./payments/payments.module";
import { MessagesModule }      from "./messages/messages.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { StorageModule }       from "./storage/storage.module";
import { RealtimeModule }      from "./realtime/realtime.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProvidersModule,
    BookingsModule,
    PaymentsModule,
    MessagesModule,
    NotificationsModule,
    StorageModule,
    RealtimeModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ClerkAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
