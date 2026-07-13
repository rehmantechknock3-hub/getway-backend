import { useCallback } from "react";

import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useMe } from "@repo/api-client";
import { showToast } from "@repo/ui";
import { reportError } from "@repo/utils";

import { appColors } from "../../../styles/colors";
import { normalizeProviderServiceCategories } from "../../../utils/provider-onboarding";

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-3">
      <Text className="text-ink-muted text-xs mb-1">{label}</Text>
      <Text className="text-ink text-base">{value || "—"}</Text>
    </View>
  );
}

export default function ProviderProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isLoaded, isSignedIn, signOut } = useAuth();
  const { user: clerkUser } = useUser();
  const { data: me, refetch: refetchMe, isRefetching: isRefetchingMe, isLoading } = useMe({
    enabled: isLoaded && isSignedIn,
  });

  const refetchMeSafely = useCallback(async () => {
    try {
      const result = await refetchMe();
      if (result.isError) {
        const err = result.error ?? new Error("Failed to refresh profile");
        reportError(err, { screen: "ProviderProfile", action: "refetchMe" });
        showToast("error", "Could not refresh profile. Pull to try again.");
      }
    } catch (error: unknown) {
      reportError(error, { screen: "ProviderProfile", action: "refetchMe" });
      showToast("error", "Could not refresh profile. Pull to try again.");
    }
  }, [refetchMe]);

  useFocusEffect(
    useCallback(() => {
      if (!isLoaded || !isSignedIn) return;
      void refetchMeSafely();
    }, [isLoaded, isSignedIn, refetchMeSafely])
  );

  const signInEmail = clerkUser?.primaryEmailAddress?.emailAddress?.trim() ?? "";
  const accountEmail = signInEmail || me?.email || "";
  const firstName = me?.firstName || clerkUser?.firstName?.trim() || "";
  const lastName = me?.lastName || clerkUser?.lastName?.trim() || "";
  const phone = me?.phone ?? "";
  const serviceCategories = normalizeProviderServiceCategories(me?.providerOnboarding);
  const experienceYears = String(me?.providerOnboarding?.experienceYears ?? 0);
  const serviceArea = me?.providerOnboarding?.serviceArea ?? "";
  const shopLocations = me?.providerOnboarding?.shopLocations ?? [];
  const hasTools = me?.providerOnboarding?.hasTools ?? true;
  const profilePhotoUrl = me?.providerOnboarding?.profilePhotoUrl ?? me?.avatarUrl ?? "";

  if (isLoading) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-canvas px-5"
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: Math.max(insets.bottom + 20, 32),
      }}
      refreshControl={
        <RefreshControl
          refreshing={isLoaded && isSignedIn && isRefetchingMe}
          onRefresh={() => void refetchMeSafely()}
        />
      }
    >
      <Text className="text-3xl font-bold text-ink mb-6">Provider Profile</Text>

      <TouchableOpacity
        className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-4 flex-row items-center justify-between mb-6 active:opacity-90"
        onPress={() => router.push("/(provider)/(tabs)/jobs")}
        accessibilityRole="button"
        accessibilityLabel="View booking history"
      >
        <View className="flex-row items-center gap-3 flex-1">
          <View className="w-11 h-11 rounded-2xl bg-primary-50 items-center justify-center border border-primary-100">
            <Ionicons name="calendar-outline" size={22} color={appColors.primary[600]} />
          </View>
          <View className="flex-1 pr-2">
            <Text className="text-ink font-semibold text-base">View booking history</Text>
            <Text className="text-ink-muted text-xs mt-0.5 leading-4">
              Jobs queue — tap any booking to track status from request to completion
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={22} color={appColors.ink.subtle} />
      </TouchableOpacity>

      <View className="bg-canvas-raised border border-ink-faint rounded-2xl p-4 mb-6">
        <View className="flex-row items-center gap-3 mb-4">
          {profilePhotoUrl ? (
            <Image source={{ uri: profilePhotoUrl }} className="w-14 h-14 rounded-2xl bg-canvas-sunken" />
          ) : (
            <View className="w-14 h-14 rounded-2xl bg-canvas-sunken items-center justify-center">
              <Text className="text-ink-muted font-bold text-lg">
                {(firstName[0] ?? "") + (lastName[0] ?? "")}
              </Text>
            </View>
          )}
          <View className="flex-1">
            <Text className="text-ink font-semibold text-lg">
              {firstName} {lastName}
            </Text>
            <Text className="text-ink-muted text-sm">
              {serviceCategories.length > 0 ? serviceCategories.join(" · ") : "Provider profile"}
            </Text>
          </View>
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1 bg-canvas rounded-xl border border-ink-faint px-3 py-2.5">
            <Text className="text-ink-muted text-xs">Rating</Text>
            <Text className="text-ink font-semibold text-base">{me?.providerMetrics?.averageRating?.toFixed(1) ?? "0.0"}</Text>
          </View>
          <View className="flex-1 bg-canvas rounded-xl border border-ink-faint px-3 py-2.5">
            <Text className="text-ink-muted text-xs">Reviews</Text>
            <Text className="text-ink font-semibold text-base">{me?.providerMetrics?.totalReviews ?? 0}</Text>
          </View>
        </View>

        <TouchableOpacity
          className="mt-4 flex-row items-center justify-between bg-canvas rounded-xl border border-ink-faint px-3 py-3 active:opacity-90"
          onPress={() => router.push("/(provider)/reviews")}
          accessibilityRole="button"
          accessibilityLabel="View customer reviews"
        >
          <View className="flex-row items-center gap-2 flex-1">
            <Ionicons name="star-outline" size={20} color={appColors.primary[600]} />
            <Text className="text-ink font-semibold text-sm">Customer reviews</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={appColors.ink.subtle} />
        </TouchableOpacity>
      </View>

      <View className="bg-canvas-raised border border-ink-faint rounded-3xl p-4 mb-5">
        <Text className="text-ink text-lg font-semibold mb-4">Personal information</Text>
        <ProfileField label="First name" value={firstName} />
        <ProfileField label="Last name" value={lastName} />
        <ProfileField label="Email" value={accountEmail} />
        <ProfileField label="Phone number" value={phone} />
      </View>

      <View className="bg-canvas-raised border border-ink-faint rounded-3xl p-4 mb-5">
        <Text className="text-xl font-bold text-ink mb-4">Provider details</Text>
        <ProfileField label="Experience (years)" value={experienceYears} />
        <ProfileField label="Service area" value={serviceArea} />
        <ProfileField label="Own tools" value={hasTools ? "Yes" : "No"} />

        {shopLocations.length > 0 ? (
          <View className="mt-2">
            <Text className="text-ink-muted text-xs mb-2">Shop locations</Text>
            <View className="gap-2">
              {shopLocations.map((location, index) => (
                <View key={`${location.address}-${index}`} className="bg-canvas border border-ink-faint rounded-2xl p-3">
                  <Text className="text-ink text-sm">{location.address}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>

      <TouchableOpacity
        className="bg-primary-600 rounded-2xl py-3.5 items-center mb-8 active:opacity-90"
        onPress={() => router.push("/(provider)/edit-info")}
        accessibilityRole="button"
        accessibilityLabel="Edit profile information"
      >
        <Text className="text-white font-semibold">EDIT INFO</Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="border border-ink-faint rounded-2xl py-3.5 items-center"
        onPress={() => signOut()}
      >
        <Text className="text-ink font-semibold">Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
