import { useQuery } from "@tanstack/react-query";

import type { AdminBookingListResponse, BookingStatus } from "@repo/schemas";

import { apiClient } from "../client";

export const adminBookingKeys = {
  all: () => ["admin", "bookings"] as const,
  list: (
    page: number,
    status?: BookingStatus,
    fromDate?: string,
    toDate?: string,
  ) =>
    [
      "admin",
      "bookings",
      "list",
      page,
      status ?? "ALL",
      fromDate ?? "",
      toDate ?? "",
    ] as const,
};

export function useAdminBookings(
  page = 1,
  options?: {
    enabled?: boolean;
    status?: BookingStatus;
    fromDate?: string;
    toDate?: string;
  },
) {
  const status = options?.status;
  const fromDate = options?.fromDate?.trim() || undefined;
  const toDate = options?.toDate?.trim() || undefined;
  return useQuery({
    queryKey: adminBookingKeys.list(page, status, fromDate, toDate),
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page) });
      if (status) params.set("status", status);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const { data } = await apiClient.get<AdminBookingListResponse>(
        `/api/v1/admin/bookings?${params.toString()}`,
      );
      return data;
    },
    enabled: options?.enabled ?? true,
  });
}
