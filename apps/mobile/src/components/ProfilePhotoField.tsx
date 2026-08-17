import { ActivityIndicator, Image, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { appColors } from "../styles/colors";

export function ProfilePhotoField({
  uri,
  helperText,
  isUploading,
  onPress,
}: {
  uri?: string | null;
  helperText: string;
  isUploading?: boolean;
  onPress: () => void;
}) {
  return (
    <View className="bg-canvas-raised border border-ink-faint rounded-2xl p-4 mb-5 items-center">
      <Text className="text-ink text-sm font-medium mb-3 self-start">Profile photo</Text>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        disabled={isUploading}
        accessibilityRole="button"
        accessibilityLabel={uri ? "Change profile photo" : "Add profile photo"}
        className="w-28 h-28 rounded-2xl bg-canvas-sunken border border-ink-faint items-center justify-center overflow-hidden mb-3"
      >
        {isUploading ? (
          <ActivityIndicator color={appColors.primary[600]} />
        ) : uri ? (
          <Image source={{ uri }} className="w-full h-full" />
        ) : (
          <View className="items-center">
            <Ionicons name="camera-outline" size={28} color={appColors.primary[600]} />
            <Text className="text-primary-600 text-xs font-semibold mt-1">Add photo</Text>
          </View>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onPress}
        disabled={isUploading}
        className="bg-primary-50 border border-primary-100 rounded-2xl px-4 py-2.5"
        activeOpacity={0.85}
        style={{ opacity: isUploading ? 0.6 : 1 }}
      >
        <Text className="text-primary-600 font-semibold text-sm">
          {uri ? "Change photo" : "Upload profile photo"}
        </Text>
      </TouchableOpacity>
      <Text className="text-ink-muted text-xs text-center mt-3 leading-5">{helperText}</Text>
    </View>
  );
}
