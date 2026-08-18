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

export default function CustomerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="provider/[id]/index"
        options={{
          ...lightHeader,
          title: "Provider",
        }}
      />
      <Stack.Screen
        name="provider/[id]/book/[serviceId]"
        options={{
          ...lightHeader,
          title: "Book",
        }}
      />
      <Stack.Screen
        name="provider/[id]/reviews"
        options={{
          ...lightHeader,
          title: "Reviews",
        }}
      />
      <Stack.Screen
        name="booking/[bookingId]"
        options={{
          ...lightHeader,
          title: "Appointment",
        }}
      />
      <Stack.Screen
        name="notifications"
        options={{
          ...lightHeader,
          title: "Notifications",
        }}
      />
      <Stack.Screen
        name="edit-info"
        options={{
          ...lightHeader,
          title: "Edit info",
        }}
      />
      <Stack.Screen
        name="saved-locations"
        options={{
          ...lightHeader,
          title: "Saved locations",
        }}
      />
    </Stack>
  );
}
