import { useCallback, useEffect, useState } from "react";

import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth, useClerk, useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import {
  apiClient,
  setAuthToken,
  useSubmitCustomerOnboarding,
  useUpdateAvatar,
  useUpdateProfile,
  userKeys,
} from "@repo/api-client";
import { showToast } from "@repo/ui";
import { fetchGoogleGeocodeLocation, reportError } from "@repo/utils";

import { LocationPreviewMap } from "../../components/LocationPreviewMap";
import { ProfilePhotoField } from "../../components/ProfilePhotoField";
import { appColors } from "../../styles/colors";
import { textInputBaselineStyle } from "../../styles/text-input";
import { requestDeviceLocation } from "../../utils/device-location";
import { promptPickProfilePhoto, type LocalProfilePhoto } from "../../utils/pick-profile-photo";
import { isValidRequiredPhone, sanitizePhoneInput } from "../../utils/phone";

const CAR_COMPANIES = [
  "Toyota",
  "Honda",
  "Suzuki",
  "KIA",
  "Hyundai",
  "Nissan",
  "Mitsubishi",
  "BMW",
  "Mercedes",
  "Audi",
  "Lexus",
  "Tesla",
  "MG",
  "Changan",
];

export default function CustomerOnboardingScreen() {
  const params = useLocalSearchParams<{ allowRoleChange?: string }>();
  const { getToken } = useAuth();
  const clerk = useClerk();
  const { user: clerkUser } = useUser();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const submitOnboarding = useSubmitCustomerOnboarding();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUpdateAvatar();
  const [phone, setPhone] = useState("");
  const [localPhoto, setLocalPhoto] = useState<LocalProfilePhoto | null>(null);
  const [primaryLocation, setPrimaryLocation] = useState("");
  const [carCompany, setCarCompany] = useState("");
  const [carModel, setCarModel] = useState("");
  const [notes, setNotes] = useState("");
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [previewLatitude, setPreviewLatitude] = useState<number | undefined>(undefined);
  const [previewLongitude, setPreviewLongitude] = useState<number | undefined>(undefined);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [locationDetecting, setLocationDetecting] = useState(false);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [locationFromDevice, setLocationFromDevice] = useState(false);
  // Covers the full handleContinue flow (set-role + session reload + onboarding + nav),
  // not just the mutation — the pre-mutation calls take most of the wall-clock time.
  const [isSubmitting, setIsSubmitting] = useState(false);
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const allowRoleChange = params.allowRoleChange === "1";

  const detectCurrentLocation = useCallback(async (opts?: { silent?: boolean }) => {
    setLocationDetecting(true);
    try {
      const result = await requestDeviceLocation({
        context: { screen: "CustomerOnboarding", action: "detectCurrentLocation" },
      });
      if (!result.ok) {
        setLocationPermissionDenied(result.reason === "denied");
        setLocationFromDevice(false);
        if (!opts?.silent) {
          showToast(
            "info",
            result.reason === "denied"
              ? "Location permission denied. Enter your address manually."
              : "Could not read your location. Enter your address manually."
          );
        }
        return;
      }
      setLocationPermissionDenied(false);
      setLocationFromDevice(true);
      setPrimaryLocation(result.data.addressLabel);
      setPreviewLatitude(result.data.coords.latitude);
      setPreviewLongitude(result.data.coords.longitude);
    } finally {
      setLocationDetecting(false);
    }
  }, []);

  useEffect(() => {
    void detectCurrentLocation({ silent: true });
  }, [detectCurrentLocation]);

  useEffect(() => {
    if (locationFromDevice) return;

    const query = primaryLocation.trim();
    if (!googleMapsApiKey || query.length < 3) {
      setPreviewLatitude(undefined);
      setPreviewLongitude(undefined);
      setPreviewLoading(false);
      return;
    }

    const timeout = setTimeout(() => {
      setPreviewLoading(true);
      void (async () => {
        const coords = await fetchGoogleGeocodeLocation(query, googleMapsApiKey);
        setPreviewLatitude(coords?.latitude);
        setPreviewLongitude(coords?.longitude);
        setPreviewLoading(false);
      })();
    }, 450);

    return () => clearTimeout(timeout);
  }, [primaryLocation, googleMapsApiKey, locationFromDevice]);

  async function handleContinue() {
    const trimmedPhone = sanitizePhoneInput(phone.trim());
    const firstName = clerkUser?.firstName?.trim() ?? "";
    const lastName = clerkUser?.lastName?.trim() ?? "";
    if (!isValidRequiredPhone(trimmedPhone)) {
      showToast("error", "Phone number is required", "Enter a valid phone number with at least 6 digits.");
      return;
    }
    if (!firstName || !lastName) {
      showToast("error", "Your account is missing a name. Sign out and complete sign-up again.");
      return;
    }
    if (!primaryLocation.trim() || !carCompany.trim() || !carModel.trim()) {
      showToast("error", "Please provide location, car company, and model.");
      return;
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const token = await getToken({ skipCache: true });
      if (!token) {
        throw new Error("Your session expired. Please sign in again.");
      }
      setAuthToken(token);
      await apiClient.post(
        "/api/v1/auth/set-role",
        { role: "CUSTOMER" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await clerk.session?.reload();
      const refreshedToken = await getToken({ skipCache: true });
      if (!refreshedToken) {
        throw new Error("Could not refresh your session. Please try again.");
      }
      setAuthToken(refreshedToken);

      await updateProfile.mutateAsync({
        firstName,
        lastName,
        phone: trimmedPhone,
      });
      if (localPhoto) {
        await uploadAvatar.mutateAsync({
          uri: localPhoto.uri,
          mimeType: localPhoto.mimeType,
          fileName: localPhoto.fileName,
        });
      }

      await submitOnboarding.mutateAsync({
        primaryLocation: primaryLocation.trim(),
        carCompany: carCompany.trim(),
        carModel: carModel.trim(),
        notes: notes.trim() ? notes.trim() : undefined,
      });
      await queryClient.refetchQueries({ queryKey: userKeys.me() });
      router.replace("/(customer)/(tabs)/home");
    } catch (error: unknown) {
      reportError(error, { screen: "CustomerOnboarding", action: "handleContinue" });
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
            <Ionicons name="chevron-back" size={18} color={appColors.ink.DEFAULT} />
            <Text className="text-ink font-medium">I am not a customer</Text>
          </TouchableOpacity>
        ) : null}

        <View className="bg-canvas-raised border border-ink-faint rounded-2xl p-4 mb-6">
          <View className="flex-row items-center gap-3">
            <View className="w-11 h-11 rounded-2xl bg-primary-50 border border-primary-100 items-center justify-center">
              <Ionicons name="car-sport-outline" size={22} color={appColors.primary[600]} />
            </View>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-ink">Tell us about your needs</Text>
              <Text className="text-ink-muted text-sm">This helps us personalize services for you.</Text>
            </View>
          </View>
        </View>

        <ProfilePhotoField
          uri={localPhoto?.uri}
          helperText="Optional. This photo appears on your profile."
          onPress={() =>
            promptPickProfilePhoto({
              hasPhoto: Boolean(localPhoto),
              screen: "CustomerOnboarding",
              allowRemove: true,
              onPicked: setLocalPhoto,
              onRemoved: () => setLocalPhoto(null),
            })
          }
        />

        <Text className="text-ink text-sm font-medium mb-2">Phone number</Text>
        <TextInput
          className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-1"
          keyboardType="phone-pad"
          placeholder="+1234567890"
          placeholderTextColor={appColors.ink.subtle}
          style={textInputBaselineStyle}
          value={phone}
          onChangeText={(value) => setPhone(sanitizePhoneInput(value))}
        />
        <Text className="text-ink-muted text-xs mb-5 leading-5">
          Required. Only you and admins can see this number — providers cannot.
        </Text>

        <Text className="text-ink text-sm font-medium mb-2">Primary location</Text>
        <Text className="text-ink-muted text-xs mb-2 leading-4">
          {locationDetecting
            ? "Detecting your current location…"
            : locationPermissionDenied
              ? "Location access was denied. Enter your address below, or allow location and try again."
              : locationFromDevice
                ? "Using your current location. Edit the address if needed."
                : "We'll use your GPS when allowed. Otherwise enter an address manually."}
        </Text>
        <TextInput
          className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-3"
          placeholder="Street, city, or area"
          placeholderTextColor={appColors.ink.subtle}
          style={textInputBaselineStyle}
          value={primaryLocation}
          onChangeText={(value) => {
            setLocationFromDevice(false);
            setPrimaryLocation(value);
          }}
          editable={!locationDetecting}
        />
        <TouchableOpacity
          className="flex-row items-center justify-center gap-2 py-3 rounded-2xl border border-primary-100 bg-primary-50 mb-4"
          onPress={() => void detectCurrentLocation()}
          disabled={locationDetecting}
          activeOpacity={0.85}
        >
          {locationDetecting ? (
            <ActivityIndicator size="small" color={appColors.primary[600]} />
          ) : (
            <Ionicons name="navigate-outline" size={18} color={appColors.primary[600]} />
          )}
          <Text className="text-primary-600 font-semibold text-sm">
            {locationDetecting ? "Detecting…" : "Use current location"}
          </Text>
        </TouchableOpacity>
        <LocationPreviewMap
          title="Location preview"
          description="Verify your service location is pinned correctly."
          latitude={previewLatitude}
          longitude={previewLongitude}
          isLoading={previewLoading || locationDetecting}
          emptyMessage={
            locationPermissionDenied
              ? "Enter an address above to preview it on the map."
              : googleMapsApiKey
                ? "Type at least 3 characters to preview your location."
                : "Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to preview your location on map."
          }
        />

        <Text className="text-ink text-sm font-medium mb-2">Car company</Text>
        <TouchableOpacity
          className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3.5 mb-4 flex-row items-center justify-between"
          onPress={() => setShowCompanyModal(true)}
          activeOpacity={0.85}
        >
          <Text className={carCompany ? "text-ink text-base" : "text-ink-subtle text-base"}>
            {carCompany || "Select company"}
          </Text>
          <Ionicons name="chevron-down" size={18} />
        </TouchableOpacity>

        <Text className="text-ink text-sm font-medium mb-2">Model</Text>
        <TextInput
          className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-4"
          placeholder="e.g. 2020"
          placeholderTextColor={appColors.ink.subtle}
          keyboardType="number-pad"
          style={textInputBaselineStyle}
          value={carModel}
          onChangeText={(value) => setCarModel(value.replace(/[^0-9]/g, ""))}
        />

        <Text className="text-ink text-sm font-medium mb-2">Additional notes (optional)</Text>
        <TextInput
          className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-8"
          placeholder="Any parking or access notes"
          placeholderTextColor={appColors.ink.subtle}
          multiline
          numberOfLines={3}
          style={textInputBaselineStyle}
          value={notes}
          onChangeText={setNotes}
        />

        <TouchableOpacity
          className="w-full bg-primary-600 rounded-2xl py-4 items-center flex-row justify-center gap-2"
          onPress={handleContinue}
          disabled={isSubmitting}
          style={{ opacity: isSubmitting ? 0.6 : 1 }}
        >
          {isSubmitting ? (
            <>
              <ActivityIndicator color={appColors.onPrimary} />
              <Text className="text-white font-semibold text-base">Setting up your account…</Text>
            </>
          ) : (
            <Text className="text-white font-semibold text-base">Continue</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showCompanyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCompanyModal(false)}
      >
        <Pressable className="flex-1 bg-black/30 justify-end" onPress={() => setShowCompanyModal(false)}>
          <Pressable className="bg-canvas rounded-t-3xl p-5 max-h-[70%]" onPress={() => undefined}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-ink text-lg font-semibold">Select car company</Text>
              <TouchableOpacity onPress={() => setShowCompanyModal(false)}>
                <Ionicons name="close" size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-2">
                {CAR_COMPANIES.map((company) => {
                  const selected = company === carCompany;
                  return (
                    <TouchableOpacity
                      key={company}
                      className={`rounded-2xl border px-4 py-3 flex-row items-center justify-between ${
                        selected ? "border-primary-600 bg-primary-50" : "border-ink-faint bg-canvas-raised"
                      }`}
                      onPress={() => {
                        setCarCompany(company);
                        setShowCompanyModal(false);
                      }}
                    >
                      <Text className={selected ? "text-primary-600 font-semibold" : "text-ink"}>{company}</Text>
                      {selected ? <Ionicons name="checkmark-circle" size={18} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
