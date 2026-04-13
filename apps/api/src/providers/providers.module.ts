import { Module } from "@nestjs/common";

import { MapsModule } from "../maps/maps.module";
import { PrismaModule } from "../prisma/prisma.module";

import { ProvidersController } from "./providers.controller";
import { ProvidersService } from "./providers.service";

@Module({
  imports: [PrismaModule, MapsModule],
  controllers: [ProvidersController],
  providers: [ProvidersService],
  exports: [ProvidersService],
})
export class ProvidersModule {}
