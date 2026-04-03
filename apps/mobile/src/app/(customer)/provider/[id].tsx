import { useMemo } from "react";

import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useProvider, useProviderServices } from "@repo/api-client";

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function ProviderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const providerId = typeof id === "string" ? id : id?.[0] ?? "";
  const insets = useSafeAreaInsets();

  const { data: provider, isLoading: loadingProvider, isError: errorProvider } = useProvider(providerId);
  const { data: services, isLoading: loadingServices } = useProviderServices(providerId);

  const initials = useMemo(() => {
    if (!provider) return "";
    return `${provider.firstName[0] ?? ""}${provider.lastName[0] ?? ""}`.toUpperCase();
  }, [provider]);

  if (!providerId) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center px-6">
        <Text className="text-ink-muted text-center">Missing provider.</Text>
      </View>
    );
  }

  if (loadingProvider) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (errorProvider || !provider) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center px-6">
        <Text className="text-ink text-center font-medium">Could not load this provider.</Text>
        <Text className="text-ink-muted text-sm text-center mt-2">They may no longer be available.</Text>
      </View>
    );
  }

  const displayName = `${provider.firstName} ${provider.lastName}`.trim();
  const headline =
    provider.serviceCategory ?? provider.primaryServiceTitle ?? "Service provider";

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{
        paddingBottom: Math.max(insets.bottom + 24, 32),
      }}
      showsVerticalScrollIndicator={false}
    >
      <View className="px-5 pt-4">
        <View className="bg-canvas-raised border border-ink-faint rounded-3xl p-5 mb-6">
          <View className="flex-row items-start gap-4">
            {provider.avatarUrl ? (
              <Image
                source={{ uri: provider.avatarUrl }}
                className="w-16 h-16 rounded-2xl bg-canvas-sunken"
                accessibilityLabel={`${displayName} profile photo`}
              />
            ) : (
              <View className="w-16 h-16 rounded-2xl bg-canvas-sunken items-center justify-center">
                <Text className="text-xl font-bold text-ink-muted">{initials}</Text>
              </View>
            )}
            <View className="flex-1">
              <Text className="text-2xl font-bold text-ink" style={{ letterSpacing: -0.5 }}>
                {displayName}
              </Text>
              <Text className="text-ink-muted text-sm mt-1">{headline}</Text>
              <View className="flex-row items-center gap-4 mt-3">
                <View className="flex-row items-center gap-1">
                  <Ionicons name="star" size={16} color="#F59E0B" />
                  <Text className="text-ink font-semibold">
                    {provider.averageRating.toFixed(1)}
                  </Text>
                  <Text className="text-ink-muted text-sm">
                    ({provider.totalReviews} reviews)
                  </Text>
                </View>
                {provider.isOnline ? (
                  <View className="flex-row items-center gap-1">
                    <View className="w-2 h-2 rounded-full bg-green-500" />
                    <Text className="text-green-700 text-xs font-medium">Online</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {provider.serviceArea ? (
            <View className="flex-row items-center gap-2 mt-4 pt-4 border-t border-ink-faint">
              <Ionicons name="location-outline" size={18} color="#78716C" />
              <Text className="text-ink-soft text-sm flex-1">{provider.serviceArea}</Text>
            </View>
          ) : null}

          {provider.bio ? (
            <Text className="text-ink-soft text-sm mt-3">{provider.bio}</Text>
          ) : null}

          {provider.serviceDescription ? (
            <View className="mt-4">
              <Text className="text-ink text-sm font-semibold mb-2">About</Text>
              <Text className="text-ink-soft text-sm leading-5">{provider.serviceDescription}</Text>
            </View>
          ) : null}

          {provider.experienceYears != null ? (
            <Text className="text-ink-muted text-xs mt-3">
              {provider.experienceYears} years experience
              {provider.hasTools === false ? " · Customer provides tools" : ""}
            </Text>
          ) : null}
        </View>

        <Text className="text-lg font-bold text-ink mb-3">Services</Text>

        {loadingServices ? (
          <ActivityIndicator className="my-6" />
        ) : !services?.length ? (
          <View className="bg-canvas-raised border border-ink-faint rounded-2xl p-4 mb-4">
            <Text className="text-ink-muted text-sm">
              No services listed yet. Check back soon.
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {services.map((s) => (
              <View
                key={s.id}
                className="bg-canvas-raised border border-ink-faint rounded-2xl p-4"
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-ink font-semibold text-base">{s.title}</Text>
                    <Text className="text-ink-muted text-xs mt-1">{s.categoryName}</Text>
                    {s.description ? (
                      <Text className="text-ink-soft text-sm mt-2">{s.description}</Text>
                    ) : null}
                  </View>
                  <Text className="text-primary-600 font-bold">{formatUsd(s.price)}</Text>
                </View>
                <Text className="text-ink-subtle text-xs mt-2">{s.duration} min</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
