import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  Alert, StatusBar, ScrollView,
} from "react-native";
import { useSignIn } from "@clerk/expo";
import { Link, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { appColors } from "../../styles/colors";
import { textInputBaselineStyle } from "../../styles/text-input";

export default function SignInScreen() {
  const { signIn } = useSignIn();
  const insets = useSafeAreaInsets();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPw,   setShowPw]   = useState(false);

  async function handleSignIn() {
    if (!email.trim())  return Alert.alert("Required", "Please enter your email address.");
    if (!password)      return Alert.alert("Required", "Please enter your password.");

    setLoading(true);

    try {
      const { error: signInError } = await signIn.password({ identifier: email.trim(), password });

      if (signInError) {
        setLoading(false);
        Alert.alert("Error", signInError.message ?? "Sign in failed");
        return;
      }

      const { error: finalError } = await signIn.finalize();

      setLoading(false);

      if (finalError) {
        Alert.alert("Error", finalError.message ?? "Failed to complete sign in");
        return;
      }
    } catch (error: unknown) {
      setLoading(false);
      Alert.alert("Error", error instanceof Error ? error.message : "Sign in failed. Please try again.");
    }

    // RootNavigator in _layout.tsx detects isSignedIn and redirects to the correct tab
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-canvas"
    >
      <StatusBar barStyle="dark-content" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom + 24, 40) }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <Link href="/(auth)/welcome" asChild>
          <TouchableOpacity className="mx-5 mb-8 w-10 h-10 rounded-full bg-canvas-sunken items-center justify-center">
            <Ionicons name="arrow-back" size={20} color={appColors.ink.DEFAULT} />
          </TouchableOpacity>
        </Link>

        <View className="px-6">
          {/* Title */}
          <Text className="text-4xl font-bold text-ink mb-1" style={{ letterSpacing: -1 }}>
            Welcome back
          </Text>
          <Text className="text-ink-muted text-base mb-10">
            Sign in to your account
          </Text>

          {/* Email */}
          <Text className="text-ink text-sm font-medium mb-2">Email</Text>
          <TextInput
            className="w-full bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-4"
            placeholder="you@example.com"
            placeholderTextColor={appColors.ink.subtle}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            style={textInputBaselineStyle}
            value={email}
            onChangeText={setEmail}
          />

          {/* Password */}
          <Text className="text-ink text-sm font-medium mb-2">Password</Text>
          <View className="relative mb-6">
            <TextInput
              className="w-full bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base pr-12"
              placeholder="••••••••"
              placeholderTextColor={appColors.ink.subtle}
              secureTextEntry={!showPw}
              autoComplete="password"
              style={textInputBaselineStyle}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              className="absolute right-4 top-3.5"
              onPress={() => setShowPw((v) => !v)}
            >
              <Ionicons name={showPw ? "eye-off" : "eye"} size={20} color={appColors.ink.muted} />
            </TouchableOpacity>
          </View>

          {/* CTA */}
          <TouchableOpacity
            onPress={handleSignIn}
            disabled={loading}
            className="w-full bg-primary-600 rounded-2xl py-4 items-center"
            style={{ opacity: loading ? 0.5 : 1 }}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={appColors.onPrimary} />
              : <Text className="text-white font-semibold text-base">Sign In</Text>
            }
          </TouchableOpacity>

          {/* Divider */}
          <View className="flex-row items-center gap-3 my-6">
            <View className="flex-1 h-px bg-ink-faint" />
            <Text className="text-ink-subtle text-sm">or</Text>
            <View className="flex-1 h-px bg-ink-faint" />
          </View>

          <View className="items-center">
            <Text className="text-ink-muted text-base">
              Don't have an account?{" "}
              <Link href="/(auth)/sign-up">
                <Text className="text-primary-600 font-semibold">Sign up</Text>
              </Link>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
