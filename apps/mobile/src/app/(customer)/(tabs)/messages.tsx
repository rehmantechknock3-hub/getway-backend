import { useCallback } from "react";

import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";

import { messageKeys, useConversations, useMe } from "@repo/api-client";
import { reportError } from "@repo/utils";

import { ConversationCard } from "../../../components/ConversationCard";
import { appColors } from "../../../styles/colors";

export default function CustomerMessagesScreen() {
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
          reportError(err, { screen: "CustomerMessages", action: "focusRefetch" });
        });
    }, [enabled, queryClient])
  );

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <View className="px-5 pb-4 pt-2">
        <Text className="text-2xl font-bold text-ink" style={{ letterSpacing: -0.5 }}>
          Messages
        </Text>
        <Text className="mt-1 text-sm text-ink-muted">Chats with your providers</Text>
      </View>

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
      ) : (data?.length ?? 0) === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <View className="mb-1 h-16 w-16 items-center justify-center rounded-2xl bg-primary-50">
            <Ionicons name="chatbubbles-outline" size={32} color={appColors.primary[600]} />
          </View>
          <Text className="mt-4 text-base font-semibold text-ink">No messages yet</Text>
          <Text className="mt-2 text-center text-sm leading-5 text-ink-muted">
            When you book a service, you can message the provider directly from the booking.
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ConversationCard
              item={item}
              myUserId={me?.id ?? ""}
              onPress={() =>
                router.push(
                  `/(customer)/conversation/${item.id}?bookingId=${item.bookingId ?? ""}`
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
