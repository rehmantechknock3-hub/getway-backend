import axios from "axios";

/**
 * Axios instance shared across all query/mutation functions.
 * The Authorization header is injected per-request by calling
 * `setAuthToken(token)` after Clerk resolves the session.
 */
export const apiClient = axios.create({
  baseURL: process.env["EXPO_PUBLIC_API_URL"] ??
           process.env["NEXT_PUBLIC_API_URL"] ??
           "http://localhost:3001",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15_000,
});

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
