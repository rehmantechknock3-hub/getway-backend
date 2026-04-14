import { Controller, Get, Param, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";

import { ProvidersService } from "./providers.service";

const ListProvidersQuerySchema = z.object({
  lat: z.coerce.number().optional(),
  lon: z.coerce.number().optional(),
  radius: z.coerce.number().min(1).max(200).optional().default(25),
});

@Controller("providers")
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get()
  async list(@Query() rawQuery: Record<string, string | undefined>, @Req() req: Request) {
    const parsed = ListProvidersQuerySchema.safeParse(rawQuery);
    const q = parsed.success ? parsed.data : { lat: undefined, lon: undefined, radius: 25 };
    return this.providersService.listPublicSummaries(q.lat, q.lon, q.radius, req.requestId);
  }

  @Get(":id/services")
  async listServices(@Param("id") id: string) {
    return this.providersService.listActiveServices(id);
  }

  @Get(":id")
  async getOne(@Param("id") id: string) {
    return this.providersService.findPublicDetail(id);
  }
}
