import { Redirect } from "expo-router";

import { useAuth, useUser } from "@clerk/expo";

import { useMe } from "@repo/api-client";

export default function IndexScreen() {
  const { isLoaded, isSignedIn, sessionClaims } = useAuth();
  const { user } = useUser();
  const roleFromClaims = (sessionClaims?.publicMetadata as { role?: string } | undefined)?.role;
  const roleFromUser = (user?.publicMetadata as { role?: string } | undefined)?.role;
  const role = roleFromClaims ?? roleFromUser;

  const meQuery = useMe({ enabled: Boolean(isLoaded && isSignedIn && role) });

  if (!isLoaded) {
    return null;
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (!role) {
    return <Redirect href="/(auth)/role-select" />;
  }

  // After reload, `/` is restored before deep routes; wait for `/users/me` so we don't skip onboarding.
  if (meQuery.isPending) {
    return null;
  }

  if (meQuery.isSuccess && !meQuery.data.onboardingCompleted) {
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
