import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";

import { ProviderServicesController } from "./provider-services.controller";
import { ProviderServicesService } from "./provider-services.service";

@Module({
  imports: [PrismaModule],
  controllers: [ProviderServicesController],
  providers: [ProviderServicesService],
})
export class ProviderServicesModule {}
