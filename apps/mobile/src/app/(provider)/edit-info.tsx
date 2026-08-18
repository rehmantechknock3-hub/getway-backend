import { useEffect, useState } from "react";

import { ActivityIndicator, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { isAxiosError } from "axios";

import { useMe, useSubmitProviderOnboarding, useUpdateAvatar, useUpdateProfile } from "@repo/api-client";
import { showToast } from "@repo/ui";
import { enrichShopLocationsWithCoordinates, reportError } from "@repo/utils";

import { PhoneNumberField } from "../../components/PhoneNumberField";
import { ProfilePhotoField } from "../../components/ProfilePhotoField";
import { ProviderServiceCategoriesField } from "../../components/ProviderServiceCategoriesField";
import { ShopAddressField } from "../../components/ShopAddressField";
import { appColors } from "../../styles/colors";
import { textInputBaselineStyle } from "../../styles/text-input";
import { promptPickProfilePhoto } from "../../utils/pick-profile-photo";
import { isValidRequiredPhone, sanitizePhoneInput } from "../../utils/phone";
import { normalizeProviderServiceCategories } from "../../utils/provider-onboarding";

function optionalPlaceId(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length >= 10 ? trimmed : undefined;
}

function optionalHttpUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

function apiErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "object" && data != null && "message" in data) {
      const message = (data as { message?: unknown }).message;
      if (typeof message === "string" && message.trim().length > 0) return message;
    }
    if (error.response?.status === 401) return "Session expired. Please try again.";
  }
  return error instanceof Error ? error.message : fallback;
}

export default function ProviderEditInfoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const { data: me, isLoading } = useMe();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUpdateAvatar();
  const updateProviderOnboarding = useSubmitProviderOnboarding();

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
  const [hasTools, setHasTools] = useState(true);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const serviceDescription = me?.providerOnboarding?.serviceDescription ?? "";

  const signInEmail = clerkUser?.primaryEmailAddress?.emailAddress?.trim() ?? "";
  const accountEmail = signInEmail || me?.email || "";

  useEffect(() => {
    if (!me) return;
    const clerkFirst = clerkUser?.firstName?.trim() ?? "";
    const clerkLast = clerkUser?.lastName?.trim() ?? "";
    setFirstName(me.firstName || clerkFirst);
    setLastName(me.lastName || clerkLast);
    setPhone(sanitizePhoneInput(me.phone ?? ""));
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
    setHasTools(me.providerOnboarding?.hasTools ?? true);
    setProfilePhotoUrl(me.providerOnboarding?.profilePhotoUrl ?? me.avatarUrl ?? "");
  }, [me, clerkUser?.firstName, clerkUser?.lastName]);

  async function handleSaveProfile() {
    if (!firstName.trim() || !lastName.trim()) {
      showToast("error", "First and last name are required.");
      return;
    }
    const trimmedPhone = sanitizePhoneInput(phone.trim());
    if (!isValidRequiredPhone(trimmedPhone)) {
      showToast("error", "Phone number is required", "Pick a country and enter a valid number for that country.");
      return;
    }
    try {
      await updateProfile.mutateAsync({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: trimmedPhone,
      });
      showToast("success", "Profile updated successfully.");
      router.back();
    } catch (error: unknown) {
      reportError(error, { screen: "ProviderEditInfo", action: "handleSaveProfile" });
      showToast("error", apiErrorMessage(error, "Failed to save profile"));
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
    if (!serviceArea.trim() || normalizedLocations.length === 0 || Number.isNaN(parsedExperience)) {
      showToast("error", "Complete provider details before saving.");
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
          reportError(new Error("Provider edit info: shop coordinates missing after enrichment"), {
            screen: "ProviderEditInfo",
            action: "handleSaveProviderInfo",
          });
          showToast(
            "error",
            "Could not pin your shop on the map. Pick an address from the suggestions, or enable Places + Geocoding for your Google API key."
          );
          return;
        }
      }

      const primaryPlaceId = optionalPlaceId(locationsToSave[0]?.placeId ?? shopPlaceId);
      await updateProviderOnboarding.mutateAsync({
        serviceCategories,
        experienceYears: parsedExperience,
        serviceArea: serviceArea.trim(),
        shopAddress: locationsToSave[0]?.address ?? pendingAddress,
        shopPlaceId: primaryPlaceId,
        shopLocations: locationsToSave.map((location) => ({
          address: location.address,
          placeId: optionalPlaceId(location.placeId),
          latitude: location.latitude,
          longitude: location.longitude,
        })),
        hasTools,
        serviceDescription: serviceDescription.trim(),
        profilePhotoUrl: optionalHttpUrl(profilePhotoUrl),
      });
      showToast("success", "Provider details updated successfully.");
      router.back();
    } catch (error: unknown) {
      reportError(error, { screen: "ProviderEditInfo", action: "handleSaveProviderInfo" });
      showToast("error", apiErrorMessage(error, "Failed to save provider details"));
    }
  }

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
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 20, 32) }}
      keyboardShouldPersistTaps="always"
      showsVerticalScrollIndicator={false}
    >
      <ProfilePhotoField
        uri={me?.avatarUrl ?? profilePhotoUrl}
        isUploading={uploadAvatar.isPending}
        helperText="Customers see this on your provider profile."
        onPress={() =>
          promptPickProfilePhoto({
            hasPhoto: Boolean(me?.avatarUrl ?? profilePhotoUrl),
            screen: "ProviderEditInfo",
            onPicked: (photo) => {
              void (async () => {
                try {
                  const uploaded = await uploadAvatar.mutateAsync(photo);
                  if (uploaded.avatarUrl) setProfilePhotoUrl(uploaded.avatarUrl);
                  showToast("success", "Profile photo updated.");
                } catch (error: unknown) {
                  reportError(error, { screen: "ProviderEditInfo", action: "uploadAvatar" });
                  showToast("error", error instanceof Error ? error.message : "Failed to upload photo");
                }
              })();
            },
          })
        }
      />

      <Text className="text-ink text-sm font-medium mb-2 mt-2">First name</Text>
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

      <PhoneNumberField
        value={phone}
        onChange={setPhone}
        helperText="Required. Only you and admins can see this number — customers cannot."
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

      <Text className="text-xl font-bold text-ink mb-4">Provider details</Text>

      <ProviderServiceCategoriesField value={serviceCategories} onChange={setServiceCategories} />

      <Text className="text-ink text-sm font-medium mb-2">Experience (years)</Text>
      <TextInput
        className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-4"
        placeholder="e.g. 3"
        placeholderTextColor={appColors.ink.subtle}
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
        enableDeviceLocation
        inputPlaceholder="Shop/office address"
        mapDescription="Confirm these pins match your shop locations. Edit or replace an address anytime, then save."
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
          <Text className="text-ink font-semibold">Have your own tools</Text>
          <Text className="text-ink-muted text-sm">Set to off if customer needs to provide equipment.</Text>
        </View>
        <Switch value={hasTools} onValueChange={setHasTools} />
      </View>

      <TouchableOpacity
        className="bg-primary-600 rounded-2xl py-3.5 items-center"
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
    </ScrollView>
  );
}
