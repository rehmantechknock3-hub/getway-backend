import React from "react";
import { Pressable, Text, ActivityIndicator } from "react-native";
import type { PressableProps } from "react-native";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type Size    = "sm" | "md" | "lg";

type ButtonProps = PressableProps & {
  variant?:   Variant;
  size?:      Size;
  label:      string;
  isLoading?: boolean;
  fullWidth?: boolean;
};

const variantClasses: Record<Variant, string> = {
  primary:     "bg-primary-600 active:bg-primary-700",
  secondary:   "bg-secondary-600 active:bg-secondary-700",
  outline:     "border border-primary-600 bg-transparent",
  ghost:       "bg-transparent",
  destructive: "bg-red-600 active:bg-red-700",
};

const textClasses: Record<Variant, string> = {
  primary:     "text-white font-semibold",
  secondary:   "text-white font-semibold",
  outline:     "text-primary-600 font-semibold",
  ghost:       "text-primary-600 font-semibold",
  destructive: "text-white font-semibold",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-2 rounded-lg",
  md: "px-4 py-3 rounded-xl",
  lg: "px-6 py-4 rounded-2xl",
};

const textSizeClasses: Record<Size, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

export function Button({
  variant   = "primary",
  size      = "md",
  label,
  isLoading = false,
  fullWidth = false,
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <Pressable
      className={[
        "flex-row items-center justify-center",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth  ? "w-full"   : "self-start",
        isDisabled ? "opacity-50" : "",
      ].join(" ")}
      disabled={isDisabled}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={variant === "outline" || variant === "ghost" ? "#2563eb" : "#ffffff"}
        />
      ) : (
        <Text className={[textClasses[variant], textSizeClasses[size]].join(" ")}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
