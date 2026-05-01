/**
 * Centralized error reporting utility.
 *
 * - **Production**: forwards to Sentry (if available) with structured context.
 * - **Development**: prints structured logs to console for easy scanning.
 *
 * This module is dependency-agnostic — it detects Sentry at runtime via the
 * global `__SENTRY__` object rather than hard-importing `@sentry/*`. This means
 * it works in every package without adding Sentry as a dependency everywhere.
 *
 * @see BEST_PRACTICES.md §11
 */

// React Native injects `__DEV__` as a global boolean at build time.
declare const __DEV__: boolean | undefined;

export type ErrorContext = {
  /** Screen or component name (e.g. "SignInScreen", "BookingCard"). */
  screen?: string;
  /** Action that triggered the error (e.g. "submitBooking", "signIn"). */
  action?: string;
  /** Arbitrary extra data to attach (requestId, entityId, etc.). */
  extra?: Record<string, unknown>;
};

type SentryLike = {
  captureException: (error: unknown, context?: unknown) => void;
  addBreadcrumb: (breadcrumb: unknown) => void;
};

/** Best-effort Sentry reference — returns null when Sentry is not initialised. */
function getSentry(): SentryLike | null {
  try {
    const g = globalThis as Record<string, unknown>;
    if (g["__SENTRY__"] && typeof g["__SENTRY__"] === "object") {
      const hub = g["__SENTRY__"] as Record<string, unknown>;
      if (typeof hub["captureException"] === "function") {
        return hub as unknown as SentryLike;
      }
    }

    // Sentry/react-native and Sentry/browser both attach to globalThis.__SENTRY__;
    // however some setups expose it differently. Also check for a pre-registered ref.
    if (g["Sentry"] && typeof g["Sentry"] === "object") {
      const s = g["Sentry"] as Record<string, unknown>;
      if (typeof s["captureException"] === "function") {
        return s as unknown as SentryLike;
      }
    }

  } catch {
    // Running in an environment where globalThis access throws — silently skip.
  }
  return null;
}

const IS_DEV =
  typeof __DEV__ !== "undefined"
    ? __DEV__
    : process.env["NODE_ENV"] !== "production";

/**
 * Report an error to the observability stack.
 *
 * - Production: Sentry.captureException with screen/action context.
 * - Development: structured console output.
 *
 * Safe to call from anywhere — never throws.
 */
export function reportError(error: unknown, ctx: ErrorContext = {}): void {
  const message =
    error instanceof Error ? error.message : String(error ?? "Unknown error");
  const stack = error instanceof Error ? error.stack : undefined;
  const status =
    typeof ctx.extra?.["status"] === "number"
      ? (ctx.extra["status"] as number)
      : undefined;
  const isExpectedAuthError = ctx.action === "apiRequest" && status === 401;

  // ── Development: structured console output ──────────────────────────────
  if (IS_DEV) {
    const level = isExpectedAuthError ? "WARN" : "ERROR";
    const tag = [ctx.screen, ctx.action].filter(Boolean).join("] [");
    const prefix = tag ? `[${level}] [${tag}]` : `[${level}]`;
    const payload = {
      ...(ctx.extra ?? {}),
      ...(stack ? { stack } : {}),
    };
    if (isExpectedAuthError) {
      // eslint-disable-next-line no-console
      console.warn(`${prefix} -> ${message}`, payload);
    } else {
      // eslint-disable-next-line no-console
      console.error(`${prefix} -> ${message}`, payload);
    }
    return;
  }

  // ── Production: forward to Sentry ───────────────────────────────────────
  const sentry = getSentry();
  if (sentry) {
    sentry.captureException(error, {
      tags: {
        ...(ctx.screen ? { screen: ctx.screen } : {}),
        ...(ctx.action ? { action: ctx.action } : {}),
      },
      extra: ctx.extra,
    });
  }
}

/**
 * Add a breadcrumb to the observability stack.
 *
 * - Production: Sentry.addBreadcrumb.
 * - Development: no-op (breadcrumbs are noise in dev console).
 */
export function addBreadcrumb(breadcrumb: {
  category: string;
  message: string;
  data?: Record<string, unknown>;
  level?: "info" | "warning" | "error";
}): void {
  if (IS_DEV) return;

  const sentry = getSentry();
  if (sentry) {
    sentry.addBreadcrumb(breadcrumb);
  }
}
