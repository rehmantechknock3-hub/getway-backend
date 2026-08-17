import { useCallback } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Conversation, Message, MessageListResponse, SendMessageBody } from "@repo/schemas";

import { apiClient } from "../client";
import { messageKeys } from "../queries/messages.queries";

const TEMP_ID_PREFIX = "temp-";

function isTempMessage(message: Message): boolean {
  return message.id.startsWith(TEMP_ID_PREFIX);
}

/** Insert a message, or replace a matching optimistic row so REST/WS don't double-add. */
function mergeMessageIntoList(
  prev: MessageListResponse | undefined,
  message: Message,
  page: number,
  replaceId?: string
): MessageListResponse {
  if (!prev) {
    return { data: [message], total: 1, page, limit: 50 };
  }

  if (prev.data.some((m) => m.id === message.id)) {
    if (!replaceId) return prev;
    const data = prev.data.filter((m) => m.id !== replaceId);
    if (data.length === prev.data.length) return prev;
    return { ...prev, data, total: Math.max(0, prev.total - 1) };
  }

  if (replaceId) {
    const idx = prev.data.findIndex((m) => m.id === replaceId);
    if (idx >= 0) {
      const data = [...prev.data];
      data[idx] = message;
      return { ...prev, data };
    }
  }

  if (!isTempMessage(message)) {
    const tempIdx = prev.data.findIndex(
      (m) =>
        isTempMessage(m) &&
        m.senderId === message.senderId &&
        m.content === message.content
    );
    if (tempIdx >= 0) {
      const data = [...prev.data];
      data[tempIdx] = message;
      return { ...prev, data };
    }
  }

  return { ...prev, data: [...prev.data, message], total: prev.total + 1 };
}

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

export function useOrCreateAdminThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<Conversation>("/api/v1/messages/admin-thread");
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: messageKeys.conversations() });
    },
  });
}

export function useSendMessage(conversationId: string, page = 1, senderId?: string) {
  const queryClient = useQueryClient();
  const listKey = messageKeys.messages(conversationId, page);

  return useMutation({
    mutationFn: async (body: SendMessageBody) => {
      const { data } = await apiClient.post<Message>(
        `/api/v1/messages/conversations/${conversationId}/messages`,
        body
      );
      return data;
    },
    onMutate: async (body) => {
      if (!senderId) {
        await queryClient.cancelQueries({ queryKey: listKey });
        return { tempId: undefined };
      }

      const tempId = `${TEMP_ID_PREFIX}${Date.now()}`;
      const optimistic: Message = {
        id: tempId,
        conversationId,
        senderId,
        type: body.type ?? "TEXT",
        content: body.content,
        createdAt: new Date(),
      };
      const applyOptimistic = () =>
        queryClient.setQueryData(listKey, (prev: MessageListResponse | undefined) =>
          mergeMessageIntoList(prev, optimistic, page)
        );

      // Write before any await so the bubble is on screen in the same tap as the composer clear.
      applyOptimistic();
      await queryClient.cancelQueries({ queryKey: listKey });
      applyOptimistic();
      return { tempId };
    },
    onError: (_err, _body, ctx) => {
      if (!ctx?.tempId) return;
      queryClient.setQueryData(listKey, (prev: MessageListResponse | undefined) => {
        if (!prev) return prev;
        const data = prev.data.filter((m) => m.id !== ctx.tempId);
        if (data.length === prev.data.length) return prev;
        return { ...prev, data, total: Math.max(0, prev.total - 1) };
      });
    },
    onSuccess: (message, _body, ctx) => {
      queryClient.setQueryData(listKey, (prev: MessageListResponse | undefined) =>
        mergeMessageIntoList(prev, message, page, ctx?.tempId)
      );
      void queryClient.invalidateQueries({ queryKey: messageKeys.conversations() });
    },
  });
}

// Used to append a WS-delivered message into the React Query cache.
export function useAppendMessage(conversationId: string, page = 1) {
  const queryClient = useQueryClient();
  return useCallback(
    (message: Message) => {
      queryClient.setQueryData(
        messageKeys.messages(conversationId, page),
        (prev: MessageListResponse | undefined) => mergeMessageIntoList(prev, message, page)
      );
      void queryClient.invalidateQueries({ queryKey: messageKeys.conversations() });
    },
    [conversationId, page, queryClient]
  );
}
