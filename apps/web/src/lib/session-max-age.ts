/** Admin session (Clerk "refresh" / client token) must die after 24 hours. */
export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Clerk timestamps are ms; some payloads still send Unix seconds. */
export function sessionCreatedAtMs(createdAt: Date | number): number {
  if (createdAt instanceof Date) return createdAt.getTime();
  return createdAt < 1e12 ? createdAt * 1000 : createdAt;
}

export function isSessionPastMaxAge(createdAt: Date | number, now = Date.now()): boolean {
  return now - sessionCreatedAtMs(createdAt) >= SESSION_MAX_AGE_MS;
}
