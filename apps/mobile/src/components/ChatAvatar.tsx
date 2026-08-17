import { useState } from "react";

import { Image, Text, View, type ImageSourcePropType } from "react-native";

type ChatAvatarSize = "sm" | "md" | "lg";

const BOX: Record<ChatAvatarSize, string> = {
  sm: "w-7 h-7",
  md: "w-9 h-9",
  lg: "w-11 h-11",
};

const LETTER: Record<ChatAvatarSize, string> = {
  sm: "text-xs font-bold text-primary-700",
  md: "text-sm font-bold text-primary-700",
  lg: "text-base font-bold text-primary-700",
};

const PX: Record<ChatAvatarSize, number> = {
  sm: 28,
  md: 36,
  lg: 44,
};

export const wayNowLogoSource: ImageSourcePropType = require("../../assets/logoWa.png");

export function chatInitial(name: string | undefined | null): string {
  const ch = name?.trim().charAt(0);
  return ch ? ch.toUpperCase() : "?";
}

/** Profile photo when present; otherwise the first letter of the name. */
export function ChatAvatar({
  uri,
  source,
  name,
  size = "md",
}: {
  uri?: string | null;
  source?: ImageSourcePropType;
  name: string;
  size?: ChatAvatarSize;
}) {
  const [failed, setFailed] = useState(false);
  const imageSource = source ?? (uri && !failed ? { uri } : undefined);
  const px = PX[size];

  return (
    <View
      className={`${BOX[size]} rounded-full bg-primary-100 items-center justify-center overflow-hidden`}
    >
      {imageSource ? (
        <Image
          source={imageSource}
          style={{ width: px, height: px }}
          resizeMode="cover"
          onError={() => {
            if (!source) setFailed(true);
          }}
          accessibilityLabel={`${name} profile photo`}
        />
      ) : (
        <Text className={LETTER[size]}>{chatInitial(name)}</Text>
      )}
    </View>
  );
}
