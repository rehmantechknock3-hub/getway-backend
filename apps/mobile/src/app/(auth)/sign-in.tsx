import { useEffect, useState } from "react";

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ScrollView,
} from "react-native";
import { useClerk, useSignIn } from "@clerk/expo";
import { Link } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { showToast } from "@repo/ui";
import { reportError, safeClerkCall } from "@repo/utils";

import { appColors } from "../../styles/colors";
import { authFormStyles as styles } from "../../styles/auth-form-styles";
import { textInputBaselineStyle } from "../../styles/text-input";

type Step = "credentials" | "verify";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "");
}

function isFinalizeWithoutSessionError(error: unknown): boolean {
  return getErrorMessage(error).toLowerCase().includes("without a created session");
}

function isExpectedSignInError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("identifier is invalid") ||
    message.includes("password") ||
    message.includes("invalid") ||
    message.includes("couldn't find") ||
    message.includes("verification") ||
    message.includes("incorrect") ||
    isFinalizeWithoutSessionError(error)
  );
}

export default function SignInScreen() {
  const { signIn } = useSignIn();
  const clerk = useClerk();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    setCode("");
  }, [step, email]);

  function messageForIncompleteSignIn(status: string | null | undefined): string {
    switch (status) {
      case "needs_second_factor":
        return "This account requires two-factor authentication.";
      case "needs_client_trust":
        return "We need to verify this device. Check your email for a code.";
      case "needs_new_password":
        return "Your password must be changed. Please reset your password to continue.";
      default:
        return "Could not complete sign in. Please try again.";
    }
  }

  async function activateCompletedSignIn(): Promise<boolean> {
    // Snapshot immediately after the auth step — don't call finalize() unless a
    // real session id exists. finalize() throws a raw Error when it is missing.
    const status = signIn.status;
    const sessionId = signIn.createdSessionId;

    if (status === "complete" && sessionId) {
      const finalizeResult = await safeClerkCall(() =>
        signIn.finalize({
          navigate: async () => {
            // RootNavigator owns post-auth routing.
          },
        })
      );

      if (!("error" in finalizeResult && finalizeResult.error)) {
        return true;
      }

      // Fallback when finalize races / throws despite a session id.
      const activateResult = await safeClerkCall(() =>
        clerk.setActive({ session: sessionId })
      );
      if ("error" in activateResult && activateResult.error) {
        throw finalizeResult.error;
      }
      return true;
    }

    const existingSessionId = signIn.existingSession?.sessionId;
    if (existingSessionId) {
      const activateResult = await safeClerkCall(() =>
        clerk.setActive({ session: existingSessionId })
      );
      if (
        typeof activateResult === "object" &&
        activateResult !== null &&
        "error" in activateResult &&
        activateResult.error
      ) {
        throw activateResult.error;
      }
      return true;
    }

    return false;
  }

  async function beginEmailVerification(reason: "needs_client_trust" | "needs_second_factor") {
    const sendResult = await safeClerkCall(() => signIn.mfa.sendEmailCode());
    if ("error" in sendResult && sendResult.error) {
      throw sendResult.error;
    }
    setCode("");
    setStep("verify");
    showToast(
      "info",
      reason === "needs_client_trust"
        ? "New device detected. Enter the code we emailed you."
        : "Enter the verification code we emailed you."
    );
  }

  async function handleSignIn() {
    if (!email.trim()) {
      showToast("error", "Please enter your email address.");
      return;
    }
    if (!password) {
      showToast("error", "Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      // Clear interrupted attempts so we never finalize stale state.
      await safeClerkCall(() => signIn.reset());

      const passwordResult = await safeClerkCall(() =>
        signIn.password({ identifier: email.trim(), password })
      );
      if ("error" in passwordResult && passwordResult.error) {
        throw passwordResult.error;
      }

      if (await activateCompletedSignIn()) {
        return;
      }

      // Emulator / new device: Clerk client-trust requires email OTP before a session exists.
      if (signIn.status === "needs_client_trust" || signIn.status === "needs_second_factor") {
        await beginEmailVerification(
          signIn.status === "needs_client_trust" ? "needs_client_trust" : "needs_second_factor"
        );
        return;
      }

      reportError(new Error(`Sign-in incomplete after password step (status: ${signIn.status})`), {
        screen: "SignInScreen",
        action: "handleSignIn",
        extra: { status: signIn.status },
      });
      showToast("error", messageForIncompleteSignIn(signIn.status));
      await safeClerkCall(() => signIn.reset());
      setStep("credentials");
    } catch (error: unknown) {
      if (!isExpectedSignInError(error)) {
        reportError(error, {
          screen: "SignInScreen",
          action: "handleSignIn",
        });
      }
      const message = isFinalizeWithoutSessionError(error)
        ? "Sign-in needs an extra verification step. Please try again."
        : getErrorMessage(error) || "Sign in failed";
      showToast("error", message);
      await safeClerkCall(() => signIn.reset());
      setStep("credentials");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (code.length < 6) {
      showToast("error", "Enter the 6-digit verification code.");
      return;
    }

    setLoading(true);
    try {
      const verifyResult = await safeClerkCall(() =>
        signIn.mfa.verifyEmailCode({ code })
      );
      if ("error" in verifyResult && verifyResult.error) {
        throw verifyResult.error;
      }

      if (await activateCompletedSignIn()) {
        return;
      }

      reportError(new Error(`Sign-in incomplete after MFA verify (status: ${signIn.status})`), {
        screen: "SignInScreen",
        action: "handleVerify",
        extra: { status: signIn.status },
      });
      showToast("error", messageForIncompleteSignIn(signIn.status));
    } catch (error: unknown) {
      if (!isExpectedSignInError(error)) {
        reportError(error, {
          screen: "SignInScreen",
          action: "handleVerify",
        });
      }
      const message = isFinalizeWithoutSessionError(error)
        ? "Verification succeeded but the session isn't ready yet. Please try again."
        : getErrorMessage(error) || "Verification failed";
      showToast("error", message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    setResending(true);
    try {
      const sendResult = await safeClerkCall(() => signIn.mfa.sendEmailCode());
      if ("error" in sendResult && sendResult.error) {
        throw sendResult.error;
      }
      setCode("");
      showToast("success", "A new verification code was sent to your email.");
    } catch (error: unknown) {
      reportError(error, {
        screen: "SignInScreen",
        action: "handleResendCode",
      });
      showToast("error", getErrorMessage(error) || "Could not resend code.");
    } finally {
      setResending(false);
    }
  }

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
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              setStep("credentials");
              void safeClerkCall(() => signIn.reset());
            }}
          >
            <Ionicons name="arrow-back" size={20} color={appColors.primary[600]} />
          </TouchableOpacity>

          <View style={styles.content}>
            <Text style={styles.title}>Verify it's you</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to{"\n"}
              <Text style={{ color: appColors.ink.DEFAULT, fontWeight: "500" }}>{email}</Text>
            </Text>

            <View style={styles.codeBox}>
              <TextInput
                key={`signin-verify-${email.trim().toLowerCase()}`}
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
              onPress={() => void handleVerify()}
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
                <Text style={styles.primaryBtnText}>Verify & sign in</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => void handleResendCode()}
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
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>

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
              placeholder="••••••••"
              placeholderTextColor={appColors.ink.subtle}
              secureTextEntry={!showPw}
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPw((v) => !v)}>
              <Ionicons name={showPw ? "eye-off" : "eye"} size={20} color={appColors.ink.muted} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => void handleSignIn()}
            disabled={loading}
            style={[styles.primaryBtn, { opacity: loading ? 0.5 : 1 }]}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={appColors.onPrimary} />
            ) : (
              <Text style={styles.primaryBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={{ alignItems: "center" }}>
            <Text style={styles.muted}>
              Don't have an account?{" "}
              <Link href="/(auth)/sign-up">
                <Text style={styles.link}>Sign up</Text>
              </Link>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
