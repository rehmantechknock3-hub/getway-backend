import { useCallback, useEffect, useRef } from "react";

import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth, useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";

import {
  useDeleteProviderService,
  useEnsureProviderListing,
  useMe,
  useMyProviderServices,
} from "@repo/api-client";
import { appColors } from "../../../styles/colors";

function formatPrice(amount: number, currency: string | undefined): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency ?? "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function serviceNeedsPriceOrDuration(s: { price: number; duration: number }): boolean {
  return s.price <= 0 || s.duration <= 0;
}

function clerkPublicRole(user: ReturnType<typeof useUser>["user"]): string | undefined {
  return (user?.publicMetadata as { role?: string } | undefined)?.role;
}

export default function ProviderServicesScreen() {
  const insets = useSafeAreaInsets();
  const { isLoaded, isSignedIn } = useAuth();
  const { user: clerkUser } = useUser();
  const bootstrapListingRef = useRef(false);
  const ensureListing = useEnsureProviderListing();
  const deleteService = useDeleteProviderService();

  const meEnabled = isLoaded && isSignedIn;
  const { data: me, isLoading: meLoading } = useMe({ enabled: meEnabled });
  /** Routing uses Clerk metadata; `/users/me` uses DB role — keep both in sync, but don’t block this tab if only DB lags. */
  const clerkRole = clerkPublicRole(clerkUser);
  const isProviderSession =
    me?.role === "PROVIDER" || clerkRole === "PROVIDER";
  const profileId =
    isProviderSession && me?.providerProfileId ? me.providerProfileId : undefined;

  const servicesQuery = useMyProviderServices({
    enabled: meEnabled && !!profileId && isProviderSession,
  });

  useFocusEffect(
    useCallback(() => {
      if (!meEnabled || !profileId || !isProviderSession) return;
      void servicesQuery.refetch();
    }, [meEnabled, profileId, isProviderSession, servicesQuery.refetch])
  );

  useEffect(() => {
    if (!profileId || !servicesQuery.isSuccess) return;
    if ((servicesQuery.data?.length ?? 0) > 0) return;
    if (bootstrapListingRef.current) return;
    if (ensureListing.isPending) return;
    bootstrapListingRef.current = true;
    void ensureListing
      .mutateAsync()
      .then(() => servicesQuery.refetch())
      .catch(() => {
        /* user can use the button below */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot when empty list first loads
  }, [profileId, servicesQuery.isSuccess, servicesQuery.data?.length]);

  function promptDeleteService(serviceId: string, serviceTitle: string) {
    Alert.alert(
      "Delete service?",
      `Delete "${serviceTitle}" permanently? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void deleteService
              .mutateAsync(serviceId)
              .then(() => servicesQuery.refetch())
              .catch(() => {
                Alert.alert("Could not delete service", "Please try again.");
              });
          },
        },
      ]
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      <StatusBar barStyle="dark-content" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: Math.max(insets.bottom + 90, 100),
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={servicesQuery.isRefetching}
            onRefresh={() => void servicesQuery.refetch()}
            enabled={meEnabled && !!profileId}
          />
        }
      >
        <View className="flex-row items-start justify-between gap-3 mb-1">
          <Text className="text-2xl font-bold text-ink flex-1" style={{ letterSpacing: -0.5 }}>
            My services
          </Text>
          {profileId && isProviderSession ? (
            <TouchableOpacity
              onPress={() => router.push("/(provider)/service/new")}
              className="p-1 -mr-1"
              accessibilityRole="button"
              accessibilityLabel="Add service"
            >
              <Ionicons name="add-circle" size={34} color={appColors.primary[600]} />
            </TouchableOpacity>
          ) : null}
        </View>
        <Text className="text-ink-muted text-sm mb-6 leading-5">
          Services with price and duration set can be turned on for customers. Drafts (missing price or time) are
          highlighted — open each one to finish setup.
        </Text>

        {!meEnabled || meLoading ? (
          <View className="py-16 items-center">
            <ActivityIndicator />
          </View>
        ) : !isProviderSession ? (
          <View className="bg-canvas-raised border border-ink-faint rounded-2xl p-5">
            <Text className="text-ink-muted text-sm text-center">
              Switch to a provider account to manage services.
            </Text>
          </View>
        ) : !profileId ? (
          <View className="bg-canvas-raised border border-ink-faint rounded-2xl p-5">
            <Text className="text-ink-muted text-sm text-center leading-5">
              Complete provider onboarding so your profile (and services) can load.
            </Text>
          </View>
        ) : servicesQuery.isLoading ? (
          <View className="py-16 items-center">
            <ActivityIndicator />
          </View>
        ) : servicesQuery.isError ? (
          <View className="bg-canvas-raised border border-ink-faint rounded-2xl p-5">
            <Text className="text-ink text-center font-medium mb-2">Could not load services</Text>
            <Text className="text-ink-muted text-sm text-center">Pull to refresh after checking your connection.</Text>
          </View>
        ) : !servicesQuery.data?.length ? (
          <View className="bg-canvas-raised border border-ink-faint rounded-2xl p-6 items-center">
            <View className="w-14 h-14 rounded-2xl bg-primary-50 items-center justify-center mb-4">
              <Ionicons name="construct-outline" size={28} color={appColors.primary[600]} />
            </View>
            <Text className="text-ink font-semibold text-center mb-2">No published service yet</Text>
            <Text className="text-ink-muted text-sm text-center leading-5 mb-4">
              We create draft listings from your onboarding categories. Tap below if they didn&apos;t appear, then set
              price and duration on each service.
            </Text>
            {ensureListing.isPending ? (
              <ActivityIndicator />
            ) : (
              <TouchableOpacity
                className="bg-primary-600 rounded-2xl px-6 py-3 w-full items-center active:opacity-90"
                onPress={() => void ensureListing.mutateAsync().then(() => servicesQuery.refetch())}
              >
                <Text className="text-white font-bold text-sm">Publish listing from my profile</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View className="gap-3">
            {servicesQuery.data.map((s) => {
              const incomplete = serviceNeedsPriceOrDuration(s);
              return (
              <View
                key={s.id}
                className={`bg-canvas-raised rounded-2xl p-4 ${
                  incomplete ? "border-2 border-red-400" : "border border-ink-faint"
                }`}
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1 min-w-0">
                    <Text className="text-ink font-semibold text-base">{s.title}</Text>
                    <Text className="text-ink-muted text-xs mt-1">{s.categoryName}</Text>
                    {incomplete ? (
                      <Text className="text-red-700 text-sm font-semibold mt-2 leading-5">
                        Add a price and duration for this service to publish it.
                      </Text>
                    ) : null}
                    {s.description ? (
                      <Text className="text-ink-soft text-sm mt-2 leading-5">{s.description}</Text>
                    ) : null}
                  </View>
                  <Text
                    className={`font-bold shrink-0 ${incomplete ? "text-red-600" : "text-primary-600"}`}
                  >
                    {s.price > 0 ? formatPrice(s.price, s.priceCurrency) : "Set price"}
                  </Text>
                </View>
                <View className="flex-row items-center justify-between mt-3">
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="time-outline" size={14} color={appColors.ink.muted} />
                    <Text className="text-ink-subtle text-xs">
                      {s.duration > 0 ? `${s.duration} min` : "Set duration"}
                    </Text>
                  </View>
                  <View
                    className={`px-2 py-0.5 rounded-full ${s.isActive ? "bg-green-100" : "bg-ink-faint"}`}
                  >
                    <Text
                      className={`text-xs font-semibold ${s.isActive ? "text-green-800" : "text-ink-muted"}`}
                    >
                      {s.isActive ? "Active" : "Hidden"}
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center justify-end gap-3 mt-3">
                  <TouchableOpacity
                    className="flex-row items-center gap-1"
                    onPress={() => router.push(`/(provider)/service/${s.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${s.title}`}
                  >
                    <Text className="text-primary-600 text-xs font-semibold">Edit</Text>
                    <Ionicons name="chevron-forward" size={14} color={appColors.primary[600]} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-row items-center gap-1"
                    onPress={() => promptDeleteService(s.id, s.title)}
                    disabled={deleteService.isPending}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${s.title}`}
                  >
                    <Ionicons name="trash-outline" size={14} color={appColors.primary[700]} />
                    <Text className="text-primary-700 text-xs font-semibold">Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
