/**
 * Web toast — sonner only. Do not import react-native here; Next/webpack
 * cannot parse RN Flow (`import typeof`) or RN Toast JSX.
 *
 * @see BEST_PRACTICES.md §11
 */

import type { ToastType } from "./toast-types";

export type { ToastType };

export function showToast(
  type: ToastType,
  message: string,
  description?: string,
): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { toast } = require("sonner") as typeof import("sonner");
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
    // sonner not installed in this bundle
  }
}
