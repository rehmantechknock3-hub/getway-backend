import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import type { User } from "@repo/schemas";

import { apiClient } from "../client";

export const userKeys = {
  me: (clerkUserId?: string | null) => ["users", "me", clerkUserId ?? "anonymous"] as const,
};

export type UseMeOptions = {
  /** When false, the query does not run (e.g. wait until signed in). Defaults to true. */
  enabled?: boolean;
  /** Scope the cache per Clerk user so switching accounts never serves stale data. */
  clerkUserId?: string | null;
};

export function useMe(options?: UseMeOptions) {
  return useQuery({
    queryKey: userKeys.me(options?.clerkUserId),
    queryFn: async () => {
      const { data } = await apiClient.get<User>("/api/v1/users/me");
      return data;
    },
    enabled: options?.enabled ?? true,
    // First fetch after reload can race Clerk → setAuthToken; retry 401s briefly.
    retry: (failureCount, error) => {
      if (failureCount >= 5) return false;
      if (isAxiosError(error) && error.response?.status === 401) return true;
      return failureCount < 2;
    },
    retryDelay: (attempt) => Math.min(120 * 2 ** attempt, 2_000),
  });
}
