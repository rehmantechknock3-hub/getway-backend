/**
 * Shared toast abstraction.
 *
 * - **Native** (iOS / Android): delegates to `react-native-toast-message`.
 * - **Web**: delegates to `sonner`.
 *
 * Do not statically import `react-native` here — Next.js/SWC cannot parse RN's
 * Flow `import typeof` syntax and will fail the web build.
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
  if (isReactNativeRuntime()) {
    showNativeToast(type, message, description);
  } else {
    showWebToast(type, message, description);
  }
}

/** Hermes / RN sets `navigator.product`; Next and browsers do not. */
function isReactNativeRuntime(): boolean {
  return (
    typeof navigator !== "undefined" &&
    // React Native sets this; browsers and Next.js do not.
    (navigator as Navigator & { product?: string }).product === "ReactNative"
  );
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
