import { Image, Text, TouchableOpacity, View } from "react-native";

import type { HomeCategory } from "../../data/home-browse";
import { appColors } from "../../styles/colors";

type CategoryBrowseCardProps = {
  category: HomeCategory;
  selected: boolean;
  onPress: () => void;
};

/** Fixed card height matching home demo tiles. */
const CARD_HEIGHT = 112;

export function CategoryBrowseCard({ category, selected, onPress }: CategoryBrowseCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${category.title}. ${category.subtitle}`}
      className="rounded-3xl overflow-hidden border mb-3"
      style={{
        borderColor: selected ? appColors.glow.blue : appColors.surface.border,
        borderWidth: selected ? 2 : 1,
        height: CARD_HEIGHT,
        backgroundColor: appColors.category[category.tone],
      }}
    >
      {/* Full-bleed composite: left tone → smooth fade → right photo (no hard color split). */}
      <Image
        source={category.image}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          width: "100%",
          height: "100%",
        }}
      />

      <View className="flex-1 justify-center pl-5 pr-28 py-3">
        <Text className="text-white text-xl font-bold mb-1" style={{ letterSpacing: -0.3 }}>
          {category.title}
        </Text>
        <Text className="text-surface-soft text-sm leading-5" numberOfLines={2}>
          {category.subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
