"use client";

import Link from "next/link";

import { useAdminStats } from "@repo/api-client";

import {
  EmptyState,
  PageHeader,
  Panel,
  StatCard,
  StatusPill,
} from "../../components/admin/ui";
import { useAdminApiReady } from "../../lib/use-admin-api-ready";

export default function DashboardOverviewPage() {
  const { ready } = useAdminApiReady();
  const { data, isLoading, isError, error, refetch } = useAdminStats({ enabled: ready });

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-white/70 bg-gradient-to-br from-brand-night via-[#121830] to-brand-night p-6 text-white shadow-glow sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-brand-violet/40 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-brand-cyan/30 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-cyan/90">
              Every service. One app.
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Welcome back to{" "}
              <span className="text-waynow-gradient">WayNow</span>
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/65">
              Your marketplace pulse — approvals, live jobs, and revenue signals in one vivid console.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            Refresh data
          </button>
        </div>
      </div>

      <PageHeader
        title="Command center"
        description="Live snapshot of customers, providers, bookings, and revenue across the platform."
      />

      {!ready || isLoading ? (
        <Panel>
          <EmptyState
            title="Loading platform stats…"
            description="Pulling live counts from the local API."
          />
        </Panel>
      ) : isError ? (
        <Panel>
          <EmptyState
            title="Could not load overview"
            description={
              error instanceof Error
                ? error.message
                : "Check that the API is running on port 3010 and your account has ADMIN role."
            }
          />
        </Panel>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              accent={0}
              label="Users"
              value={data.users.total}
              hint={`${data.users.customers} customers · ${data.users.providers} providers`}
              href="/dashboard/users"
            />
            <StatCard
              accent={1}
              label="Providers"
              value={data.providers.total}
              hint={`${data.providers.pending} pending · ${data.providers.online} online`}
              href="/dashboard/providers"
            />
            <StatCard
              accent={2}
              label="Bookings"
              value={data.bookings.total}
              hint={`${data.bookings.pending} pending · ${data.bookings.completed} completed`}
              href="/dashboard/bookings"
            />
            <StatCard
              accent={3}
              label="Services"
              value={data.services.total}
              hint={`${data.payments.succeeded} successful payments`}
              href="/dashboard/services"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="Needs attention"
              description="Items that typically need an admin decision."
            >
              <div className="space-y-3 px-5 py-5">
                <AttentionRow
                  label="Provider applications"
                  value={data.providers.pending + data.providers.underReview}
                  href="/dashboard/providers"
                  tone={data.providers.pending > 0 ? "warning" : "success"}
                />
                <AttentionRow
                  label="Open bookings"
                  value={
                    data.bookings.pending +
                    data.bookings.accepted +
                    data.bookings.inProgress
                  }
                  href="/dashboard/bookings"
                  tone="info"
                />
                <AttentionRow
                  label="Payment volume (succeeded)"
                  value={`$${(data.payments.volumeCentsApprox / 100).toFixed(2)}`}
                  href="/dashboard/payments"
                  tone="neutral"
                />
              </div>
            </Panel>

            <Panel
              title="Control center"
              description="Jump into the core admin surfaces."
            >
              <div className="grid gap-3 px-5 py-5 sm:grid-cols-2">
                {[
                  {
                    href: "/dashboard/users",
                    title: "Users",
                    body: "View, filter, suspend accounts",
                  },
                  {
                    href: "/dashboard/providers",
                    title: "Providers",
                    body: "Approve / reject / suspend",
                  },
                  {
                    href: "/dashboard/bookings",
                    title: "Bookings",
                    body: "Monitor every job status",
                  },
                  {
                    href: "/dashboard/payments",
                    title: "Revenue",
                    body: "Commission, payouts, reports",
                  },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-xl border border-brand-violet/10 bg-gradient-to-br from-white to-brand-mist px-4 py-4 transition hover:-translate-y-0.5 hover:border-brand-blue/25 hover:shadow-glow-sm"
                  >
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{item.body}</p>
                  </Link>
                ))}
              </div>
            </Panel>
          </div>
        </>
      ) : null}
    </div>
  );
}

function AttentionRow({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: string | number;
  href: string;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl border border-slate-100 bg-white/70 px-4 py-3 transition hover:border-brand-violet/25 hover:bg-gradient-to-r hover:from-brand-violet/5 hover:to-brand-cyan/5"
    >
      <p className="text-sm font-medium text-slate-800">{label}</p>
      <StatusPill tone={tone}>{value}</StatusPill>
    </Link>
  );
}
