import { Image, View, Text, TouchableOpacity, StatusBar } from "react-native";
import { Link } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-surface-night" style={{ paddingTop: insets.top }}>
      <StatusBar barStyle="light-content" />

      <View className="flex-1 items-center justify-center px-8">
        <Image
          source={require("../../../assets/logoWa.png")}
          className="w-56 h-56 mb-2"
          resizeMode="contain"
          accessibilityLabel="WayNow logo"
        />

        <Text className="text-surface-muted text-base text-center leading-relaxed" style={{ maxWidth: 280 }}>
          Every service. One app.
        </Text>
      </View>

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
            className="w-full bg-canvas-sunken border border-ink-faint rounded-2xl py-4 items-center"
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
