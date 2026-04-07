import { useEffect, useState } from "react";

import { ActivityIndicator, Alert, Image, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth, useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useMe, useSubmitProviderOnboarding, useUpdateProfile } from "@repo/api-client";

import { ProviderServiceCategoriesField } from "../../../components/ProviderServiceCategoriesField";
import { appColors } from "../../../styles/colors";
import { textInputBaselineStyle } from "../../../styles/text-input";
import { normalizeProviderServiceCategories } from "../../../utils/provider-onboarding";

export default function ProviderProfileScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, signOut } = useAuth();
  const { user: clerkUser } = useUser();
  const { data: me } = useMe({ enabled: isLoaded && isSignedIn });
  const updateProfile = useUpdateProfile();
  const updateProviderOnboarding = useSubmitProviderOnboarding();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceCategories, setServiceCategories] = useState<string[]>([]);
  const [experienceYears, setExperienceYears] = useState("0");
  const [serviceArea, setServiceArea] = useState("");
  const [hasTools, setHasTools] = useState(true);
  const [serviceDescription, setServiceDescription] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");

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
    setHasTools(me.providerOnboarding?.hasTools ?? true);
    setServiceDescription(me.providerOnboarding?.serviceDescription ?? "");
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
    if (serviceCategories.length === 0 || !serviceArea.trim() || !serviceDescription.trim() || Number.isNaN(parsedExperience)) {
      Alert.alert("Required", "Add at least one service category and complete provider details.");
      return;
    }
    try {
      await updateProviderOnboarding.mutateAsync({
        serviceCategories,
        experienceYears: parsedExperience,
        serviceArea: serviceArea.trim(),
        hasTools,
        serviceDescription: serviceDescription.trim(),
        profilePhotoUrl: profilePhotoUrl.trim() ? profilePhotoUrl.trim() : undefined,
      });
      Alert.alert("Saved", "Provider details updated successfully.");
    } catch (error: unknown) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to save provider details");
    }
  }

  return (
    <ScrollView className="flex-1 bg-canvas px-5 pt-6" contentContainerStyle={{ paddingBottom: 28 }}>
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

      <ProviderServiceCategoriesField value={serviceCategories} onChange={setServiceCategories} />
      <View className="h-2" />

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

      <Text className="text-ink text-sm font-medium mb-2">Service description</Text>
      <TextInput
        className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-4"
        style={textInputBaselineStyle}
        value={serviceDescription}
        onChangeText={setServiceDescription}
        multiline
        numberOfLines={3}
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
