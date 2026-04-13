import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";

import { GoogleMapsService } from "./google-maps.service";

@Module({
  imports: [PrismaModule],
  providers: [GoogleMapsService],
  exports: [GoogleMapsService],
})
export class MapsModule {}
