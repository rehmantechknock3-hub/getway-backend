import { useCallback } from "react";

import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";

import { messageKeys, useConversations, useMe } from "@repo/api-client";
import type { ConversationListItem } from "@repo/schemas";
import { reportError } from "@repo/utils";

import { appColors } from "../../../styles/colors";

function timeAgo(date: Date | string | undefined): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

function ConversationRow({
  item,
  myUserId,
  onPress,
}: {
  item: ConversationListItem;
  myUserId: string;
  onPress: () => void;
}) {
  const name = `${item.otherPartyFirstName} ${item.otherPartyLastName}`.trim();
  const isMine = item.lastMessageSenderId === myUserId;
  const preview = item.lastMessageContent
    ? `${isMine ? "You: " : ""}${item.lastMessageContent}`
    : "No messages yet";

  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center px-4 py-3.5 border-b border-ink-faint bg-canvas"
      accessibilityRole="button"
      accessibilityLabel={`Open conversation with ${name}`}
    >
      <View className="w-11 h-11 rounded-full bg-primary-100 items-center justify-center mr-3">
        <Text className="text-primary-700 font-bold text-base">
          {item.otherPartyFirstName.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View className="flex-1 min-w-0">
        <View className="flex-row items-center justify-between mb-0.5">
          <Text className="text-ink font-semibold text-sm flex-1 mr-2" numberOfLines={1}>
            {name}
          </Text>
          <Text className="text-ink-muted text-xs flex-shrink-0">
            {timeAgo(item.lastMessageAt)}
          </Text>
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-ink-soft text-sm flex-1 mr-2" numberOfLines={1}>
            {preview}
          </Text>
          {item.unreadCount > 0 ? (
            <View className="bg-primary-600 rounded-full min-w-[20px] h-5 items-center justify-center px-1">
              <Text className="text-white text-xs font-bold">
                {item.unreadCount > 99 ? "99+" : item.unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ProviderMessagesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userId: clerkUserId, isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  const enabled = isLoaded && isSignedIn;
  const { data, isLoading, isError, refetch } = useConversations({ enabled });
  const { data: me } = useMe({ enabled, clerkUserId });

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      queryClient
        .invalidateQueries({ queryKey: messageKeys.conversations() })
        .catch((err: unknown) => {
          reportError(err, { screen: "ProviderMessages", action: "focusRefetch" });
        });
    }, [enabled, queryClient])
  );

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <View className="px-5 pb-3 pt-2">
        <Text className="text-2xl font-bold text-ink" style={{ letterSpacing: -0.5 }}>
          Messages
        </Text>
      </View>

      {!enabled || isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="alert-circle-outline" size={40} color={appColors.semantic.destructive} />
          <Text className="text-ink-soft text-center mt-3">
            Could not load conversations. Pull down to retry.
          </Text>
          <TouchableOpacity
            onPress={() => void refetch()}
            className="mt-4 bg-primary-600 rounded-xl px-5 py-2.5"
            accessibilityRole="button"
          >
            <Text className="text-white font-semibold text-sm">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (data?.length ?? 0) === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="chatbubbles-outline" size={52} color={appColors.ink.subtle} />
          <Text className="text-ink font-semibold text-base mt-4">No messages yet</Text>
          <Text className="text-ink-muted text-sm text-center mt-2 leading-5">
            Customer messages will appear here once they start a conversation from a booking.
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ConversationRow
              item={item}
              myUserId={me?.id ?? ""}
              onPress={() =>
                router.push(
                  `/(provider)/conversation/${item.id}?bookingId=${item.bookingId}`
                )
              }
            />
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
