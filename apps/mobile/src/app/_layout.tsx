import "../globals.css";
import { useEffect, useLayoutEffect } from "react";
import { Stack, useRouter, useSegments, useRootNavigationState } from "expo-router";
import { ClerkProvider, useAuth, useUser } from "@clerk/expo";
import * as SecureStore from "expo-secure-store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { setAuthToken, useMe } from "@repo/api-client";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60 * 1000, retry: 1 },
  },
});

const tokenCache = {
  async getToken(key: string) {
    return SecureStore.getItemAsync(key);
  },
  async saveToken(key: string, value: string) {
    return SecureStore.setItemAsync(key, value);
  },
};

function RootNavigator() {
  const { isLoaded, isSignedIn, getToken, sessionClaims } = useAuth();
  const { user } = useUser();
  const router   = useRouter();
  const segments = useSegments();
  const navState = useRootNavigationState();

  const roleFromClaims = (sessionClaims?.publicMetadata as { role?: string } | undefined)?.role;
  const roleFromUser = (user?.publicMetadata as { role?: string } | undefined)?.role;
  const role = roleFromClaims ?? roleFromUser;

  const meQuery = useMe({ enabled: Boolean(isLoaded && isSignedIn && role) });

  // Set the axios token as early as possible so `/users/me` succeeds on the first tick after reload.
  useLayoutEffect(() => {
    if (!isSignedIn) {
      setAuthToken(null);
      return;
    }
    void getToken().then((token) => setAuthToken(token));
  }, [isSignedIn, getToken]);

  // Auth-based routing — runs only when auth state or current segment changes.
  // Using imperative navigation (not <Redirect>) to avoid redirect loops:
  // <Redirect> re-fires on every render, fighting with in-progress auth flows.
  useEffect(() => {
    if (!isLoaded)        return;
    if (!navState?.key)   return; // navigation container not yet mounted

    const inAuthGroup = segments[0] === "(auth)";
    const authSegment = segments[1] as string | undefined;
    const inCustomerOnboarding = authSegment === "customer-onboarding";
    const inProviderOnboarding = authSegment === "provider-onboarding";

    // Stay on onboarding forms (reload must not jump to tabs).
    if (inAuthGroup && (inCustomerOnboarding || inProviderOnboarding)) {
      return;
    }

    if (!isSignedIn) {
      // Only push to welcome if we're outside the auth group.
      // Inside the auth group (sign-up, sign-in, verify) we leave navigation alone.
      if (!inAuthGroup) router.replace("/(auth)/welcome");
      return;
    }

    // Signed in but still inside main app shells without finishing onboarding (e.g. bad redirect).
    if (
      role &&
      meQuery.isSuccess &&
      !meQuery.data.onboardingCompleted
    ) {
      if (role === "CUSTOMER" && segments[0] === "(customer)") {
        router.replace("/(auth)/customer-onboarding");
        return;
      }
      if (role === "PROVIDER" && segments[0] === "(provider)") {
        router.replace("/(auth)/provider-onboarding");
        return;
      }
    }

    // Signed in — leave auth stack only when role + onboarding (or /me failure) are resolved.
    if (inAuthGroup) {
      if (!role) {
        if (authSegment !== "role-select") router.replace("/(auth)/role-select");
        return;
      }

      if (meQuery.isPending) {
        return;
      }

      if (meQuery.isSuccess && !meQuery.data.onboardingCompleted) {
        if (role === "PROVIDER" && authSegment !== "provider-onboarding") {
          router.replace("/(auth)/provider-onboarding");
        } else if (role === "CUSTOMER" && authSegment !== "customer-onboarding") {
          router.replace("/(auth)/customer-onboarding");
        }
        return;
      }

      if (role === "PROVIDER") {
        router.replace("/(provider)/(tabs)/jobs");
      } else {
        router.replace("/(customer)/(tabs)/home");
      }
    }
  }, [isLoaded, isSignedIn, sessionClaims, user?.publicMetadata, segments, navState?.key, meQuery.isPending, meQuery.isSuccess, meQuery.data, role]);

  return null;
}

export default function RootLayout() {
  return (
    <ClerkProvider
      publishableKey={process.env["EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY"]!}
      tokenCache={tokenCache}
    >
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }} />
        <RootNavigator />
      </QueryClientProvider>
    </ClerkProvider>
  );
}
