"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@clerk/nextjs";

import { setAuthToken } from "@repo/api-client";

/** Ensures the shared API client has a Clerk JWT before admin queries run. */
export function useAdminApiReady() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [tokenReady, setTokenReady] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setAuthToken(null);
      setTokenReady(true);
      return;
    }
    let cancelled = false;
    void getToken()
      .then((token) => {
        if (cancelled) return;
        setAuthToken(token);
        setTokenReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setAuthToken(null);
        setTokenReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  return {
    isLoaded,
    isSignedIn: Boolean(isSignedIn),
    ready: isLoaded && Boolean(isSignedIn) && tokenReady,
  };
}
