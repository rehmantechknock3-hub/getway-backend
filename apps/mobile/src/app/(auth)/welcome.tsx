import { View, Text, TouchableOpacity, StatusBar } from "react-native";
import { Link } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { appColors } from "../../styles/colors";

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-ink" style={{ paddingTop: insets.top }}>
      <StatusBar barStyle="light-content" />

      {/* Hero — dark charcoal */}
      <View className="flex-1 items-center justify-center px-8">
        <View className="w-20 h-20 rounded-3xl bg-primary-500 items-center justify-center mb-6">
          <Ionicons name="flash" size={40} color={appColors.canvas.raised} />
        </View>

        <Text
          className="text-5xl font-bold text-white text-center mb-3"
          style={{ letterSpacing: -1.5 }}
        >
          Marketplace
        </Text>

        <Text className="text-ink-subtle text-lg text-center leading-relaxed" style={{ maxWidth: 260 }}>
          Trusted professionals, on demand
        </Text>

        <View className="flex-row gap-3 mt-10 flex-wrap justify-center">
          {["Verified Pros", "Live Tracking", "Secure Payments"].map((f) => (
            <View key={f} className="flex-row items-center gap-1.5 bg-ink-soft px-3 py-1.5 rounded-full">
              <View className="w-1.5 h-1.5 rounded-full bg-primary-500" />
              <Text className="text-ink-subtle text-xs font-medium">{f}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Bottom card */}
      <View
        className="bg-canvas-raised rounded-t-3xl px-6 pt-8"
        style={{ paddingBottom: Math.max(insets.bottom + 8, 24) }}
      >
        <Link href="/(auth)/sign-in" asChild>
          <TouchableOpacity
            className="w-full bg-primary-600 rounded-2xl py-4 items-center mb-3"
            activeOpacity={0.85}
          >
            <Text className="text-white text-base font-semibold">Sign In</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/(auth)/sign-up" asChild>
          <TouchableOpacity
            className="w-full bg-canvas-sunken rounded-2xl py-4 items-center"
            activeOpacity={0.85}
          >
            <Text className="text-ink text-base font-semibold">Create Account</Text>
          </TouchableOpacity>
        </Link>

        <Text className="text-ink-subtle text-xs text-center mt-5">
          By continuing you agree to our{" "}
          <Text className="text-primary-600">Terms</Text>
          {" & "}
          <Text className="text-primary-600">Privacy Policy</Text>
        </Text>
      </View>
    </View>
  );
}
