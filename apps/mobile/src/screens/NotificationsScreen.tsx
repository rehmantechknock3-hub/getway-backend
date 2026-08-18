import { useCallback } from "react";

import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";

import type { Notification } from "@repo/schemas";
import {
  useClearAllNotifications,
  useDeleteNotification,
  useMarkNotificationRead,
  useNotifications,
} from "@repo/api-client";

import { appColors } from "../styles/colors";

function formatTime(d: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d instanceof Date ? d : new Date(d));
}

type StackRole = "customer" | "provider";

export function NotificationsScreen({ stack }: { stack: StackRole }) {
  const insets = useSafeAreaInsets();
  const { isLoaded, isSignedIn } = useAuth();

  const enabled = isLoaded && isSignedIn;
  const { data, isLoading, isError, refetch, isRefetching } = useNotifications(1, { enabled });
  const markRead = useMarkNotificationRead();
  const deleteNotification = useDeleteNotification();
  const clearAllNotifications = useClearAllNotifications();

  useFocusEffect(
    useCallback(() => {
      if (enabled) void refetch();
    }, [enabled, refetch])
  );

  const onOpenItem = (n: Notification) => {
    if (!n.readAt) {
      void markRead.mutateAsync(n.id).catch(() => undefined);
    }
    if (n.bookingId) {
      if (stack === "customer") {
        router.push({
          pathname: "/(customer)/booking/[bookingId]",
          params: { bookingId: n.bookingId },
        });
      } else {
        router.replace("/(provider)/(tabs)/jobs");
      }
    }
  };

  const onDeleteItem = (n: Notification) => {
    Alert.alert("Remove notification?", "This notification will be removed from your list.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          void deleteNotification.mutateAsync(n.id).catch(() => undefined);
        },
      },
    ]);
  };

  const onClearAll = () => {
    Alert.alert("Clear all notifications?", "This will remove all notifications from your list.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear all",
        style: "destructive",
        onPress: () => {
          void clearAllNotifications.mutateAsync().catch(() => undefined);
        },
      },
    ]);
  };

  const items = data?.data ?? [];

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: Math.max(insets.bottom + 24, 40),
      }}
      refreshControl={
        <RefreshControl refreshing={enabled && isRefetching} onRefresh={() => void refetch()} />
      }
    >
      <Text className="text-ink-muted text-sm mb-4">
        Booking updates and requests appear here. Tap an item to open related details.
      </Text>

      {items.length > 0 ? (
        <View className="mb-3 flex-row justify-end">
          <Pressable
            onPress={onClearAll}
            disabled={clearAllNotifications.isPending}
            accessibilityRole="button"
            accessibilityLabel="Clear all notifications"
          >
            <Text className="text-primary-600 text-sm font-semibold">
              {clearAllNotifications.isPending ? "Clearing..." : "Clear all"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {!enabled || isLoading ? (
        <View className="py-16 items-center">
          <ActivityIndicator color={appColors.primary[600]} />
        </View>
      ) : isError ? (
        <View className="bg-canvas-raised rounded-2xl p-6 border border-ink-faint">
          <Text className="text-ink text-center font-medium">Could not load notifications</Text>
          <Text className="text-ink-muted text-sm text-center mt-2">Pull down to try again.</Text>
        </View>
      ) : items.length === 0 ? (
        <View className="bg-canvas-raised rounded-2xl p-10 border border-ink-faint items-center">
          <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-1">
            <Ionicons name="notifications-off-outline" size={32} color={appColors.primary[600]} />
          </View>
          <Text className="text-ink font-semibold text-base mt-4 text-center">You&apos;re all caught up</Text>
          <Text className="text-ink-muted text-sm text-center mt-2 leading-5">
            New booking activity will show up here.
          </Text>
        </View>
      ) : (
        <View className="gap-3">
          {items.map((n) => {
            const unread = !n.readAt;
            return (
              <Pressable
                key={n.id}
                className={`rounded-2xl border p-4 ${
                  unread ? "bg-primary-50 border-primary-100" : "bg-canvas-raised border-ink-faint"
                }`}
                onPress={() => onOpenItem(n)}
                accessibilityRole="button"
                accessibilityLabel={`${n.title}. ${n.body}`}
              >
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1 pr-3">
                    <Text className="text-ink font-semibold text-base">{n.title}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-ink-subtle text-xs">
                      {formatTime(n.createdAt instanceof Date ? n.createdAt : new Date(n.createdAt))}
                    </Text>
                    <Pressable
                      className="mt-1.5"
                      onPress={(e) => {
                        e.stopPropagation();
                        onDeleteItem(n);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove notification ${n.title}`}
                    >
                      <Ionicons name="trash-outline" size={16} color={appColors.ink.subtle} />
                    </Pressable>
                  </View>
                </View>
                <Text className="text-ink-muted text-sm mt-2 leading-5">{n.body}</Text>
                {n.bookingId ? (
                  <Text className="text-primary-600 text-xs font-semibold mt-3">
                    {stack === "customer" ? "View booking →" : "Open job queue →"}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
