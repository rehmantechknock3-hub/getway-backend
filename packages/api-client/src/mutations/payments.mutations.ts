import { useMutation } from "@tanstack/react-query";

import { CreatePaymentIntentResponseSchema, type CreatePaymentIntentResponse } from "@repo/schemas";

import { apiClient } from "../client";

/** Authorizes payment for a booking (manual capture — the provider's COMPLETED transition captures it). */
export function useCreatePaymentIntent() {
  return useMutation({
    mutationFn: async (bookingId: string): Promise<CreatePaymentIntentResponse> => {
      const { data } = await apiClient.post<unknown>(`/api/v1/payments/bookings/${bookingId}/intent`);
      return CreatePaymentIntentResponseSchema.parse(data);
    },
  });
}
