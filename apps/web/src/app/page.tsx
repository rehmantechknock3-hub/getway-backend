import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";

export default async function LandingPage() {
  const { userId } = await auth();

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-gray-800">
        <span className="text-xl font-bold tracking-tight">Marketplace</span>
        {userId ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">Signed in</span>
            <UserButton afterSignOutUrl="/" />
          </div>
        ) : (
          <Link
            href="/sign-in"
            className="px-4 py-2 bg-white text-gray-950 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors"
          >
            Admin Sign In
          </Link>
        )}
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-800 rounded-full text-xs text-gray-400 border border-gray-700">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Platform running
        </div>

        <h1 className="text-5xl font-bold tracking-tight max-w-xl leading-tight">
          Service Marketplace
          <span className="text-gray-400"> Admin</span>
        </h1>

        <p className="text-gray-400 max-w-md text-lg">
          Manage bookings, providers, services, and payments from one place.
        </p>

        <div className="flex gap-3 mt-2">
          <Link
            href={userId ? "/dashboard/bookings" : "/sign-in"}
            className="px-6 py-3 bg-white text-gray-950 font-medium rounded-lg hover:bg-gray-100 transition-colors"
          >
            {userId ? "Go to Dashboard" : "Sign In"}
          </Link>
          <a
            href="http://localhost:3001/api/v1"
            target="_blank"
            rel="noreferrer"
            className="px-6 py-3 bg-gray-800 text-gray-300 font-medium rounded-lg hover:bg-gray-700 transition-colors border border-gray-700"
          >
            API Status
          </a>
        </div>
      </div>

      {/* Footer */}
      <footer className="px-8 py-5 border-t border-gray-800 text-center text-xs text-gray-600">
        Marketplace Platform · M1 Foundation
      </footer>
    </main>
  );
}
