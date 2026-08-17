import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  AdminMessageThreadList,
  Conversation,
  Message,
  MessageListResponse,
  OpenAdminThreadInput,
  SendMessageBody,
} from "@repo/schemas";

import { apiClient } from "../client";

export const adminMessageKeys = {
  all: () => ["admin", "messages"] as const,
  threads: (page: number) => ["admin", "messages", "threads", page] as const,
  messages: (conversationId: string, page: number) =>
    ["admin", "messages", "list", conversationId, page] as const,
};

export function useAdminMessageThreads(page = 1, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: adminMessageKeys.threads(page),
    queryFn: async () => {
      const { data } = await apiClient.get<AdminMessageThreadList>(
        `/api/v1/admin/messages?page=${page}&limit=30`,
      );
      return data;
    },
    enabled: options?.enabled ?? true,
    refetchInterval: 5_000,
  });
}

export function useAdminOpenProviderThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: OpenAdminThreadInput) => {
      const { data } = await apiClient.post<Conversation>(
        "/api/v1/admin/messages/threads",
        input,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminMessageKeys.all() });
    },
  });
}

export function useAdminThreadMessages(
  conversationId: string,
  page = 1,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: adminMessageKeys.messages(conversationId, page),
    queryFn: async () => {
      const { data } = await apiClient.get<MessageListResponse>(
        `/api/v1/admin/messages/${conversationId}/messages?page=${page}&limit=50`,
      );
      return data;
    },
    enabled: (options?.enabled ?? true) && Boolean(conversationId),
    refetchInterval: 5_000,
  });
}

export function useAdminSendMessage(conversationId: string, page = 1) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: SendMessageBody) => {
      const { data } = await apiClient.post<Message>(
        `/api/v1/admin/messages/${conversationId}/messages`,
        body,
      );
      return data;
    },
    onSuccess: (message) => {
      queryClient.setQueryData(
        adminMessageKeys.messages(conversationId, page),
        (prev: MessageListResponse | undefined) => {
          if (!prev) {
            return { data: [message], total: 1, page, limit: 50 };
          }
          if (prev.data.some((m) => m.id === message.id)) return prev;
          return { ...prev, data: [...prev.data, message], total: prev.total + 1 };
        },
      );
      void queryClient.invalidateQueries({ queryKey: adminMessageKeys.all() });
    },
  });
}
