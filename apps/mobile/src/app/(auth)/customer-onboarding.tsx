import { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth, useClerk } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { apiClient, useSubmitCustomerOnboarding, userKeys } from "@repo/api-client";
import { fetchGoogleGeocodeLocation } from "@repo/utils";

import { LocationPreviewMap } from "../../components/LocationPreviewMap";
import { appColors } from "../../styles/colors";
import { textInputBaselineStyle } from "../../styles/text-input";

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
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const submitOnboarding = useSubmitCustomerOnboarding();
  const [primaryLocation, setPrimaryLocation] = useState("");
  const [carCompany, setCarCompany] = useState("");
  const [carModel, setCarModel] = useState("");
  const [notes, setNotes] = useState("");
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [previewLatitude, setPreviewLatitude] = useState<number | undefined>(undefined);
  const [previewLongitude, setPreviewLongitude] = useState<number | undefined>(undefined);
  const [previewLoading, setPreviewLoading] = useState(false);
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const allowRoleChange = params.allowRoleChange === "1";

  useEffect(() => {
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
  }, [primaryLocation, googleMapsApiKey]);

  async function handleContinue() {
    if (!primaryLocation.trim() || !carCompany.trim() || !carModel.trim()) {
      Alert.alert("Required", "Please provide location, car company, and model.");
      return;
    }

    try {
      const token = await getToken();
      await apiClient.post(
        "/api/v1/auth/set-role",
        { role: "CUSTOMER" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await clerk.session?.reload();

      await submitOnboarding.mutateAsync({
        primaryLocation: primaryLocation.trim(),
        carCompany: carCompany.trim(),
        carModel: carModel.trim(),
        notes: notes.trim() ? notes.trim() : undefined,
      });
      await queryClient.refetchQueries({ queryKey: userKeys.me() });
      router.replace("/(customer)/(tabs)/home");
    } catch (error: unknown) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to save onboarding");
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

        <View className="bg-canvas-raised border border-ink-faint rounded-3xl p-4 mb-6">
          <View className="flex-row items-center gap-3">
            <View className="w-11 h-11 rounded-2xl bg-primary-100 items-center justify-center">
              <Ionicons name="car-sport-outline" size={22} />
            </View>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-ink">Tell us about your needs</Text>
              <Text className="text-ink-muted text-sm">This helps us personalize services for you.</Text>
            </View>
          </View>
        </View>

        <Text className="text-ink text-sm font-medium mb-2">Primary location</Text>
        <TextInput
          className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-4"
          placeholder="e.g. California, USA"
          placeholderTextColor={appColors.ink.subtle}
          style={textInputBaselineStyle}
          value={primaryLocation}
          onChangeText={setPrimaryLocation}
        />
        <LocationPreviewMap
          title="Location preview"
          description="Verify your service location is pinned correctly."
          latitude={previewLatitude}
          longitude={previewLongitude}
          isLoading={previewLoading}
          emptyMessage={
            googleMapsApiKey
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
          className="w-full bg-primary-600 rounded-2xl py-4 items-center"
          onPress={handleContinue}
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
                        selected ? "border-primary-500 bg-primary-50" : "border-ink-faint bg-canvas-raised"
                      }`}
                      onPress={() => {
                        setCarCompany(company);
                        setShowCompanyModal(false);
                      }}
                    >
                      <Text className={selected ? "text-primary-700 font-semibold" : "text-ink"}>{company}</Text>
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
