"use client";

import { useEffect } from "react";

import { useAuth } from "@clerk/nextjs";

import { setAuthToken, setAuthTokenResolver } from "@repo/api-client";

/**
 * Mounts once for the whole admin shell so Axios always has a fresh Clerk JWT
 * resolver while any dashboard route is open.
 */
export function AdminApiAuthBridge() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setAuthTokenResolver(null);
      setAuthToken(null);
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
    void safeGetToken().then((token) => {
      setAuthToken(token);
    });

    return () => {
      setAuthTokenResolver(null);
      setAuthToken(null);
    };
  }, [isLoaded, isSignedIn, getToken]);

  return null;
}
