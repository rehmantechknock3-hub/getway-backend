import { clerkMiddleware, createRouteMatcher, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { isAdminRole, roleFromSessionClaims } from "./lib/admin-role";
import { revokeIfSessionPastMaxAge } from "./lib/enforce-session-max-age";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/unauthorized",
]);

const isDashboardRoute = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  // No marketing home — send everyone to the admin dashboard entry.
  if (request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const session = await auth();

  if (session.sessionId) {
    try {
      const expired = await revokeIfSessionPastMaxAge(session.sessionId);
      if (expired) {
        if (isPublicRoute(request)) return NextResponse.next();
        return NextResponse.redirect(new URL("/sign-in", request.url));
      }
    } catch {
      // Clerk lookup failed — keep the existing JWT check below.
    }
  }

  if (isPublicRoute(request)) {
    return NextResponse.next();
  }

  if (!session.userId) {
    await auth.protect({
      unauthenticatedUrl: new URL("/sign-in", request.url).toString(),
    });
    return NextResponse.next();
  }

  // Dashboard: signed-in ADMIN only (customers/providers cannot open the console).
  if (isDashboardRoute(request)) {
    let role = roleFromSessionClaims(session.sessionClaims);
    if (!isAdminRole(role)) {
      try {
        const client = await clerkClient();
        const user = await client.users.getUser(session.userId);
        role =
          typeof user.publicMetadata?.role === "string"
            ? user.publicMetadata.role
            : undefined;
      } catch {
        role = undefined;
      }
    }

    if (!isAdminRole(role)) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
