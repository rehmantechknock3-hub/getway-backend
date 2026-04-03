import { useQuery } from "@tanstack/react-query";
import type { FavoriteProviderListResponse } from "@repo/schemas";

import { apiClient } from "../client";

export const favoriteKeys = {
  all:  () => ["favorites"] as const,
  list: () => ["favorites", "list"] as const,
};

export function useFavoriteProviders(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: favoriteKeys.list(),
    queryFn: async () => {
      const { data } = await apiClient.get<FavoriteProviderListResponse>(
        "/api/v1/favorites"
      );
      return data;
    },
    enabled: options?.enabled ?? true,
  });
}
