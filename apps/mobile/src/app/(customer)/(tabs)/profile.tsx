import { useCallback } from "react";

import { ActivityIndicator, Image, ScrollView, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth, useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMe } from "@repo/api-client";
import { showToast } from "@repo/ui";
import { reportError } from "@repo/utils";

import { SavedLocationsInfoButton } from "../../../components/SavedLocationsInfoButton";
import { appColors } from "../../../styles/colors";

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-3">
      <Text className="text-ink-muted text-xs mb-1">{label}</Text>
      <Text className="text-ink text-base">{value || "—"}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isLoaded, isSignedIn, signOut } = useAuth();
  const { user: clerkUser } = useUser();
  const { data: me, isLoading, refetch } = useMe({
    enabled: isLoaded && isSignedIn,
  });

  const refetchMeSafely = useCallback(async () => {
    try {
      const result = await refetch();
      if (result.isError) {
        const err = result.error ?? new Error("Failed to refresh profile");
        reportError(err, { screen: "CustomerProfile", action: "refetchMe" });
        showToast("error", "Could not refresh profile.");
      }
    } catch (error: unknown) {
      reportError(error, { screen: "CustomerProfile", action: "refetchMe" });
      showToast("error", "Could not refresh profile.");
    }
  }, [refetch]);

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
  const avatarUrl = me?.avatarUrl ?? "";
  const savedLocations = me?.savedLocations ?? [];
  const primaryLocation = me?.customerOnboarding?.primaryLocation ?? "";
  const carCompany = me?.customerOnboarding?.carCompany ?? "";
  const carModel = me?.customerOnboarding?.carModel ?? "";
  const notes = me?.customerOnboarding?.notes ?? "";

  if (isLoading) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      <StatusBar barStyle="dark-content" />
      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: Math.max(insets.bottom + 20, 32),
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-6">
          <Text className="text-3xl font-bold text-ink mb-1" style={{ letterSpacing: -0.5 }}>
            Profile
          </Text>
          <Text className="text-ink-muted text-base">Manage your account and saved places.</Text>
        </View>

        <TouchableOpacity
          className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-4 flex-row items-center justify-between mb-5 active:opacity-90"
          onPress={() => router.push("/(customer)/(tabs)/bookings")}
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
                Past and upcoming appointments from the Bookings tab
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={22} color={appColors.ink.subtle} />
        </TouchableOpacity>

        <View className="bg-canvas-raised border border-ink-faint rounded-2xl p-4 mb-5">
          <View className="flex-row items-center gap-3 mb-4">
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} className="w-14 h-14 rounded-full bg-canvas-sunken" />
            ) : (
              <View className="w-14 h-14 rounded-full bg-primary-50 items-center justify-center border border-primary-100">
                <Ionicons name="person-outline" size={22} color={appColors.primary[600]} />
              </View>
            )}
            <View className="flex-1">
              <Text className="text-ink text-lg font-semibold">
                {firstName || "Your"} {lastName || "Profile"}
              </Text>
              <Text className="text-ink-muted text-sm">Personal information</Text>
            </View>
          </View>

          <ProfileField label="First name" value={firstName} />
          <ProfileField label="Last name" value={lastName} />
          <ProfileField label="Email" value={accountEmail} />
          <ProfileField label="Phone number" value={phone} />
          <Text className="text-ink-muted text-xs mb-1">Private — only you and admins can see this.</Text>
        </View>

        <View className="bg-canvas-raised border border-ink-faint rounded-2xl p-4 mb-5">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-2 flex-1 pr-2">
              <Ionicons name="location-outline" size={18} color={appColors.primary[600]} />
              <Text className="text-lg font-bold text-ink">Saved Locations</Text>
              <SavedLocationsInfoButton />
            </View>
          </View>

          {savedLocations.length === 0 ? (
            <Text className="text-ink-muted text-sm mb-4">No saved locations yet.</Text>
          ) : (
            <View className="gap-3 mb-4">
              {savedLocations.map((location, index) => (
                <View key={`${location.label}-${index}`} className="bg-canvas border border-ink-faint rounded-2xl p-3.5">
                  <Text className="text-ink font-semibold text-sm mb-1">{location.label}</Text>
                  <Text className="text-ink-muted text-sm">{location.address}</Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            className="bg-primary-50 border border-primary-100 rounded-2xl py-3 items-center active:opacity-90"
            onPress={() => router.push("/(customer)/saved-locations")}
            accessibilityRole="button"
            accessibilityLabel={savedLocations.length === 0 ? "Add saved location" : "Manage saved locations"}
          >
            <Text className="text-primary-600 font-semibold">
              {savedLocations.length === 0 ? "Add location" : "Manage locations"}
            </Text>
          </TouchableOpacity>
        </View>

        <View className="bg-canvas-raised border border-ink-faint rounded-2xl p-4 mb-5">
          <View className="flex-row items-center gap-2 mb-4">
            <Ionicons name="car-sport-outline" size={18} color={appColors.primary[600]} />
            <Text className="text-lg font-bold text-ink">Vehicle Preferences</Text>
          </View>

          <ProfileField label="Primary location" value={primaryLocation} />
          <ProfileField label="Car company" value={carCompany} />
          <ProfileField label="Model (number)" value={carModel} />
          {notes ? <ProfileField label="Notes" value={notes} /> : null}
        </View>

        <TouchableOpacity
          className="bg-primary-600 rounded-2xl py-3.5 items-center mb-5 active:opacity-90"
          onPress={() => router.push("/(customer)/edit-info")}
          accessibilityRole="button"
          accessibilityLabel="Edit profile information"
        >
          <Text className="text-white font-semibold">Edit info</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="border border-ink-faint rounded-2xl py-3.5 items-center bg-canvas-raised"
          onPress={() => signOut()}
        >
          <Text className="text-ink font-semibold">Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
