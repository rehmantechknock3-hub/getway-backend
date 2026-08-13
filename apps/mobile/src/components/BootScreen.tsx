import { ActivityIndicator, Image, View } from "react-native";

import { appColors } from "../styles/colors";

/** Shown while Clerk/auth routing resolves so the splash never falls through to a blank white view. */
export function BootScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: appColors.surface.night,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Image
        source={require("../../assets/logoWa.png")}
        style={{ width: 180, height: 180, marginBottom: 24 }}
        resizeMode="contain"
        accessibilityLabel="WayNow"
      />
      <ActivityIndicator size="large" color={appColors.primary[500]} />
    </View>
  );
}
