import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { PaymentsService } from "./payments.service";
import { ProviderPaymentsController } from "./provider-payments.controller";

@Module({
  imports: [PrismaModule],
  controllers: [ProviderPaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
