import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { ProvidersModule } from "../providers/providers.module";

import { FavoritesController } from "./favorites.controller";
import { FavoritesService } from "./favorites.service";

@Module({
  imports: [PrismaModule, ProvidersModule],
  controllers: [FavoritesController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
