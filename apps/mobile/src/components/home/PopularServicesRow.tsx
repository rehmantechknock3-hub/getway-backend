import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { POPULAR_SERVICES, type PopularService } from "../../data/home-browse";
import { appColors } from "../../styles/colors";

type PopularServicesRowProps = {
  selectedId: string | null;
  onSelect: (service: PopularService) => void;
};

export function PopularServicesRow({ selectedId, onSelect }: PopularServicesRowProps) {
  return (
    <View className="mb-7">
      <Text className="text-white text-lg font-semibold px-5 mb-4">Popular Right Now</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 18 }}
      >
        {POPULAR_SERVICES.map((service) => {
          const selected = selectedId === service.id;
          const glowColor = appColors.glow[service.glow];
          return (
            <TouchableOpacity
              key={service.id}
              activeOpacity={0.85}
              className="items-center gap-2.5 w-[72px]"
              onPress={() => onSelect(service)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${service.label}${selected ? ", selected" : ""}`}
            >
              <View
                className={`w-16 h-16 rounded-full items-center justify-center border-2 overflow-hidden ${
                  selected ? "bg-surface-elevated" : "bg-surface-card"
                }`}
                style={{
                  borderColor: glowColor,
                  shadowColor: glowColor,
                  shadowOpacity: 0.55,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 8,
                }}
              >
                {service.image ? (
                  <Image
                    source={service.image}
                    className="w-full h-full"
                    resizeMode="cover"
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <Ionicons
                    name={service.icon ?? "ellipse-outline"}
                    size={28}
                    color={appColors.onPrimary}
                  />
                )}
              </View>
              <Text
                className={`text-xs font-medium text-center ${
                  selected ? "text-white" : "text-surface-soft"
                }`}
                numberOfLines={1}
              >
                {service.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
