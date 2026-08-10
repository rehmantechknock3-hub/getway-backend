import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ActivityIndicator,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { io, type Socket } from "socket.io-client";

import {
  useAppendMessage,
  useConversations,
  useMe,
  useMessages,
  useOrCreateConversation,
} from "@repo/api-client";
import type { Message } from "@repo/schemas";
import { reportError } from "@repo/utils";

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

function OutgoingBubble({ msg }: { msg: ProcessedMessage }) {
  return (
    <View className={`self-end max-w-[78%] ${msg.isLast ? "mb-2" : "mb-0.5"}`}>
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
    </View>
  );
}

function IncomingBubble({
  msg,
  otherInitial,
}: {
  msg: ProcessedMessage;
  otherInitial: string;
}) {
  return (
    <View
      className={`self-start flex-row items-end max-w-[80%] ${msg.isLast ? "mb-2" : "mb-0.5"}`}
      style={{ paddingLeft: 8 }}
    >
      <View className="w-7 h-7 flex-shrink-0 mr-1.5 items-center justify-center">
        {msg.isLast ? (
          <View
            className="w-7 h-7 rounded-full items-center justify-center"
            style={{ backgroundColor: appColors.primary[100] }}
          >
            <Text
              style={{
                color: appColors.primary[700],
                fontSize: 11,
                fontWeight: "700",
              }}
            >
              {otherInitial.toUpperCase()}
            </Text>
          </View>
        ) : null}
      </View>

      <View
        className="bg-canvas-raised px-3.5 pt-2.5 pb-2 border border-ink-faint"
        style={{
          borderRadius: 18,
          borderBottomLeftRadius: msg.isLast ? 4 : 18,
        }}
      >
        <Text className="text-ink text-sm leading-5">{msg.content}</Text>
        <Text className="text-ink-subtle text-right mt-1" style={{ fontSize: 10 }}>
          {formatTime(msg.createdAt)}
        </Text>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ProviderConversationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { conversationId, bookingId } = useLocalSearchParams<{
    conversationId: string;
    bookingId?: string;
  }>();
  const { userId: clerkUserId, getToken, isLoaded, isSignedIn } = useAuth();
  const { data: me } = useMe({ enabled: isLoaded && isSignedIn, clerkUserId });
  const myDbId = me?.id;

  const [inputText, setInputText] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const getTokenRef = useRef(getToken);
  const reconnectingRef = useRef(false);
  const listRef = useRef<FlatList<ProcessedMessage>>(null);

  const isNew = conversationId === "new";
  const enabled = isLoaded && isSignedIn && (!!conversationId || !!bookingId);

  const { data: createdConv } = useOrCreateConversation(bookingId ?? "", {
    enabled: isNew && !!bookingId,
  });

  useEffect(() => {
    if (isNew && createdConv?.id) {
      router.replace(`/(provider)/conversation/${createdConv.id}?bookingId=${bookingId ?? ""}`);
    }
  }, [isNew, createdConv?.id, bookingId, router]);

  const realConversationId = isNew ? (createdConv?.id ?? "") : conversationId;

  const { data: convList } = useConversations({ enabled: !isNew && enabled });
  const conversation = convList?.find((c) => c.id === realConversationId);
  const otherInitial = conversation?.otherPartyFirstName?.charAt(0) ?? "?";
  const otherName = conversation
    ? `${conversation.otherPartyFirstName} ${conversation.otherPartyLastName}`.trim()
    : "Customer";

  const { data: messagesData, isLoading } = useMessages(realConversationId, 1, {
    enabled: !isNew && !!realConversationId,
  });
  const appendMessage = useAppendMessage(realConversationId, 1);

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
      "http://localhost:3001"
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
        .catch((e: unknown) => reportError(e, { screen: "ProviderConversation", action: "reconnect" }))
        .finally(() => { reconnectingRef.current = false; });
    };

    client.on("connect", () => setSocketConnected(true));
    client.on("disconnect", (r) => { setSocketConnected(false); if (r !== "io client disconnect") reconnect(); });
    client.on("connect_error", () => { setSocketConnected(false); reconnect(); });
    client.on("message:received", (msg: Message) => { appendMessage(msg); scrollToBottom(true); });

    const sub = AppState.addEventListener("change", (s) => { if (s === "active" && !client.connected) reconnect(); });

    if (cancelled) { client.disconnect(); return; }
    socketRef.current = client;

    return () => {
      cancelled = true;
      sub.remove();
      client.off("connect"); client.off("disconnect"); client.off("connect_error"); client.off("message:received");
      client.disconnect();
      socketRef.current = null;
    };
  }, [isNew, realConversationId]);

  const sendMessage = useCallback(() => {
    const text = inputText.trim();
    if (!text || !socketRef.current?.connected) return;
    setInputText("");
    socketRef.current.emit("message:send", { conversationId: realConversationId, content: text, type: "TEXT" });
    setTimeout(() => scrollToBottom(true), 80);
  }, [inputText, conversationId, scrollToBottom]);

  const canSend = inputText.trim().length > 0 && socketConnected;

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={insets.bottom}
      style={{ backgroundColor: appColors.canvas.DEFAULT }}
    >
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

        <View
          className="w-9 h-9 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: appColors.primary[100] }}
        >
          <Text style={{ color: appColors.primary[700], fontSize: 15, fontWeight: "700" }}>
            {otherInitial.toUpperCase()}
          </Text>
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
              {socketConnected ? "Online" : "Connecting…"}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Messages ────────────────────────────────────────────────────── */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
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
                  <OutgoingBubble msg={item} />
                ) : (
                  <IncomingBubble msg={item} otherInitial={otherInitial} />
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
                Your messages with this customer are private and secure.
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollToBottom(false)}
          style={{ backgroundColor: appColors.canvas.sunken }}
        />
      )}

      {/* ── Input bar ───────────────────────────────────────────────────── */}
      <View
        className="bg-canvas-raised border-t border-ink-faint"
        style={{
          paddingHorizontal: 12,
          paddingTop: 10,
          paddingBottom: Math.max(insets.bottom + 8, 14),
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
            onPress={sendMessage}
            disabled={!canSend}
            className="items-center justify-center"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: canSend ? appColors.primary[600] : appColors.ink.faint,
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
    </KeyboardAvoidingView>
  );
}
