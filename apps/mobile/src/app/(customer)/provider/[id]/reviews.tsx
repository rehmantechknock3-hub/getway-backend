import { useMemo, useState } from "react";

import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useProviderPublicReviews } from "@repo/api-client";

import { appColors } from "../../../../styles/colors";

const PAGE_SIZE = 10;

function formatReviewDate(value: Date): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    value instanceof Date ? value : new Date(value)
  );
}

export default function CustomerProviderReviewsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const providerId = typeof id === "string" ? id : id?.[0] ?? "";
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, isFetching } = useProviderPublicReviews(
    providerId,
    page,
    PAGE_SIZE,
    { enabled: !!providerId }
  );

  const reviews = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const pageLabel = useMemo(() => `Page ${page} of ${totalPages}`, [page, totalPages]);

  if (!providerId) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center px-6">
        <Text className="text-ink-muted text-center">Missing provider.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{
        paddingTop: 12,
        paddingHorizontal: 20,
        paddingBottom: Math.max(insets.bottom + 24, 32),
      }}
      showsVerticalScrollIndicator={false}
    >
      {isLoading ? (
        <View className="py-20 items-center">
          <ActivityIndicator color={appColors.primary[600]} />
        </View>
      ) : isError ? (
        <View className="bg-canvas-raised rounded-3xl p-6 border border-ink-faint mt-4">
          <Text className="text-ink text-center font-medium mb-2">Could not load reviews</Text>
          <Text className="text-ink-muted text-sm text-center">
            Please try again in a moment.
          </Text>
        </View>
      ) : reviews.length === 0 ? (
        <View className="bg-canvas-raised rounded-3xl p-8 border border-ink-faint items-center mt-4">
          <View className="w-16 h-16 rounded-2xl bg-primary-50 items-center justify-center mb-4">
            <Ionicons name="star-outline" size={30} color={appColors.primary[600]} />
          </View>
          <Text className="text-ink font-bold text-lg text-center mb-2">No reviews yet</Text>
          <Text className="text-ink-muted text-sm text-center leading-5">
            Reviews from completed bookings will appear here.
          </Text>
        </View>
      ) : (
        <View className="gap-3 mt-1">
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
                      color={i < item.rating ? appColors.semantic.warning : appColors.semantic.disabled}
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

      {total > PAGE_SIZE ? (
        <View className="mt-5 flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!canPrev || isFetching}
            className={`px-4 py-2.5 rounded-xl border ${
              canPrev ? "border-primary-500 bg-primary-50" : "border-ink-faint bg-canvas-raised"
            }`}
          >
            <Text className={canPrev ? "text-primary-700 font-semibold" : "text-ink-muted"}>
              Previous
            </Text>
          </TouchableOpacity>

          <Text className="text-ink-muted text-xs">{pageLabel}</Text>

          <TouchableOpacity
            onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={!canNext || isFetching}
            className={`px-4 py-2.5 rounded-xl border ${
              canNext ? "border-primary-500 bg-primary-50" : "border-ink-faint bg-canvas-raised"
            }`}
          >
            <Text className={canNext ? "text-primary-700 font-semibold" : "text-ink-muted"}>
              Next
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
}
