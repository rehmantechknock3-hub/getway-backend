import "../globals.css";
import { useEffect, useLayoutEffect } from "react";
import { Platform } from "react-native";
import {
  Stack,
  useGlobalSearchParams,
  useRouter,
  useSegments,
  useRootNavigationState,
} from "expo-router";
import { ClerkProvider, useAuth, useUser } from "@clerk/expo";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Toast from "react-native-toast-message";

import { setApiBaseUrl, setAuthToken, setAuthTokenResolver, useMe } from "@repo/api-client";

/** iOS Simulator often resolves `localhost` to IPv6 first; Nest may be IPv4-only → connection fails. */
function resolveApiUrlForDevice(raw: string): string {
  const u = raw.trim().replace(/^["']|["']$/g, "") || "http://localhost:3001";
  if (Platform.OS !== "ios") return u;
  try {
    const parsed = new URL(u);
    if (parsed.hostname === "localhost") {
      parsed.hostname = "127.0.0.1";
    }
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, "");
  } catch {
    return u;
  }
}

setApiBaseUrl(
  resolveApiUrlForDevice(
    process.env["EXPO_PUBLIC_API_URL"] ??
      process.env["NEXT_PUBLIC_API_URL"] ??
      "http://localhost:3001"
  )
);

const SENTRY_DSN = process.env["EXPO_PUBLIC_SENTRY_DSN"];
const SHOULD_INIT_SENTRY =
  Boolean(SENTRY_DSN) &&
  process.env["NODE_ENV"] === "production" &&
  Constants.appOwnership !== "expo";

if (SHOULD_INIT_SENTRY) {
  try {
    // Lazy-load Sentry in production/dev-client builds only.
    // This avoids Expo Go devtools conflicts during local development.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require("@sentry/react-native");
    Sentry.init({
      dsn: SENTRY_DSN,
      enabled: true,
    });
    // Register explicit global handle so shared utils can discover Sentry safely
    // without importing react-native-only modules in non-RN runtimes.
    (globalThis as Record<string, unknown>)["Sentry"] = Sentry;
  } catch {
    // Keep app boot resilient if Sentry init fails unexpectedly.
  }
}

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
  const params = useGlobalSearchParams<{ allowRoleChange?: string }>();
  const navState = useRootNavigationState();

  const roleFromClaims = (sessionClaims?.publicMetadata as { role?: string } | undefined)?.role;
  const roleFromUser = (user?.publicMetadata as { role?: string } | undefined)?.role;
  const role = roleFromClaims ?? roleFromUser;
  const allowRoleChange = params.allowRoleChange === "1";

  const meQuery = useMe({ enabled: Boolean(isLoaded && isSignedIn && role) });

  // Per-request Clerk JWT (avoids 401s from stale axios default headers after reload / token refresh).
  useLayoutEffect(() => {
    if (!isSignedIn) {
      setAuthTokenResolver(null);
      setAuthToken(null);
      return;
    }
    setAuthTokenResolver(() => getToken());
    void getToken().then((token) => {
      setAuthToken(token);
    });
    return () => {
      setAuthTokenResolver(null);
    };
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
      if (inAuthGroup && authSegment === "role-select" && allowRoleChange) {
        return;
      }
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
      if (authSegment === "role-select" && allowRoleChange) {
        return;
      }
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
  }, [allowRoleChange, isLoaded, isSignedIn, sessionClaims, user?.publicMetadata, segments, navState?.key, meQuery.isPending, meQuery.isSuccess, meQuery.data, role]);

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
        <Toast />
      </QueryClientProvider>
    </ClerkProvider>
  );
}
