import { BadRequestException, Controller, Get, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  DrivingLegQuerySchema,
  DrivingLegResponseSchema,
  DrivingRouteResponseSchema,
} from "@repo/schemas";

import { GoogleMapsService } from "./google-maps.service";

@Controller("maps")
export class MapsController {
  constructor(private readonly googleMaps: GoogleMapsService) {}

  @Get("driving-leg")
  async drivingLeg(@Req() req: Request, @Query() rawQuery: Record<string, string | undefined>) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const parsed = DrivingLegQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new BadRequestException("Invalid maps query");

    const leg = await this.googleMaps.resolveDrivingLeg(
      parsed.data.originLatitude,
      parsed.data.originLongitude,
      parsed.data.destLatitude,
      parsed.data.destLongitude,
      req.requestId
    );

    return DrivingLegResponseSchema.parse(leg);
  }

  @Get("driving-route")
  async drivingRoute(@Req() req: Request, @Query() rawQuery: Record<string, string | undefined>) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const parsed = DrivingLegQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new BadRequestException("Invalid maps query");

    const route = await this.googleMaps.resolveDrivingRoute(
      parsed.data.originLatitude,
      parsed.data.originLongitude,
      parsed.data.destLatitude,
      parsed.data.destLongitude,
      req.requestId
    );

    return DrivingRouteResponseSchema.parse(route);
  }
}
