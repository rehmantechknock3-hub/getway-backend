import Image from "next/image";

import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-night px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,246,0.25),transparent_40%),radial-gradient(circle_at_75%_70%,rgba(45,91,255,0.2),transparent_35%)]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="relative mb-4 h-16 w-16 overflow-hidden rounded-2xl ring-1 ring-white/15">
            <Image
              src="/logoWa.png"
              alt="WayNow"
              fill
              sizes="64px"
              className="object-cover"
              priority
            />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">WayNow Admin</h1>
          <p className="mt-2 text-sm text-white/55">Sign in to manage the marketplace</p>
        </div>

        <SignIn
          forceRedirectUrl="/dashboard"
          fallbackRedirectUrl="/dashboard"
          appearance={{
            layout: {
              socialButtonsPlacement: "bottom",
            },
            elements: {
              rootBox: "mx-auto",
              card: "shadow-2xl shadow-black/40",
              socialButtons: "hidden",
              socialButtonsBlockButton: "hidden",
              socialButtonsProviderIcon: "hidden",
              dividerRow: "hidden",
              dividerText: "hidden",
            },
          }}
        />
      </div>
    </div>
  );
}
