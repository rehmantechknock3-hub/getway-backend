import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";

import {
  setAuthToken,
  useAddFavoriteProvider,
  useFavoriteProviders,
  useProvider,
  useProviderPublicReviews,
  useProviderServices,
  useRemoveFavoriteProvider,
} from "@repo/api-client";

import { appColors } from "../../../../styles/colors";

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

  const favoritesEnabled = isLoaded && isSignedIn && apiReady;
  const { data: favoritesPayload } = useFavoriteProviders({ enabled: favoritesEnabled });
  const addFavorite = useAddFavoriteProvider();
  const removeFavorite = useRemoveFavoriteProvider();

  const isFavorite = useMemo(() => {
    if (!favoritesPayload?.data || !providerId) return false;
    return favoritesPayload.data.some((p) => p.id === providerId);
  }, [favoritesPayload?.data, providerId]);

  const { data: provider, isLoading: loadingProvider, isError: errorProvider } =
    useProvider(providerId);
  const { data: services, isLoading: loadingServices } = useProviderServices(providerId);
  const { data: providerReviews, isLoading: loadingReviews } = useProviderPublicReviews(providerId, 1, 3);

  const initials = useMemo(() => {
    if (!provider) return "";
    return `${provider.firstName[0] ?? ""}${provider.lastName[0] ?? ""}`.toUpperCase();
  }, [provider]);

  const toggleFavorite = useCallback(() => {
    if (!providerId || addFavorite.isPending || removeFavorite.isPending) return;
    if (isFavorite) {
      void removeFavorite.mutateAsync(providerId);
    } else {
      void addFavorite.mutateAsync(providerId);
    }
  }, [
    providerId,
    isFavorite,
    addFavorite,
    removeFavorite,
  ]);

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
  const favoriteBusy = addFavorite.isPending || removeFavorite.isPending;

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{
        paddingBottom: Math.max(insets.bottom + 24, 32),
      }}
      showsVerticalScrollIndicator={false}
    >
      <View className="px-5 pt-4">
        <View className="bg-canvas-raised border border-ink-faint rounded-3xl p-5 mb-6 shadow-sm">
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
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1">
                  <Text className="text-2xl font-bold text-ink" style={{ letterSpacing: -0.5 }}>
                    {displayName}
                  </Text>
                  <Text className="text-ink-muted text-sm mt-1">{headline}</Text>
                </View>
                <Pressable
                  accessibilityLabel={isFavorite ? "Remove from saved providers" : "Save provider"}
                  accessibilityRole="button"
                  onPress={toggleFavorite}
                  disabled={!favoritesEnabled || favoriteBusy}
                  className="w-11 h-11 rounded-2xl bg-primary-50 border border-primary-200 items-center justify-center active:opacity-80"
                >
                  {favoriteBusy ? (
                    <ActivityIndicator size="small" color={appColors.primary[600]} />
                  ) : (
                    <Ionicons
                      name={isFavorite ? "heart" : "heart-outline"}
                      size={22}
                      color={appColors.primary[600]}
                    />
                  )}
                </Pressable>
              </View>
              <View className="flex-row items-center gap-4 mt-3">
                <View className="flex-row items-center gap-1">
                  <Ionicons name="star" size={16} color={appColors.semantic.warning} />
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
              <Ionicons name="location-outline" size={18} color={appColors.ink.muted} />
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

        <Text className="text-lg font-bold text-ink mb-1">Services</Text>
        <Text className="text-ink-subtle text-sm mb-3">
          Pick a service and time to book. The provider is notified in their Jobs tab.
        </Text>

        {loadingServices ? (
          <ActivityIndicator className="my-6" />
        ) : !services?.length ? (
          <View className="bg-canvas-raised border border-ink-faint rounded-2xl p-4 mb-4">
            <Text className="text-ink font-medium text-sm mb-2">No services to book yet</Text>
            <Text className="text-ink-muted text-sm leading-5">
              This provider’s profile is visible, but they have not published a service customers can book. They need to
              open the Provider app → Services tab once so a listing is created from their onboarding details.
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {services.map((s) => (
              <View
                key={s.id}
                className="bg-canvas-raised border border-ink-faint rounded-2xl p-4 overflow-hidden"
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
                <Text className="text-ink-subtle text-xs mt-2 mb-3">{s.duration} min</Text>
                <TouchableOpacity
                  activeOpacity={0.9}
                  className="bg-primary-600 rounded-xl py-3 items-center"
                  onPress={() =>
                    router.push(`/(customer)/provider/${providerId}/book/${s.id}` as const)
                  }
                >
                  <Text className="text-white font-bold text-sm">Book this service</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View className="mt-7 mb-1 flex-row items-center justify-between">
          <Text className="text-lg font-bold text-ink">Reviews</Text>
          {(providerReviews?.total ?? 0) > 3 ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push(`/(customer)/provider/${providerId}/reviews` as const)}
            >
              <Text className="text-primary-700 font-semibold text-sm">See all</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <Text className="text-ink-subtle text-sm mb-3">
          Real feedback from completed bookings.
        </Text>

        {loadingReviews ? (
          <ActivityIndicator className="my-4" />
        ) : !(providerReviews?.data.length ?? 0) ? (
          <View className="bg-canvas-raised border border-ink-faint rounded-2xl p-4 mb-2">
            <Text className="text-ink font-medium text-sm">No reviews yet</Text>
            <Text className="text-ink-muted text-sm mt-1">
              Once customers complete jobs and leave feedback, reviews appear here.
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {providerReviews?.data.map((r) => {
              const customerName = `${r.customerFirstName} ${r.customerLastName}`.trim();
              return (
                <View key={r.id} className="bg-canvas-raised border border-ink-faint rounded-2xl p-4">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-ink font-semibold">{customerName}</Text>
                    <View className="flex-row items-center gap-1">
                      <Ionicons name="star" size={14} color={appColors.semantic.warning} />
                      <Text className="text-ink font-semibold">{r.rating.toFixed(1)}</Text>
                    </View>
                  </View>
                  <Text className="text-ink-muted text-xs mb-2">{r.serviceTitle}</Text>
                  {r.comment ? (
                    <Text className="text-ink-soft text-sm">{r.comment}</Text>
                  ) : (
                    <Text className="text-ink-subtle text-sm italic">No written comment</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {(providerReviews?.total ?? 0) > 3 ? (
          <TouchableOpacity
            activeOpacity={0.85}
            className="mt-3 mb-1 bg-canvas-raised border border-ink-faint rounded-xl py-2.5 items-center"
            onPress={() => router.push(`/(customer)/provider/${providerId}/reviews` as const)}
          >
            <Text className="text-primary-700 font-semibold">See all reviews</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </ScrollView>
  );
}
