import { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  Alert, StatusBar, ScrollView,
} from "react-native";
import { useAuth, useClerk, useUser } from "@clerk/expo";
import { router } from "expo-router";
import { apiClient } from "@repo/api-client";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { appColors } from "../../styles/colors";

type Role = "CUSTOMER" | "PROVIDER";

const ROLES: {
  value: Role;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  title: string;
  subtitle: string;
  perks: string[];
}[] = [
  {
    value:    "CUSTOMER",
    icon:     "search",
    iconBg:   appColors.primary[50],
    title:    "I need services",
    subtitle: "Find and book trusted professionals near you",
    perks:    ["Browse verified providers", "Live job tracking", "Secure payment"],
  },
  {
    value:    "PROVIDER",
    icon:     "briefcase",
    iconBg:   appColors.primary[50],
    title:    "I provide services",
    subtitle: "Grow your business and manage bookings",
    perks:    ["Set your own schedule", "Get paid fast", "Build your reputation"],
  },
];

export default function RoleSelectScreen() {
  const { getToken, sessionClaims } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Role | null>(null);
  const [loading,  setLoading]  = useState(false);
  const roleFromClaims = (sessionClaims?.publicMetadata as { role?: string } | undefined)?.role;
  const roleFromUser = (user?.publicMetadata as { role?: string } | undefined)?.role;
  const role = roleFromClaims ?? roleFromUser;

  useEffect(() => {
    if (role === "PROVIDER") {
      router.replace("/(provider)/(tabs)/jobs");
      return;
    }
    if (role === "CUSTOMER") {
      router.replace("/(customer)/(tabs)/home");
    }
  }, [role]);

  async function handleConfirm() {
    if (!selected) return;
    setLoading(true);
    try {
      const token = await getToken();
      await apiClient.post(
        "/api/v1/auth/set-role",
        { role: selected },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      await clerk.session?.reload();
      router.replace(
        selected === "PROVIDER"
          ? "/(auth)/provider-onboarding"
          : "/(auth)/customer-onboarding",
      );
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to set role");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, paddingBottom: Math.max(insets.bottom + 24, 40) }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="mb-10 mt-4">
          <Text className="text-4xl font-bold text-ink mb-2" style={{ letterSpacing: -1 }}>
            How will you use{"\n"}Marketplace?
          </Text>
          <Text className="text-ink-muted text-base">
            Choose your role — you can't change this later
          </Text>
        </View>

        {/* Role cards */}
        <View className="gap-4 mb-10">
          {ROLES.map((role) => {
            const active = selected === role.value;
            return (
              <TouchableOpacity
                key={role.value}
                onPress={() => setSelected(role.value)}
                activeOpacity={0.85}
                className={[
                  "rounded-3xl p-6 border-2",
                  active ? "border-primary-500 bg-primary-50" : "border-ink-faint bg-canvas-raised",
                ].join(" ")}
              >
                {/* Icon + title row */}
                <View className="flex-row items-center gap-4 mb-4">
                  <View
                    className="w-14 h-14 rounded-2xl items-center justify-center"
                    style={{ backgroundColor: active ? appColors.primary[500] : role.iconBg }}
                  >
                    <Ionicons
                      name={role.icon}
                      size={24}
                      color={active ? appColors.canvas.raised : appColors.primary[500]}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className={`text-lg font-bold mb-0.5 ${active ? "text-primary-700" : "text-ink"}`}>
                      {role.title}
                    </Text>
                    <Text className="text-ink-muted text-sm">{role.subtitle}</Text>
                  </View>
                  <View className={[
                    "w-6 h-6 rounded-full border-2 items-center justify-center",
                    active ? "border-primary-600 bg-primary-600" : "border-ink-faint bg-transparent",
                  ].join(" ")}>
                    {active && <Ionicons name="checkmark" size={14} color={appColors.canvas.raised} />}
                  </View>
                </View>

                {/* Perks */}
                <View className={`pt-4 border-t gap-2 ${active ? "border-primary-200" : "border-ink-faint"}`}>
                  {role.perks.map((perk) => (
                    <View key={perk} className="flex-row items-center gap-2">
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={active ? appColors.primary[600] : appColors.ink.subtle}
                      />
                      <Text className={`text-sm ${active ? "text-primary-800" : "text-ink-muted"}`}>
                        {perk}
                      </Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* CTA */}
        <TouchableOpacity
          onPress={handleConfirm}
          disabled={!selected || loading}
          className="w-full bg-primary-600 rounded-2xl py-4 items-center"
          style={{ opacity: !selected || loading ? 0.5 : 1 }}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={appColors.canvas.raised} />
            : <Text className="text-white font-semibold text-base">Get Started</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
