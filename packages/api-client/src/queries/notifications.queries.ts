import { useQuery } from "@tanstack/react-query";

import type { NotificationListResponse } from "@repo/schemas";

import { apiClient } from "../client";

export const notificationKeys = {
  all: () => ["notifications"] as const,
  list: (page = 1) => ["notifications", "list", page] as const,
};

export function useNotifications(page = 1, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: notificationKeys.list(page),
    queryFn: async () => {
      const { data } = await apiClient.get<NotificationListResponse>(
        `/api/v1/notifications?page=${page}`
      );
      return data;
    },
    enabled: options?.enabled ?? true,
  });
}
