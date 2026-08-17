import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";

import { showToast } from "@repo/ui";
import { reportError } from "@repo/utils";

export type LocalProfilePhoto = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
};

export async function pickProfilePhoto(
  source: "library" | "camera",
  screen: string
): Promise<LocalProfilePhoto | null> {
  try {
    if (source === "library") {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast("error", "Photo access needed", "Allow photo library access to upload your profile picture.");
        return null;
      }
    } else {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showToast("error", "Camera access needed", "Allow camera access to take your profile picture.");
        return null;
      }
    }

    const result =
      source === "library"
        ? await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          })
        : await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          });

    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    return {
      uri: asset.uri,
      mimeType: asset.mimeType ?? "image/jpeg",
      fileName: asset.fileName ?? `avatar-${Date.now()}.jpg`,
    };
  } catch (error: unknown) {
    reportError(error, { screen, action: "pickProfilePhoto", extra: { source } });
    showToast("error", "Could not open photos", "Please try again.");
    return null;
  }
}

export function promptPickProfilePhoto(opts: {
  hasPhoto: boolean;
  screen: string;
  title?: string;
  message?: string;
  allowRemove?: boolean;
  onPicked: (photo: LocalProfilePhoto) => void;
  onRemoved?: () => void;
}): void {
  const buttons: Array<{
    text: string;
    style?: "cancel" | "destructive" | "default";
    onPress?: () => void;
  }> = [
    {
      text: "Choose from library",
      onPress: () => {
        void pickProfilePhoto("library", opts.screen).then((photo) => {
          if (photo) opts.onPicked(photo);
        });
      },
    },
    {
      text: "Take photo",
      onPress: () => {
        void pickProfilePhoto("camera", opts.screen).then((photo) => {
          if (photo) opts.onPicked(photo);
        });
      },
    },
  ];
  if (opts.allowRemove && opts.hasPhoto) {
    buttons.push({
      text: "Remove photo",
      style: "destructive",
      onPress: () => opts.onRemoved?.(),
    });
  }
  buttons.push({ text: "Cancel", style: "cancel" });

  Alert.alert(
    opts.title ?? "Profile photo",
    opts.message ?? "Add a photo for your profile.",
    buttons
  );
}
