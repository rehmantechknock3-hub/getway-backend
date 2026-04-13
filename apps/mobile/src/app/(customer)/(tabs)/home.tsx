import { useCallback, useEffect, useMemo, useState } from "react";

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
  setAuthToken,
  useFavoriteProviders,
  useMe,
  useNotifications,
  usePublicProviders,
} from "@repo/api-client";

import { appColors } from "../../../styles/colors";
import { textInputBaselineStyle } from "../../../styles/text-input";

const CATEGORIES = [
  { icon: "water", label: "Plumbing" },
  { icon: "flash", label: "Electrical" },
  { icon: "brush", label: "Cleaning" },
  { icon: "construct", label: "Repairs" },
  { icon: "leaf", label: "Gardening" },
  { icon: "color-palette", label: "Painting" },
];
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

/** Uses `serviceSearchText` (service category names from the API) plus onboarding fields. */
function providerMatchesCategoryLabel(p: ProviderPublicSummary, categoryLabel: string | null): boolean {
  if (!categoryLabel) return true;
  const c = normalizeForSearch(categoryLabel);
  if (!c) return true;

  const catalog = p.serviceSearchText ?? "";
  if (catalog.includes(c)) return true;

  const sc = normalizeForSearch(p.serviceCategory ?? "");
  const pt = normalizeForSearch(p.primaryServiceTitle ?? "");

  if (sc.length > 0) {
    if (sc.includes(c) || c.includes(sc)) return true;
  }
  if (pt.length > 0) {
    if (pt.includes(c) || c.includes(pt)) return true;
  }

  return false;
}

function formatStartingPrice(price: number | undefined): string {
  if (price == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function formatDistance(distanceKm: number | undefined): string | null {
  if (distanceKm == null || Number.isNaN(distanceKm)) return null;
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m away`;
  return `${distanceKm.toFixed(1)} km away`;
}

/** Prefer API `distanceMeters` (Google’s integer route length) so list matches Maps more closely. */
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
    return formatDistance(distanceKm(customerCoords.lat, customerCoords.lon, p.latitude, p.longitude));
  }
  return null;
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
  const bookLabel = p.primaryServiceTitle
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
        "This provider hasn’t published a bookable service, so the booking flow can’t open. You can still view their profile. Ask them to open the Provider app, go to the Services tab, and publish a listing (or complete onboarding again).",
        [
          { text: "Cancel", style: "cancel" },
          { text: "View profile", onPress: openProfile },
        ]
      );
      return;
    }
    router.push(`/(customer)/provider/${p.id}/book/${p.primaryServiceId}` as const);
  };

  return (
    <View className="bg-canvas-raised rounded-2xl border border-ink-faint flex-row items-stretch shadow-sm overflow-hidden">
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
            className="w-14 h-14 rounded-2xl bg-canvas-sunken"
            accessibilityLabel={`${displayName} profile photo`}
          />
        ) : (
          <View className="w-14 h-14 rounded-2xl bg-canvas-sunken items-center justify-center">
            <Text className="text-xl font-bold text-ink-muted">{initials}</Text>
          </View>
        )}

        <View className="flex-1 min-w-0">
          <Text className="text-ink font-semibold text-base">{displayName}</Text>
          <Text className="text-ink-muted text-sm">{serviceLine}</Text>
          <Text className="text-ink-subtle text-xs mt-1">Tap for full profile · all services</Text>
          <View className="flex-row items-center gap-3 mt-1">
            <View className="flex-row items-center gap-1">
              <Ionicons name="star" size={12} color={appColors.semantic.warning} />
              <Text className="text-xs font-medium text-ink-soft">
                {p.averageRating.toFixed(1)} ({p.totalReviews})
              </Text>
            </View>
            {p.serviceArea ? (
              <View className="flex-row items-center gap-1 flex-1 min-w-0">
                <Ionicons name="location-outline" size={12} color={appColors.ink.subtle} />
                <Text className="text-xs text-ink-subtle flex-1" numberOfLines={1}>
                  {p.serviceArea}
                </Text>
              </View>
            ) : null}
            {distanceLabel ? (
              <View className="flex-row items-center gap-1">
                <Ionicons name="navigate-outline" size={12} color={appColors.primary[600]} />
                <Text className="text-xs font-medium text-primary-700">{distanceLabel}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>

      <View className="w-px bg-ink-faint my-3" />

      <View className="justify-center items-center px-3 py-3 gap-2 min-w-[88px]">
        <Text className="text-primary-600 font-bold text-sm text-center">{formatStartingPrice(p.startingPrice)}</Text>
        <View className={`px-2 py-0.5 rounded-full ${available ? "bg-green-100" : "bg-ink-faint"}`}>
          <Text className={`text-xs font-medium ${available ? "text-green-700" : "text-ink-subtle"}`}>
            {available ? "Available" : "Offline"}
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.88}
          className="bg-primary-600 rounded-xl px-3 py-2.5 w-full items-center"
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
  const { sessionClaims, getToken, isLoaded, isSignedIn } = useAuth();
  const firstName = (sessionClaims?.firstName as string) ?? "there";
  const [apiReady, setApiReady] = useState(false);
  const [feed, setFeed] = useState<"discover" | "saved">("discover");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [customerLocationReady, setCustomerLocationReady] = useState(false);

  const refreshAuthToken = useCallback(async () => {
    const token = await getToken();
    setAuthToken(token);
    setApiReady(Boolean(token));
    return token;
  }, [getToken]);

  const refreshCustomerLocation = useCallback(async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== Location.PermissionStatus.GRANTED) {
      setCustomerCoords(null);
      return;
    }

    try {
      const precise = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      setCustomerCoords({
        lat: precise.coords.latitude,
        lon: precise.coords.longitude,
      });
      return;
    } catch {
      // Fallback when highest accuracy is temporarily unavailable.
    }

    const fallback = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    setCustomerCoords({
      lat: fallback.coords.latitude,
      lon: fallback.coords.longitude,
    });
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setApiReady(false);
      return;
    }
    let cancelled = false;
    void refreshAuthToken().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, refreshAuthToken]);

  const providersQueryEnabled = isLoaded && isSignedIn && apiReady;

  const { data: me, refetch: refetchMe } = useMe({ enabled: providersQueryEnabled });

  const discoveryCoords = useMemo(() => {
    const primaryLat = me?.customerOnboarding?.primaryLatitude;
    const primaryLon = me?.customerOnboarding?.primaryLongitude;
    const hasPrimary =
      typeof primaryLat === "number" &&
      typeof primaryLon === "number" &&
      Number.isFinite(primaryLat) &&
      Number.isFinite(primaryLon);
    if (hasPrimary) {
      return { lat: primaryLat, lon: primaryLon };
    }
    if (customerCoords) {
      return customerCoords;
    }
    return null;
  }, [me?.customerOnboarding?.primaryLatitude, me?.customerOnboarding?.primaryLongitude, customerCoords]);

  const { data: notificationPayload, refetch: refetchNotifications } = useNotifications(1, {
    enabled: providersQueryEnabled,
  });

  useFocusEffect(
    useCallback(() => {
      if (!providersQueryEnabled) return;
      void (async () => {
        await refreshAuthToken();
        await refetchNotifications();
        await refetchMe();
      })();
    }, [providersQueryEnabled, refetchNotifications, refreshAuthToken, refetchMe])
  );

  useEffect(() => {
    if (!providersQueryEnabled) return;
    let cancelled = false;
    setCustomerLocationReady(false);
    void (async () => {
      try {
        await refreshCustomerLocation();
        if (cancelled) return;
      } catch {
        // Keep last known location if a refresh attempt fails.
      } finally {
        if (!cancelled) setCustomerLocationReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [providersQueryEnabled, refreshCustomerLocation]);
  const {
    data: providers,
    isLoading,
    isError,
    error: providersFetchError,
    refetch,
    isRefetching,
  } = usePublicProviders(discoveryCoords?.lat, discoveryCoords?.lon, DISCOVERY_RADIUS_KM, {
    enabled: providersQueryEnabled && feed === "discover" && !!discoveryCoords,
  });
  const {
    data: favoritesPayload,
    isLoading: favoritesLoading,
    isError: favoritesError,
    error: favoritesFetchError,
    refetch: refetchFavorites,
    isRefetching: favoritesRefetching,
  } = useFavoriteProviders({
    enabled: providersQueryEnabled && feed === "saved",
    lat: discoveryCoords?.lat,
    lon: discoveryCoords?.lon,
  });

  const list = feed === "discover" ? providers : favoritesPayload?.data;
  const listLoading = feed === "discover" ? isLoading : favoritesLoading;
  const listError = feed === "discover" ? isError : favoritesError;
  const listRefetching = feed === "discover" ? isRefetching : favoritesRefetching;

  const filteredList = useMemo(() => {
    if (!list?.length) return list ?? [];
    const categoryActive = feed === "discover" ? categoryFilter : null;
    return list.filter(
      (p) =>
        providerMatchesQuery(p, searchQuery) &&
        providerMatchesCategoryLabel(p, categoryActive) &&
        (!onlineOnly || p.isOnline)
    );
  }, [list, searchQuery, categoryFilter, onlineOnly, feed]);

  const onListRefresh = () => {
    if (feed === "discover") {
      void (async () => {
        try {
          await refreshAuthToken();
          await refreshCustomerLocation();
          await refetchMe();
        } finally {
          await refetch();
        }
      })();
    }
    else {
      void (async () => {
        await refreshAuthToken();
        await refetchFavorites();
      })();
    }
  };

  const activeFetchError = feed === "discover" ? providersFetchError : favoritesFetchError;

  return (
    <View className="flex-1 bg-canvas">
      <StatusBar barStyle="dark-content" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: Math.max(insets.bottom + 90, 100),
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={providersQueryEnabled && listRefetching}
            onRefresh={onListRefresh}
          />
        }
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 mb-6">
          <View>
            <Text className="text-ink-muted text-sm">Good morning,</Text>
            <Text className="text-2xl font-bold text-ink" style={{ letterSpacing: -0.5 }}>
              {firstName} 👋
            </Text>
          </View>
          <View className="relative">
            <TouchableOpacity
              className="w-11 h-11 rounded-full bg-canvas-raised border border-ink-faint items-center justify-center"
              onPress={() => router.push("/(customer)/notifications")}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={22} color={appColors.ink.DEFAULT} />
            </TouchableOpacity>
            {(notificationPayload?.unreadCount ?? 0) > 0 ? (
              <View className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-primary-600 items-center justify-center px-1 border border-canvas">
                <Text className="text-white text-xs font-bold">
                  {(notificationPayload?.unreadCount ?? 0) > 9
                    ? "9+"
                    : String(notificationPayload?.unreadCount ?? 0)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Discover / Saved */}
        <View className="flex-row px-5 gap-2 mb-6">
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setFeed("discover")}
            className={`flex-1 py-3 rounded-2xl border items-center ${
              feed === "discover"
                ? "bg-primary-600 border-primary-600"
                : "bg-canvas-raised border-ink-faint"
            }`}
          >
            <Text
              className={`text-sm font-bold ${feed === "discover" ? "text-white" : "text-ink-soft"}`}
            >
              Discover
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setFeed("saved")}
            className={`flex-1 py-3 rounded-2xl border flex-row items-center justify-center gap-2 ${
              feed === "saved"
                ? "bg-ink border-ink"
                : "bg-canvas-raised border-ink-faint"
            }`}
          >
            <Ionicons
              name="heart"
              size={16}
              color={feed === "saved" ? appColors.onPrimary : appColors.primary[600]}
            />
            <Text
              className={`text-sm font-bold ${feed === "saved" ? "text-white" : "text-ink-soft"}`}
            >
              Saved
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View className="mx-5 mb-7">
          <View className="flex-row items-center bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3 gap-3">
            <Ionicons name="search" size={20} color={appColors.ink.muted} />
            <TextInput
              className="flex-1 text-ink text-base"
              placeholder="Search services or providers..."
              placeholderTextColor={appColors.ink.subtle}
              style={textInputBaselineStyle}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              accessibilityLabel="Search providers and services"
            />
            <TouchableOpacity
              className={`rounded-xl px-3 py-1.5 border ${
                onlineOnly ? "bg-primary-50 border-primary-600" : "bg-primary-600 border-primary-600"
              }`}
              onPress={() => setOnlineOnly((v) => !v)}
              accessibilityLabel={onlineOnly ? "Show all providers" : "Show available providers only"}
              accessibilityRole="button"
            >
              <Text
                className={`text-xs font-semibold ${onlineOnly ? "text-primary-700" : "text-white"}`}
              >
                Filter
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Categories */}
        <View className="mb-7">
          <View className="flex-row items-center justify-between px-5 mb-4">
            <Text className="text-lg font-bold text-ink">Categories</Text>
            <TouchableOpacity
              onPress={() => setCategoryFilter(null)}
              accessibilityRole="button"
              accessibilityLabel="Show all categories"
            >
              <Text className="text-primary-600 text-sm font-medium">See all</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
            {CATEGORIES.map(({ icon, label }) => {
              const selected = categoryFilter === label;
              return (
                <TouchableOpacity
                  key={label}
                  activeOpacity={0.8}
                  className="items-center gap-2"
                  onPress={() => setCategoryFilter((prev) => (prev === label ? null : label))}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${label} category${selected ? ", selected" : ""}`}
                >
                  <View
                    className={`w-16 h-16 rounded-2xl items-center justify-center border ${
                      selected ? "bg-primary-50 border-primary-600" : "bg-canvas-raised border-ink-faint"
                    }`}
                  >
                    <Ionicons
                      name={icon as keyof typeof Ionicons.glyphMap}
                      size={26}
                      color={selected ? appColors.primary[600] : appColors.ink.soft}
                    />
                  </View>
                  <Text
                    className={`text-xs font-medium ${selected ? "text-primary-700 font-semibold" : "text-ink-soft"}`}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Promo banner */}
        <View className="mx-5 mb-7 bg-ink rounded-3xl p-5 flex-row items-center overflow-hidden">
          <View className="flex-1">
            <Text className="text-primary-400 text-xs font-semibold uppercase tracking-wide mb-1">Limited offer</Text>
            <Text className="text-white text-xl font-bold mb-1" style={{ letterSpacing: -0.5 }}>
              First booking{"\n"}20% off
            </Text>
            <TouchableOpacity className="bg-primary-600 self-start rounded-xl px-4 py-2 mt-2">
              <Text className="text-white text-xs font-bold">Book now</Text>
            </TouchableOpacity>
          </View>
          <View className="w-20 h-20 rounded-2xl bg-ink-soft items-center justify-center ml-4">
            <Ionicons name="pricetag" size={36} color={appColors.primary[500]} />
          </View>
        </View>

        {/* Provider list */}
        <View className="px-5">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-ink">
              {feed === "discover" ? "Nearby providers" : "Saved providers"}
            </Text>
          </View>

          {!providersQueryEnabled || listLoading ? (
            <View className="py-12 items-center">
              <ActivityIndicator />
            </View>
          ) : listError ? (
            <View className="bg-canvas-raised rounded-2xl p-4 border border-ink-faint">
              <Text className="text-ink-muted text-sm text-center">
                Could not load {feed === "discover" ? "providers" : "saved providers"}. Check that the API is running
                and EXPO_PUBLIC_API_URL reaches your server. On a physical phone use your computer&apos;s LAN IP, not
                localhost. Pull down to retry.
              </Text>
              {(() => {
                const base = getApiBaseUrl();
                const usesLoopback =
                  base.includes("localhost") || base.includes("127.0.0.1");
                return (
                  <>
                    {usesLoopback ? (
                      <View className="mt-4 bg-primary-50 border border-primary-200 rounded-2xl p-4">
                        {Platform.OS === "ios" ? (
                          <>
                            <Text className="text-ink font-bold text-sm mb-2">
                              iOS Simulator: localhost should work
                            </Text>
                            <Text className="text-ink-soft text-xs leading-5 mb-3">
                              The simulator uses your Mac&apos;s localhost. A &quot;Network Error&quot; here usually means
                              the Nest API is not running on port 3001 (or the port is blocked).
                            </Text>
                            <Text className="text-ink-soft text-xs leading-5 mb-2">
                              In a separate terminal from the repo root:
                            </Text>
                            <Text selectable className="font-mono text-xs text-ink mb-3">
                              pnpm --filter @repo/api dev
                            </Text>
                            <Text className="text-ink-muted text-xs leading-5 mb-2">
                              Confirm you see &quot;API running on http://localhost:3001&quot;. If it still fails, check
                              macOS Firewall for Node on port 3001.
                            </Text>
                            <Text className="text-ink-muted text-xs leading-5 mb-3">
                              Still stuck? In apps/api/.env try{" "}
                              <Text className="font-mono text-ink">EXPO_PUBLIC_API_URL=http://127.0.0.1:3001</Text>{" "}
                              (forces IPv4; some simulators resolve <Text className="font-mono text-ink">localhost</Text>{" "}
                              to IPv6 first), then restart Expo with <Text className="font-mono text-ink">expo start -c</Text>.
                            </Text>
                            <Text className="text-ink-soft text-xs leading-5 border-t border-primary-200 pt-3">
                              <Text className="font-semibold text-ink">On a physical iPhone</Text>, localhost points at
                              the phone — set EXPO_PUBLIC_API_URL to your Mac&apos;s Wi‑Fi IP in apps/api/.env and restart
                              Expo with <Text className="font-mono text-ink">expo start -c</Text>.
                            </Text>
                          </>
                        ) : null}
                        {Platform.OS === "android" ? (
                          <>
                            <Text className="text-ink font-bold text-sm mb-2">
                              Android: localhost is usually wrong
                            </Text>
                            <Text className="text-ink-soft text-xs leading-5 mb-2">
                              <Text className="font-semibold text-ink">Emulator:</Text> set{" "}
                              <Text className="font-mono text-ink">EXPO_PUBLIC_API_URL=http://10.0.2.2:3001</Text> in
                              apps/api/.env, then <Text className="font-mono text-ink">expo start -c</Text>.
                            </Text>
                            <Text className="text-ink-soft text-xs leading-5">
                              <Text className="font-semibold text-ink">Physical phone:</Text> use your computer&apos;s
                              LAN IP (same Wi‑Fi), e.g. http://192.168.1.x:3001.
                            </Text>
                          </>
                        ) : null}
                      </View>
                    ) : null}
                    {__DEV__ ? (
                      <View className="mt-4 pt-4 border-t border-ink-faint">
                        <Text className="text-xs font-semibold text-ink-soft mb-2">Developer details</Text>
                        <Text selectable className="text-xs font-mono text-ink-muted mb-2">
                          {base}
                        </Text>
                        {activeFetchError ? (
                          <Text selectable className="text-xs text-red-700">
                            {formatQueryError(activeFetchError)}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                  </>
                );
              })()}
            </View>
          ) : feed === "discover" && !discoveryCoords ? (
            <View className="bg-canvas-raised rounded-3xl p-8 border border-ink-faint items-center">
              <Ionicons name="location-outline" size={36} color={appColors.ink.subtle} />
              <Text className="text-ink font-bold text-lg text-center mt-3 mb-2">
                Set where to search
              </Text>
              <Text className="text-ink-muted text-sm text-center leading-5 mb-5">
                Turn on location access, or save a primary location under Profile (vehicle preferences). Discovery uses
                your saved primary location when it is set, otherwise your current position.
              </Text>
              <TouchableOpacity
                className="bg-primary-600 rounded-2xl px-5 py-3"
                onPress={() => void Linking.openSettings()}
              >
                <Text className="text-white font-semibold text-sm">Open location settings</Text>
              </TouchableOpacity>
            </View>
          ) : !list?.length ? (
            <View className="bg-canvas-raised rounded-3xl p-8 border border-ink-faint items-center">
              {feed === "saved" ? (
                <>
                  <View className="w-16 h-16 rounded-full bg-primary-50 items-center justify-center mb-4">
                    <Ionicons name="heart-outline" size={32} color={appColors.primary[600]} />
                  </View>
                  <Text className="text-ink font-bold text-lg text-center mb-2">No saved providers yet</Text>
                  <Text className="text-ink-muted text-sm text-center leading-5">
                    Open a provider profile and tap the heart to save them here for quick access.
                  </Text>
                  <TouchableOpacity
                    className="mt-5 bg-primary-600 rounded-2xl px-6 py-3"
                    onPress={() => setFeed("discover")}
                    activeOpacity={0.9}
                  >
                    <Text className="text-white font-bold text-sm">Browse discover</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text className="text-ink-muted text-sm text-center">
                  No providers returned from the server yet. If you expect listings here, confirm at least one user has
                  completed sign-up as a provider against this same database, or pull down to refresh.
                </Text>
              )}
            </View>
          ) : !filteredList.length ? (
            <View className="bg-canvas-raised rounded-3xl p-8 border border-ink-faint items-center">
              <Ionicons name="search-outline" size={40} color={appColors.ink.subtle} />
              <Text className="text-ink font-bold text-lg text-center mt-4 mb-2">No matches</Text>
              <Text className="text-ink-muted text-sm text-center leading-5">
                Try a different search, clear the category chip, or turn off the available-only filter.
              </Text>
              <TouchableOpacity
                className="mt-5 bg-canvas-sunken border border-ink-faint rounded-2xl px-6 py-3"
                onPress={() => {
                  setSearchQuery("");
                  setCategoryFilter(null);
                  setOnlineOnly(false);
                }}
                activeOpacity={0.9}
              >
                <Text className="text-ink font-semibold text-sm">Clear search & filters</Text>
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
      </ScrollView>
    </View>
  );
}
