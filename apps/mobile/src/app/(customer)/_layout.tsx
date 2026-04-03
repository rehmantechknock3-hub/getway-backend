import { Stack } from "expo-router";

export default function CustomerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="provider/[id]"
        options={{
          headerShown: true,
          title: "Provider",
          headerBackTitle: "Back",
          headerTintColor: "#1C1917",
        }}
      />
    </Stack>
  );
}
