import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Notification } from "@repo/schemas";

import { apiClient } from "../client";
import { notificationKeys } from "../queries/notifications.queries";

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { data } = await apiClient.patch<Notification>(
        `/api/v1/notifications/${notificationId}/read`
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      await apiClient.delete(`/api/v1/notifications/${notificationId}`);
      return notificationId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
    },
  });
}

export function useClearAllNotifications() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiClient.delete("/api/v1/notifications");
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
    },
  });
}
