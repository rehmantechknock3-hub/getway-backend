import { BadRequestException, Controller, Get, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  DrivingLegQuerySchema,
  DrivingLegResponseSchema,
  DrivingRouteResponseSchema,
  PlaceDetailsQuerySchema,
  PlaceDetailsResponseSchema,
  PlacesAutocompleteQuerySchema,
  PlacesAutocompleteResponseSchema,
  ReverseGeocodeQuerySchema,
  ReverseGeocodeResponseSchema,
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

  @Get("places/autocomplete")
  async placesAutocomplete(
    @Req() req: Request,
    @Query() rawQuery: Record<string, string | undefined>,
  ) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const parsed = PlacesAutocompleteQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new BadRequestException("Invalid places query");

    const predictions = await this.googleMaps.autocompletePlaces({
      query: parsed.data.q,
      requestId: req.requestId,
    });

    return PlacesAutocompleteResponseSchema.parse({ predictions });
  }

  @Get("places/details")
  async placeDetails(
    @Req() req: Request,
    @Query() rawQuery: Record<string, string | undefined>,
  ) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const parsed = PlaceDetailsQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new BadRequestException("Invalid place details query");

    const details = await this.googleMaps.resolvePlaceDetails({
      placeId: parsed.data.placeId,
      requestId: req.requestId,
    });
    if (!details) throw new BadRequestException("Could not resolve place");

    return PlaceDetailsResponseSchema.parse(details);
  }

  @Get("geocode/reverse")
  async reverseGeocode(
    @Req() req: Request,
    @Query() rawQuery: Record<string, string | undefined>,
  ) {
    const clerkId = req.auth?.sub;
    if (!clerkId) throw new BadRequestException("No authenticated user");

    const parsed = ReverseGeocodeQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new BadRequestException("Invalid reverse geocode query");

    const result = await this.googleMaps.reverseGeocode({
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      requestId: req.requestId,
    });
    if (!result) throw new BadRequestException("Could not reverse geocode");

    return ReverseGeocodeResponseSchema.parse(result);
  }
}
