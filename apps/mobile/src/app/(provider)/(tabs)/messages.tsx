import { useCallback } from "react";

import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";

import { messageKeys, useConversations, useMe, useOrCreateAdminThread } from "@repo/api-client";
import { showToast } from "@repo/ui";
import { reportError } from "@repo/utils";

import { ChatAvatar, wayNowLogoSource } from "../../../components/ChatAvatar";
import { ConversationCard, timeAgo } from "../../../components/ConversationCard";
import { appColors } from "../../../styles/colors";

export default function ProviderMessagesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userId: clerkUserId, isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  const enabled = isLoaded && isSignedIn;
  const { data, isLoading, isError, refetch } = useConversations({ enabled });
  const { data: me } = useMe({ enabled, clerkUserId });
  const createAdminThread = useOrCreateAdminThread();

  const customerThreads = (data ?? []).filter((item) => item.kind !== "PROVIDER_ADMIN");
  const adminThread = (data ?? []).find((item) => item.kind === "PROVIDER_ADMIN");
  const adminUnread = adminThread?.unreadCount ?? 0;

  const openAdminChat = async () => {
    try {
      const thread = await createAdminThread.mutateAsync();
      router.push(`/(provider)/conversation/${thread.id}`);
    } catch (error: unknown) {
      reportError(error, { screen: "ProviderMessages", action: "openAdminChat" });
      showToast("error", "Could not open admin chat. Try again.");
    }
  };

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
      <View className="px-5 pb-4 pt-2">
        <Text className="text-2xl font-bold text-ink" style={{ letterSpacing: -0.5 }}>
          Messages
        </Text>
        <Text className="mt-1 text-sm text-ink-muted">Support and customer chats</Text>
      </View>

      <TouchableOpacity
        onPress={() => void openAdminChat()}
        disabled={createAdminThread.isPending}
        activeOpacity={0.88}
        className="mx-4 mb-4 overflow-hidden rounded-2xl border border-primary-100 bg-primary-50 px-3.5 py-3.5"
        accessibilityRole="button"
        accessibilityLabel="Chat with Admin"
      >
        <View className="flex-row items-center">
          <View className="mr-3 rounded-full bg-primary-200 p-0.5">
            <ChatAvatar source={wayNowLogoSource} name="WayNow Admin" size="lg" />
          </View>
          <View className="min-w-0 flex-1">
            <View className="mb-1 flex-row items-center justify-between">
              <View className="mr-2 min-w-0 flex-1 flex-row items-center">
                <Text className="mr-2 text-sm font-bold text-ink" numberOfLines={1}>
                  WayNow Admin
                </Text>
                <View className="rounded-full bg-primary-600 px-2 py-0.5">
                  <Text className="text-xs font-semibold text-white">Support</Text>
                </View>
              </View>
              {adminThread?.lastMessageAt ? (
                <View className="rounded-full bg-primary-100 px-2 py-0.5">
                  <Text className="text-xs font-semibold text-primary-700">
                    {timeAgo(adminThread.lastMessageAt)}
                  </Text>
                </View>
              ) : null}
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="mr-2 flex-1 text-sm text-ink-soft" numberOfLines={1}>
                {adminThread?.lastMessageContent ?? "Ask about payouts or account support"}
              </Text>
              {adminUnread > 0 ? (
                <View className="h-5 min-w-[20px] items-center justify-center rounded-full bg-primary-600 px-1.5">
                  <Text className="text-xs font-bold text-white">
                    {adminUnread > 99 ? "99+" : adminUnread}
                  </Text>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={16} color={appColors.primary[600]} />
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {customerThreads.length > 0 ? (
        <Text className="mb-2 px-5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Customers
        </Text>
      ) : null}

      {!enabled || isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={appColors.primary[600]} />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="alert-circle-outline" size={40} color={appColors.semantic.destructive} />
          <Text className="mt-3 text-center text-ink-soft">
            Could not load conversations. Pull down to retry.
          </Text>
          <TouchableOpacity
            onPress={() => void refetch()}
            className="mt-4 rounded-2xl bg-primary-600 px-5 py-2.5"
            accessibilityRole="button"
          >
            <Text className="text-sm font-semibold text-white">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : customerThreads.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <View className="mb-1 h-16 w-16 items-center justify-center rounded-2xl bg-primary-50">
            <Ionicons name="chatbubbles-outline" size={32} color={appColors.primary[600]} />
          </View>
          <Text className="mt-4 text-base font-semibold text-ink">No customer messages yet</Text>
          <Text className="mt-2 text-center text-sm leading-5 text-ink-muted">
            Customer messages will appear here once they start a conversation from a booking.
          </Text>
        </View>
      ) : (
        <FlatList
          data={customerThreads}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ConversationCard
              item={item}
              myUserId={me?.id ?? ""}
              onPress={() =>
                router.push(
                  `/(provider)/conversation/${item.id}?bookingId=${item.bookingId ?? ""}`
                )
              }
            />
          )}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 16,
            gap: 12,
          }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
