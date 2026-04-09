import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { CacheModule } from "@nestjs/cache-manager";
import { ConfigModule } from "@nestjs/config";

import { ClerkAuthGuard }         from "./auth/clerk.guard";
import { RolesGuard }             from "./auth/roles.guard";
import { RequestIdMiddleware }    from "./common/request-id.middleware";
import { PrismaModule }           from "./prisma/prisma.module";
import { AuthModule }          from "./auth/auth.module";
import { UsersModule }         from "./users/users.module";
import { ProvidersModule }     from "./providers/providers.module";
import { BookingsModule }      from "./bookings/bookings.module";
import { FavoritesModule }     from "./favorites/favorites.module";
import { PaymentsModule }      from "./payments/payments.module";
import { MessagesModule }      from "./messages/messages.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { StorageModule }       from "./storage/storage.module";
import { RealtimeModule }      from "./realtime/realtime.module";
import { ReviewsModule }       from "./reviews/reviews.module";
import { ProviderServicesModule } from "./provider-services/provider-services.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.register({
      isGlobal: true,
      ttl: 60_000,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProvidersModule,
    BookingsModule,
    FavoritesModule,
    PaymentsModule,
    MessagesModule,
    NotificationsModule,
    StorageModule,
    RealtimeModule,
    ReviewsModule,
    ProviderServicesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ClerkAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
