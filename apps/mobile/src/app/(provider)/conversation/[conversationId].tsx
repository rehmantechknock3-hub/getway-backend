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

import { ChatAvatar, wayNowLogoSource } from "../../../components/ChatAvatar";
import {
  ChatThreadBackdrop,
  DateSeparator,
  IncomingBubble,
  OutgoingBubble,
  isDifferentDay,
  processMessages,
  type ProcessedMessage,
} from "../../../components/ChatBubbles";
import { useKeyboardBottomInset } from "../../../hooks/useKeyboardBottomInset";
import { appColors } from "../../../styles/colors";
import { textInputBaselineStyle } from "../../../styles/text-input";

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ProviderConversationScreen() {
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
  const isAdminChat =
    conversation?.kind === "PROVIDER_ADMIN" || (!bookingId && !isNew);
  const otherName = conversation
    ? `${conversation.otherPartyFirstName} ${conversation.otherPartyLastName}`.trim()
    : isAdminChat
      ? "WayNow Admin"
      : "Customer";
  const otherAvatarUrl = conversation?.otherPartyAvatarUrl ?? null;
  const otherAvatarSource = isAdminChat ? wayNowLogoSource : undefined;
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
        .catch((e: unknown) => reportError(e, { screen: "ProviderConversation", action: "reconnect" }))
        .finally(() => { reconnectingRef.current = false; });
    };

    client.on("connect", () => {
      setSocketConnected(true);
      // Pull anything stored while this client (or the peer) was offline.
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
      reportError(error, { screen: "ProviderConversation", action: "sendMessage" });
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
          <ChatAvatar
            uri={otherAvatarUrl}
            source={otherAvatarSource}
            name={otherName}
            size="md"
          />
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
      <View className="flex-1" style={{ marginBottom: composerHeight + avoidedBottom }}>
        <ChatThreadBackdrop />
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
                    <OutgoingBubble msg={item} avatarUrl={myAvatarUrl} name={myName} />
                  ) : (
                    <IncomingBubble
                      msg={item}
                      avatarUrl={otherAvatarUrl}
                      avatarSource={otherAvatarSource}
                      name={otherName}
                    />
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
                <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-primary-50">
                  <Ionicons name="chatbubbles-outline" size={32} color={appColors.primary[400]} />
                </View>
                <Text className="mb-1 text-base font-semibold text-ink">No messages yet</Text>
                <Text className="text-center text-sm leading-5 text-ink-muted">
                  {isAdminChat
                    ? "Message WayNow Admin about payouts or account support."
                    : "Your messages with this customer are private and secure."}
                </Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollToBottom(false)}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            style={{ backgroundColor: "transparent" }}
          />
        )}
      </View>

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
