import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";

import { favoriteKeys } from "../queries/favorites.queries";

export function useAddFavoriteProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (providerId: string) => {
      await apiClient.post(`/api/v1/favorites/${providerId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoriteKeys.all() });
    },
  });
}

export function useRemoveFavoriteProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (providerId: string) => {
      await apiClient.delete(`/api/v1/favorites/${providerId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoriteKeys.all() });
    },
  });
}
