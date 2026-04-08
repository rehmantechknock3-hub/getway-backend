import { Stack } from "expo-router";

import { appColors } from "../../styles/colors";

export default function ProviderLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="notifications"
        options={{
          headerShown: true,
          title: "Notifications",
          headerBackTitle: "Back",
          headerTintColor: appColors.ink.DEFAULT,
        }}
      />
      <Stack.Screen
        name="booking/[id]"
        options={{
          headerShown: true,
          title: "Job",
          headerBackTitle: "Back",
          headerTintColor: appColors.ink.DEFAULT,
        }}
      />
      <Stack.Screen
        name="reviews"
        options={{
          headerShown: true,
          title: "Customer reviews",
          headerBackTitle: "Back",
          headerTintColor: appColors.ink.DEFAULT,
        }}
      />
      <Stack.Screen
        name="service/new"
        options={{
          headerShown: true,
          title: "Add service",
          headerBackTitle: "Back",
          headerTintColor: appColors.ink.DEFAULT,
        }}
      />
      <Stack.Screen
        name="service/[id]"
        options={{
          headerShown: true,
          title: "Edit service",
          headerBackTitle: "Back",
          headerTintColor: appColors.ink.DEFAULT,
        }}
      />
    </Stack>
  );
}
