/**
 * Native toast — react-native-toast-message.
 * Metro resolves this file as `toast.native.tsx` instead of `toast.tsx`.
 *
 * @see BEST_PRACTICES.md §11
 */

import Toast from "react-native-toast-message";

import type { ToastType } from "./toast-types";

export type { ToastType };

const NATIVE_TYPE_MAP: Record<ToastType, string> = {
  success: "success",
  error: "error",
  info: "info",
};

export function showToast(
  type: ToastType,
  message: string,
  description?: string,
): void {
  Toast.show({
    type: NATIVE_TYPE_MAP[type],
    text1: message,
    ...(description ? { text2: description } : {}),
    visibilityTime: type === "error" ? 4000 : 3000,
  });
}
