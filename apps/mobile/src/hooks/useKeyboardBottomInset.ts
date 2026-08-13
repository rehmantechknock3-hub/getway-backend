import { useEffect, useState } from "react";

import { Dimensions, Keyboard, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Bottom inset that keeps chat/composer UI above the soft keyboard.
 * Designed for Android Expo Go (pan / unreliable resize): lift by the full
 * keyboard overlap, never a partial height.
 */
export function useKeyboardBottomInset() {
  const insets = useSafeAreaInsets();
  const [avoidedBottom, setAvoidedBottom] = useState(0);

  useEffect(() => {
    const measureOverlap = (keyboardTopY: number, reportedHeight: number) => {
      const windowHeight = Dimensions.get("window").height;
      const screenHeight = Dimensions.get("screen").height;

      const fromWindow = Math.max(0, Math.round(windowHeight - keyboardTopY));
      const fromScreen = Math.max(0, Math.round(screenHeight - keyboardTopY));
      const reported = Math.max(0, Math.round(reportedHeight));

      // Take the largest estimate — under-counting is what left the input half-covered.
      let overlap = Math.max(fromWindow, fromScreen, reported);

      if (Platform.OS === "ios") {
        overlap = Math.max(overlap - insets.bottom, 0);
      } else if (overlap > 0) {
        // Extra cushion for Gboard suggestion strip / nav bar mismatch on Pixel.
        overlap += Math.max(insets.bottom, 12);
      }

      setAvoidedBottom(overlap);
    };

    const onShow = (event: { endCoordinates: { screenY: number; height: number } }) => {
      measureOverlap(event.endCoordinates.screenY, event.endCoordinates.height);
    };
    const onHide = () => setAvoidedBottom(0);

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const changeEvent =
      Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidChangeFrame";

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    const changeSub = Keyboard.addListener(changeEvent, (event) => {
      const { screenY, height } = event.endCoordinates;
      if (height < 1) {
        setAvoidedBottom(0);
        return;
      }
      measureOverlap(screenY, height);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
      changeSub.remove();
    };
  }, [insets.bottom]);

  const keyboardOpen = avoidedBottom > 0;
  const composerPaddingBottom = keyboardOpen ? 10 : Math.max(insets.bottom + 8, 14);

  return {
    keyboardOpen,
    avoidedBottom,
    composerPaddingBottom,
  };
}
