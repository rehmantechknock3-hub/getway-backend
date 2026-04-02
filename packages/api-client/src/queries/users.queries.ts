import { useQuery } from "@tanstack/react-query";
import type { User } from "@repo/schemas";
import { apiClient } from "../client";

export const userKeys = {
  me: () => ["users", "me"] as const,
};

export function useMe() {
  return useQuery({
    queryKey: userKeys.me(),
    queryFn: async () => {
      const { data } = await apiClient.get<User>("/api/v1/users/me");
      return data;
    },
  });
}
