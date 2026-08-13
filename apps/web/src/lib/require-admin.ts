import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { isAdminRole, roleFromSessionClaims } from "./admin-role";

/**
 * Ensures the current session is a signed-in ADMIN.
 * Falls back to Clerk user publicMetadata when the session token omits role.
 */
export async function requireAdmin(): Promise<{ userId: string; role: "ADMIN" }> {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    redirect("/sign-in");
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
