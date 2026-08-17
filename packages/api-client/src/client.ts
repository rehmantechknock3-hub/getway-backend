import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";

import { addBreadcrumb, randomUUID, reportError } from "@repo/utils";

/** When set (Expo), every request awaits a fresh Clerk session JWT so calls never race stale `defaults.headers`. */
type AuthTokenResolver = () => Promise<string | null>;

let authTokenResolver: AuthTokenResolver | null = null;

export function setAuthTokenResolver(resolver: AuthTokenResolver | null): void {
  authTokenResolver = resolver;
}

const defaultBaseUrl =
  process.env["EXPO_PUBLIC_API_URL"] ??
  process.env["NEXT_PUBLIC_API_URL"] ??
  "http://127.0.0.1:3010";

/**
 * Axios instance shared across all query/mutation functions.
 * The Authorization header is injected per-request by calling
 * `setAuthToken(token)` after Clerk resolves the session.
 *
 * In monorepos, `EXPO_PUBLIC_*` may not be inlined inside this package when Metro
 * bundles it — call `setApiBaseUrl()` once from the Expo app entry (see mobile `_layout.tsx`).
 */
export const apiClient = axios.create({
  baseURL: defaultBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15_000,
});

/** Re-apply API origin from the Expo app so env vars loaded there always win. */
export function setApiBaseUrl(url: string): void {
  const trimmed = url
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\/$/, "");
  if (trimmed.length > 0) {
    apiClient.defaults.baseURL = trimmed;
  }
}

export function getApiBaseUrl(): string {
  const b = apiClient.defaults.baseURL;
  return typeof b === "string" ? b : "";
}

/** Call this once after Clerk resolves the token. */
export function setAuthToken(token: string | null): void {
  if (token) {
    apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common["Authorization"];
  }
}

// ── Request interceptor: optional fresh Clerk token + Request-ID ────────────

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  // Always refresh when a resolver is registered. Axios merges `defaults.headers`
  // onto `config.headers` before this runs, so a stale `Authorization` from
  // `setAuthToken()` would otherwise skip the resolver and 401 after ~60s.
  if (authTokenResolver) {
    try {
      const token = await authTokenResolver();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Keep any existing Authorization header if Clerk is briefly unavailable.
    }
  }

  // React Native FormData uploads break if Axios keeps the default `application/json`
  // Content-Type (often surfaces as a generic "Network Error" with no HTTP response).
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    const headers = config.headers;
    if (typeof headers.set === "function") {
      // `false` tells Axios to omit Content-Type so the runtime can set multipart boundaries.
      headers.set("Content-Type", false as unknown as string);
    } else {
      delete (headers as Record<string, unknown>)["Content-Type"];
      delete (headers as Record<string, unknown>)["content-type"];
    }
  }

  config.headers["X-Request-ID"] = randomUUID();
  return config;
});

// ── Response interceptor ──────────────────────────────────────────────────
// Records Sentry breadcrumbs on every response (success and failure) so
// production issues carry a full API call timeline.

apiClient.interceptors.response.use(
  (response) => {
    addBreadcrumb({
      category: "api",
      message: `${response.config.method?.toUpperCase()} ${response.config.url}`,
      data: {
        requestId: response.headers["x-request-id"] as string | undefined,
        status: response.status,
      },
      level: "info",
    });
    return response;
  },
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const requestId =
        (error.config?.headers?.["X-Request-ID"] as string | undefined) ??
        undefined;
      reportError(error, {
        action: "apiRequest",
        extra: {
          requestId,
          url: error.config?.url,
          method: error.config?.method?.toUpperCase(),
          status: error.response?.status,
        },
      });
      addBreadcrumb({
        category: "api",
        message: `${error.config?.method?.toUpperCase()} ${error.config?.url} FAILED`,
        data: { requestId, status: error.response?.status },
        level: "error",
      });
    }
    return Promise.reject(error);
  },
);

/** Standard API error shape from the NestJS backend. */
export type ApiError = {
  message:    string;
  statusCode: number;
  error?:     string;
};
