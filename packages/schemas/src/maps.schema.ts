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

export const PlacesAutocompleteQuerySchema = z.object({
  q: z.string().trim().min(2).max(200),
});

export const PlacePredictionSchema = z.object({
  description: z.string().min(1),
  placeId: z.string().min(1),
});

export const PlacesAutocompleteResponseSchema = z.object({
  predictions: z.array(PlacePredictionSchema),
});

export const PlaceDetailsQuerySchema = z.object({
  placeId: z.string().trim().min(1).max(256),
});

export const PlaceDetailsResponseSchema = z.object({
  address: z.string().min(1),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  placeId: z.string().min(1),
});

export const ReverseGeocodeQuerySchema = z.object({
  latitude: z.coerce.number().finite().min(-90).max(90),
  longitude: z.coerce.number().finite().min(-180).max(180),
});

export const ReverseGeocodeResponseSchema = z.object({
  address: z.string().min(1),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});

export type DrivingLegQuery = z.infer<typeof DrivingLegQuerySchema>;
export type DrivingLegResponse = z.infer<typeof DrivingLegResponseSchema>;
export type RoutePoint = z.infer<typeof RoutePointSchema>;
export type DrivingRouteResponse = z.infer<typeof DrivingRouteResponseSchema>;
export type PlacesAutocompleteQuery = z.infer<typeof PlacesAutocompleteQuerySchema>;
export type PlacePrediction = z.infer<typeof PlacePredictionSchema>;
export type PlacesAutocompleteResponse = z.infer<typeof PlacesAutocompleteResponseSchema>;
export type PlaceDetailsQuery = z.infer<typeof PlaceDetailsQuerySchema>;
export type PlaceDetailsResponse = z.infer<typeof PlaceDetailsResponseSchema>;
export type ReverseGeocodeQuery = z.infer<typeof ReverseGeocodeQuerySchema>;
export type ReverseGeocodeResponse = z.infer<typeof ReverseGeocodeResponseSchema>;
