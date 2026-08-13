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
import { authFormStyles as styles } from "../../styles/auth-form-styles";
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
    <View style={styles.stepRow}>
      <View style={step === "details" ? styles.stepActive : styles.stepDone} />
      <View style={step === "verify" ? styles.stepActive : styles.stepIdle} />
    </View>
  );

  if (step === "verify") {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.root}
      >
        <StatusBar barStyle="dark-content" />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{
            paddingTop: insets.top + 16,
            paddingBottom: Math.max(insets.bottom + 24, 40),
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep("details")}>
            <Ionicons name="arrow-back" size={20} color={appColors.primary[600]} />
          </TouchableOpacity>

          <View style={styles.content}>
            <StepDots />
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to{"\n"}
              <Text style={{ color: appColors.ink.DEFAULT, fontWeight: "500" }}>{email}</Text>
            </Text>

            <View style={styles.codeBox}>
              <TextInput
                key={`verify-code-${email.trim().toLowerCase()}`}
                style={styles.codeInput}
                placeholder="000000"
                placeholderTextColor={appColors.ink.subtle}
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
              />
            </View>

            <TouchableOpacity
              onPress={handleVerify}
              disabled={loading || resending || code.length < 6}
              style={[
                styles.primaryBtn,
                { opacity: loading || resending || code.length < 6 ? 0.5 : 1 },
              ]}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={appColors.onPrimary} />
              ) : (
                <Text style={styles.primaryBtnText}>Verify Email</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleResendCode}
              disabled={loading || resending}
              style={styles.secondaryAction}
              accessibilityRole="button"
              accessibilityLabel="Resend verification code"
            >
              {resending ? (
                <ActivityIndicator color={appColors.primary[600]} />
              ) : (
                <Text style={styles.link}>Resend code</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.root}
    >
      <StatusBar barStyle="dark-content" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: Math.max(insets.bottom + 24, 40),
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Link href="/(auth)/welcome" asChild>
          <TouchableOpacity style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={appColors.primary[600]} />
          </TouchableOpacity>
        </Link>

        <View style={styles.content}>
          <StepDots />
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join thousands of customers and providers</Text>

          <View style={styles.nameRow}>
            <View style={styles.inputRow}>
              <Text style={styles.label}>First name</Text>
              <TextInput
                style={[styles.input, textInputBaselineStyle]}
                placeholder="Jane"
                placeholderTextColor={appColors.ink.subtle}
                autoCapitalize="words"
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>
            <View style={styles.inputRow}>
              <Text style={styles.label}>Last name</Text>
              <TextInput
                style={[styles.input, textInputBaselineStyle]}
                placeholder="Doe"
                placeholderTextColor={appColors.ink.subtle}
                autoCapitalize="words"
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          </View>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, textInputBaselineStyle]}
            placeholder="you@example.com"
            placeholderTextColor={appColors.ink.subtle}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              style={[styles.passwordInput, textInputBaselineStyle]}
              placeholder="Min. 8 characters"
              placeholderTextColor={appColors.ink.subtle}
              secureTextEntry={!showPw}
              autoComplete="new-password"
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPw((v) => !v)}>
              <Ionicons name={showPw ? "eye-off" : "eye"} size={20} color={appColors.ink.muted} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={handleCreate}
            disabled={loading}
            style={[styles.primaryBtn, { opacity: loading ? 0.5 : 1 }]}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={appColors.onPrimary} />
            ) : (
              <Text style={styles.primaryBtnText}>Continue</Text>
            )}
          </TouchableOpacity>

          <View style={styles.linkRow}>
            <Text style={styles.muted}>
              Already have an account?{" "}
              <Link href="/(auth)/sign-in">
                <Text style={styles.link}>Sign in</Text>
              </Link>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
