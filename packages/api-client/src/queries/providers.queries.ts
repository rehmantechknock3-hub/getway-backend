import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../client";
import type { ProviderProfile, Service } from "@repo/schemas";

export const providerKeys = {
  all:      ()           => ["providers"]               as const,
  nearby:   (lat: number, lon: number, radius: number) =>
              ["providers", "nearby", lat, lon, radius] as const,
  detail:   (id: string) => ["providers", id]           as const,
  services: (id: string) => ["providers", id, "services"] as const,
};

export function useNearbyProviders(
  lat: number,
  lon: number,
  radiusKm = 10
) {
  return useQuery({
    queryKey: providerKeys.nearby(lat, lon, radiusKm),
    queryFn: async () => {
      const { data } = await apiClient.get<ProviderProfile[]>(
        `/api/v1/providers/nearby?lat=${lat}&lon=${lon}&radius=${radiusKm}`
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
      const { data } = await apiClient.get<ProviderProfile>(
        `/api/v1/providers/${id}`
      );
      return data;
    },
    enabled: !!id,
  });
}

export function useProviderServices(providerId: string) {
  return useQuery({
    queryKey: providerKeys.services(providerId),
    queryFn: async () => {
      const { data } = await apiClient.get<Service[]>(
        `/api/v1/providers/${providerId}/services`
      );
      return data;
    },
    enabled: !!providerId,
  });
}
