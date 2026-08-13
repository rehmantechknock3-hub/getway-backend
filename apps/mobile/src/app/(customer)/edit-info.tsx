import { useCallback, useEffect, useState } from "react";

import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMe, useSubmitCustomerOnboarding, useUpdateProfile, useUpdateSavedLocations } from "@repo/api-client";
import { showToast } from "@repo/ui";
import { fetchGoogleGeocodeLocation, reportError } from "@repo/utils";

import { LocationPreviewMap } from "../../components/LocationPreviewMap";
import { appColors } from "../../styles/colors";
import { textInputBaselineStyle } from "../../styles/text-input";
import { requestDeviceLocation } from "../../utils/device-location";
import { countPhoneDigits, sanitizePhoneInput } from "../../utils/phone";

export default function CustomerEditInfoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const { data: me, isLoading } = useMe();
  const updateProfile = useUpdateProfile();
  const updateSavedLocations = useUpdateSavedLocations();
  const updateCustomerOnboarding = useSubmitCustomerOnboarding();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [savedLocations, setSavedLocations] = useState<Array<{ id: string; label: string; address: string }>>([]);
  const [primaryLocation, setPrimaryLocation] = useState("");
  const [primaryPreviewLatitude, setPrimaryPreviewLatitude] = useState<number | undefined>(undefined);
  const [primaryPreviewLongitude, setPrimaryPreviewLongitude] = useState<number | undefined>(undefined);
  const [primaryPreviewLoading, setPrimaryPreviewLoading] = useState(false);
  const [locationDetecting, setLocationDetecting] = useState(false);
  const [locationFromDevice, setLocationFromDevice] = useState(false);
  const [carCompany, setCarCompany] = useState("");
  const [carModel, setCarModel] = useState("");
  const [notes, setNotes] = useState("");
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  const signInEmail = clerkUser?.primaryEmailAddress?.emailAddress?.trim() ?? "";
  const accountEmail = signInEmail || me?.email || "";

  const detectCurrentLocation = useCallback(async () => {
    setLocationDetecting(true);
    try {
      const result = await requestDeviceLocation({
        context: { screen: "CustomerEditInfo", action: "detectCurrentLocation" },
      });
      if (!result.ok) {
        setLocationFromDevice(false);
        showToast(
          "info",
          result.reason === "denied"
            ? "Location permission denied. Enter your address manually."
            : "Could not read your location. Enter your address manually."
        );
        return;
      }
      setLocationFromDevice(true);
      setPrimaryLocation(result.data.addressLabel);
      setPrimaryPreviewLatitude(result.data.coords.latitude);
      setPrimaryPreviewLongitude(result.data.coords.longitude);
    } finally {
      setLocationDetecting(false);
    }
  }, []);

  useEffect(() => {
    if (!me) return;
    const clerkFirst = clerkUser?.firstName?.trim() ?? "";
    const clerkLast = clerkUser?.lastName?.trim() ?? "";
    setFirstName(me.firstName || clerkFirst);
    setLastName(me.lastName || clerkLast);
    setPhone(sanitizePhoneInput(me.phone ?? ""));
    setSavedLocations(
      (me.savedLocations ?? []).map((location, index) => ({
        id: `existing-${index}`,
        label: location.label,
        address: location.address,
      }))
    );
    setPrimaryLocation(me.customerOnboarding?.primaryLocation ?? "");
    setLocationFromDevice(false);
    setCarCompany(me.customerOnboarding?.carCompany ?? "");
    setCarModel(me.customerOnboarding?.carModel ?? "");
    setNotes(me.customerOnboarding?.notes ?? "");
  }, [me, clerkUser?.firstName, clerkUser?.lastName]);

  useEffect(() => {
    if (locationFromDevice) return;

    const query = primaryLocation.trim();
    if (!googleMapsApiKey || query.length < 3) {
      setPrimaryPreviewLatitude(undefined);
      setPrimaryPreviewLongitude(undefined);
      setPrimaryPreviewLoading(false);
      return;
    }

    const timeout = setTimeout(() => {
      setPrimaryPreviewLoading(true);
      void (async () => {
        const coords = await fetchGoogleGeocodeLocation(query, googleMapsApiKey);
        setPrimaryPreviewLatitude(coords?.latitude);
        setPrimaryPreviewLongitude(coords?.longitude);
        setPrimaryPreviewLoading(false);
      })();
    }, 450);

    return () => clearTimeout(timeout);
  }, [primaryLocation, googleMapsApiKey, locationFromDevice]);

  function updateLocation(index: number, key: "label" | "address", value: string) {
    setSavedLocations((prev) =>
      prev.map((location, i) => (i === index ? { ...location, [key]: value } : location))
    );
  }

  function addLocation() {
    setSavedLocations((prev) => [...prev, { id: `new-${Date.now()}-${prev.length}`, label: "", address: "" }]);
  }

  function removeLocation(index: number) {
    setSavedLocations((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveProfile() {
    if (!firstName.trim() || !lastName.trim()) {
      showToast("error", "First and last name are required.");
      return;
    }
    const trimmedPhone = sanitizePhoneInput(phone.trim());
    if (trimmedPhone.length > 0 && countPhoneDigits(trimmedPhone) < 6) {
      showToast("error", "Phone number must include at least 6 digits.");
      return;
    }
    try {
      await updateProfile.mutateAsync({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: trimmedPhone.length > 0 ? trimmedPhone : undefined,
      });
      showToast("success", "Profile updated successfully.");
      router.back();
    } catch (error: unknown) {
      reportError(error, { screen: "CustomerEditInfo", action: "handleSaveProfile" });
      showToast("error", error instanceof Error ? error.message : "Failed to save profile");
    }
  }

  async function handleSaveLocations() {
    const cleanLocations = savedLocations
      .map((location) => ({ label: location.label.trim(), address: location.address.trim() }))
      .filter((location) => location.label && location.address);
    try {
      await updateSavedLocations.mutateAsync(cleanLocations);
      showToast("success", "Locations updated successfully.");
    } catch (error: unknown) {
      reportError(error, { screen: "CustomerEditInfo", action: "handleSaveLocations" });
      showToast("error", error instanceof Error ? error.message : "Failed to save locations");
    }
  }

  async function handleSaveVehiclePreferences() {
    if (!primaryLocation.trim() || !carCompany.trim() || !carModel.trim()) {
      showToast("error", "Location, car company and model are required.");
      return;
    }
    try {
      await updateCustomerOnboarding.mutateAsync({
        primaryLocation: primaryLocation.trim(),
        carCompany: carCompany.trim(),
        carModel: carModel.trim(),
        notes: notes.trim() ? notes.trim() : undefined,
      });
      showToast("success", "Vehicle preferences updated successfully.");
      router.back();
    } catch (error: unknown) {
      reportError(error, { screen: "CustomerEditInfo", action: "handleSaveVehiclePreferences" });
      showToast("error", error instanceof Error ? error.message : "Failed to save vehicle preferences");
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
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="bg-canvas-raised border border-ink-faint rounded-2xl p-4 mb-5 mt-2">
        <View className="flex-row items-center gap-3 mb-4">
          <View className="w-11 h-11 rounded-2xl bg-primary-50 items-center justify-center border border-primary-100">
            <Ionicons name="person-outline" size={22} color={appColors.primary[600]} />
          </View>
          <View>
            <Text className="text-ink text-lg font-semibold">Personal information</Text>
            <Text className="text-ink-muted text-sm">Update your account details</Text>
          </View>
        </View>

        <Text className="text-ink text-sm font-medium mb-2">First name</Text>
        <TextInput
          className="bg-canvas border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-3"
          style={textInputBaselineStyle}
          value={firstName}
          onChangeText={setFirstName}
        />

        <Text className="text-ink text-sm font-medium mb-2">Last name</Text>
        <TextInput
          className="bg-canvas border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-3"
          style={textInputBaselineStyle}
          value={lastName}
          onChangeText={setLastName}
        />

        <Text className="text-ink text-sm font-medium mb-2">Email</Text>
        <View className="bg-canvas border border-ink-faint rounded-2xl px-4 py-3.5 mb-1">
          <Text className="text-ink text-base">{accountEmail || "—"}</Text>
        </View>
        <Text className="text-ink-muted text-xs mb-3">
          Same as your sign-in email. Update it in your account settings if needed.
        </Text>

        <Text className="text-ink text-sm font-medium mb-2">Phone number (optional)</Text>
        <TextInput
          className="bg-canvas border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-4"
          keyboardType="phone-pad"
          style={textInputBaselineStyle}
          value={phone}
          onChangeText={(value) => setPhone(sanitizePhoneInput(value))}
        />

        <TouchableOpacity
          className="bg-primary-600 rounded-2xl py-3.5 items-center"
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
      </View>

      <View className="bg-canvas-raised border border-ink-faint rounded-2xl p-4 mb-5">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-2">
            <Ionicons name="location-outline" size={18} color={appColors.primary[600]} />
            <Text className="text-lg font-bold text-ink">Saved Locations</Text>
          </View>
          <TouchableOpacity onPress={addLocation} className="bg-primary-50 border border-primary-100 rounded-2xl px-3 py-1.5">
            <Text className="text-primary-600 font-semibold text-sm">+ Add</Text>
          </TouchableOpacity>
        </View>

        {savedLocations.length === 0 ? (
          <View className="border border-dashed border-ink-faint rounded-2xl p-4">
            <Text className="text-ink-muted text-sm">No saved locations yet. Add Home or Office to speed up bookings.</Text>
          </View>
        ) : (
          <View className="gap-3">
            {savedLocations.map((location, index) => (
              <View key={`${location.id}-${index}`} className="bg-canvas border border-ink-faint rounded-2xl p-3.5">
                <TextInput
                  className="bg-canvas-raised border border-ink-faint rounded-xl px-3 py-2.5 text-ink text-sm mb-2"
                  placeholder="Label (Home, Office)"
                  placeholderTextColor={appColors.ink.subtle}
                  style={textInputBaselineStyle}
                  value={location.label}
                  onChangeText={(value) => updateLocation(index, "label", value)}
                />
                <TextInput
                  className="bg-canvas-raised border border-ink-faint rounded-xl px-3 py-2.5 text-ink text-sm mb-2.5"
                  placeholder="Full address"
                  placeholderTextColor={appColors.ink.subtle}
                  style={textInputBaselineStyle}
                  value={location.address}
                  onChangeText={(value) => updateLocation(index, "address", value)}
                />
                <TouchableOpacity onPress={() => removeLocation(index)} className="self-start">
                  <Text className="text-destructive font-medium">Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          className="bg-primary-600 rounded-2xl py-3.5 items-center mt-4"
          onPress={handleSaveLocations}
          disabled={updateSavedLocations.isPending}
          style={{ opacity: updateSavedLocations.isPending ? 0.6 : 1 }}
        >
          {updateSavedLocations.isPending ? (
            <ActivityIndicator color={appColors.onPrimary} />
          ) : (
            <Text className="text-white font-semibold">Save Locations</Text>
          )}
        </TouchableOpacity>
      </View>

      <View className="bg-canvas-raised border border-ink-faint rounded-2xl p-4 mb-5">
        <View className="flex-row items-center gap-2 mb-4">
          <Ionicons name="car-sport-outline" size={18} color={appColors.primary[600]} />
          <Text className="text-lg font-bold text-ink">Vehicle Preferences</Text>
        </View>

        <Text className="text-ink text-sm font-medium mb-2">Primary location</Text>
        <TextInput
          className="bg-canvas border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-3"
          value={primaryLocation}
          onChangeText={(value) => {
            setLocationFromDevice(false);
            setPrimaryLocation(value);
          }}
          placeholder="Street, city, or area"
          placeholderTextColor={appColors.ink.subtle}
          style={textInputBaselineStyle}
          editable={!locationDetecting}
        />
        <TouchableOpacity
          className="flex-row items-center justify-center gap-2 py-3 rounded-2xl border border-primary-100 bg-primary-50 mb-3"
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
          description="Verify your primary location pin is correct."
          latitude={primaryPreviewLatitude}
          longitude={primaryPreviewLongitude}
          isLoading={primaryPreviewLoading || locationDetecting}
          emptyMessage={
            googleMapsApiKey
              ? "Type at least 3 characters to preview your location."
              : "Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to preview location on map."
          }
        />

        <Text className="text-ink text-sm font-medium mb-2 mt-3">Car company</Text>
        <TextInput
          className="bg-canvas border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-3"
          value={carCompany}
          onChangeText={setCarCompany}
          placeholder="e.g. Toyota"
          placeholderTextColor={appColors.ink.subtle}
          style={textInputBaselineStyle}
        />

        <Text className="text-ink text-sm font-medium mb-2">Model (number)</Text>
        <TextInput
          className="bg-canvas border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-3"
          value={carModel}
          onChangeText={(value) => setCarModel(value.replace(/[^0-9]/g, ""))}
          keyboardType="number-pad"
          placeholder="e.g. 2020"
          placeholderTextColor={appColors.ink.subtle}
          style={textInputBaselineStyle}
        />

        <Text className="text-ink text-sm font-medium mb-2">Notes (optional)</Text>
        <TextInput
          className="bg-canvas border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-4"
          value={notes}
          onChangeText={setNotes}
          placeholder="Parking / access notes"
          placeholderTextColor={appColors.ink.subtle}
          style={textInputBaselineStyle}
        />

        <TouchableOpacity
          className="bg-primary-600 rounded-2xl py-3.5 items-center"
          onPress={handleSaveVehiclePreferences}
          disabled={updateCustomerOnboarding.isPending}
          style={{ opacity: updateCustomerOnboarding.isPending ? 0.6 : 1 }}
        >
          {updateCustomerOnboarding.isPending ? (
            <ActivityIndicator color={appColors.onPrimary} />
          ) : (
            <Text className="text-white font-semibold">Save Vehicle Preferences</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
