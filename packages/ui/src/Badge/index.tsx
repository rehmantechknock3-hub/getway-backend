import React from "react";
import { View, Text } from "react-native";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info";

type BadgeProps = {
  label:    string;
  variant?: BadgeVariant;
};

const variantClasses: Record<BadgeVariant, { bg: string; text: string }> = {
  default: { bg: "bg-gray-100",   text: "text-gray-700"  },
  success: { bg: "bg-green-100",  text: "text-green-700" },
  warning: { bg: "bg-yellow-100", text: "text-yellow-700" },
  error:   { bg: "bg-red-100",    text: "text-red-700"   },
  info:    { bg: "bg-blue-100",   text: "text-blue-700"  },
};

export function Badge({ label, variant = "default" }: BadgeProps) {
  const { bg, text } = variantClasses[variant];
  return (
    <View className={`${bg} px-2 py-0.5 rounded-full self-start`}>
      <Text className={`${text} text-xs font-medium`}>{label}</Text>
    </View>
  );
}
