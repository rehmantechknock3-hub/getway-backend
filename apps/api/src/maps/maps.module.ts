import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";

import { GoogleMapsService } from "./google-maps.service";
import { MapsController } from "./maps.controller";

@Module({
  imports: [PrismaModule],
  controllers: [MapsController],
  providers: [GoogleMapsService],
  exports: [GoogleMapsService],
})
export class MapsModule {}
