"use client";

import { useEffect } from "react";

import { useClerk, useSession } from "@clerk/nextjs";

import { setAuthToken, setAuthTokenResolver } from "@repo/api-client";
import { safeClerkCall } from "@repo/utils";

import {
  isSessionPastMaxAge,
  SESSION_MAX_AGE_MS,
  sessionCreatedAtMs,
} from "../lib/session-max-age";

/**
 * Ends the Clerk session when it hits 24 hours, including a tab left open.
 */
export function SessionMaxAgeGuard() {
  const { session } = useSession();
  const { signOut } = useClerk();

  useEffect(() => {
    if (!session) return;

    const signOutExpired = () => {
      setAuthTokenResolver(null);
      setAuthToken(null);
      void safeClerkCall(() => signOut({ redirectUrl: "/sign-in" }));
    };

    if (isSessionPastMaxAge(session.createdAt)) {
      signOutExpired();
      return;
    }

    const remaining =
      sessionCreatedAtMs(session.createdAt) + SESSION_MAX_AGE_MS - Date.now();
    const timer = window.setTimeout(signOutExpired, remaining);
    return () => window.clearTimeout(timer);
  }, [session, signOut]);

  return null;
}
