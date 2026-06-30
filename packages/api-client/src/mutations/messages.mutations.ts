import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Message } from "@repo/schemas";

import { apiClient } from "../client";
import { messageKeys } from "../queries/messages.queries";

export function useMarkMessagesRead(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // Reading messages via the list endpoint marks them as read server-side.
      // This mutation explicitly refetches the conversation list to update unread badges.
      await queryClient.invalidateQueries({ queryKey: messageKeys.conversations() });
    },
  });
}

export function useInvalidateConversations() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: messageKeys.conversations() });
}

// Used to optimistically append a WS-delivered message into the React Query cache.
export function useAppendMessage(conversationId: string, page = 1) {
  const queryClient = useQueryClient();
  return (message: Message) => {
    queryClient.setQueryData(
      messageKeys.messages(conversationId, page),
      (prev: { data: Message[]; total: number; page: number; limit: number } | undefined) => {
        if (!prev) return prev;
        const exists = prev.data.some((m) => m.id === message.id);
        if (exists) return prev;
        return { ...prev, data: [...prev.data, message], total: prev.total + 1 };
      }
    );
    queryClient.invalidateQueries({ queryKey: messageKeys.conversations() });
  };
}
