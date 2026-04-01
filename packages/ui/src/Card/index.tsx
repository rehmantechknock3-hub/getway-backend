import React from "react";
import { View } from "react-native";
import type { ViewProps } from "react-native";

type CardProps = ViewProps & {
  children: React.ReactNode;
  padding?:  "none" | "sm" | "md" | "lg";
};

const paddingClasses = {
  none: "",
  sm:   "p-3",
  md:   "p-4",
  lg:   "p-6",
};

export function Card({ children, padding = "md", className = "", ...props }: CardProps) {
  return (
    <View
      className={[
        "bg-white rounded-2xl shadow-sm border border-gray-100",
        paddingClasses[padding],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </View>
  );
}
