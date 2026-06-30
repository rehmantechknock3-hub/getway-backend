import { z } from "zod";

export const DrivingRouteKind = z.enum(["DRIVING", "STRAIGHT_LINE"]);
export type DrivingRouteKind = z.infer<typeof DrivingRouteKind>;

export const DrivingLegQuerySchema = z.object({
  originLatitude:   z.coerce.number().finite().min(-90).max(90),
  originLongitude:  z.coerce.number().finite().min(-180).max(180),
  destLatitude:     z.coerce.number().finite().min(-90).max(90),
  destLongitude:    z.coerce.number().finite().min(-180).max(180),
});

export const DrivingLegResponseSchema = z.object({
  distanceMeters:     z.number().int().nonnegative(),
  distanceKm:         z.number().finite().nonnegative(),
  durationSeconds:    z.number().int().nonnegative().nullable(),
  /** When Distance Matrix is unavailable, durationSeconds may be null. */
  kind:               DrivingRouteKind,
});

export const RoutePointSchema = z.object({
  latitude:  z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});

export const DrivingRouteResponseSchema = DrivingLegResponseSchema.extend({
  path: z.array(RoutePointSchema).min(2),
});

export type DrivingLegQuery = z.infer<typeof DrivingLegQuerySchema>;
export type DrivingLegResponse = z.infer<typeof DrivingLegResponseSchema>;
export type RoutePoint = z.infer<typeof RoutePointSchema>;
export type DrivingRouteResponse = z.infer<typeof DrivingRouteResponseSchema>;
