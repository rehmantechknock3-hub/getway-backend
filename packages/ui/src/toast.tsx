import { Platform } from "react-native";

/**
 * Shared toast abstraction.
 *
 * - **Native** (iOS / Android): delegates to `react-native-toast-message`.
 * - **Web**: delegates to `sonner`.
 *
 * Both libraries must be installed in their respective apps. This module only
 * provides the unified API so the call-site never cares which library is used
 * and swapping either library later requires a single-file change.
 *
 * @see BEST_PRACTICES.md §11 (Toast vs Alert)
 */

export type ToastType = "success" | "error" | "info";

/**
 * Show a toast notification.
 *
 * @example
 * showToast("success", "Booking confirmed");
 * showToast("error", "Could not load services", "Pull to retry.");
 */
export function showToast(
  type: ToastType,
  message: string,
  description?: string,
): void {
  if (Platform.OS === "web") {
    showWebToast(type, message, description);
  } else {
    showNativeToast(type, message, description);
  }
}

// ── Native (react-native-toast-message) ───────────────────────────────────

const NATIVE_TYPE_MAP: Record<ToastType, string> = {
  success: "success",
  error: "error",
  info: "info",
};

function showNativeToast(
  type: ToastType,
  message: string,
  description?: string,
): void {
  try {
    // Dynamic require so the web bundle never sees this import.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Toast = require("react-native-toast-message").default;
    Toast.show({
      type: NATIVE_TYPE_MAP[type],
      text1: message,
      ...(description ? { text2: description } : {}),
      visibilityTime: type === "error" ? 4000 : 3000,
    });
  } catch {
    // Library not installed yet — fall back silently in dev.
  }
}

// ── Web (sonner) ──────────────────────────────────────────────────────────

function showWebToast(
  type: ToastType,
  message: string,
  description?: string,
): void {
  try {
    // Dynamic require so the native bundle never sees this import.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { toast } = require("sonner");
    const opts = description ? { description } : undefined;

    switch (type) {
      case "success":
        toast.success(message, opts);
        break;
      case "error":
        toast.error(message, opts);
        break;
      case "info":
        toast.info(message, opts);
        break;
    }
  } catch {
    // Library not installed yet — fall back silently in dev.
  }
}
