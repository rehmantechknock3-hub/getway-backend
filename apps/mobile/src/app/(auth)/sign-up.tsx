import { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  StatusBar, ScrollView,
} from "react-native";
import { useClerk, useSignUp } from "@clerk/expo";
import { Link, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { showToast } from "@repo/ui";
import { reportError, safeClerkCall } from "@repo/utils";

import { appColors } from "../../styles/colors";
import { textInputBaselineStyle } from "../../styles/text-input";

type Step = "details" | "verify";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isExpectedSignUpInputError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("taken") ||
    message.includes("already") ||
    message.includes("exists") ||
    message.includes("email address is invalid") ||
    message.includes("password")
  );
}

export default function SignUpScreen() {
  const { signUp } = useSignUp();
  const clerk = useClerk();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>("details");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    setCode("");
  }, [step, email]);

  async function handleCreate() {
    if (!firstName.trim() || !lastName.trim()) {
      showToast("error", "Please enter your first and last name.");
      return;
    }
    if (!email.trim()) {
      showToast("error", "Please enter your email address.");
      return;
    }
    if (password.length < 8) {
      showToast("error", "Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const createResult = await safeClerkCall(() =>
        signUp.password({
          emailAddress: email.trim(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        })
      );
      if ("error" in createResult && createResult.error) {
        throw createResult.error;
      }

      const sendCodeResult = await safeClerkCall(() =>
        signUp.verifications.sendEmailCode()
      );
      if ("error" in sendCodeResult && sendCodeResult.error) {
        throw sendCodeResult.error;
      }

      setCode("");
      setStep("verify");
    } catch (error: unknown) {
      if (!isExpectedSignUpInputError(error)) {
        reportError(error, {
          screen: "SignUpScreen",
          action: "handleCreate",
          extra: { identifier: email.trim() },
        });
      }
      showToast("error", getErrorMessage(error) || "Sign up failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    setLoading(true);
    try {
      const verifyResult = await safeClerkCall(() =>
        signUp.verifications.verifyEmailCode({ code })
      );
      if ("error" in verifyResult && verifyResult.error) {
        throw verifyResult.error;
      }

      const createdSessionId = signUp.createdSessionId;
      if (!createdSessionId) {
        showToast("error", "Verification completed but session is unavailable.");
        return;
      }

      const activateResult = await safeClerkCall(() =>
        clerk.setActive({ session: createdSessionId })
      );
      if (
        typeof activateResult === "object" &&
        activateResult !== null &&
        "error" in activateResult &&
        activateResult.error
      ) {
        throw activateResult.error;
      }

      router.replace("/(auth)/role-select");
    } catch (error: unknown) {
      reportError(error, {
        screen: "SignUpScreen",
        action: "handleVerify",
        extra: { identifier: email.trim() },
      });
      showToast("error", error instanceof Error ? error.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    setResending(true);
    try {
      const sendCodeResult = await safeClerkCall(() =>
        signUp.verifications.sendEmailCode()
      );
      if ("error" in sendCodeResult && sendCodeResult.error) {
        throw sendCodeResult.error;
      }

      setCode("");
      showToast("success", "A new verification code was sent to your email.");
    } catch (error: unknown) {
      reportError(error, {
        screen: "SignUpScreen",
        action: "handleResendCode",
        extra: { identifier: email.trim() },
      });
      showToast("error", getErrorMessage(error) || "Could not resend code.");
    } finally {
      setResending(false);
    }
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
                key={`verify-code-${email.trim().toLowerCase()}`}
                className="text-ink text-3xl font-bold tracking-widest text-center"
                placeholder="000000"
                placeholderTextColor={appColors.ink.subtle}
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
                style={{ letterSpacing: 12 }}
              />
            </View>

            <TouchableOpacity
              onPress={handleVerify}
              disabled={loading || resending || code.length < 6}
              className="w-full bg-primary-600 rounded-2xl py-4 items-center"
              style={{ opacity: loading || resending || code.length < 6 ? 0.5 : 1 }}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={appColors.onPrimary} />
                : <Text className="text-white font-semibold text-base">Verify Email</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleResendCode}
              disabled={loading || resending}
              className="w-full py-4 items-center mt-2 active:opacity-80"
              accessibilityRole="button"
              accessibilityLabel="Resend verification code"
            >
              {resending ? (
                <ActivityIndicator color={appColors.primary[600]} />
              ) : (
                <Text className="text-primary-600 font-semibold text-base">Resend code</Text>
              )}
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
              ? <ActivityIndicator color={appColors.onPrimary} />
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
