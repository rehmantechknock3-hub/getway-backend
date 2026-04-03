import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { AdminCreateBookingInput, Booking } from "@repo/schemas";

import { apiClient } from "../client";
import { adminBookingKeys } from "../queries/admin-bookings.queries";

export function useAdminCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdminCreateBookingInput) => {
      const { data } = await apiClient.post<Booking>("/api/v1/admin/bookings", input);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminBookingKeys.all() });
    },
  });
}
