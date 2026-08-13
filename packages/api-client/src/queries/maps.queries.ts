import { useQuery } from "@tanstack/react-query";

import {
  DrivingLegResponseSchema,
  PlaceDetailsResponseSchema,
  PlacesAutocompleteResponseSchema,
  ReverseGeocodeResponseSchema,
  type DrivingLegResponse,
  type PlaceDetailsResponse,
  type PlacesAutocompleteResponse,
  type ReverseGeocodeResponse,
} from "@repo/schemas";

import { apiClient } from "../client";

export const mapsKeys = {
  all: () => ["maps"] as const,
  drivingLeg: (args: {
    originLatitude: number;
    originLongitude: number;
    destLatitude: number;
    destLongitude: number;
  }) =>
    [
      "maps",
      "driving-leg",
      args.originLatitude,
      args.originLongitude,
      args.destLatitude,
      args.destLongitude,
    ] as const,
  drivingRoute: (args: {
    originLatitude: number;
    originLongitude: number;
    destLatitude: number;
    destLongitude: number;
  }) =>
    [
      "maps",
      "driving-route",
      args.originLatitude,
      args.originLongitude,
      args.destLatitude,
      args.destLongitude,
    ] as const,
  placesAutocomplete: (q: string) => ["maps", "places-autocomplete", q] as const,
};

export function useDrivingLeg(
  args: {
    originLatitude: number;
    originLongitude: number;
    destLatitude: number;
    destLongitude: number;
  },
  options?: { enabled?: boolean },
) {
  const enabled =
    (options?.enabled ?? true) &&
    Number.isFinite(args.originLatitude) &&
    Number.isFinite(args.originLongitude) &&
    Number.isFinite(args.destLatitude) &&
    Number.isFinite(args.destLongitude);

  return useQuery({
    queryKey: mapsKeys.drivingLeg(args),
    queryFn: async (): Promise<DrivingLegResponse> => {
      const { data } = await apiClient.get<unknown>("/api/v1/maps/driving-leg", { params: args });
      return DrivingLegResponseSchema.parse(data);
    },
    enabled,
    staleTime: 30_000,
  });
}

export function usePlacesAutocomplete(query: string, options?: { enabled?: boolean }) {
  const q = query.trim();
  const enabled = (options?.enabled ?? true) && q.length >= 2;

  return useQuery({
    queryKey: mapsKeys.placesAutocomplete(q),
    queryFn: async (): Promise<PlacesAutocompleteResponse> => {
      const { data } = await apiClient.get<unknown>("/api/v1/maps/places/autocomplete", {
        params: { q },
      });
      return PlacesAutocompleteResponseSchema.parse(data);
    },
    enabled,
    staleTime: 30_000,
  });
}

export async function fetchPlaceDetails(placeId: string): Promise<PlaceDetailsResponse> {
  const { data } = await apiClient.get<unknown>("/api/v1/maps/places/details", {
    params: { placeId },
  });
  return PlaceDetailsResponseSchema.parse(data);
}

export async function fetchReverseGeocode(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeResponse> {
  const { data } = await apiClient.get<unknown>("/api/v1/maps/geocode/reverse", {
    params: { latitude, longitude },
  });
  return ReverseGeocodeResponseSchema.parse(data);
}
