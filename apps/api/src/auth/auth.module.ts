import { Module } from "@nestjs/common";

import { AuthController } from "./auth.controller";
import { ClerkAuthGuard } from "./clerk.guard";
import { HealthController } from "./health.controller";
import { RolesGuard } from "./roles.guard";
import { WebhookController } from "./webhook.controller";
import { UsersModule } from "../users/users.module";

@Module({
  imports:     [UsersModule],
  controllers: [WebhookController, AuthController, HealthController],
  providers:   [ClerkAuthGuard, RolesGuard],
  exports:     [ClerkAuthGuard, RolesGuard],
})
export class AuthModule {}
