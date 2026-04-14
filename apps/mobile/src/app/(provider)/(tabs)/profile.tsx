import { useCallback, useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import {
  useMe,
  useSubmitProviderOnboarding,
  useUpdateProfile,
  useUpdateProviderPresence,
} from "@repo/api-client";
import { showToast } from "@repo/ui";
import { enrichShopLocationsWithCoordinates, reportError } from "@repo/utils";

import { ShopAddressField } from "../../../components/ShopAddressField";
import { appColors } from "../../../styles/colors";
import { textInputBaselineStyle } from "../../../styles/text-input";
import { normalizeProviderServiceCategories } from "../../../utils/provider-onboarding";

export default function ProviderProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isLoaded, isSignedIn, signOut } = useAuth();
  const { user: clerkUser } = useUser();
  const { data: me, refetch: refetchMe, isRefetching: isRefetchingMe } = useMe({
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
  const updateProfile = useUpdateProfile();
  const updateProviderOnboarding = useSubmitProviderOnboarding();
  const updateProviderPresence = useUpdateProviderPresence();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceCategories, setServiceCategories] = useState<string[]>([]);
  const [experienceYears, setExperienceYears] = useState("0");
  const [serviceArea, setServiceArea] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [shopPlaceId, setShopPlaceId] = useState<string | undefined>(undefined);
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  const [shopLocations, setShopLocations] = useState<
    Array<{ address: string; placeId?: string; latitude?: number; longitude?: number }>
  >([]);
  const [isOnline, setIsOnline] = useState(false);
  const [hasTools, setHasTools] = useState(true);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const serviceDescription = me?.providerOnboarding?.serviceDescription ?? "";

  const signInEmail =
    clerkUser?.primaryEmailAddress?.emailAddress?.trim() ?? "";
  const accountEmail = signInEmail || me?.email || "";

  useEffect(() => {
    if (!me) return;
    const clerkFirst = clerkUser?.firstName?.trim() ?? "";
    const clerkLast = clerkUser?.lastName?.trim() ?? "";
    setFirstName(clerkFirst || me.firstName);
    setLastName(clerkLast || me.lastName);
    setPhone(me.phone ?? "");
    setServiceCategories(normalizeProviderServiceCategories(me.providerOnboarding));
    setExperienceYears(String(me.providerOnboarding?.experienceYears ?? 0));
    setServiceArea(me.providerOnboarding?.serviceArea ?? "");
    setShopAddress(me.providerOnboarding?.shopAddress ?? "");
    setShopPlaceId(me.providerOnboarding?.shopPlaceId);
    setShopLocations(
      (me.providerOnboarding?.shopLocations ?? []).map((location) => ({
        address: location.address,
        placeId: location.placeId,
        latitude: location.latitude,
        longitude: location.longitude,
      }))
    );
    setIsOnline(me.providerMetrics?.isOnline ?? false);
    setHasTools(me.providerOnboarding?.hasTools ?? true);
    setProfilePhotoUrl(me.providerOnboarding?.profilePhotoUrl ?? me.avatarUrl ?? "");
  }, [me, clerkUser?.firstName, clerkUser?.lastName]);


  async function handleSaveProfile() {
    const emailToSave = accountEmail.trim();
    if (!firstName.trim() || !lastName.trim() || !emailToSave || !phone.trim()) {
      Alert.alert("Required", "Name, email and phone are required.");
      return;
    }
    try {
      await updateProfile.mutateAsync({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: emailToSave,
        phone: phone.trim(),
      });
      Alert.alert("Saved", "Profile updated successfully.");
    } catch (error: unknown) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to save profile");
    }
  }

  async function handleSaveProviderInfo() {
    const parsedExperience = Number.parseInt(experienceYears, 10);
    const pendingAddress = shopAddress.trim();
    const normalizedLocations =
      pendingAddress.length > 0 &&
      !shopLocations.some((location) => location.address.toLowerCase() === pendingAddress.toLowerCase())
        ? [...shopLocations, { address: pendingAddress, placeId: shopPlaceId }]
        : shopLocations;
    if (
      !serviceArea.trim() ||
      normalizedLocations.length === 0 ||
      Number.isNaN(parsedExperience)
    ) {
      Alert.alert("Required", "Complete provider details before saving.");
      return;
    }
    try {
      let locationsToSave = normalizedLocations;
      if (googleMapsApiKey) {
        locationsToSave = await enrichShopLocationsWithCoordinates(normalizedLocations, googleMapsApiKey);
        const anyMissing = locationsToSave.some(
          (location) => typeof location.latitude !== "number" || typeof location.longitude !== "number"
        );
        if (anyMissing) {
          reportError(new Error("Provider profile: shop coordinates missing after enrichment"), {
            screen: "ProviderProfile",
            action: "handleSaveProviderInfo",
          });
          showToast(
            "error",
            "Could not pin your shop on the map. Pick an address from the suggestions, or enable Places + Geocoding for your Google API key."
          );
          return;
        }
      }

      await updateProviderOnboarding.mutateAsync({
        serviceCategories,
        experienceYears: parsedExperience,
        serviceArea: serviceArea.trim(),
        shopAddress: locationsToSave[0]?.address ?? pendingAddress,
        shopPlaceId: locationsToSave[0]?.placeId ?? shopPlaceId,
        shopLocations: locationsToSave,
        hasTools,
        serviceDescription: serviceDescription.trim(),
        profilePhotoUrl: profilePhotoUrl.trim() ? profilePhotoUrl.trim() : undefined,
      });
      Alert.alert("Saved", "Provider details updated successfully.");
    } catch (error: unknown) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to save provider details");
    }
  }

  async function handlePresenceToggle(nextValue: boolean) {
    setIsOnline(nextValue);
    try {
      await updateProviderPresence.mutateAsync(nextValue);
    } catch (error: unknown) {
      setIsOnline(!nextValue);
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to update availability");
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-canvas px-5"
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: Math.max(insets.bottom + 20, 32),
      }}
      keyboardShouldPersistTaps="always"
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
            <Text className="text-ink font-semibold text-lg">{firstName} {lastName}</Text>
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

      <Text className="text-ink text-sm font-medium mb-2">First name</Text>
      <TextInput
        className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-4"
        style={textInputBaselineStyle}
        value={firstName}
        onChangeText={setFirstName}
      />

      <Text className="text-ink text-sm font-medium mb-2">Last name</Text>
      <TextInput
        className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-4"
        style={textInputBaselineStyle}
        value={lastName}
        onChangeText={setLastName}
      />

      <Text className="text-ink text-sm font-medium mb-2">Email</Text>
      <View className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3.5 mb-1">
        <Text className="text-ink text-base">{accountEmail || "—"}</Text>
      </View>
      <Text className="text-ink-muted text-xs mb-4">
        Same as your sign-in email. Update it in your account settings if needed.
      </Text>

      <Text className="text-ink text-sm font-medium mb-2">Phone number</Text>
      <TextInput
        className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-6"
        keyboardType="phone-pad"
        style={textInputBaselineStyle}
        value={phone}
        onChangeText={setPhone}
      />

      <TouchableOpacity
        className="bg-primary-600 rounded-2xl py-3.5 items-center mb-8"
        onPress={handleSaveProfile}
        disabled={updateProfile.isPending}
        style={{ opacity: updateProfile.isPending ? 0.6 : 1 }}
      >
        {updateProfile.isPending ? (
          <ActivityIndicator color={appColors.onPrimary} />
        ) : (
          <Text className="text-white font-semibold">Save Profile</Text>
        )}
      </TouchableOpacity>

      <Text className="text-xl font-bold text-ink mb-4">Provider Onboarding</Text>

      <Text className="text-ink text-sm font-medium mb-2">Experience (years)</Text>
      <TextInput
        className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-4"
        keyboardType="number-pad"
        style={textInputBaselineStyle}
        value={experienceYears}
        onChangeText={setExperienceYears}
      />

      <Text className="text-ink text-sm font-medium mb-2">Service area</Text>
      <TextInput
        className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-4"
        style={textInputBaselineStyle}
        value={serviceArea}
        onChangeText={setServiceArea}
      />

      <ShopAddressField
        shopAddress={shopAddress}
        setShopAddress={setShopAddress}
        shopPlaceId={shopPlaceId}
        setShopPlaceId={setShopPlaceId}
        shopLocations={shopLocations}
        setShopLocations={setShopLocations}
        googleMapsApiKey={googleMapsApiKey}
        inputPlaceholder="Shop/office address"
        mapDescription="Confirm these pins match your shop locations."
        mapEmptyMessage={
          googleMapsApiKey
            ? "Enter at least 3 characters in shop address to preview on map."
            : "Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to preview shop location."
        }
      />

      <Text className="text-ink-muted text-xs mb-4 leading-5">
        Set price and duration for each offering under <Text className="font-semibold text-ink-soft">My services</Text>.
      </Text>

      <View className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-4 mb-6 flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-ink font-semibold">Availability</Text>
          <Text className="text-ink-muted text-sm">Customers see this as online/offline status.</Text>
        </View>
        <Switch value={isOnline} onValueChange={(value) => void handlePresenceToggle(value)} />
      </View>

      <View className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-4 mb-6 flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-ink font-semibold">Have your own tools</Text>
          <Text className="text-ink-muted text-sm">Set to off if customer needs to provide equipment.</Text>
        </View>
        <Switch value={hasTools} onValueChange={setHasTools} />
      </View>

      <TouchableOpacity
        className="bg-primary-600 rounded-2xl py-3.5 items-center mb-8"
        onPress={handleSaveProviderInfo}
        disabled={updateProviderOnboarding.isPending}
        style={{ opacity: updateProviderOnboarding.isPending ? 0.6 : 1 }}
      >
        {updateProviderOnboarding.isPending ? (
          <ActivityIndicator color={appColors.onPrimary} />
        ) : (
          <Text className="text-white font-semibold">Save Provider Details</Text>
        )}
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
