"use client";

import { useState } from "react";

import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

import { setAuthToken, setAuthTokenResolver } from "@repo/api-client";
import { safeClerkCall } from "@repo/utils";

type AdminSignOutButtonProps = {
  variant?: "sidebar" | "header";
};

/**
 * Ends the Clerk session, clears the shared API JWT, and sends the user to sign-in.
 */
export function AdminSignOutButton({ variant = "sidebar" }: AdminSignOutButtonProps) {
  const { signOut } = useClerk();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSignOut = async () => {
    setError(null);
    setBusy(true);
    try {
      setAuthTokenResolver(null);
      setAuthToken(null);
      const result = await safeClerkCall(() =>
        signOut({ redirectUrl: "/sign-in" }),
      );
      if (
        result &&
        typeof result === "object" &&
        "error" in result &&
        result.error
      ) {
        setError("Could not sign out. Try again.");
        return;
      }
      router.replace("/sign-in");
      router.refresh();
    } catch {
      setError("Could not sign out. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (variant === "header") {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onSignOut()}
          className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
        >
          {busy ? "Signing out…" : "Sign out"}
        </button>
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => void onSignOut()}
        className="flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500/90 hover:border-rose-400/40 disabled:opacity-50"
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
      {error ? <p className="text-center text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
