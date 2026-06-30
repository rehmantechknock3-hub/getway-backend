import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";
import { bookingKeys } from "../queries/bookings.queries";
import { favoriteKeys } from "../queries/favorites.queries";
import { providerKeys } from "../queries/providers.queries";
import { providerReviewKeys } from "../queries/provider-reviews.queries";
import { userKeys } from "../queries/users.queries";
import type {
  Booking,
  CreateBookingInput,
  UpdateBookingStatusInput,
  CreateReviewInput,
  Review,
} from "@repo/schemas";

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBookingInput) => {
      const { data } = await apiClient.post<Booking>("/api/v1/bookings", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.all() });
    },
  });
}

export function useUpdateBookingStatus(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateBookingStatusInput) => {
      const { data } = await apiClient.patch<Booking>(
        `/api/v1/bookings/${bookingId}/status`,
        input
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.detail(bookingId) });
      queryClient.invalidateQueries({ queryKey: bookingKeys.all() });
    },
  });
}

export function useCreateReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateReviewInput) => {
      const { data } = await apiClient.post<Review>("/api/v1/reviews", input);
      return data;
    },
    onSuccess: async (review) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: bookingKeys.detail(review.bookingId),
          refetchType: "all",
        }),
        queryClient.invalidateQueries({ queryKey: bookingKeys.all(), refetchType: "all" }),
        queryClient.invalidateQueries({ queryKey: providerKeys.all(), refetchType: "all" }),
        queryClient.invalidateQueries({ queryKey: favoriteKeys.all(), refetchType: "all" }),
        queryClient.invalidateQueries({ queryKey: providerReviewKeys.all(), refetchType: "all" }),
        queryClient.invalidateQueries({ queryKey: userKeys.me(), refetchType: "all" }),
      ]);
    },
  });
}
