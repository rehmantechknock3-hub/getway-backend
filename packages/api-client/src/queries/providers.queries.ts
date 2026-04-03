import { useQuery } from "@tanstack/react-query";

import type { ProviderPublicDetail, ProviderPublicSummary, ProviderServiceOffer } from "@repo/schemas";

import { apiClient } from "../client";

export const providerKeys = {
  all: () => ["providers"] as const,
  list: (lat?: number, lon?: number, radius?: number) =>
    ["providers", "list", lat ?? null, lon ?? null, radius ?? null] as const,
  nearby: (lat: number, lon: number, radius: number) =>
    ["providers", "nearby", lat, lon, radius] as const,
  detail: (id: string) => ["providers", id] as const,
  services: (id: string) => ["providers", id, "services"] as const,
};

export type UsePublicProvidersOptions = {
  /** When false, the query does not run (e.g. wait until Clerk token is on the axios client). */
  enabled?: boolean;
};

/** All providers for discovery (optional geo filter via query params). */
export function usePublicProviders(
  lat?: number,
  lon?: number,
  radiusKm = 25,
  options?: UsePublicProvidersOptions
) {
  const params = new URLSearchParams();
  if (lat != null && lon != null) {
    params.set("lat", String(lat));
    params.set("lon", String(lon));
    params.set("radius", String(radiusKm));
  }
  const qs = params.toString();

  return useQuery({
    queryKey: providerKeys.list(lat, lon, radiusKm),
    queryFn: async () => {
      const { data } = await apiClient.get<ProviderPublicSummary[]>(
        `/api/v1/providers${qs ? `?${qs}` : ""}`
      );
      return data;
    },
    enabled: options?.enabled !== false,
  });
}

export function useNearbyProviders(lat: number, lon: number, radiusKm = 10) {
  return useQuery({
    queryKey: providerKeys.nearby(lat, lon, radiusKm),
    queryFn: async () => {
      const { data } = await apiClient.get<ProviderPublicSummary[]>(
        `/api/v1/providers?lat=${lat}&lon=${lon}&radius=${radiusKm}`
      );
      return data;
    },
    enabled: !!lat && !!lon,
  });
}

export function useProvider(id: string) {
  return useQuery({
    queryKey: providerKeys.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get<ProviderPublicDetail>(`/api/v1/providers/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useProviderServices(providerId: string) {
  return useQuery({
    queryKey: providerKeys.services(providerId),
    queryFn: async () => {
      const { data } = await apiClient.get<ProviderServiceOffer[]>(
        `/api/v1/providers/${providerId}/services`
      );
      return data;
    },
    enabled: !!providerId,
  });
}
