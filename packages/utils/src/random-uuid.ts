/**
 * Cross-platform UUID v4 generator.
 *
 * Uses `crypto.randomUUID()` when available (Node, modern browsers).
 * Falls back to a Math.random-based v4 UUID for React Native environments
 * where the Web Crypto API may not be fully polyfilled.
 */
export function randomUUID(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  // RFC 4122 v4 UUID fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
