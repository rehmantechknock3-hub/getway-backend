import { Module } from "@nestjs/common";
import { ClerkAuthGuard }    from "./clerk.guard";
import { RolesGuard }        from "./roles.guard";
import { WebhookController } from "./webhook.controller";
import { AuthController }    from "./auth.controller";
import { UsersModule }       from "../users/users.module";

@Module({
  imports:     [UsersModule],
  controllers: [WebhookController, AuthController],
  providers:   [ClerkAuthGuard, RolesGuard],
  exports:     [ClerkAuthGuard, RolesGuard],
})
export class AuthModule {}
