import { Stack } from "expo-router";

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
          headerTintColor: "#1C1917",
        }}
      />
      <Stack.Screen
        name="provider/[id]/book/[serviceId]"
        options={{
          headerShown: true,
          title: "Book",
          headerBackTitle: "Back",
          headerTintColor: "#1C1917",
        }}
      />
      <Stack.Screen
        name="booking/[id]"
        options={{
          headerShown: true,
          title: "Booking",
          headerBackTitle: "Back",
          headerTintColor: "#1C1917",
        }}
      />
      <Stack.Screen
        name="notifications"
        options={{
          headerShown: true,
          title: "Notifications",
          headerBackTitle: "Back",
          headerTintColor: "#1C1917",
        }}
      />
    </Stack>
  );
}
