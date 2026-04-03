import { useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { useSubmitProviderOnboarding, userKeys } from "@repo/api-client";

import { textInputBaselineStyle } from "../../styles/text-input";

const SERVICE_CATEGORIES = [
  "Car Wash",
  "Car Detailing",
  "Oil Change",
  "Tire Service",
  "Battery Service",
  "AC Service",
  "Brake Service",
  "Engine Diagnostics",
  "Car Polishing",
  "Interior Cleaning",
  "Roadside Assistance",
  "Vehicle Inspection",
];

export default function ProviderOnboardingScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const submitOnboarding = useSubmitProviderOnboarding();
  const [serviceCategory, setServiceCategory] = useState("");
  const [experienceYears, setExperienceYears] = useState("0");
  const [serviceArea, setServiceArea] = useState("");
  const [hasTools, setHasTools] = useState(true);
  const [serviceDescription, setServiceDescription] = useState("");
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  async function handleContinue() {
    const parsedExperience = Number.parseInt(experienceYears, 10);
    if (!serviceCategory.trim() || !serviceArea.trim() || !serviceDescription.trim()) {
      Alert.alert("Required", "Please provide category, service area, and description.");
      return;
    }
    if (Number.isNaN(parsedExperience) || parsedExperience < 0) {
      Alert.alert("Required", "Please enter valid years of experience.");
      return;
    }

    try {
      await submitOnboarding.mutateAsync({
        serviceCategory: serviceCategory.trim(),
        experienceYears: parsedExperience,
        serviceArea: serviceArea.trim(),
        hasTools,
        serviceDescription: serviceDescription.trim(),
      });
      await queryClient.refetchQueries({ queryKey: userKeys.me() });
      router.replace("/(provider)/(tabs)/jobs");
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
              <Ionicons name="briefcase-outline" size={22} />
            </View>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-ink">Set up your provider profile</Text>
              <Text className="text-ink-muted text-sm">Tell customers what you can offer.</Text>
            </View>
          </View>
        </View>

        <View className="bg-canvas-raised border border-ink-faint rounded-3xl p-4 mb-5">
          <Text className="text-ink text-sm font-medium mb-2">Service category</Text>
          <TouchableOpacity
            className="bg-canvas border border-ink-faint rounded-2xl px-4 py-3.5 mb-3 flex-row items-center justify-between"
            onPress={() => setShowCategoryModal(true)}
            activeOpacity={0.85}
          >
            <Text className={serviceCategory ? "text-ink text-base" : "text-ink-subtle text-base"}>
              {serviceCategory || "Select service category"}
            </Text>
            <Ionicons name="chevron-down" size={18} />
          </TouchableOpacity>

          <Text className="text-ink text-sm font-medium mb-2">Experience (years)</Text>
          <TextInput
            className="bg-canvas border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-3"
            placeholder="e.g. 3"
            placeholderTextColor="#A8A29E"
            keyboardType="number-pad"
            style={textInputBaselineStyle}
            value={experienceYears}
            onChangeText={setExperienceYears}
          />

          <Text className="text-ink text-sm font-medium mb-2">Service area</Text>
          <TextInput
            className="bg-canvas border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-3"
            placeholder="e.g. DHA, Gulberg"
            placeholderTextColor="#A8A29E"
            style={textInputBaselineStyle}
            value={serviceArea}
            onChangeText={setServiceArea}
          />

          <Text className="text-ink text-sm font-medium mb-2">Service description</Text>
          <TextInput
            className="bg-canvas border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base"
            placeholder="Describe the services you offer"
            placeholderTextColor="#A8A29E"
            value={serviceDescription}
            onChangeText={setServiceDescription}
            multiline
            textAlignVertical="top"
            numberOfLines={4}
            style={[textInputBaselineStyle, { minHeight: 110 }]}
          />
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
          onPress={handleContinue}
          disabled={submitOnboarding.isPending}
          style={{ opacity: submitOnboarding.isPending ? 0.6 : 1 }}
        >
          {submitOnboarding.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">Continue</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <Pressable className="flex-1 bg-black/30 justify-end" onPress={() => setShowCategoryModal(false)}>
          <Pressable className="bg-canvas rounded-t-3xl p-5 max-h-[70%]" onPress={() => undefined}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-ink text-lg font-semibold">Select service category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Ionicons name="close" size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-2">
                {SERVICE_CATEGORIES.map((category) => {
                  const selected = category === serviceCategory;
                  return (
                    <TouchableOpacity
                      key={category}
                      className={`rounded-2xl border px-4 py-3 flex-row items-center justify-between ${
                        selected ? "border-primary-500 bg-primary-50" : "border-ink-faint bg-canvas-raised"
                      }`}
                      onPress={() => {
                        setServiceCategory(category);
                        setShowCategoryModal(false);
                      }}
                    >
                      <Text className={selected ? "text-primary-700 font-semibold" : "text-ink"}>{category}</Text>
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
