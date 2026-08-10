import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { appColors } from "../../styles/colors";

type HomeHeaderProps = {
  title: string;
  locationLabel: string;
  unreadCount: number;
  onPressLocation: () => void;
  onPressNotifications: () => void;
  /** When set, shows a back control to return to the browse home. */
  onBack?: () => void;
};

export function HomeHeader({
  title,
  locationLabel,
  unreadCount,
  onPressLocation,
  onPressNotifications,
  onBack,
}: HomeHeaderProps) {
  return (
    <View className="px-5 mb-6">
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1 flex-row items-center pr-3 gap-2">
          {onBack ? (
            <TouchableOpacity
              className="w-11 h-11 rounded-full bg-surface-elevated border border-surface-border items-center justify-center"
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Back to home"
            >
              <Ionicons name="arrow-back" size={22} color={appColors.onPrimary} />
            </TouchableOpacity>
          ) : null}
          <Text
            className="text-white text-3xl font-bold flex-1"
            style={{ letterSpacing: -0.8 }}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
        <View className="relative">
          <TouchableOpacity
            className="w-11 h-11 rounded-full bg-surface-elevated border border-surface-border items-center justify-center"
            onPress={onPressNotifications}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={22} color={appColors.onPrimary} />
          </TouchableOpacity>
          {unreadCount > 0 ? (
            <View className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-glow-blue items-center justify-center px-1 border border-surface-night">
              <Text className="text-white text-xs font-bold">
                {unreadCount > 9 ? "9+" : String(unreadCount)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPressLocation}
        className="self-start flex-row items-center gap-2 bg-surface-elevated border border-surface-border rounded-full px-3.5 py-2"
        accessibilityRole="button"
        accessibilityLabel={`Location ${locationLabel}`}
      >
        <Ionicons name="location" size={14} color={appColors.glow.blue} />
        <Text className="text-surface-soft text-sm font-medium" numberOfLines={1}>
          {locationLabel}
        </Text>
        <Ionicons name="chevron-down" size={14} color={appColors.surface.muted} />
      </TouchableOpacity>
    </View>
  );
}
