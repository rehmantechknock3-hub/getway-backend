import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { isAdminRole, roleFromSessionClaims } from "./admin-role";
import { revokeIfSessionPastMaxAge } from "./enforce-session-max-age";

/**
 * Ensures the current session is a signed-in ADMIN.
 * Falls back to Clerk user publicMetadata when the session token omits role.
 */
export async function requireAdmin(): Promise<{ userId: string; role: "ADMIN" }> {
  const { userId, sessionId, sessionClaims } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  if (sessionId) {
    try {
      if (await revokeIfSessionPastMaxAge(sessionId)) {
        redirect("/sign-in");
      }
    } catch {
      // Clerk lookup failed — role check below still runs.
    }
  }

  let role = roleFromSessionClaims(sessionClaims);
  if (!isAdminRole(role)) {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    role = typeof user.publicMetadata?.role === "string" ? user.publicMetadata.role : undefined;
  }

  if (!isAdminRole(role)) {
    redirect("/unauthorized");
  }

  return { userId, role };
}
