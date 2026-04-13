import { useQuery } from "@tanstack/react-query";
import type { FavoriteProviderListResponse } from "@repo/schemas";

import { apiClient } from "../client";

export const favoriteKeys = {
  all: () => ["favorites"] as const,
  list: (lat?: number | null, lon?: number | null) =>
    ["favorites", "list", lat ?? null, lon ?? null] as const,
};

export type UseFavoriteProvidersOptions = {
  enabled?: boolean;
  /** When set with `lon`, the API returns the same driving distances as Discover for that point. */
  lat?: number;
  lon?: number;
};

export function useFavoriteProviders(options?: UseFavoriteProvidersOptions) {
  const lat = options?.lat;
  const lon = options?.lon;
  const params = new URLSearchParams();
  if (lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)) {
    params.set("lat", String(lat));
    params.set("lon", String(lon));
  }
  const qs = params.toString();

  return useQuery({
    queryKey: favoriteKeys.list(lat ?? null, lon ?? null),
    queryFn: async () => {
      const { data } = await apiClient.get<FavoriteProviderListResponse>(
        `/api/v1/favorites${qs ? `?${qs}` : ""}`
      );
      return data;
    },
    enabled: options?.enabled ?? true,
  });
}
