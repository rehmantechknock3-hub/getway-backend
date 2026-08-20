import { Redirect } from "expo-router";
import { useAuth, useUser } from "@clerk/expo";

import { useMe } from "@repo/api-client";

import { BootScreen } from "../components/BootScreen";

export default function IndexScreen() {
  const { isLoaded, isSignedIn, sessionClaims } = useAuth();
  const { user } = useUser();
  const roleFromClaims = (sessionClaims?.publicMetadata as { role?: string } | undefined)?.role;
  const roleFromUser = (user?.publicMetadata as { role?: string } | undefined)?.role;
  const role = roleFromClaims ?? roleFromUser;

  const meQuery = useMe({ enabled: Boolean(isLoaded && isSignedIn && role) });

  if (!isLoaded) {
    return <BootScreen />;
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (!role) {
    return <Redirect href="/(auth)/role-select" />;
  }

  // After reload, `/` is restored before deep routes; wait for `/users/me` so we don't skip onboarding.
  // Use isLoading (pending AND fetching), not isPending — disabled queries are pending in TanStack v5
  // and would otherwise render a blank screen forever.
  if (meQuery.isLoading) {
    return <BootScreen />;
  }

  if (meQuery.isError) {
    if (role === "PROVIDER") {
      return <Redirect href="/(auth)/provider-onboarding" />;
    }
    return <Redirect href="/(auth)/customer-onboarding" />;
  }

  if (meQuery.isSuccess && meQuery.data && !meQuery.data.onboardingCompleted) {
    if (role === "PROVIDER") {
      return <Redirect href="/(auth)/provider-onboarding" />;
    }
    return <Redirect href="/(auth)/customer-onboarding" />;
  }

  if (role === "PROVIDER") {
    return <Redirect href="/(provider)/(tabs)/jobs" />;
  }

  return <Redirect href="/(customer)/(tabs)/home" />;
}
