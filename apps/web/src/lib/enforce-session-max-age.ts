import { clerkClient } from "@clerk/nextjs/server";

import { isSessionPastMaxAge, sessionCreatedAtMs } from "./session-max-age";

const createdAtBySessionId = new Map<string, number>();

/**
 * Revokes a Clerk session that is older than 24 hours.
 * @returns true when the user must sign in again
 */
export async function revokeIfSessionPastMaxAge(sessionId: string): Promise<boolean> {
  const cached = createdAtBySessionId.get(sessionId);
  if (cached !== undefined && !isSessionPastMaxAge(cached)) return false;

  const client = await clerkClient();

  if (cached !== undefined) {
    createdAtBySessionId.delete(sessionId);
    await client.sessions.revokeSession(sessionId);
    return true;
  }

  const clerkSession = await client.sessions.getSession(sessionId);
  const createdAt = sessionCreatedAtMs(clerkSession.createdAt);
  createdAtBySessionId.set(sessionId, createdAt);

  const inactive = clerkSession.status !== "active";
  if (!inactive && !isSessionPastMaxAge(createdAt)) return false;

  createdAtBySessionId.delete(sessionId);
  if (!inactive) {
    await client.sessions.revokeSession(sessionId);
  }
  return true;
}
