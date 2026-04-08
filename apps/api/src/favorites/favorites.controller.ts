import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
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
  async list(@Req() req: Request) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");
    return this.favoritesService.list(clerkId);
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
