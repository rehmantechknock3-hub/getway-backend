import { Stack } from "expo-router";

import { appColors } from "../../styles/colors";

const lightHeader = {
  headerShown: true as const,
  headerBackTitle: "Back",
  headerTintColor: appColors.primary[600],
  headerStyle: {
    backgroundColor: appColors.canvas.DEFAULT,
  },
  headerTitleStyle: {
    color: appColors.ink.DEFAULT,
    fontWeight: "600" as const,
  },
  headerShadowVisible: false,
};

export default function ProviderLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="notifications"
        options={{
          ...lightHeader,
          title: "Notifications",
        }}
      />
      <Stack.Screen
        name="booking/[bookingId]"
        options={{
          ...lightHeader,
          title: "Job",
        }}
      />
      <Stack.Screen
        name="reviews"
        options={{
          ...lightHeader,
          title: "Customer reviews",
        }}
      />
      <Stack.Screen
        name="service/new"
        options={{
          ...lightHeader,
          title: "Add service",
        }}
      />
      <Stack.Screen
        name="service/[id]"
        options={{
          ...lightHeader,
          title: "Edit service",
        }}
      />
      <Stack.Screen
        name="edit-info"
        options={{
          ...lightHeader,
          title: "Edit info",
        }}
      />
    </Stack>
  );
}
