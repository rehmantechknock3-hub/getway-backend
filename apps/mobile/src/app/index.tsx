import { Redirect } from "expo-router";
import { useAuth, useUser } from "@clerk/expo";

export default function IndexScreen() {
  const { isLoaded, isSignedIn, sessionClaims } = useAuth();
  const { user } = useUser();
  const roleFromClaims = (sessionClaims?.publicMetadata as { role?: string } | undefined)?.role;
  const roleFromUser = (user?.publicMetadata as { role?: string } | undefined)?.role;
  const role = roleFromClaims ?? roleFromUser;

  if (!isLoaded) {
    return null;
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (!role) {
    return <Redirect href="/(auth)/role-select" />;
  }

  if (role === "PROVIDER") {
    return <Redirect href="/(provider)/(tabs)/jobs" />;
  }

  return <Redirect href="/(customer)/(tabs)/home" />;
}
