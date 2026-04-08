import { useQuery } from "@tanstack/react-query";

import type { ProviderBookingListResponse, ProviderBookingView } from "@repo/schemas";

import { apiClient } from "../client";

export type ProviderBookingsScope = "queue" | "history" | "all";

export const providerBookingKeys = {
  all: () => ["provider", "bookings"] as const,
  list: (page = 1, scope: ProviderBookingsScope = "queue") =>
    ["provider", "bookings", "list", page, scope] as const,
  detail: (id: string) => ["provider", "bookings", id] as const,
};

export function useProviderBookings(
  page = 1,
  options?: { enabled?: boolean; scope?: ProviderBookingsScope }
) {
  const scope = options?.scope ?? "queue";
  return useQuery({
    queryKey: providerBookingKeys.list(page, scope),
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        scope,
      });
      const { data } = await apiClient.get<ProviderBookingListResponse>(
        `/api/v1/provider/bookings?${params.toString()}`
      );
      return data;
    },
    enabled: options?.enabled ?? true,
  });
}

export function useProviderBooking(id: string, options?: { enabled?: boolean }) {
  const enabled = (options?.enabled ?? true) && !!id;
  return useQuery({
    queryKey: providerBookingKeys.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get<ProviderBookingView>(
        `/api/v1/provider/bookings/${id}`
      );
      return data;
    },
    enabled,
  });
}
