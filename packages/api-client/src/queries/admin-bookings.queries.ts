import { useQuery } from "@tanstack/react-query";

import type { BookingListResponse } from "@repo/schemas";

import { apiClient } from "../client";

export const adminBookingKeys = {
  all: () => ["admin", "bookings"] as const,
  list: (page: number) => ["admin", "bookings", "list", page] as const,
};

export function useAdminBookings(page = 1, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: adminBookingKeys.list(page),
    queryFn: async () => {
      const { data } = await apiClient.get<BookingListResponse>(
        `/api/v1/admin/bookings?page=${page}`
      );
      return data;
    },
    enabled: options?.enabled ?? true,
  });
}
