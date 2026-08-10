import { useCallback, useMemo } from "react";

import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";

import {
  useAddFavoriteProvider,
  useFavoriteProviders,
  useProvider,
  useProviderPublicReviews,
  useProviderServices,
  useRemoveFavoriteProvider,
} from "@repo/api-client";

import { appColors } from "../../../../styles/colors";

function formatServicePrice(amount: number, currency: string | undefined): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency ?? "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function ProviderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const providerId = typeof id === "string" ? id : id?.[0] ?? "";
  const insets = useSafeAreaInsets();
  const { isLoaded, isSignedIn } = useAuth();

  const favoritesEnabled = isLoaded && isSignedIn;
  const { data: favoritesPayload } = useFavoriteProviders({ enabled: favoritesEnabled });
  const addFavorite = useAddFavoriteProvider();
  const removeFavorite = useRemoveFavoriteProvider();

  const isFavorite = useMemo(() => {
    if (!favoritesPayload?.data || !providerId) return false;
    return favoritesPayload.data.some((p) => p.id === providerId);
  }, [favoritesPayload?.data, providerId]);

  const {
    data: provider,
    isLoading: loadingProvider,
    isError: errorProvider,
    refetch: refetchProvider,
  } = useProvider(providerId);
  const { data: services, isLoading: loadingServices, refetch: refetchServices } =
    useProviderServices(providerId);
  const {
    data: providerReviews,
    isLoading: loadingReviews,
    refetch: refetchProviderReviews,
  } = useProviderPublicReviews(providerId, 1, 3);

  useFocusEffect(
    useCallback(() => {
      if (!providerId) return;
      void refetchProvider();
      void refetchServices();
      void refetchProviderReviews();
    }, [providerId, refetchProvider, refetchServices, refetchProviderReviews])
  );

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

  const fromPrice = (() => {
    if (!services?.length) return null;
    const lowest = services.reduce((min, s) => (s.price < min.price ? s : min), services[0]);
    return formatServicePrice(lowest.price, lowest.priceCurrency);
  })();

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{
        paddingBottom: Math.max(insets.bottom + 24, 32),
      }}
      showsVerticalScrollIndicator={false}
    >
      <View className="px-5 pt-4">
        {/* Hero profile */}
        <View className="bg-canvas-raised border border-ink-faint rounded-2xl overflow-hidden mb-5">
          <View className="bg-canvas-sunken items-center justify-center py-8">
            {provider.avatarUrl ? (
              <Image
                source={{ uri: provider.avatarUrl }}
                className="w-24 h-24 rounded-2xl bg-canvas-raised"
                accessibilityLabel={`${displayName} profile photo`}
              />
            ) : (
              <View className="w-24 h-24 rounded-2xl bg-primary-50 items-center justify-center border border-primary-100">
                <Text className="text-3xl font-bold text-primary-600">{initials}</Text>
              </View>
            )}
          </View>

          <View className="p-5">
            <View className="flex-row items-start justify-between gap-3">
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
                className="w-11 h-11 rounded-full bg-primary-50 border border-primary-100 items-center justify-center active:opacity-80"
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

            <View className="flex-row flex-wrap items-center gap-3 mt-4">
              <View className="flex-row items-center gap-1 bg-canvas-sunken rounded-full px-3 py-1.5">
                <Ionicons name="star" size={14} color={appColors.semantic.warning} />
                <Text className="text-ink font-semibold text-sm">
                  {provider.averageRating.toFixed(1)}
                </Text>
                <Text className="text-ink-muted text-xs">({provider.totalReviews})</Text>
              </View>
              {provider.isOnline ? (
                <View className="flex-row items-center gap-1.5 bg-primary-50 rounded-full px-3 py-1.5">
                  <View className="w-2 h-2 rounded-full" style={{ backgroundColor: appColors.semantic.success }} />
                  <Text className="text-primary-700 text-xs font-semibold">Online</Text>
                </View>
              ) : (
                <View className="flex-row items-center gap-1.5 bg-canvas-sunken rounded-full px-3 py-1.5">
                  <View className="w-2 h-2 rounded-full bg-ink-subtle" />
                  <Text className="text-ink-muted text-xs font-medium">Offline</Text>
                </View>
              )}
              {fromPrice ? (
                <View className="flex-row items-center gap-1 rounded-full px-3 py-1.5 border border-primary-100 bg-primary-50">
                  <Text className="text-primary-700 text-xs font-semibold">From {fromPrice}</Text>
                </View>
              ) : null}
            </View>

            {provider.serviceArea ? (
              <View className="flex-row items-center gap-2 mt-4 pt-4 border-t border-ink-faint">
                <Ionicons name="location-outline" size={18} color={appColors.primary[600]} />
                <Text className="text-ink-soft text-sm flex-1">{provider.serviceArea}</Text>
              </View>
            ) : null}

            {provider.bio ? (
              <Text className="text-ink-soft text-sm mt-3 leading-5">{provider.bio}</Text>
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
        </View>

        <Text className="text-lg font-bold text-ink mb-1">Choose a package</Text>
        <Text className="text-ink-muted text-sm mb-3">
          Select a service below, then pick a time to book.
        </Text>

        {!provider.isOnline ? (
          <View className="bg-canvas-sunken border border-ink-faint rounded-2xl px-4 py-3 mb-4 flex-row gap-3">
            <Ionicons name="information-circle-outline" size={22} color={appColors.ink.muted} />
            <View className="flex-1">
              <Text className="text-ink text-sm font-semibold mb-1">Booking unavailable</Text>
              <Text className="text-ink-muted text-sm leading-5">
                This provider is offline. You can still view their profile and save them to favorites.
              </Text>
            </View>
          </View>
        ) : null}

        {loadingServices ? (
          <ActivityIndicator className="my-6" color={appColors.primary[600]} />
        ) : !services?.length ? (
          <View className="bg-canvas-raised border border-ink-faint rounded-2xl p-4 mb-4">
            <Text className="text-ink font-medium text-sm mb-2">No services to book yet</Text>
            <Text className="text-ink-muted text-sm leading-5">
              This provider has not published a bookable service yet.
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {services.map((s) => (
              <View
                key={s.id}
                className="bg-canvas-raised border border-ink-faint rounded-2xl p-4 overflow-hidden"
              >
                <View className="flex-row items-start gap-3">
                  <View className="w-12 h-12 rounded-xl bg-primary-50 items-center justify-center">
                    <Ionicons name="construct-outline" size={22} color={appColors.primary[600]} />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-1">
                        <Text className="text-ink font-semibold text-base">{s.title}</Text>
                        <Text className="text-ink-muted text-xs mt-1">{s.categoryName}</Text>
                      </View>
                      <Text className="text-primary-600 font-bold">
                        {formatServicePrice(s.price, s.priceCurrency)}
                      </Text>
                    </View>
                    {s.description ? (
                      <Text className="text-ink-soft text-sm mt-2" numberOfLines={3}>
                        {s.description}
                      </Text>
                    ) : null}
                    <View className="flex-row items-center gap-1.5 mt-2">
                      <Ionicons name="time-outline" size={14} color={appColors.ink.subtle} />
                      <Text className="text-ink-subtle text-xs">{s.duration} min</Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity
                  activeOpacity={provider.isOnline ? 0.9 : 1}
                  disabled={!provider.isOnline}
                  className={`mt-4 rounded-2xl py-3.5 items-center ${
                    provider.isOnline ? "bg-primary-600" : "bg-ink-faint"
                  }`}
                  onPress={() =>
                    router.push(`/(customer)/provider/${providerId}/book/${s.id}` as const)
                  }
                  accessibilityState={{ disabled: !provider.isOnline }}
                  accessibilityLabel={
                    provider.isOnline
                      ? `Book ${s.title}`
                      : `${s.title} — booking unavailable because provider status is offline`
                  }
                >
                  <Text
                    className={`font-bold text-sm ${
                      provider.isOnline ? "text-white" : "text-ink-subtle"
                    }`}
                  >
                    Book this service
                  </Text>
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
              <Text className="text-primary-600 font-semibold text-sm">See all</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <Text className="text-ink-muted text-sm mb-3">Real feedback from completed bookings.</Text>

        {loadingReviews ? (
          <ActivityIndicator className="my-4" color={appColors.primary[600]} />
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
            className="mt-3 mb-1 bg-canvas-raised border border-primary-100 rounded-2xl py-3 items-center"
            onPress={() => router.push(`/(customer)/provider/${providerId}/reviews` as const)}
          >
            <Text className="text-primary-600 font-semibold">See all reviews</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </ScrollView>
  );
}
