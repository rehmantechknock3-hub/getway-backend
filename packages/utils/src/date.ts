/**
 * Format a date for display in booking cards.
 * @example formatBookingDate(new Date()) // "Mon, Jan 6 at 2:30 PM"
 */
export function formatBookingDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month:   "short",
    day:     "numeric",
    hour:    "2-digit",
    minute:  "2-digit",
  });
}

/**
 * Returns a human-readable relative time string.
 * @example timeAgo(new Date(Date.now() - 60000)) // "1 minute ago"
 */
export function timeAgo(date: Date | string): string {
  const d    = typeof date === "string" ? new Date(date) : date;
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);

  if (secs < 60)   return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)} minute${Math.floor(secs / 60) !== 1 ? "s" : ""} ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)} hour${Math.floor(secs / 3600) !== 1 ? "s" : ""} ago`;
  return `${Math.floor(secs / 86400)} day${Math.floor(secs / 86400) !== 1 ? "s" : ""} ago`;
}
