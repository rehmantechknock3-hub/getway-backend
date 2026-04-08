import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../client";
import type { BookingListResponse, BookingWithReview } from "@repo/schemas";

export const bookingKeys = {
  all:    ()           => ["bookings"]           as const,
  list:   (page = 1)   => ["bookings", "list", page] as const,
  detail: (id: string) => ["bookings", id]       as const,
};

export function useBookings(
  page = 1,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: bookingKeys.list(page),
    queryFn: async () => {
      const { data } = await apiClient.get<BookingListResponse>(
        `/api/v1/bookings?page=${page}`
      );
      return data;
    },
    enabled: options?.enabled ?? true,
  });
}

export function useBooking(id: string, options?: { enabled?: boolean }) {
  const enabled = (options?.enabled ?? true) && !!id;
  return useQuery({
    queryKey: bookingKeys.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get<BookingWithReview>(`/api/v1/bookings/${id}`);
      return data;
    },
    enabled,
  });
}
