"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@clerk/nextjs";

import { setAuthToken, setAuthTokenResolver } from "@repo/api-client";

/**
 * Keeps the shared Axios client authenticated for admin dashboard queries.
 *
 * Clerk session JWTs expire in ~60s. A one-shot `setAuthToken` goes stale when
 * switching tabs/screens or after refetch-on-focus — so we also register a
 * per-request resolver (same pattern as mobile `_layout.tsx`).
 */
export function useAdminApiReady() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [tokenReady, setTokenReady] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setAuthTokenResolver(null);
      setAuthToken(null);
      setTokenReady(true);
      return;
    }

    const safeGetToken = async (): Promise<string | null> => {
      try {
        return await Promise.race([
          getToken({ skipCache: true }),
          new Promise<null>((resolve) => {
            setTimeout(() => resolve(null), 5000);
          }),
        ]);
      } catch {
        return null;
      }
    };

    setAuthTokenResolver(safeGetToken);

    let cancelled = false;
    void safeGetToken().then((token) => {
      if (cancelled) return;
      setAuthToken(token);
      setTokenReady(true);
    });

    return () => {
      cancelled = true;
      // Keep the resolver while navigating between dashboard pages; clear only on
      // sign-out / leaving signed-in state (handled above and in AdminShell).
    };
  }, [isLoaded, isSignedIn, getToken]);

  return {
    isLoaded,
    isSignedIn: Boolean(isSignedIn),
    ready: isLoaded && Boolean(isSignedIn) && tokenReady,
  };
}
