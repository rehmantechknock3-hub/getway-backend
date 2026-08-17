import { Alert, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { appColors } from "../styles/colors";

const SAVED_LOCATIONS_HELP =
  "These are shortcuts like Home or Office. Save them once so you can pick an address when you book, instead of typing it every time. They are extra places — your primary location is still the main address from onboarding.";

export function SavedLocationsInfoButton() {
  return (
    <TouchableOpacity
      onPress={() =>
        Alert.alert("Saved locations", SAVED_LOCATIONS_HELP, [{ text: "OK" }])
      }
      accessibilityRole="button"
      accessibilityLabel="What are saved locations?"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="information-circle-outline" size={20} color={appColors.primary[600]} />
    </TouchableOpacity>
  );
}
