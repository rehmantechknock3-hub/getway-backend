"use client";

import { useState } from "react";

import Link from "next/link";

import {
  useAdminProviders,
  useAdminUpdateProviderVerification,
} from "@repo/api-client";
import type { VerificationStatus } from "@repo/schemas";

import {
  EmptyState,
  PageHeader,
  Panel,
  StatusPill,
} from "../../../components/admin/ui";
import { useAdminApiReady } from "../../../lib/use-admin-api-ready";

const FILTERS: Array<{ label: string; value?: VerificationStatus }> = [
  { label: "All" },
  { label: "Pending", value: "PENDING" },
  { label: "Under review", value: "UNDER_REVIEW" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
];

function statusTone(
  status: VerificationStatus,
): "neutral" | "success" | "warning" | "danger" | "info" {
  switch (status) {
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "danger";
    case "UNDER_REVIEW":
      return "info";
    default:
      return "warning";
  }
}

export default function ProvidersPage() {
  const { ready } = useAdminApiReady();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<VerificationStatus | undefined>(undefined);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useAdminProviders(page, status, {
    enabled: ready,
  });
  const updateVerification = useAdminUpdateProviderVerification();

  const runAction = async (providerId: string, next: VerificationStatus) => {
    setActionError(null);
    setBusyId(providerId);
    try {
      await updateVerification.mutateAsync({
        providerId,
        input: { verificationStatus: next },
      });
      await refetch();
    } catch {
      setActionError("Could not update provider access. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Providers"
        description="Approve providers to make them visible to customers. Reject or suspend to revoke marketplace access."
        actions={
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-xl border border-brand-blue/20 bg-white/80 px-3.5 py-2 text-sm font-semibold text-brand-blue-dark hover:bg-white"
          >
            Refresh
          </button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = status === f.value;
          return (
            <button
              key={f.label}
              type="button"
              onClick={() => {
                setPage(1);
                setStatus(f.value);
              }}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? "bg-waynow-mark text-white shadow-glow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {actionError ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {actionError}
        </p>
      ) : null}

      <Panel title="Provider access queue" description="Admin-controlled verification gate">
        {!ready || isLoading ? (
          <EmptyState title="Loading providers…" description="Fetching verification queue." />
        ) : isError ? (
          <EmptyState
            title="Could not load providers"
            description={error instanceof Error ? error.message : "Check API + ADMIN role."}
          />
        ) : !data?.data.length ? (
          <EmptyState
            title="No providers in this filter"
            description="When providers finish onboarding they appear here as Pending."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-5 py-3 font-medium">Provider</th>
                    <th className="px-5 py-3 font-medium">Phone</th>
                    <th className="px-5 py-3 font-medium">Area</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Online</th>
                    <th className="px-5 py-3 font-medium">Joined</th>
                    <th className="px-5 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.data.map((p) => {
                    const busy = busyId === p.id;
                    return (
                      <tr key={p.id} className="text-slate-900 hover:bg-slate-50/80">
                        <td className="px-5 py-3">
                          <Link
                            href={`/dashboard/providers/${p.id}`}
                            className="group block"
                          >
                            <p className="font-medium text-brand-blue-dark group-hover:underline">
                              {p.firstName} {p.lastName}
                            </p>
                            <p className="text-xs text-slate-500">{p.email}</p>
                            <p className="mt-1 text-xs font-medium text-slate-400 group-hover:text-brand-blue-dark">
                              View full profile →
                            </p>
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{p.phone || "—"}</td>
                        <td className="px-5 py-3 text-slate-600">{p.serviceArea ?? "—"}</td>
                        <td className="px-5 py-3">
                          <StatusPill tone={statusTone(p.verificationStatus)}>
                            {p.verificationStatus}
                          </StatusPill>
                        </td>
                        <td className="px-5 py-3">
                          <StatusPill tone={p.isOnline ? "success" : "neutral"}>
                            {p.isOnline ? "Online" : "Offline"}
                          </StatusPill>
                        </td>
                        <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                          {new Date(p.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-2">
                            {p.verificationStatus !== "APPROVED" ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void runAction(p.id, "APPROVED")}
                                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                Approve
                              </button>
                            ) : null}
                            {p.verificationStatus !== "UNDER_REVIEW" ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void runAction(p.id, "UNDER_REVIEW")}
                                className="rounded-lg border border-brand-blue/30 bg-white px-2.5 py-1 text-xs font-semibold text-brand-blue-dark hover:bg-brand-mist disabled:opacity-50"
                              >
                                Review
                              </button>
                            ) : null}
                            {p.verificationStatus !== "REJECTED" ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void runAction(p.id, "REJECTED")}
                                className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                              >
                                {p.verificationStatus === "APPROVED" ? "Suspend" : "Reject"}
                              </button>
                            ) : null}
                            {p.verificationStatus === "REJECTED" ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void runAction(p.id, "PENDING")}
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                              >
                                Reopen
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-600">
              <span>
                Page {data.page} · {data.total} total
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1 font-medium hover:bg-slate-50 disabled:opacity-40"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1 font-medium hover:bg-slate-50 disabled:opacity-40"
                  disabled={page * data.limit >= data.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
