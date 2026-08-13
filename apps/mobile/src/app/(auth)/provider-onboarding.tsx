import { useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StatusBar,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth, useClerk } from "@clerk/expo";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import {
  apiClient,
  getApiBaseUrl,
  setAuthToken,
  useSubmitProviderOnboarding,
  useUpdateAvatar,
  userKeys,
} from "@repo/api-client";
import { showToast } from "@repo/ui";
import { enrichShopLocationsWithCoordinates, reportError } from "@repo/utils";

import { ProviderServiceCategoriesField } from "../../components/ProviderServiceCategoriesField";
import { ShopAddressField } from "../../components/ShopAddressField";
import { appColors } from "../../styles/colors";
import { textInputBaselineStyle } from "../../styles/text-input";

type LocalPhoto = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
};

export default function ProviderOnboardingScreen() {
  const params = useLocalSearchParams<{ allowRoleChange?: string }>();
  const { getToken } = useAuth();
  const clerk = useClerk();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const submitOnboarding = useSubmitProviderOnboarding();
  const uploadAvatar = useUpdateAvatar();
  const [serviceCategories, setServiceCategories] = useState<string[]>([]);
  const [experienceYears, setExperienceYears] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [shopPlaceId, setShopPlaceId] = useState<string | undefined>(undefined);
  const [shopLocations, setShopLocations] = useState<
    Array<{ address: string; placeId?: string; latitude?: number; longitude?: number }>
  >([]);
  const [hasTools, setHasTools] = useState(true);
  const [serviceDescription, setServiceDescription] = useState("");
  const [localPhoto, setLocalPhoto] = useState<LocalPhoto | null>(null);
  // Covers the full handleContinue flow (set-role + session reload + geocode + upload + onboarding + nav),
  // not just the mutation — the pre-mutation calls take most of the wall-clock time.
  const [isSubmitting, setIsSubmitting] = useState(false);
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const allowRoleChange = params.allowRoleChange === "1";

  async function pickProfilePhoto(source: "library" | "camera") {
    try {
      if (source === "library") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          showToast("error", "Photo access needed", "Allow photo library access to upload your profile picture.");
          return;
        }
      } else {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          showToast("error", "Camera access needed", "Allow camera access to take your profile picture.");
          return;
        }
      }

      const result =
        source === "library"
          ? await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.85,
            })
          : await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.85,
            });

      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      setLocalPhoto({
        uri: asset.uri,
        mimeType: asset.mimeType ?? "image/jpeg",
        fileName: asset.fileName ?? `provider-avatar-${Date.now()}.jpg`,
      });
    } catch (error: unknown) {
      reportError(error, { screen: "ProviderOnboarding", action: "pickProfilePhoto", extra: { source } });
      showToast("error", "Could not open photos", "Please try again.");
    }
  }

  function promptPickProfilePhoto() {
    Alert.alert("Profile photo", "Add a photo customers will see on your profile.", [
      { text: "Choose from library", onPress: () => void pickProfilePhoto("library") },
      { text: "Take photo", onPress: () => void pickProfilePhoto("camera") },
      ...(localPhoto
        ? [{ text: "Remove photo", style: "destructive" as const, onPress: () => setLocalPhoto(null) }]
        : []),
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function handleContinue() {
    const parsedExperience = Number.parseInt(experienceYears, 10);
    const pendingAddress = shopAddress.trim();
    const normalizedLocations =
      pendingAddress.length > 0 &&
      !shopLocations.some((location) => location.address.toLowerCase() === pendingAddress.toLowerCase())
        ? [...shopLocations, { address: pendingAddress, placeId: shopPlaceId }]
        : shopLocations;
    if (!localPhoto) {
      showToast("error", "Add a profile photo", "Customers need a photo to recognize your profile.");
      return;
    }
    if (
      serviceCategories.length === 0 ||
      !serviceArea.trim() ||
      normalizedLocations.length === 0 ||
      !serviceDescription.trim()
    ) {
      showToast("error", "Pick categories, add at least one shop location, and complete service details.");
      return;
    }
    if (Number.isNaN(parsedExperience) || parsedExperience < 0) {
      showToast("error", "Please enter valid years of experience.");
      return;
    }
    if (isSubmitting) return;

    const formatStepError = (step: string, error: unknown): string => {
      if (isAxiosError(error)) {
        const base = getApiBaseUrl() || "(no API URL)";
        if (!error.response) {
          return `${step} failed: network error talking to ${base}. Keep USB plugged in and retry.`;
        }
        const serverMessage =
          typeof error.response.data === "object" &&
          error.response.data != null &&
          "message" in error.response.data
            ? String((error.response.data as { message?: unknown }).message ?? error.message)
            : error.message;
        return `${step} failed (${error.response.status}): ${serverMessage}`;
      }
      return error instanceof Error ? error.message : `${step} failed`;
    };

    setIsSubmitting(true);
    try {
      const token = await getToken({ skipCache: true });
      if (!token) {
        throw new Error("Your session expired. Please sign in again.");
      }
      setAuthToken(token);
      try {
        await apiClient.post(
          "/api/v1/auth/set-role",
          { role: "PROVIDER" },
          { headers: { Authorization: `Bearer ${token}` }, timeout: 30_000 }
        );
      } catch (error: unknown) {
        throw new Error(formatStepError("Set role", error));
      }
      await clerk.session?.reload();
      const refreshedToken = await getToken({ skipCache: true });
      if (!refreshedToken) {
        throw new Error("Could not refresh your session. Please try again.");
      }
      setAuthToken(refreshedToken);

      let locationsToSave = normalizedLocations;
      if (googleMapsApiKey) {
        locationsToSave = await enrichShopLocationsWithCoordinates(normalizedLocations, googleMapsApiKey);
        const anyMissing = locationsToSave.some(
          (location) => typeof location.latitude !== "number" || typeof location.longitude !== "number"
        );
        if (anyMissing) {
          reportError(new Error("Provider onboarding: shop coordinates missing after enrichment"), {
            screen: "ProviderOnboarding",
            action: "handleContinue",
          });
          showToast(
            "error",
            "Could not pin your shop on the map. Pick an address from the suggestions, or enable Places + Geocoding for your Google API key."
          );
          setIsSubmitting(false);
          return;
        }
      }

      let uploaded;
      try {
        uploaded = await uploadAvatar.mutateAsync({
          uri: localPhoto.uri,
          mimeType: localPhoto.mimeType,
          fileName: localPhoto.fileName,
        });
      } catch (error: unknown) {
        throw new Error(formatStepError("Photo upload", error));
      }
      const profilePhotoUrl = uploaded.avatarUrl;
      if (!profilePhotoUrl) {
        throw new Error("Photo upload succeeded but no image URL was returned.");
      }

      try {
        await submitOnboarding.mutateAsync({
          serviceCategories,
          experienceYears: parsedExperience,
          serviceArea: serviceArea.trim(),
          shopAddress: locationsToSave[0]?.address ?? pendingAddress,
          shopPlaceId: locationsToSave[0]?.placeId ?? shopPlaceId,
          shopLocations: locationsToSave,
          hasTools,
          serviceDescription: serviceDescription.trim(),
          profilePhotoUrl,
        });
      } catch (error: unknown) {
        throw new Error(formatStepError("Save profile", error));
      }
      await queryClient.refetchQueries({ queryKey: userKeys.me() });
      router.replace("/(provider)/(tabs)/services");
    } catch (error: unknown) {
      reportError(error, { screen: "ProviderOnboarding", action: "handleContinue" });
      showToast("error", error instanceof Error ? error.message : "Failed to save onboarding");
      setIsSubmitting(false);
    }
  }

  function handleChangeRole() {
    router.replace("/(auth)/role-select?allowRoleChange=1");
  }

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingTop: 14, paddingBottom: Math.max(insets.bottom + 24, 40) }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {allowRoleChange ? (
          <TouchableOpacity
            className="self-start flex-row items-center gap-2 mb-4"
            onPress={handleChangeRole}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={18} color={appColors.primary[600]} />
            <Text className="text-primary-600 font-medium">I am not a provider</Text>
          </TouchableOpacity>
        ) : null}

        <View className="bg-canvas-raised border border-ink-faint rounded-2xl p-4 mb-6">
          <View className="flex-row items-center gap-3">
            <View className="w-11 h-11 rounded-2xl bg-primary-50 border border-primary-100 items-center justify-center">
              <Ionicons name="briefcase-outline" size={22} color={appColors.primary[600]} />
            </View>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-ink">Set up your provider profile</Text>
              <Text className="text-ink-muted text-sm">Tell customers what you can offer.</Text>
            </View>
          </View>
        </View>

        <View className="bg-canvas-raised border border-ink-faint rounded-2xl p-4 mb-5 items-center">
          <Text className="text-ink text-sm font-medium mb-3 self-start">Profile photo</Text>
          <TouchableOpacity
            onPress={promptPickProfilePhoto}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Add profile photo"
            className="w-28 h-28 rounded-2xl bg-canvas-sunken border border-ink-faint items-center justify-center overflow-hidden mb-3"
          >
            {localPhoto ? (
              <Image source={{ uri: localPhoto.uri }} className="w-full h-full" />
            ) : (
              <View className="items-center">
                <Ionicons name="camera-outline" size={28} color={appColors.primary[600]} />
                <Text className="text-primary-600 text-xs font-semibold mt-1">Add photo</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={promptPickProfilePhoto}
            className="bg-primary-50 border border-primary-100 rounded-2xl px-4 py-2.5"
            activeOpacity={0.85}
          >
            <Text className="text-primary-600 font-semibold text-sm">
              {localPhoto ? "Change photo" : "Upload profile photo"}
            </Text>
          </TouchableOpacity>
          <Text className="text-ink-muted text-xs text-center mt-3 leading-5">
            Required. Customers see this on your provider profile.
          </Text>
        </View>

        <View className="bg-canvas-raised border border-ink-faint rounded-2xl p-4 mb-5">
          <ProviderServiceCategoriesField value={serviceCategories} onChange={setServiceCategories} />

          <Text className="text-ink text-sm font-medium mb-2">Experience (years)</Text>
          <TextInput
            className="bg-canvas border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-3"
            placeholder="e.g. 3"
            placeholderTextColor={appColors.ink.subtle}
            keyboardType="number-pad"
            style={textInputBaselineStyle}
            value={experienceYears}
            onChangeText={setExperienceYears}
          />

          <Text className="text-ink text-sm font-medium mb-2">Service area</Text>
          <TextInput
            className="bg-canvas border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-3"
            placeholder="e.g. New York, Washington"
            placeholderTextColor={appColors.ink.subtle}
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
            autoDetectOnMount
            inputPlaceholder="Search your shop address"
            mapDescription="Confirm this pin matches your shop location. You can edit the address anytime before saving."
            mapEmptyMessage={
              googleMapsApiKey
                ? "Search a shop address to preview it on map."
                : "Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to preview your shop on map."
            }
          />

          <Text className="text-ink text-sm font-medium mb-2">Service description</Text>
          <TextInput
            className="bg-canvas border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-3"
            placeholder="Describe the services you offer"
            placeholderTextColor={appColors.ink.subtle}
            value={serviceDescription}
            onChangeText={setServiceDescription}
            multiline
            textAlignVertical="top"
            numberOfLines={4}
            style={[textInputBaselineStyle, { minHeight: 110 }]}
          />

          <Text className="text-ink-muted text-xs leading-5 mt-1">
            We&apos;ll create a draft listing for each category. Open <Text className="font-semibold text-ink-soft">My
            services</Text> to set price and duration before customers can book.
          </Text>
        </View>

        <View className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-4 mb-8 flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-ink font-semibold">I have my own tools</Text>
            <Text className="text-ink-muted text-sm">Turn off if customer must provide equipment.</Text>
          </View>
          <Switch value={hasTools} onValueChange={setHasTools} />
        </View>

        <TouchableOpacity
          className="w-full bg-primary-600 rounded-2xl py-4 items-center flex-row justify-center gap-2"
          onPress={() => void handleContinue()}
          disabled={isSubmitting}
          style={{ opacity: isSubmitting ? 0.6 : 1 }}
        >
          {isSubmitting ? (
            <>
              <ActivityIndicator color={appColors.onPrimary} />
              <Text className="text-white font-semibold text-base">Setting up your profile…</Text>
            </>
          ) : (
            <Text className="text-white font-semibold text-base">Continue</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
