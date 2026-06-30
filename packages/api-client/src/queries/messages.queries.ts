import { useQuery } from "@tanstack/react-query";

import type {
  Conversation,
  ConversationListItem,
  MessageListResponse,
} from "@repo/schemas";

import { apiClient } from "../client";

export const messageKeys = {
  conversations:          () => ["messages", "conversations"] as const,
  conversation:           (bookingId: string) => ["messages", "conversation", bookingId] as const,
  messages:               (conversationId: string, page: number) =>
    ["messages", "list", conversationId, page] as const,
};

export function useConversations(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: messageKeys.conversations(),
    queryFn: async () => {
      const { data } = await apiClient.get<ConversationListItem[]>(
        "/api/v1/messages/conversations"
      );
      return data;
    },
    enabled: options?.enabled ?? true,
  });
}

export function useOrCreateConversation(
  bookingId: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: messageKeys.conversation(bookingId),
    queryFn: async () => {
      const { data } = await apiClient.post<Conversation>(
        `/api/v1/messages/conversations/${bookingId}`
      );
      return data;
    },
    enabled: (options?.enabled ?? true) && !!bookingId,
  });
}

export function useMessages(
  conversationId: string,
  page = 1,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: messageKeys.messages(conversationId, page),
    queryFn: async () => {
      const { data } = await apiClient.get<MessageListResponse>(
        `/api/v1/messages/conversations/${conversationId}/messages?page=${page}&limit=50`
      );
      return data;
    },
    enabled: (options?.enabled ?? true) && !!conversationId,
  });
}
