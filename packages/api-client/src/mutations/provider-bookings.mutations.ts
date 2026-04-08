import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ProviderBookingView, UpdateBookingStatusInput } from "@repo/schemas";

import { apiClient } from "../client";
import { bookingKeys } from "../queries/bookings.queries";
import { notificationKeys } from "../queries/notifications.queries";
import { providerBookingKeys } from "../queries/provider-bookings.queries";

export function useUpdateProviderBookingStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { bookingId: string; input: UpdateBookingStatusInput }) => {
      const { data } = await apiClient.patch<ProviderBookingView>(
        `/api/v1/provider/bookings/${args.bookingId}/status`,
        args.input
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: providerBookingKeys.all() });
      queryClient.invalidateQueries({ queryKey: bookingKeys.all() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
    },
  });
}
