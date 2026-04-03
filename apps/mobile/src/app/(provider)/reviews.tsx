import { useCallback, useEffect, useState } from "react";

import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";

import { setAuthToken, useProviderReviews } from "@repo/api-client";

function formatReviewDate(d: Date): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    d instanceof Date ? d : new Date(d)
  );
}

export default function ProviderReviewsScreen() {
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
  const { data, isLoading, isError, refetch, isRefetching } = useProviderReviews(1, { enabled });

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      void refetch();
    }, [enabled, refetch])
  );

  const reviews = data?.data ?? [];

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{
        paddingTop: 12,
        paddingBottom: Math.max(insets.bottom + 24, 32),
        paddingHorizontal: 20,
      }}
      refreshControl={
        <RefreshControl refreshing={enabled && isRefetching} onRefresh={() => void refetch()} />
      }
    >
      {!enabled || isLoading ? (
        <View className="py-20 items-center">
          <ActivityIndicator color="#E8521A" />
        </View>
      ) : isError ? (
        <View className="bg-canvas-raised rounded-3xl p-6 border border-ink-faint mt-4">
          <Text className="text-ink text-center font-medium mb-2">Could not load reviews</Text>
          <Text className="text-ink-muted text-sm text-center">
            Pull to refresh, or confirm you are signed in as a provider and the API is running.
          </Text>
        </View>
      ) : reviews.length === 0 ? (
        <View className="bg-canvas-raised rounded-3xl p-10 border border-ink-faint items-center mt-4">
          <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
            <Ionicons name="star-outline" size={30} color="#E8521A" />
          </View>
          <Text className="text-ink font-bold text-lg text-center mb-2">No reviews yet</Text>
          <Text className="text-ink-muted text-sm text-center leading-5">
            When customers complete jobs and leave feedback, their ratings and comments appear here.
          </Text>
        </View>
      ) : (
        <View className="gap-3 mt-2">
          {reviews.map((item) => {
            const customerName = `${item.customerFirstName} ${item.customerLastName}`.trim();
            return (
              <View
                key={item.id}
                className="bg-canvas-raised rounded-3xl border border-ink-faint p-4"
              >
                <View className="flex-row items-start justify-between gap-3 mb-2">
                  <View className="flex-1 min-w-0">
                    <Text className="text-ink font-semibold text-base" numberOfLines={1}>
                      {customerName}
                    </Text>
                    <Text className="text-ink-muted text-sm mt-0.5" numberOfLines={2}>
                      {item.serviceTitle}
                    </Text>
                  </View>
                  <Text className="text-ink-subtle text-xs shrink-0">
                    {formatReviewDate(item.createdAt)}
                  </Text>
                </View>
                <View className="flex-row items-center gap-0.5 mb-2">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Ionicons
                      key={i}
                      name={i < item.rating ? "star" : "star-outline"}
                      size={18}
                      color={i < item.rating ? "#F59E0B" : "#D6D3D1"}
                    />
                  ))}
                </View>
                {item.comment ? (
                  <Text className="text-ink-muted text-sm leading-5">{item.comment}</Text>
                ) : (
                  <Text className="text-ink-subtle text-sm italic">No written comment</Text>
                )}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
