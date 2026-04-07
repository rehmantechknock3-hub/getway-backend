import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  Alert, StatusBar, ScrollView,
} from "react-native";
import { useSignUp } from "@clerk/expo";
import { Link, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { appColors } from "../../styles/colors";
import { textInputBaselineStyle } from "../../styles/text-input";

type Step = "details" | "verify";

export default function SignUpScreen() {
  const { signUp } = useSignUp();
  const insets = useSafeAreaInsets();

  const [step,      setStep]      = useState<Step>("details");
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [code,      setCode]      = useState("");
  const [loading,   setLoading]   = useState(false);
  const [showPw,    setShowPw]    = useState(false);

  async function handleCreate() {
    if (!firstName.trim() || !lastName.trim()) return Alert.alert("Required", "Please enter your first and last name.");
    if (!email.trim())                          return Alert.alert("Required", "Please enter your email address.");
    if (password.length < 8)                    return Alert.alert("Required", "Password must be at least 8 characters.");

    setLoading(true);

    const { error: createError } = await signUp.password({
      emailAddress: email.trim(),
      password,
      firstName:    firstName.trim(),
      lastName:     lastName.trim(),
    });

    if (createError) {
      setLoading(false);
      Alert.alert("Error", createError.message ?? "Sign up failed");
      return;
    }

    const { error: sendError } = await signUp.verifications.sendEmailCode();

    setLoading(false);

    if (sendError) {
      Alert.alert("Error", sendError.message ?? "Failed to send verification email");
      return;
    }

    setStep("verify");
  }

  async function handleVerify() {
    setLoading(true);

    const { error: verifyError } = await signUp.verifications.verifyEmailCode({ code });

    if (verifyError) {
      setLoading(false);
      Alert.alert("Error", verifyError.message ?? "Verification failed");
      return;
    }

    const { error: finalError } = await signUp.finalize();

    setLoading(false);

    if (finalError) {
      Alert.alert("Error", finalError.message ?? "Failed to complete sign up");
      return;
    }

    router.replace("/(auth)/role-select");
  }

  // Step indicator
  const StepDots = () => (
    <View className="flex-row gap-2 mb-8">
      <View className={`h-1 rounded-full ${step === "details" ? "w-8 bg-primary-600" : "w-4 bg-primary-600"}`} />
      <View className={`h-1 rounded-full ${step === "verify" ? "w-8 bg-primary-600" : "w-4 bg-ink-faint"}`} />
    </View>
  );

  if (step === "verify") {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-canvas">
        <StatusBar barStyle="dark-content" />
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom + 24, 40) }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            className="mx-5 mb-8 w-10 h-10 rounded-full bg-canvas-sunken items-center justify-center"
            onPress={() => setStep("details")}
          >
            <Ionicons name="arrow-back" size={20} color={appColors.ink.DEFAULT} />
          </TouchableOpacity>

          <View className="px-6">
            <StepDots />
            <Text className="text-4xl font-bold text-ink mb-1" style={{ letterSpacing: -1 }}>
              Check your email
            </Text>
            <Text className="text-ink-muted text-base mb-10">
              We sent a 6-digit code to{"\n"}<Text className="text-ink font-medium">{email}</Text>
            </Text>

            {/* Code input */}
            <View className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3 mb-6">
              <TextInput
                className="text-ink text-3xl font-bold tracking-widest text-center"
                placeholder="000000"
                placeholderTextColor={appColors.ink.subtle}
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={setCode}
                style={{ letterSpacing: 12 }}
              />
            </View>

            <TouchableOpacity
              onPress={handleVerify}
              disabled={loading || code.length < 6}
              className="w-full bg-primary-600 rounded-2xl py-4 items-center"
              style={{ opacity: loading || code.length < 6 ? 0.5 : 1 }}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={appColors.canvas.raised} />
                : <Text className="text-white font-semibold text-base">Verify Email</Text>
              }
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-canvas">
      <StatusBar barStyle="dark-content" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom + 24, 40) }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Link href="/(auth)/welcome" asChild>
          <TouchableOpacity className="mx-5 mb-8 w-10 h-10 rounded-full bg-canvas-sunken items-center justify-center">
            <Ionicons name="arrow-back" size={20} color={appColors.ink.DEFAULT} />
          </TouchableOpacity>
        </Link>

        <View className="px-6">
          <StepDots />
          <Text className="text-4xl font-bold text-ink mb-1" style={{ letterSpacing: -1 }}>
            Create account
          </Text>
          <Text className="text-ink-muted text-base mb-10">
            Join thousands of customers and providers
          </Text>

          {/* Name row */}
          <View className="flex-row gap-3 mb-4">
            <View className="flex-1">
              <Text className="text-ink text-sm font-medium mb-2">First name</Text>
              <TextInput
                className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base"
                placeholder="Jane"
                placeholderTextColor={appColors.ink.subtle}
                autoCapitalize="words"
                style={textInputBaselineStyle}
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>
            <View className="flex-1">
              <Text className="text-ink text-sm font-medium mb-2">Last name</Text>
              <TextInput
                className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base"
                placeholder="Doe"
                placeholderTextColor={appColors.ink.subtle}
                autoCapitalize="words"
                style={textInputBaselineStyle}
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          </View>

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

          <Text className="text-ink text-sm font-medium mb-2">Password</Text>
          <View className="relative mb-6">
            <TextInput
              className="w-full bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base pr-12"
              placeholder="Min. 8 characters"
              placeholderTextColor={appColors.ink.subtle}
              secureTextEntry={!showPw}
              autoComplete="new-password"
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

          <TouchableOpacity
            onPress={handleCreate}
            disabled={loading}
            className="w-full bg-primary-600 rounded-2xl py-4 items-center"
            style={{ opacity: loading ? 0.5 : 1 }}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={appColors.canvas.raised} />
              : <Text className="text-white font-semibold text-base">Continue</Text>
            }
          </TouchableOpacity>

          <View className="items-center mt-6">
            <Text className="text-ink-muted text-base">
              Already have an account?{" "}
              <Link href="/(auth)/sign-in">
                <Text className="text-primary-600 font-semibold">Sign in</Text>
              </Link>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
