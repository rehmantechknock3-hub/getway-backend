"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AdminAccountBox } from "./admin-account-box";
import { AdminSignOutButton } from "./admin-sign-out-button";

const NAV = [
  { href: "/dashboard", label: "Overview", exact: true, icon: "◈" },
  { href: "/dashboard/bookings", label: "Bookings", icon: "◎" },
  { href: "/dashboard/users", label: "Users", icon: "◉" },
  { href: "/dashboard/providers", label: "Providers", icon: "◇" },
  { href: "/dashboard/services", label: "Services", icon: "⬡" },
  { href: "/dashboard/payments", label: "Payments", icon: "✦" },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activeLabel =
    NAV.find((item) =>
      item.exact
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(`${item.href}/`),
    )?.label ?? "Dashboard";

  return (
    <div className="flex min-h-screen bg-brand-mist">
      <aside className="relative sticky top-0 z-20 flex h-screen w-[280px] shrink-0 flex-col overflow-hidden bg-brand-night text-white shadow-xl shadow-brand-night/40">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-violet/20 via-transparent to-brand-blue/20" />
        <div className="pointer-events-none absolute -left-16 top-10 h-40 w-40 rounded-full bg-brand-violet/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 bottom-24 h-44 w-44 rounded-full bg-brand-blue/25 blur-3xl" />

        <Link
          href="/dashboard"
          className="relative z-10 mx-4 mt-4 flex items-center gap-3 rounded-2xl border border-brand-night-border bg-brand-night-elevated/80 px-3 py-3 transition hover:bg-brand-night-elevated"
        >
          <div className="relative h-12 w-12 overflow-hidden rounded-xl ring-1 ring-white/25">
            <Image
              src="/logoWa.png"
              alt="WayNow"
              fill
              sizes="48px"
              className="object-cover"
              priority
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold tracking-tight text-white">
              Way<span className="text-brand-cyan">Now</span>
            </p>
            <p className="truncate text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
              Admin Console
            </p>
          </div>
        </Link>

        <div className="relative z-10 px-5 pt-7 pb-2">
          <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Command
          </p>
        </div>

        <nav className="relative z-10 flex-1 space-y-1.5 px-3 pb-4">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-brand-blue text-white shadow-lg shadow-brand-blue/30"
                    : "text-slate-300 hover:bg-brand-night-elevated hover:text-white"
                }`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-brand-night-elevated text-brand-cyan group-hover:bg-brand-night-border"
                  }`}
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="relative z-10 space-y-3 border-t border-brand-night-border p-4">
          <AdminAccountBox />
          <AdminSignOutButton variant="sidebar" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-violet">
                WayNow Platform
              </p>
              <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-slate-900">
                {activeLabel}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-brand-blue/20 bg-white px-3.5 py-1.5 sm:flex">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-semibold text-slate-700">Admin online</span>
              </div>
            </div>
          </div>
        </header>

        <main className="relative flex-1 overflow-auto">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-brand-violet/10 to-transparent" />
          <div className="relative mx-auto max-w-7xl px-6 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
