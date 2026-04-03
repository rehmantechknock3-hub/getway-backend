import { useQuery } from "@tanstack/react-query";

import type { ProviderReviewListResponse } from "@repo/schemas";

import { apiClient } from "../client";

export const providerReviewKeys = {
  all: () => ["provider", "reviews"] as const,
  list: (page = 1) => ["provider", "reviews", "list", page] as const,
};

export function useProviderReviews(page = 1, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: providerReviewKeys.list(page),
    queryFn: async () => {
      const { data } = await apiClient.get<ProviderReviewListResponse>(
        `/api/v1/provider/reviews?page=${page}`
      );
      return data;
    },
    enabled: options?.enabled ?? true,
  });
}
