import { useEffect, useState } from "react";

import { ActivityIndicator, Alert, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth, useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMe, useSubmitCustomerOnboarding, useUpdateProfile, useUpdateSavedLocations } from "@repo/api-client";

import { textInputBaselineStyle } from "../../../styles/text-input";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
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
  const [carCompany, setCarCompany] = useState("");
  const [carModel, setCarModel] = useState("");
  const [notes, setNotes] = useState("");

  const signInEmail =
    clerkUser?.primaryEmailAddress?.emailAddress?.trim() ?? "";
  const accountEmail = signInEmail || me?.email || "";

  useEffect(() => {
    if (!me) return;
    // Email is shown from Clerk; names were only loaded from the API. The DB row is filled by the Clerk
    // webhook (`user.created` / `user.updated`). If webhooks missed localhost or ran with stale payload,
    // `me` can disagree with the signed-in Clerk user — prefer Clerk for name when present.
    const clerkFirst = clerkUser?.firstName?.trim() ?? "";
    const clerkLast = clerkUser?.lastName?.trim() ?? "";
    setFirstName(clerkFirst || me.firstName);
    setLastName(clerkLast || me.lastName);
    setPhone(me.phone ?? "");
    setSavedLocations(
      (me.savedLocations ?? []).map((location, index) => ({
        id: `existing-${index}`,
        label: location.label,
        address: location.address,
      }))
    );
    setPrimaryLocation(me.customerOnboarding?.primaryLocation ?? "");
    setCarCompany(me.customerOnboarding?.carCompany ?? "");
    setCarModel(me.customerOnboarding?.carModel ?? "");
    setNotes(me.customerOnboarding?.notes ?? "");
  }, [me, clerkUser?.firstName, clerkUser?.lastName]);

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

  async function handleSaveLocations() {
    const cleanLocations = savedLocations
      .map((location) => ({ label: location.label.trim(), address: location.address.trim() }))
      .filter((location) => location.label && location.address);
    try {
      await updateSavedLocations.mutateAsync(cleanLocations);
      Alert.alert("Saved", "Locations updated successfully.");
    } catch (error: unknown) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to save locations");
    }
  }

  async function handleSaveVehiclePreferences() {
    if (!primaryLocation.trim() || !carCompany.trim() || !carModel.trim()) {
      Alert.alert("Required", "Location, car company and model are required.");
      return;
    }
    try {
      await updateCustomerOnboarding.mutateAsync({
        primaryLocation: primaryLocation.trim(),
        carCompany: carCompany.trim(),
        carModel: carModel.trim(),
        notes: notes.trim() ? notes.trim() : undefined,
      });
      Alert.alert("Saved", "Vehicle preferences updated successfully.");
    } catch (error: unknown) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to save vehicle preferences");
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
          <Text className="text-3xl font-bold text-ink mb-1">Profile Management</Text>
          <Text className="text-ink-muted text-base">Manage your account and saved places.</Text>
        </View>

        <View className="bg-canvas-raised border border-ink-faint rounded-3xl p-4 mb-5">
          <View className="flex-row items-center gap-3 mb-4">
            <View className="w-11 h-11 rounded-2xl bg-primary-100 items-center justify-center">
              <Ionicons name="person-outline" size={22} />
            </View>
            <View>
              <Text className="text-ink text-lg font-semibold">{firstName || "Your"} {lastName || "Profile"}</Text>
              <Text className="text-ink-muted text-sm">Personal information</Text>
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

          <Text className="text-ink text-sm font-medium mb-2">Phone number</Text>
          <TextInput
            className="bg-canvas border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-4"
            keyboardType="phone-pad"
            style={textInputBaselineStyle}
            value={phone}
            onChangeText={setPhone}
          />

          <TouchableOpacity
            className="bg-primary-600 rounded-2xl py-3.5 items-center"
            onPress={handleSaveProfile}
            disabled={updateProfile.isPending}
            style={{ opacity: updateProfile.isPending ? 0.6 : 1 }}
          >
            {updateProfile.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Save Profile</Text>}
          </TouchableOpacity>
        </View>

        <View className="bg-canvas-raised border border-ink-faint rounded-3xl p-4 mb-5">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-2">
              <Ionicons name="location-outline" size={18} />
              <Text className="text-xl font-bold text-ink">Saved Locations</Text>
            </View>
            <TouchableOpacity onPress={addLocation} className="bg-primary-100 rounded-xl px-3 py-1.5">
              <Text className="text-primary-700 font-semibold text-sm">+ Add</Text>
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
                    placeholderTextColor="#A8A29E"
                    style={textInputBaselineStyle}
                    value={location.label}
                    onChangeText={(value) => updateLocation(index, "label", value)}
                  />
                  <TextInput
                    className="bg-canvas-raised border border-ink-faint rounded-xl px-3 py-2.5 text-ink text-sm mb-2.5"
                    placeholder="Full address"
                    placeholderTextColor="#A8A29E"
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
            {updateSavedLocations.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Save Locations</Text>}
          </TouchableOpacity>
        </View>

        <View className="bg-canvas-raised border border-ink-faint rounded-3xl p-4 mb-5">
          <View className="flex-row items-center gap-2 mb-4">
            <Ionicons name="car-sport-outline" size={18} />
            <Text className="text-xl font-bold text-ink">Vehicle Preferences</Text>
          </View>

          <Text className="text-ink text-sm font-medium mb-2">Primary location</Text>
          <TextInput
            className="bg-canvas border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-3"
            value={primaryLocation}
            onChangeText={setPrimaryLocation}
            placeholder="e.g. California, USA"
            placeholderTextColor="#A8A29E"
            style={textInputBaselineStyle}
          />

          <Text className="text-ink text-sm font-medium mb-2">Car company</Text>
          <TextInput
            className="bg-canvas border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-3"
            value={carCompany}
            onChangeText={setCarCompany}
            placeholder="e.g. Toyota"
            placeholderTextColor="#A8A29E"
            style={textInputBaselineStyle}
          />

          <Text className="text-ink text-sm font-medium mb-2">Model (number)</Text>
          <TextInput
            className="bg-canvas border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-3"
            value={carModel}
            onChangeText={(value) => setCarModel(value.replace(/[^0-9]/g, ""))}
            keyboardType="number-pad"
            placeholder="e.g. 2020"
            placeholderTextColor="#A8A29E"
            style={textInputBaselineStyle}
          />

          <Text className="text-ink text-sm font-medium mb-2">Notes (optional)</Text>
          <TextInput
            className="bg-canvas border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-4"
            value={notes}
            onChangeText={setNotes}
            placeholder="Parking / access notes"
            placeholderTextColor="#A8A29E"
            style={textInputBaselineStyle}
          />

          <TouchableOpacity
            className="bg-primary-600 rounded-2xl py-3.5 items-center"
            onPress={handleSaveVehiclePreferences}
            disabled={updateCustomerOnboarding.isPending}
            style={{ opacity: updateCustomerOnboarding.isPending ? 0.6 : 1 }}
          >
            {updateCustomerOnboarding.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold">Save Vehicle Preferences</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity className="border border-ink-faint rounded-2xl py-3.5 items-center bg-canvas-raised" onPress={() => signOut()}>
          <Text className="text-ink font-semibold">Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
