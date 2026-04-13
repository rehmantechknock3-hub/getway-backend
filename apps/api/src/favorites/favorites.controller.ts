import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";

import { Roles } from "../auth/roles.decorator";
import { FavoritesService } from "./favorites.service";

@Controller("favorites")
@Roles("CUSTOMER")
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query("lat") latRaw?: string,
    @Query("lon") lonRaw?: string
  ) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");
    const lat = latRaw != null ? Number.parseFloat(latRaw) : undefined;
    const lon = lonRaw != null ? Number.parseFloat(lonRaw) : undefined;
    const hasGeo =
      lat != null &&
      lon != null &&
      !Number.isNaN(lat) &&
      !Number.isNaN(lon) &&
      Number.isFinite(lat) &&
      Number.isFinite(lon);
    return this.favoritesService.list(
      clerkId,
      hasGeo ? lat : undefined,
      hasGeo ? lon : undefined,
      req.requestId
    );
  }

  @Post(":providerId")
  async add(@Req() req: Request, @Param("providerId") providerId: string) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");
    await this.favoritesService.add(clerkId, providerId);
    return { ok: true as const };
  }

  @Delete(":providerId")
  async remove(@Req() req: Request, @Param("providerId") providerId: string) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");
    await this.favoritesService.remove(clerkId, providerId);
    return { ok: true as const };
  }
}
