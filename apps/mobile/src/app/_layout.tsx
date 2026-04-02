import "../globals.css";
import { useEffect } from "react";
import { Stack, useRouter, useSegments, useRootNavigationState } from "expo-router";
import { ClerkProvider, useAuth, useUser } from "@clerk/expo";
import * as SecureStore from "expo-secure-store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setAuthToken } from "@repo/api-client";

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

  // Keep the API client token in sync
  useEffect(() => {
    if (!isSignedIn) { setAuthToken(null); return; }
    getToken().then((token) => setAuthToken(token));
  }, [isSignedIn, getToken]);

  // Auth-based routing — runs only when auth state or current segment changes.
  // Using imperative navigation (not <Redirect>) to avoid redirect loops:
  // <Redirect> re-fires on every render, fighting with in-progress auth flows.
  useEffect(() => {
    if (!isLoaded)        return;
    if (!navState?.key)   return; // navigation container not yet mounted

    const inAuthGroup = segments[0] === "(auth)";
    const inCustomerOnboarding = segments[1] === "customer-onboarding";
    const inProviderOnboarding = segments[1] === "provider-onboarding";
    const roleFromClaims = (sessionClaims?.publicMetadata as { role?: string } | undefined)?.role;
    const roleFromUser = (user?.publicMetadata as { role?: string } | undefined)?.role;
    const role = roleFromClaims ?? roleFromUser;

    // Allow onboarding screens to stay mounted while role/session metadata settles.
    if (inAuthGroup && (inCustomerOnboarding || inProviderOnboarding)) {
      return;
    }

    if (!isSignedIn) {
      // Only push to welcome if we're outside the auth group.
      // Inside the auth group (sign-up, sign-in, verify) we leave navigation alone.
      if (!inAuthGroup) router.replace("/(auth)/welcome");
      return;
    }

    // Signed in — navigate away from auth screens
    if (inAuthGroup) {
      if (!role) {
        // No role yet: go to role-select (unless already there)
        if (segments[1] !== "role-select") router.replace("/(auth)/role-select");
      } else if (role === "PROVIDER") {
        router.replace("/(provider)/(tabs)/jobs");
      } else {
        router.replace("/(customer)/(tabs)/home");
      }
    }
  }, [isLoaded, isSignedIn, sessionClaims, segments, navState?.key]);

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
