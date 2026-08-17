import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ActivityIndicator,
  AppState,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";

import {
  messageKeys,
  useAppendMessage,
  useConversations,
  useMe,
  useMessages,
  useOrCreateConversation,
  useSendMessage,
} from "@repo/api-client";
import type { Message } from "@repo/schemas";
import { showToast } from "@repo/ui";
import { reportError } from "@repo/utils";

import { ChatAvatar } from "../../../components/ChatAvatar";
import { useKeyboardBottomInset } from "../../../hooks/useKeyboardBottomInset";
import { appColors } from "../../../styles/colors";
import { textInputBaselineStyle } from "../../../styles/text-input";

// ── Types ────────────────────────────────────────────────────────────────────

type ProcessedMessage = Message & {
  isFirst: boolean;
  isLast: boolean;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function processMessages(msgs: Message[]): ProcessedMessage[] {
  return msgs.map((msg, i) => ({
    ...msg,
    isFirst: !msgs[i - 1] || msgs[i - 1]!.senderId !== msg.senderId,
    isLast:  !msgs[i + 1] || msgs[i + 1]!.senderId !== msg.senderId,
  }));
}

function formatTime(date: Date | string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date instanceof Date ? date : new Date(date));
}

function formatDateLabel(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  }).format(d);
}

function isDifferentDay(a: Date | string, b: Date | string): boolean {
  return new Date(a).toDateString() !== new Date(b).toDateString();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DateSeparator({ date }: { date: Date | string }) {
  return (
    <View className="flex-row items-center my-3 px-4">
      <View className="flex-1 h-px bg-ink-faint" />
      <Text className="text-ink-subtle text-xs mx-3 font-medium">
        {formatDateLabel(date)}
      </Text>
      <View className="flex-1 h-px bg-ink-faint" />
    </View>
  );
}

function OutgoingBubble({
  msg,
  avatarUrl,
  name,
}: {
  msg: ProcessedMessage;
  avatarUrl?: string | null;
  name: string;
}) {
  return (
    <View
      className={`self-end flex-row items-end max-w-[86%] ${msg.isLast ? "mb-2" : "mb-0.5"}`}
    >
      <View
        className="bg-primary-600 px-3.5 pt-2.5 pb-2"
        style={{
          borderRadius: 18,
          borderBottomRightRadius: msg.isLast ? 4 : 18,
        }}
      >
        <Text className="text-white text-sm leading-5">{msg.content}</Text>
        <Text className="text-primary-100 text-xs text-right mt-1">
          {formatTime(msg.createdAt)}
        </Text>
      </View>
      <View className="w-7 h-7 flex-shrink-0 ml-1.5 items-center justify-center">
        {msg.isLast ? <ChatAvatar uri={avatarUrl} name={name} size="sm" /> : null}
      </View>
    </View>
  );
}

function IncomingBubble({
  msg,
  avatarUrl,
  name,
}: {
  msg: ProcessedMessage;
  avatarUrl?: string | null;
  name: string;
}) {
  return (
    <View
      className={`self-start flex-row items-end max-w-[86%] ${msg.isLast ? "mb-2" : "mb-0.5"}`}
      style={{ paddingLeft: 8 }}
    >
      <View className="w-7 h-7 flex-shrink-0 mr-1.5 items-center justify-center">
        {msg.isLast ? <ChatAvatar uri={avatarUrl} name={name} size="sm" /> : null}
      </View>

      <View
        className="bg-canvas-raised px-3.5 pt-2.5 pb-2 border border-ink-faint"
        style={{
          borderRadius: 18,
          borderBottomLeftRadius: msg.isLast ? 4 : 18,
        }}
      >
        <Text className="text-ink text-sm leading-5">{msg.content}</Text>
        <Text
          className="text-ink-subtle text-right mt-1"
          style={{ fontSize: 10 }}
        >
          {formatTime(msg.createdAt)}
        </Text>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CustomerConversationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { avoidedBottom, composerPaddingBottom } = useKeyboardBottomInset();
  const { conversationId, bookingId } = useLocalSearchParams<{
    conversationId: string;
    bookingId?: string;
  }>();
  const { userId: clerkUserId, getToken, isLoaded, isSignedIn } = useAuth();
  const { data: me } = useMe({ enabled: isLoaded && isSignedIn, clerkUserId });
  const myDbId = me?.id;

  const [inputText, setInputText] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [sending, setSending] = useState(false);
  const [composerHeight, setComposerHeight] = useState(64);
  const socketRef = useRef<Socket | null>(null);
  const getTokenRef = useRef(getToken);
  const reconnectingRef = useRef(false);
  const listRef = useRef<FlatList<ProcessedMessage>>(null);

  const isNew = conversationId === "new";
  const enabled = isLoaded && isSignedIn && (!!conversationId || !!bookingId);

  // For "new" route: create/fetch conversation by bookingId, then redirect to its ID
  const { data: createdConv } = useOrCreateConversation(bookingId ?? "", {
    enabled: isNew && !!bookingId,
  });

  // Once we have the real ID, replace the route so the URL is canonical
  useEffect(() => {
    if (isNew && createdConv?.id) {
      router.replace(`/(customer)/conversation/${createdConv.id}?bookingId=${bookingId ?? ""}`);
    }
  }, [isNew, createdConv?.id, bookingId, router]);

  const realConversationId = isNew ? (createdConv?.id ?? "") : conversationId;

  const { data: convList } = useConversations({ enabled: !isNew && enabled });
  const conversation = convList?.find((c) => c.id === realConversationId);
  const otherName = conversation
    ? `${conversation.otherPartyFirstName} ${conversation.otherPartyLastName}`.trim()
    : "Chat";
  const otherAvatarUrl = conversation?.otherPartyAvatarUrl ?? null;
  const myName = `${me?.firstName ?? ""} ${me?.lastName ?? ""}`.trim() || "You";
  const myAvatarUrl = me?.avatarUrl ?? me?.providerOnboarding?.profilePhotoUrl ?? null;

  const { data: messagesData, isLoading } = useMessages(realConversationId, 1, {
    enabled: !isNew && !!realConversationId,
  });
  const appendMessage = useAppendMessage(realConversationId, 1);
  const sendMessageMutation = useSendMessage(realConversationId, 1, myDbId);

  const processedMessages = useMemo(
    () => processMessages(messagesData?.data ?? []),
    [messagesData?.data]
  );

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const scrollToBottom = useCallback((animated = true) => {
    listRef.current?.scrollToEnd({ animated });
  }, []);

  useEffect(() => {
    if (processedMessages.length > 0) setTimeout(() => scrollToBottom(false), 60);
  }, [processedMessages.length, scrollToBottom]);

  useEffect(() => {
    if (avoidedBottom > 0) setTimeout(() => scrollToBottom(true), 50);
  }, [avoidedBottom, scrollToBottom]);

  // Socket
  useEffect(() => {
    if (isNew || !realConversationId) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }
    if (socketRef.current != null) return;

    let cancelled = false;
    const base = (
      process.env.EXPO_PUBLIC_SOCKET_URL ??
      process.env.EXPO_PUBLIC_API_URL ??
      "http://127.0.0.1:3010"
    ).trim().replace(/\/$/, "");

    const client = io(`${base}/chat`, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 5_000,
      query: { conversationId: realConversationId },
      auth: (cb) => void getTokenRef.current({ skipCache: true }).then((t) => cb({ token: t ?? "" })),
    });

    const reconnect = () => {
      if (reconnectingRef.current) return;
      reconnectingRef.current = true;
      void getTokenRef.current({ skipCache: true })
        .then((t) => { client.auth = { token: t ?? "" }; if (!client.connected) client.connect(); })
        .catch((e: unknown) => reportError(e, { screen: "CustomerConversation", action: "reconnect" }))
        .finally(() => { reconnectingRef.current = false; });
    };

    client.on("connect", () => {
      setSocketConnected(true);
      void queryClient.invalidateQueries({
        queryKey: messageKeys.messages(realConversationId, 1),
      });
    });
    client.on("disconnect", (r) => { setSocketConnected(false); if (r !== "io client disconnect") reconnect(); });
    client.on("connect_error", () => { setSocketConnected(false); reconnect(); });
    client.on("message:received", (msg: Message) => { appendMessage(msg); scrollToBottom(true); });

    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        void queryClient.invalidateQueries({
          queryKey: messageKeys.messages(realConversationId, 1),
        });
        if (!client.connected) reconnect();
      }
    });

    if (cancelled) { client.disconnect(); return; }
    socketRef.current = client;

    return () => {
      cancelled = true;
      sub.remove();
      client.off("connect"); client.off("disconnect"); client.off("connect_error"); client.off("message:received");
      client.disconnect();
      socketRef.current = null;
    };
  }, [isNew, realConversationId, appendMessage, queryClient, scrollToBottom]);

  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || !realConversationId || sending) return;
    setInputText("");
    setSending(true);
    try {
      // Always persist over REST so offline peers still receive the message when they return.
      // Socket remains for live delivery to anyone currently in the room.
      const sendPromise = sendMessageMutation.mutateAsync({ content: text, type: "TEXT" });
      setTimeout(() => scrollToBottom(true), 80);
      await sendPromise;
    } catch (error: unknown) {
      setInputText(text);
      reportError(error, { screen: "CustomerConversation", action: "sendMessage" });
      showToast("error", "Could not send message. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }, [inputText, realConversationId, sending, sendMessageMutation, scrollToBottom]);

  const canSend = inputText.trim().length > 0 && !sending && !!realConversationId;

  return (
    <View className="flex-1" style={{ backgroundColor: appColors.canvas.DEFAULT }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View
        className="flex-row items-center px-4 border-b border-ink-faint bg-canvas-raised"
        style={{
          paddingTop: insets.top + 10,
          paddingBottom: 12,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="mr-2 p-1"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={28} color={appColors.primary[600]} />
        </TouchableOpacity>

        <View className="mr-3">
          <ChatAvatar uri={otherAvatarUrl} name={otherName} size="md" />
        </View>

        <View className="flex-1">
          <Text className="text-ink font-bold text-[15px]" numberOfLines={1}>
            {otherName}
          </Text>
          <View className="flex-row items-center mt-0.5 gap-1.5">
            <View
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: socketConnected
                  ? appColors.semantic.success
                  : appColors.ink.faint,
              }}
            />
            <Text className="text-ink-muted text-xs">
              {socketConnected ? "Connected" : "Reconnecting…"}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Messages ────────────────────────────────────────────────────── */}
      {isLoading ? (
        <View
          className="flex-1 items-center justify-center"
          style={{ marginBottom: composerHeight + avoidedBottom }}
        >
          <ActivityIndicator color={appColors.primary[600]} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={processedMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => {
            const prevMsg = processedMessages[index - 1];
            const showSeparator =
              !prevMsg || isDifferentDay(prevMsg.createdAt, item.createdAt);
            const isMine = item.senderId === myDbId;
            return (
              <>
                {showSeparator ? <DateSeparator date={item.createdAt} /> : null}
                {isMine ? (
                  <OutgoingBubble msg={item} avatarUrl={myAvatarUrl} name={myName} />
                ) : (
                  <IncomingBubble msg={item} avatarUrl={otherAvatarUrl} name={otherName} />
                )}
              </>
            );
          }}
          contentContainerStyle={{
            paddingHorizontal: 12,
            paddingTop: 12,
            paddingBottom: 8,
            flexGrow: 1,
            justifyContent: processedMessages.length === 0 ? "center" : "flex-end",
          }}
          ListEmptyComponent={
            <View className="items-center px-8">
              <View
                className="w-16 h-16 rounded-full items-center justify-center mb-4"
                style={{ backgroundColor: appColors.primary[50] }}
              >
                <Ionicons name="chatbubbles-outline" size={32} color={appColors.primary[400]} />
              </View>
              <Text className="text-ink font-semibold text-base mb-1">No messages yet</Text>
              <Text className="text-ink-muted text-sm text-center leading-5">
                Say hello! Your messages are private between you and the provider.
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollToBottom(false)}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          style={{
            backgroundColor: appColors.canvas.sunken,
            marginBottom: composerHeight + avoidedBottom,
          }}
        />
      )}

      {/* ── Input bar (pinned above keyboard) ───────────────────────────── */}
      <View
        className="bg-canvas-raised border-t border-ink-faint"
        onLayout={(event) => {
          const next = Math.ceil(event.nativeEvent.layout.height);
          if (next > 0 && next !== composerHeight) setComposerHeight(next);
        }}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: avoidedBottom,
          paddingHorizontal: 12,
          paddingTop: 10,
          paddingBottom: composerPaddingBottom,
        }}
      >
        <View className="flex-row items-end gap-2">
          <TextInput
            className="flex-1 bg-canvas-sunken rounded-3xl px-4 text-ink text-sm"
            style={[
              textInputBaselineStyle,
              {
                minHeight: 40,
                maxHeight: 120,
                paddingTop: 10,
                paddingBottom: 10,
                borderWidth: 1,
                borderColor: appColors.ink.faint,
              },
            ]}
            placeholder="Type a message…"
            placeholderTextColor={appColors.ink.subtle}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={2000}
            returnKeyType="default"
            blurOnSubmit={false}
            accessibilityLabel="Message input"
          />
          <TouchableOpacity
            onPress={() => void sendMessage()}
            disabled={!canSend}
            className="items-center justify-center"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: canSend ? appColors.primary[600] : appColors.ink.faint,
              marginBottom: 0,
            }}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <Ionicons
              name="send"
              size={17}
              color={canSend ? appColors.onPrimary : appColors.ink.subtle}
              style={{ marginLeft: 2 }}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
