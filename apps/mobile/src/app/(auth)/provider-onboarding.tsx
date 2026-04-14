import { useState } from "react";

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";

import { useSubmitProviderOnboarding, userKeys } from "@repo/api-client";
import { showToast } from "@repo/ui";
import { enrichShopLocationsWithCoordinates, reportError } from "@repo/utils";

import { ProviderServiceCategoriesField } from "../../components/ProviderServiceCategoriesField";
import { ShopAddressField } from "../../components/ShopAddressField";
import { appColors } from "../../styles/colors";
import { textInputBaselineStyle } from "../../styles/text-input";

export default function ProviderOnboardingScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const submitOnboarding = useSubmitProviderOnboarding();
  const [serviceCategories, setServiceCategories] = useState<string[]>([]);
  const [experienceYears, setExperienceYears] = useState("0");
  const [serviceArea, setServiceArea] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [shopPlaceId, setShopPlaceId] = useState<string | undefined>(undefined);
  const [shopLocations, setShopLocations] = useState<
    Array<{ address: string; placeId?: string; latitude?: number; longitude?: number }>
  >([]);
  const [hasTools, setHasTools] = useState(true);
  const [serviceDescription, setServiceDescription] = useState("");
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  async function handleContinue() {
    const parsedExperience = Number.parseInt(experienceYears, 10);
    const pendingAddress = shopAddress.trim();
    const normalizedLocations =
      pendingAddress.length > 0 &&
      !shopLocations.some((location) => location.address.toLowerCase() === pendingAddress.toLowerCase())
        ? [...shopLocations, { address: pendingAddress, placeId: shopPlaceId }]
        : shopLocations;
    if (
      serviceCategories.length === 0 ||
      !serviceArea.trim() ||
      normalizedLocations.length === 0 ||
      !serviceDescription.trim()
    ) {
      Alert.alert(
        "Required",
        "Pick categories, add at least one shop location, and complete service details."
      );
      return;
    }
    if (Number.isNaN(parsedExperience) || parsedExperience < 0) {
      Alert.alert("Required", "Please enter valid years of experience.");
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
          reportError(new Error("Provider onboarding: shop coordinates missing after enrichment"), {
            screen: "ProviderOnboarding",
            action: "handleContinue",
          });
          showToast(
            "error",
            "Could not pin your shop on the map. Pick an address from the suggestions, or enable Places + Geocoding for your Google API key."
          );
          return;
        }
      }

      await submitOnboarding.mutateAsync({
        serviceCategories,
        experienceYears: parsedExperience,
        serviceArea: serviceArea.trim(),
        shopAddress: locationsToSave[0]?.address ?? pendingAddress,
        shopPlaceId: locationsToSave[0]?.placeId ?? shopPlaceId,
        shopLocations: locationsToSave,
        hasTools,
        serviceDescription: serviceDescription.trim(),
      });
      await queryClient.refetchQueries({ queryKey: userKeys.me() });
      router.replace("/(provider)/(tabs)/services");
    } catch (error: unknown) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to save onboarding");
    }
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
        <View className="bg-canvas-raised border border-ink-faint rounded-3xl p-4 mb-6">
          <View className="flex-row items-center gap-3">
            <View className="w-11 h-11 rounded-2xl bg-primary-100 items-center justify-center">
              <Ionicons name="briefcase-outline" size={22} color={appColors.ink.DEFAULT} />
            </View>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-ink">Set up your provider profile</Text>
              <Text className="text-ink-muted text-sm">Tell customers what you can offer.</Text>
            </View>
          </View>
        </View>

        <View className="bg-canvas-raised border border-ink-faint rounded-3xl p-4 mb-5">
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
            placeholder="e.g. DHA, Gulberg"
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
            inputPlaceholder="Search your shop address"
            mapDescription="Confirm this pin matches your shop location."
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

        <View className="bg-canvas-raised border border-ink-faint rounded-3xl px-4 py-4 mb-8 flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-ink font-semibold">I have my own tools</Text>
            <Text className="text-ink-muted text-sm">Turn off if customer must provide equipment.</Text>
          </View>
          <Switch value={hasTools} onValueChange={setHasTools} />
        </View>

        <TouchableOpacity
          className="w-full bg-primary-600 rounded-2xl py-4 items-center"
          onPress={() => void handleContinue()}
          disabled={submitOnboarding.isPending}
          style={{ opacity: submitOnboarding.isPending ? 0.6 : 1 }}
        >
          {submitOnboarding.isPending ? (
            <ActivityIndicator color={appColors.onPrimary} />
          ) : (
            <Text className="text-white font-semibold text-base">Continue</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
