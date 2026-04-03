import { useCallback, useEffect, useState } from "react";

import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";

import type { Notification } from "@repo/schemas";
import {
  setAuthToken,
  useMarkNotificationRead,
  useNotifications,
} from "@repo/api-client";

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
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [apiReady, setApiReady] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setApiReady(false);
      return;
    }
    let cancelled = false;
    void getToken().then((token) => {
      if (cancelled) return;
      setAuthToken(token);
      setApiReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  const enabled = isLoaded && isSignedIn && apiReady;
  const { data, isLoading, isError, refetch, isRefetching } = useNotifications(1, { enabled });
  const markRead = useMarkNotificationRead();

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
        router.push(`/(customer)/booking/${n.bookingId}`);
      } else {
        router.replace("/(provider)/(tabs)/jobs");
      }
    }
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

      {!enabled || isLoading ? (
        <View className="py-16 items-center">
          <ActivityIndicator />
        </View>
      ) : isError ? (
        <View className="bg-canvas-raised rounded-2xl p-6 border border-ink-faint">
          <Text className="text-ink text-center font-medium">Could not load notifications</Text>
          <Text className="text-ink-muted text-sm text-center mt-2">Pull down to try again.</Text>
        </View>
      ) : items.length === 0 ? (
        <View className="bg-canvas-raised rounded-2xl p-10 border border-ink-faint items-center">
          <Ionicons name="notifications-off-outline" size={40} color="#A8A29E" />
          <Text className="text-ink font-semibold text-base mt-4 text-center">You're all caught up</Text>
          <Text className="text-ink-muted text-sm text-center mt-2 leading-5">
            New booking activity will show up here.
          </Text>
        </View>
      ) : (
        <View className="gap-3">
          {items.map((n) => {
            const unread = !n.readAt;
            return (
              <TouchableOpacity
                key={n.id}
                activeOpacity={0.9}
                className={`rounded-2xl border p-4 ${
                  unread ? "bg-primary-50 border-primary-100" : "bg-canvas-raised border-ink-faint"
                }`}
                onPress={() => onOpenItem(n)}
                accessibilityRole="button"
                accessibilityLabel={`${n.title}. ${n.body}`}
              >
                <View className="flex-row items-start justify-between gap-2">
                  <Text className="text-ink font-semibold text-base flex-1">{n.title}</Text>
                  <Text className="text-ink-subtle text-xs">
                    {formatTime(n.createdAt instanceof Date ? n.createdAt : new Date(n.createdAt))}
                  </Text>
                </View>
                <Text className="text-ink-muted text-sm mt-2 leading-5">{n.body}</Text>
                {n.bookingId ? (
                  <Text className="text-primary-600 text-xs font-semibold mt-3">
                    {stack === "customer" ? "View booking →" : "Open job queue →"}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
