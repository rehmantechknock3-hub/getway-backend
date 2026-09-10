import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { ProviderPaymentsController } from "./provider-payments.controller";
import { stripeClientProvider } from "./stripe-client.provider";
import { StripeConnectController } from "./stripe-connect.controller";
import { StripeWebhookController } from "./stripe-webhook.controller";

@Module({
  imports: [PrismaModule],
  controllers: [
    ProviderPaymentsController,
    PaymentsController,
    StripeConnectController,
    StripeWebhookController,
  ],
  providers: [PaymentsService, stripeClientProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
