import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Alert,
  Linking,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Image,
  RefreshControl,
  Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";

import type { ProviderPublicSummary } from "@repo/schemas";
import {
  getApiBaseUrl,
  useFavoriteProviders,
  useMe,
  useNotifications,
  usePublicProviders,
} from "@repo/api-client";
import { haversineDistance } from "@repo/utils";

import { CategoryBrowseCard } from "../../../components/home/CategoryBrowseCard";
import { HomeHeader } from "../../../components/home/HomeHeader";
import { NearbyProvidersMap } from "../../../components/home/NearbyProvidersMap";
import { PopularServicesRow } from "../../../components/home/PopularServicesRow";
import {
  HOME_CATEGORIES,
  POPULAR_SERVICES,
  type HomeCategory,
  type PopularService,
} from "../../../data/home-browse";
import { appColors } from "../../../styles/colors";
import { textInputBaselineStyle } from "../../../styles/text-input";
import { requestDeviceLocation } from "../../../utils/device-location";

const DISCOVERY_RADIUS_KM = 10;

function formatQueryError(e: unknown): string {
  if (e == null) return "";
  if (typeof e === "object" && "message" in e) {
    const m = (e as { message?: string }).message;
    if (typeof m === "string" && m.length > 0) return m;
  }
  return String(e);
}

function normalizeForSearch(s: string): string {
  return s.trim().toLowerCase();
}

function providerMatchesQuery(p: ProviderPublicSummary, query: string): boolean {
  const q = normalizeForSearch(query);
  if (!q) return true;
  const catalog = p.serviceSearchText ?? "";
  if (catalog.includes(q)) return true;
  const parts = [
    p.firstName,
    p.lastName,
    `${p.firstName} ${p.lastName}`,
    p.serviceCategory,
    p.primaryServiceTitle,
    p.serviceArea,
    p.serviceDescription,
  ]
    .filter((x): x is string => typeof x === "string" && x.length > 0)
    .map((x) => normalizeForSearch(x));
  return parts.some((chunk) => chunk.includes(q));
}

/** Match if any keyword hits catalog / category / title fields. */
function providerMatchesKeywords(
  p: ProviderPublicSummary,
  keywords: string[] | null
): boolean {
  if (!keywords?.length) return true;
  return keywords.some((keyword) => {
    const c = normalizeForSearch(keyword);
    if (!c) return false;
    const catalog = p.serviceSearchText ?? "";
    if (catalog.includes(c)) return true;
    const sc = normalizeForSearch(p.serviceCategory ?? "");
    const pt = normalizeForSearch(p.primaryServiceTitle ?? "");
    if (sc.length > 0 && (sc.includes(c) || c.includes(sc))) return true;
    if (pt.length > 0 && (pt.includes(c) || c.includes(pt))) return true;
    return false;
  });
}

function formatStartingPrice(price: number | undefined, currency?: string): string {
  if (price == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency ?? "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

function formatDistance(distanceKm: number | undefined): string | null {
  if (distanceKm == null || Number.isNaN(distanceKm)) return null;
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m away`;
  return `${distanceKm.toFixed(1)} km away`;
}

function formatListedDistance(
  p: ProviderPublicSummary,
  customerCoords: { lat: number; lon: number } | null
): string | null {
  if (p.distanceMeters != null) {
    const m = p.distanceMeters;
    if (m < 1000) return `${m} m away`;
    return `${(m / 1000).toFixed(1)} km away`;
  }
  if (p.distanceKm != null && !Number.isNaN(p.distanceKm)) {
    return formatDistance(p.distanceKm);
  }
  if (customerCoords && p.latitude != null && p.longitude != null) {
    return formatDistance(
      haversineDistance(customerCoords.lat, customerCoords.lon, p.latitude, p.longitude)
    );
  }
  return null;
}

function EnableLocationCard({
  radiusKm,
  onEnable,
}: {
  radiusKm: number;
  onEnable: () => void;
}) {
  return (
    <View className="bg-surface-card border border-surface-border rounded-2xl p-5 items-center">
      <Ionicons name="location-outline" size={32} color={appColors.surface.muted} />
      <Text className="text-white font-semibold text-base text-center mt-3">
        Enable location to see nearby
      </Text>
      <Text className="text-surface-muted text-sm text-center mt-2 leading-5">
        Nearby providers stay hidden until you allow location. We use it to show who is within{" "}
        {radiusKm} km of you.
      </Text>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onEnable}
        className="mt-4 w-full bg-glow-blue rounded-2xl py-3 items-center"
        accessibilityRole="button"
        accessibilityLabel="Enable location"
      >
        <Text className="text-white font-semibold text-sm">Enable location</Text>
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => void Linking.openSettings()}
        className="mt-3 px-5 py-2"
        accessibilityRole="button"
        accessibilityLabel="Open location settings"
      >
        <Text className="text-glow-blue font-semibold text-sm">Open settings</Text>
      </TouchableOpacity>
    </View>
  );
}

function ProviderRow({
  p,
  customerCoords,
}: {
  p: ProviderPublicSummary;
  customerCoords: { lat: number; lon: number } | null;
}) {
  const displayName = `${p.firstName} ${p.lastName}`.trim();
  const serviceLine = p.serviceCategory ?? p.primaryServiceTitle ?? "Services";
  const initials = `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();
  const available = p.isOnline;
  const bookLabel =
    p.activeServiceCount > 1
      ? "View provider services"
      : p.primaryServiceTitle
        ? `Book ${p.primaryServiceTitle}`
        : "Book service";
  const distanceLabel = formatListedDistance(p, customerCoords);

  const openProfile = () => {
    router.push(`/(customer)/provider/${p.id}` as const);
  };

  const openBook = () => {
    if (!p.isOnline) {
      Alert.alert("Provider is offline", "This provider is currently offline. Please try again later.");
      return;
    }
    if (!p.primaryServiceId) {
      Alert.alert(
        "Booking isn’t available yet",
        "This provider hasn’t published a bookable service, so the booking flow can’t open. You can still view their profile.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "View profile", onPress: openProfile },
        ]
      );
      return;
    }
    if (p.activeServiceCount > 1) {
      openProfile();
      return;
    }
    router.push(`/(customer)/provider/${p.id}/book/${p.primaryServiceId}` as const);
  };

  return (
    <View className="bg-surface-card rounded-2xl border border-surface-border flex-row items-stretch overflow-hidden">
      <TouchableOpacity
        activeOpacity={0.9}
        className="flex-1 flex-row items-center gap-4 p-4 pr-2"
        onPress={openProfile}
        accessibilityRole="button"
        accessibilityLabel={`${displayName}, ${serviceLine}. Opens profile with all services.`}
      >
        {p.avatarUrl ? (
          <Image
            source={{ uri: p.avatarUrl }}
            className="w-14 h-14 rounded-2xl bg-surface-elevated"
            accessibilityLabel={`${displayName} profile photo`}
          />
        ) : (
          <View className="w-14 h-14 rounded-2xl bg-surface-elevated items-center justify-center">
            <Text className="text-xl font-bold text-surface-muted">{initials}</Text>
          </View>
        )}

        <View className="flex-1 min-w-0">
          <Text className="text-white font-semibold text-base">{displayName}</Text>
          <Text className="text-surface-muted text-sm">{serviceLine}</Text>
          <View className="flex-row items-center gap-3 mt-1">
            <View className="flex-row items-center gap-1">
              <Ionicons name="star" size={12} color={appColors.semantic.warning} />
              <Text className="text-xs font-medium text-surface-soft">
                {p.averageRating.toFixed(1)} ({p.totalReviews})
              </Text>
            </View>
            {distanceLabel ? (
              <View className="flex-row items-center gap-1">
                <Ionicons name="navigate-outline" size={12} color={appColors.glow.blue} />
                <Text className="text-xs font-medium text-glow-blue">{distanceLabel}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>

      <View className="w-px bg-surface-border my-3" />

      <View className="justify-center items-center px-3 py-3 gap-2 min-w-[88px]">
        <Text className="text-glow-blue font-bold text-sm text-center">
          {formatStartingPrice(p.startingPrice, p.startingPriceCurrency)}
        </Text>
        <View
          className={`px-2 py-0.5 rounded-full ${
            available ? "bg-glow-blue/20" : "bg-surface-elevated"
          }`}
        >
          <Text
            className={`text-xs font-medium ${
              available ? "text-glow-blue" : "text-surface-muted"
            }`}
          >
            {available ? "Available" : "Offline"}
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.88}
          className="bg-glow-blue rounded-xl px-3 py-2.5 w-full items-center"
          onPress={openBook}
          accessibilityRole="button"
          accessibilityLabel={bookLabel}
        >
          <Text className="text-white text-xs font-bold text-center" numberOfLines={2}>
            Book
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { isLoaded, isSignedIn } = useAuth();
  const [feed, setFeed] = useState<"discover" | "saved">("discover");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterKeywords, setFilterKeywords] = useState<string[] | null>(null);
  const [selectedPopularId, setSelectedPopularId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showProvidersList, setShowProvidersList] = useState(false);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState("Detecting…");
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);

  const refreshCustomerLocation = useCallback(async () => {
    const result = await requestDeviceLocation({
      accuracy: Location.Accuracy.Highest,
      context: { screen: "CustomerHome", action: "refreshCustomerLocation" },
    });
    if (!result.ok) {
      setLocationPermissionDenied(result.reason === "denied");
      if (result.reason === "denied") {
        setCustomerCoords(null);
      }
      return;
    }
    setLocationPermissionDenied(false);
    setCustomerCoords({
      lat: result.data.coords.latitude,
      lon: result.data.coords.longitude,
    });
    setLocationLabel(result.data.shortLabel);
  }, []);

  const providersQueryEnabled = isLoaded && isSignedIn;

  const { data: me, refetch: refetchMe } = useMe({ enabled: providersQueryEnabled });
  const welcomeName = me?.firstName?.trim() || "there";

  // Nearby is GPS-only. Do not fall back to a saved profile address — if they
  // decline permission we ask them to enable location instead of listing providers.
  const discoveryCoords = customerCoords;

  useEffect(() => {
    if (customerCoords) return;
    let cancelled = false;
    void (async () => {
      if (!discoveryCoords) {
        if (!cancelled) {
          setLocationLabel("Enable location");
        }
        return;
      }
      try {
        const places = await Location.reverseGeocodeAsync({
          latitude: discoveryCoords.lat,
          longitude: discoveryCoords.lon,
        });
        if (cancelled) return;
        const place = places[0];
        const city = place?.city ?? place?.subregion ?? place?.region;
        const country = place?.country;
        if (city && country) setLocationLabel(`${city}, ${country}`);
        else if (city) setLocationLabel(city);
        else setLocationLabel("Near you");
      } catch {
        if (!cancelled) setLocationLabel("Near you");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [discoveryCoords, customerCoords, locationPermissionDenied]);

  const { data: notificationPayload, refetch: refetchNotifications } = useNotifications(1, {
    enabled: providersQueryEnabled,
  });

  useFocusEffect(
    useCallback(() => {
      if (!providersQueryEnabled) return;
      void (async () => {
        await refreshCustomerLocation();
        await refetchNotifications();
        await refetchMe();
      })();
    }, [providersQueryEnabled, refreshCustomerLocation, refetchNotifications, refetchMe])
  );

  const providersListActive = showProvidersList || filterKeywords != null;

  const {
    data: providers,
    isLoading,
    isError,
    error: providersFetchError,
    refetch,
    isRefetching,
  } = usePublicProviders(discoveryCoords?.lat, discoveryCoords?.lon, DISCOVERY_RADIUS_KM, {
    enabled: providersQueryEnabled && feed === "discover" && !!discoveryCoords && providersListActive,
  });

  /** Always load the 10 km nearby set for the home map + list under categories. */
  const {
    data: nearbyProviders,
    isLoading: nearbyLoading,
    isError: nearbyError,
    refetch: refetchNearby,
    isRefetching: nearbyRefetching,
  } = usePublicProviders(discoveryCoords?.lat, discoveryCoords?.lon, DISCOVERY_RADIUS_KM, {
    enabled: providersQueryEnabled && !providersListActive && !!discoveryCoords,
  });
  const {
    data: favoritesPayload,
    isLoading: favoritesLoading,
    isError: favoritesError,
    error: favoritesFetchError,
    refetch: refetchFavorites,
    isRefetching: favoritesRefetching,
  } = useFavoriteProviders({
    enabled: providersQueryEnabled && feed === "saved" && providersListActive,
    lat: discoveryCoords?.lat,
    lon: discoveryCoords?.lon,
  });

  const list = feed === "discover" ? providers : favoritesPayload?.data;
  const listLoading = feed === "discover" ? isLoading : favoritesLoading;
  const listError = feed === "discover" ? isError : favoritesError;
  const listRefetching = feed === "discover" ? isRefetching : favoritesRefetching;
  const browseRefreshing = !providersListActive && nearbyRefetching;

  const filteredList = useMemo(() => {
    if (!list?.length) return list ?? [];
    const keywordsActive = feed === "discover" ? filterKeywords : null;
    return list.filter(
      (p) =>
        providerMatchesQuery(p, searchQuery) &&
        providerMatchesKeywords(p, keywordsActive) &&
        (!onlineOnly || p.isOnline)
    );
  }, [list, searchQuery, filterKeywords, onlineOnly, feed]);

  const onListRefresh = () => {
    if (feed === "discover") {
      void (async () => {
        try {
          await refreshCustomerLocation();
          await refetchMe();
        } finally {
          if (providersListActive) await refetch();
          else await refetchNearby();
        }
      })();
    } else {
      void refetchFavorites();
    }
  };

  const activeFetchError = feed === "discover" ? providersFetchError : favoritesFetchError;

  const resultsTitle = useMemo(() => {
    if (selectedCategoryId) {
      return HOME_CATEGORIES.find((c) => c.id === selectedCategoryId)?.title ?? "Providers";
    }
    if (selectedPopularId) {
      return POPULAR_SERVICES.find((s) => s.id === selectedPopularId)?.label ?? "Providers";
    }
    return "Providers";
  }, [selectedCategoryId, selectedPopularId]);

  const goBackToBrowse = useCallback(() => {
    setShowProvidersList(false);
    setSelectedPopularId(null);
    setSelectedCategoryId(null);
    setFilterKeywords(null);
    setSearchQuery("");
    setOnlineOnly(false);
    setFeed("discover");
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  }, []);

  const onSelectPopular = (service: PopularService) => {
    setSelectedPopularId(service.id);
    setSelectedCategoryId(null);
    setFilterKeywords([service.filterLabel]);
    setShowProvidersList(true);
    setFeed("discover");
  };

  const onSelectCategory = (category: HomeCategory) => {
    setSelectedCategoryId(category.id);
    setSelectedPopularId(null);
    setFilterKeywords(category.filterKeywords);
    setShowProvidersList(true);
    setFeed("discover");
  };

  const onViewAllServices = () => {
    setSelectedPopularId(null);
    setSelectedCategoryId(null);
    setFilterKeywords(null);
    setSearchQuery("");
    setOnlineOnly(false);
    setShowProvidersList(true);
    setFeed("discover");
  };

  const onPressLocation = () => {
    if (locationPermissionDenied || !discoveryCoords) {
      Alert.alert(
        "Enable location",
        "Turn on location access so we can show providers near you.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open settings",
            onPress: () => {
              void Linking.openSettings();
            },
          },
          {
            text: "Try again",
            onPress: () => {
              void refreshCustomerLocation();
            },
          },
        ]
      );
      return;
    }
    void refreshCustomerLocation();
  };

  return (
    <View className="flex-1 bg-surface-night">
      <StatusBar barStyle="light-content" />
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: Math.max(insets.bottom + 90, 100),
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={providersQueryEnabled && (providersListActive ? listRefetching : browseRefreshing)}
            onRefresh={onListRefresh}
            tintColor={appColors.onPrimary}
          />
        }
      >
        <HomeHeader
          title={providersListActive ? resultsTitle : "All Services"}
          locationLabel={locationLabel}
          unreadCount={notificationPayload?.unreadCount ?? 0}
          onPressLocation={onPressLocation}
          onPressNotifications={() => router.push("/(customer)/notifications")}
          onBack={providersListActive ? goBackToBrowse : undefined}
          avatarUrl={me?.avatarUrl}
          profileName={welcomeName}
          onPressProfile={
            providersListActive ? undefined : () => router.push("/(customer)/(tabs)/profile")
          }
        />

        {!providersListActive ? (
          <>
            <PopularServicesRow selectedId={selectedPopularId} onSelect={onSelectPopular} />

            <View className="px-5 mb-5 flex-row gap-3">
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => router.push("/(customer)/(tabs)/bookings")}
                className="flex-1 bg-glow-blue rounded-2xl py-3.5 px-3 flex-row items-center justify-center gap-2"
                accessibilityRole="button"
                accessibilityLabel="View current bookings"
              >
                <Ionicons name="calendar-outline" size={18} color={appColors.onPrimary} />
                <Text className="text-white text-sm font-semibold">View bookings</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={onViewAllServices}
                className="flex-1 bg-surface-elevated border border-surface-border rounded-2xl py-3.5 px-3 flex-row items-center justify-center gap-2"
                accessibilityRole="button"
                accessibilityLabel="View all services"
              >
                <Ionicons name="grid-outline" size={18} color={appColors.onPrimary} />
                <Text className="text-white text-sm font-semibold">View all services</Text>
              </TouchableOpacity>
            </View>

            <View className="px-5 mb-5">
              <Text className="text-white text-lg font-semibold mb-4">All Categories</Text>
              {HOME_CATEGORIES.map((category) => (
                <CategoryBrowseCard
                  key={category.id}
                  category={category}
                  selected={selectedCategoryId === category.id}
                  onPress={() => onSelectCategory(category)}
                />
              ))}
            </View>

            <View className="px-5 mb-8">
              {!discoveryCoords ? (
                <>
                  <Text className="text-white text-lg font-semibold mb-3">Providers near you</Text>
                  <EnableLocationCard
                    radiusKm={DISCOVERY_RADIUS_KM}
                    onEnable={() => void refreshCustomerLocation()}
                  />
                </>
              ) : (
                <>
                  <NearbyProvidersMap
                    customerCoords={discoveryCoords}
                    providers={nearbyProviders ?? []}
                    radiusKm={DISCOVERY_RADIUS_KM}
                    isLoading={nearbyLoading}
                    onSelectProvider={(providerId) => {
                      router.push(`/(customer)/provider/${providerId}` as const);
                    }}
                  />
                  <View className="flex-row items-center justify-between mt-5 mb-3">
                    <Text className="text-white text-lg font-semibold">Providers near you</Text>
                    <Text className="text-surface-muted text-xs">
                      {(nearbyProviders ?? []).length} within {DISCOVERY_RADIUS_KM} km
                    </Text>
                  </View>
                  {nearbyLoading ? (
                    <View className="py-10 items-center">
                      <ActivityIndicator color={appColors.glow.blue} />
                    </View>
                  ) : nearbyError ? (
                    <View className="bg-surface-card border border-surface-border rounded-2xl p-5">
                      <Text className="text-surface-soft text-sm text-center mb-3">
                        Could not load nearby providers.
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => void refetchNearby()}
                        className="bg-surface-elevated border border-surface-border rounded-2xl py-3 items-center"
                      >
                        <Text className="text-white font-semibold text-sm">Retry</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (nearbyProviders ?? []).length === 0 ? (
                    <View className="bg-surface-card border border-surface-border rounded-2xl p-5">
                      <Text className="text-surface-soft text-sm leading-5 text-center">
                        No providers found within {DISCOVERY_RADIUS_KM} km right now. Try View all to browse farther.
                      </Text>
                    </View>
                  ) : (
                    <View className="gap-3">
                      {(nearbyProviders ?? []).map((p) => (
                        <ProviderRow key={p.id} p={p} customerCoords={discoveryCoords} />
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>
          </>
        ) : (
          <View className="px-5">
            <View className="flex-row gap-2 mb-4">
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setFeed("discover")}
                className={`flex-1 py-3 rounded-2xl border items-center ${
                  feed === "discover"
                    ? "bg-glow-blue border-glow-blue"
                    : "bg-surface-card border-surface-border"
                }`}
              >
                <Text
                  className={`text-sm font-bold ${
                    feed === "discover" ? "text-white" : "text-surface-soft"
                  }`}
                >
                  Discover
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setFeed("saved")}
                className={`flex-1 py-3 rounded-2xl border flex-row items-center justify-center gap-2 ${
                  feed === "saved"
                    ? "bg-surface-elevated border-white"
                    : "bg-surface-card border-surface-border"
                }`}
              >
                <Ionicons
                  name="heart"
                  size={16}
                  color={feed === "saved" ? appColors.onPrimary : appColors.glow.purple}
                />
                <Text
                  className={`text-sm font-bold ${
                    feed === "saved" ? "text-white" : "text-surface-soft"
                  }`}
                >
                  Saved
                </Text>
              </TouchableOpacity>
            </View>

            <View className="mb-5">
              <View className="flex-row items-center bg-surface-card border border-surface-border rounded-2xl px-4 py-3 gap-3">
                <Ionicons name="search" size={20} color={appColors.surface.muted} />
                <TextInput
                  className="flex-1 text-white text-base"
                  placeholder="Search services or providers..."
                  placeholderTextColor={appColors.surface.muted}
                  style={textInputBaselineStyle}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
                  accessibilityLabel="Search providers and services"
                />
                <TouchableOpacity
                  className={`rounded-xl px-3 py-1.5 border ${
                    onlineOnly
                      ? "bg-glow-blue/20 border-glow-blue"
                      : "bg-glow-blue border-glow-blue"
                  }`}
                  onPress={() => setOnlineOnly((v) => !v)}
                  accessibilityLabel={
                    onlineOnly ? "Show all providers" : "Show available providers only"
                  }
                  accessibilityRole="button"
                >
                  <Text
                    className={`text-xs font-semibold ${
                      onlineOnly ? "text-glow-blue" : "text-white"
                    }`}
                  >
                    Filter
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-bold text-white">
                {feed === "discover" ? "Nearby providers" : "Saved providers"}
              </Text>
            </View>

            {!providersQueryEnabled || listLoading ? (
              <View className="py-12 items-center">
                <ActivityIndicator color={appColors.onPrimary} />
              </View>
            ) : listError ? (
              <View className="bg-surface-card rounded-2xl p-4 border border-surface-border">
                <Text className="text-surface-muted text-sm text-center">
                  Could not load {feed === "discover" ? "providers" : "saved providers"}. Check that
                  the API is running and EXPO_PUBLIC_API_URL reaches your server. Pull down to retry.
                </Text>
                {__DEV__ ? (
                  <View className="mt-4 pt-4 border-t border-surface-border">
                    <Text selectable className="text-xs font-mono text-surface-muted mb-2">
                      {getApiBaseUrl()}
                    </Text>
                    {activeFetchError ? (
                      <Text selectable className="text-xs text-red-400">
                        {formatQueryError(activeFetchError)}
                      </Text>
                    ) : null}
                    {Platform.OS === "android" ? (
                      <Text className="text-surface-muted text-xs mt-2 leading-5">
                        Emulator tip: use http://10.0.2.2:3010 for the API host.
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : feed === "discover" && !discoveryCoords ? (
              <EnableLocationCard
                radiusKm={DISCOVERY_RADIUS_KM}
                onEnable={() => void refreshCustomerLocation()}
              />
            ) : !list?.length ? (
              <View className="bg-surface-card rounded-3xl p-8 border border-surface-border items-center">
                {feed === "saved" ? (
                  <>
                    <View className="w-16 h-16 rounded-full bg-glow-purple/20 items-center justify-center mb-4">
                      <Ionicons name="heart-outline" size={32} color={appColors.glow.purple} />
                    </View>
                    <Text className="text-white font-bold text-lg text-center mb-2">
                      No saved providers yet
                    </Text>
                    <Text className="text-surface-muted text-sm text-center leading-5">
                      Open a provider profile and tap the heart to save them here.
                    </Text>
                    <TouchableOpacity
                      className="mt-5 bg-glow-blue rounded-2xl px-6 py-3"
                      onPress={() => setFeed("discover")}
                      activeOpacity={0.9}
                    >
                      <Text className="text-white font-bold text-sm">Browse discover</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text className="text-surface-muted text-sm text-center">
                    No providers nearby yet. Pull down to refresh once providers are online.
                  </Text>
                )}
              </View>
            ) : !filteredList.length ? (
              <View className="bg-surface-card rounded-3xl p-8 border border-surface-border items-center">
                <Ionicons name="search-outline" size={40} color={appColors.surface.muted} />
                <Text className="text-white font-bold text-lg text-center mt-4 mb-2">No matches</Text>
                <Text className="text-surface-muted text-sm text-center leading-5">
                  Try a different search or clear the category filter.
                </Text>
                <TouchableOpacity
                  className="mt-5 bg-surface-elevated border border-surface-border rounded-2xl px-6 py-3"
                  onPress={goBackToBrowse}
                  activeOpacity={0.9}
                >
                  <Text className="text-white font-semibold text-sm">Back to categories</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="gap-3">
                {filteredList.map((p) => (
                  <ProviderRow key={p.id} p={p} customerCoords={discoveryCoords} />
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
