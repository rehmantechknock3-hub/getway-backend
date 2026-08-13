import { Image, View, Text, TouchableOpacity, StatusBar, StyleSheet } from "react-native";
import { Link } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { appColors } from "../../styles/colors";

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      <View style={styles.hero}>
        <Image
          source={require("../../../assets/logoWa.png")}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="WayNow logo"
        />

        <Text style={styles.tagline}>Every service. One app.</Text>
      </View>

      <View
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom + 8, 24) },
        ]}
      >
        <Link href="/(auth)/sign-in" asChild>
          <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Sign In</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/(auth)/sign-up" asChild>
          <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.85}>
            <Text style={styles.secondaryBtnText}>Create Account</Text>
          </TouchableOpacity>
        </Link>

        <Text style={styles.legal}>
          By continuing you agree to our{" "}
          <Text style={styles.legalLink}>Terms</Text>
          {" & "}
          <Text style={styles.legalLink}>Privacy Policy</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: appColors.surface.night,
  },
  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  logo: {
    width: 224,
    height: 224,
    marginBottom: 8,
  },
  tagline: {
    color: appColors.surface.muted,
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 280,
  },
  sheet: {
    backgroundColor: appColors.canvas.raised,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  primaryBtn: {
    width: "100%",
    backgroundColor: appColors.primary[600],
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryBtnText: {
    color: appColors.onPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryBtn: {
    width: "100%",
    backgroundColor: appColors.canvas.sunken,
    borderWidth: 1,
    borderColor: appColors.ink.faint,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryBtnText: {
    color: appColors.ink.DEFAULT,
    fontSize: 16,
    fontWeight: "600",
  },
  legal: {
    color: appColors.ink.subtle,
    fontSize: 12,
    textAlign: "center",
    marginTop: 20,
  },
  legalLink: {
    color: appColors.primary[600],
  },
});
