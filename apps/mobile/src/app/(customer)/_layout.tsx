import { Stack } from "expo-router";

import { appColors } from "../../styles/colors";

export default function CustomerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="provider/[id]/index"
        options={{
          headerShown: true,
          title: "Provider",
          headerBackTitle: "Back",
          headerTintColor: appColors.ink.DEFAULT,
        }}
      />
      <Stack.Screen
        name="provider/[id]/book/[serviceId]"
        options={{
          headerShown: true,
          title: "Book",
          headerBackTitle: "Back",
          headerTintColor: appColors.ink.DEFAULT,
        }}
      />
      <Stack.Screen
        name="provider/[id]/reviews"
        options={{
          headerShown: true,
          title: "Reviews",
          headerBackTitle: "Back",
          headerTintColor: appColors.ink.DEFAULT,
        }}
      />
      <Stack.Screen
        name="booking/[id]"
        options={{
          headerShown: true,
          title: "Booking",
          headerBackTitle: "Back",
          headerTintColor: appColors.ink.DEFAULT,
        }}
      />
      <Stack.Screen
        name="notifications"
        options={{
          headerShown: true,
          title: "Notifications",
          headerBackTitle: "Back",
          headerTintColor: appColors.ink.DEFAULT,
        }}
      />
    </Stack>
  );
}
