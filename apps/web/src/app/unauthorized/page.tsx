"use client";

import Link from "next/link";

import { SignOutButton, useAuth } from "@clerk/nextjs";

export default function UnauthorizedPage() {
  const { isSignedIn } = useAuth();

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-mist px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-violet">
          Access denied
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
          Admin access required
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          This console is only available to signed-in administrators. Your account does not have
          the ADMIN role, or your session is not active.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {isSignedIn ? (
            <SignOutButton redirectUrl="/sign-in">
              <button
                type="button"
                className="rounded-xl bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-dark"
              >
                Sign out
              </button>
            </SignOutButton>
          ) : (
            <Link
              href="/sign-in"
              className="rounded-xl bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-dark"
            >
              Admin sign in
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
