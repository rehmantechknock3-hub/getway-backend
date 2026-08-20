import { Alert, InteractionManager, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";

import { showToast } from "@repo/ui";
import { reportError } from "@repo/utils";

export type LocalProfilePhoto = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
};

function normalizeImageMime(mime?: string | null): string {
  const value = mime?.trim().toLowerCase() ?? "";
  if (value === "image/jpg" || value === "image/pjpeg") return "image/jpeg";
  if (value.startsWith("image/")) return value;
  return "image/jpeg";
}

function pickerOptions(allowsEditing: boolean): ImagePicker.ImagePickerOptions {
  return {
    mediaTypes: ["images"],
    allowsEditing,
    aspect: [1, 1],
    quality: 0.85,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  };
}

async function launchPicker(source: "library" | "camera"): Promise<ImagePicker.ImagePickerResult> {
  const run = (allowsEditing: boolean) =>
    source === "library"
      ? ImagePicker.launchImageLibraryAsync(pickerOptions(allowsEditing))
      : ImagePicker.launchCameraAsync(pickerOptions(allowsEditing));

  // Android Photo Picker + crop UI often throws; iOS crop is reliable.
  try {
    return await run(Platform.OS === "ios");
  } catch (error: unknown) {
    if (Platform.OS !== "android") throw error;
    return await run(false);
  }
}

function firstAsset(result: ImagePicker.ImagePickerResult | ImagePicker.ImagePickerErrorResult | null) {
  if (!result || !("assets" in result) || result.canceled || !result.assets?.[0]) return null;
  return result.assets[0];
}

export async function pickProfilePhoto(
  source: "library" | "camera",
  screen: string
): Promise<LocalProfilePhoto | null> {
  try {
    if (source === "library") {
      // Android 13+ system picker does not need READ_MEDIA_IMAGES. Asking for it
      // shows a deny dialog and then we never open the gallery.
      if (Platform.OS !== "android") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          showToast("error", "Photo access needed", "Allow photo library access to upload your profile picture.");
          return null;
        }
      }
    } else {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showToast("error", "Camera access needed", "Allow camera access to take your profile picture.");
        return null;
      }
    }

    let result = await launchPicker(source);
    let asset = firstAsset(result);

    // Android may kill the activity while the picker is open; recover the selection.
    if (!asset && Platform.OS === "android") {
      asset = firstAsset(await ImagePicker.getPendingResultAsync());
    }

    if (!asset) return null;

    const mimeType = normalizeImageMime(asset.mimeType);
    const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    return {
      uri: asset.uri,
      mimeType,
      fileName: asset.fileName?.includes(".") ? asset.fileName : `avatar-${Date.now()}.${ext}`,
    };
  } catch (error: unknown) {
    reportError(error, { screen, action: "pickProfilePhoto", extra: { source } });
    showToast("error", "Could not open photos", "Please try again.");
    return null;
  }
}

function afterAlertDismissed(action: () => void): void {
  InteractionManager.runAfterInteractions(() => {
    setTimeout(action, Platform.OS === "android" ? 400 : 0);
  });
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
        afterAlertDismissed(() => {
          void pickProfilePhoto("library", opts.screen).then((photo) => {
            if (photo) opts.onPicked(photo);
          });
        });
      },
    },
    {
      text: "Take photo",
      onPress: () => {
        afterAlertDismissed(() => {
          void pickProfilePhoto("camera", opts.screen).then((photo) => {
            if (photo) opts.onPicked(photo);
          });
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
