import axios from "axios";

const defaultBaseUrl =
  process.env["EXPO_PUBLIC_API_URL"] ??
  process.env["NEXT_PUBLIC_API_URL"] ??
  "http://localhost:3001";

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
  const trimmed = url.trim().replace(/\/$/, "");
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

/** Standard API error shape from the NestJS backend. */
export type ApiError = {
  message:    string;
  statusCode: number;
  error?:     string;
};
