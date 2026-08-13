"use client";

import { useState, type ReactNode } from "react";

import Link from "next/link";
import { useParams } from "next/navigation";

import {
  useAdminProvider,
  useAdminUpdateProviderVerification,
} from "@repo/api-client";
import type { VerificationStatus } from "@repo/schemas";

import {
  EmptyState,
  PageHeader,
  Panel,
  StatusPill,
} from "../../../../components/admin/ui";
import { useAdminApiReady } from "../../../../lib/use-admin-api-ready";

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

function bookingStatusTone(
  status: string,
): "neutral" | "success" | "warning" | "danger" | "info" {
  switch (status) {
    case "COMPLETED":
      return "success";
    case "PENDING":
      return "warning";
    case "REJECTED":
    case "CANCELLED":
      return "danger";
    case "IN_PROGRESS":
    case "ACCEPTED":
      return "info";
    default:
      return "neutral";
  }
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="text-sm text-slate-900">{value ?? "—"}</dd>
    </div>
  );
}

export default function ProviderDetailPage() {
  const params = useParams<{ id: string }>();
  const providerId = params.id ?? "";
  const { ready } = useAdminApiReady();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useAdminProvider(providerId, {
    enabled: ready && Boolean(providerId),
  });
  const updateVerification = useAdminUpdateProviderVerification();

  const runAction = async (next: VerificationStatus) => {
    setActionError(null);
    setBusy(true);
    try {
      await updateVerification.mutateAsync({
        providerId,
        input: { verificationStatus: next },
      });
      await refetch();
    } catch {
      setActionError("Could not update provider access. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const name = data ? `${data.firstName} ${data.lastName}`.trim() : "Provider";

  return (
    <div className="space-y-6">
      <PageHeader
        title={isLoading || !data ? "Provider details" : name}
        description="Full onboarding profile, services, and documents for approval decisions."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/providers"
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to list
            </Link>
            <button
              type="button"
              onClick={() => void refetch()}
              className="rounded-xl border border-brand-blue/20 bg-white/80 px-3.5 py-2 text-sm font-semibold text-brand-blue-dark hover:bg-white"
            >
              Refresh
            </button>
          </div>
        }
      />

      {!ready || isLoading ? (
        <EmptyState title="Loading provider…" description="Fetching full profile." />
      ) : isError ? (
        <EmptyState
          title="Could not load provider"
          description={error instanceof Error ? error.message : "Check API + ADMIN role."}
        />
      ) : !data ? (
        <EmptyState title="Provider not found" description="This profile may have been removed." />
      ) : (
        <>
          {actionError ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {actionError}
            </p>
          ) : null}

          <Panel
            title="Verification decision"
            description="Approve only after reviewing description, area, services, and documents."
            actions={
              <div className="flex flex-wrap gap-2">
                {data.verificationStatus !== "APPROVED" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runAction("APPROVED")}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                ) : null}
                {data.verificationStatus !== "UNDER_REVIEW" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runAction("UNDER_REVIEW")}
                    className="rounded-lg border border-brand-blue/30 bg-white px-3 py-1.5 text-xs font-semibold text-brand-blue-dark hover:bg-brand-mist disabled:opacity-50"
                  >
                    Mark under review
                  </button>
                ) : null}
                {data.verificationStatus !== "REJECTED" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runAction("REJECTED")}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                  >
                    {data.verificationStatus === "APPROVED" ? "Suspend" : "Reject"}
                  </button>
                ) : null}
                {data.verificationStatus === "REJECTED" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runAction("PENDING")}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Reopen
                  </button>
                ) : null}
              </div>
            }
          >
            <div className="flex flex-wrap items-center gap-3 px-5 py-4">
              <StatusPill tone={statusTone(data.verificationStatus)}>
                {data.verificationStatus}
              </StatusPill>
              <StatusPill tone={data.isOnline ? "success" : "neutral"}>
                {data.isOnline ? "Online" : "Offline"}
              </StatusPill>
              <span className="text-sm text-slate-500">
                Bookings: {data.bookingCounts.total} total · {data.bookingCounts.completed}{" "}
                completed · {data.bookingCounts.pending} pending
              </span>
            </div>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Contact & account">
              <dl className="px-5">
                <DetailRow label="Email" value={data.email} />
                <DetailRow label="Phone" value={data.phone} />
                <DetailRow
                  label="Onboarding"
                  value={data.onboardingCompleted ? "Completed" : "Incomplete"}
                />
                <DetailRow
                  label="Joined"
                  value={new Date(data.createdAt).toLocaleString()}
                />
                <DetailRow
                  label="Rating"
                  value={`${data.averageRating.toFixed(1)} (${data.totalReviews} reviews)`}
                />
                <DetailRow
                  label="Earnings"
                  value={`${data.totalEarnings.toFixed(2)}`}
                />
              </dl>
            </Panel>

            <Panel title="Onboarding profile">
              <dl className="px-5">
                <DetailRow label="Service area" value={data.serviceArea} />
                <DetailRow label="Shop address" value={data.shopAddress} />
                <DetailRow
                  label="Experience"
                  value={
                    data.experienceYears != null ? `${data.experienceYears} years` : null
                  }
                />
                <DetailRow
                  label="Has tools"
                  value={
                    data.hasTools == null ? null : data.hasTools ? "Yes" : "No"
                  }
                />
                <DetailRow
                  label="Categories"
                  value={
                    data.serviceCategories.length
                      ? data.serviceCategories.join(", ")
                      : null
                  }
                />
                <DetailRow
                  label="Description"
                  value={
                    data.serviceDescription ? (
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {data.serviceDescription}
                      </p>
                    ) : null
                  }
                />
                <DetailRow label="Bio" value={data.bio} />
                <DetailRow
                  label="Shop locations"
                  value={
                    data.shopLocations.length ? (
                      <ul className="list-disc space-y-1 pl-4">
                        {data.shopLocations.map((loc) => (
                          <li key={loc.address}>{loc.address}</li>
                        ))}
                      </ul>
                    ) : null
                  }
                />
                {data.profilePhotoUrl ? (
                  <DetailRow
                    label="Photo"
                    value={
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={data.profilePhotoUrl}
                        alt={`${name} profile`}
                        className="h-24 w-24 rounded-xl object-cover ring-1 ring-slate-200"
                      />
                    }
                  />
                ) : null}
              </dl>
            </Panel>
          </div>

          <Panel title="Services" description="Listed offerings on this provider profile">
            {!data.services.length ? (
              <div className="px-5 py-6 text-sm text-slate-500">No services created yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-5 py-3 font-medium">Title</th>
                      <th className="px-5 py-3 font-medium">Category</th>
                      <th className="px-5 py-3 font-medium">Price</th>
                      <th className="px-5 py-3 font-medium">Duration</th>
                      <th className="px-5 py-3 font-medium">Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.services.map((s) => (
                      <tr key={s.id}>
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-900">{s.title}</p>
                          {s.description ? (
                            <p className="mt-1 text-xs text-slate-500">{s.description}</p>
                          ) : null}
                        </td>
                        <td className="px-5 py-3 text-slate-600">{s.categoryName ?? "—"}</td>
                        <td className="px-5 py-3 text-slate-900">
                          {s.price.toFixed(2)} {s.priceCurrency}
                        </td>
                        <td className="px-5 py-3 text-slate-600">{s.duration} min</td>
                        <td className="px-5 py-3">
                          <StatusPill tone={s.isActive ? "success" : "neutral"}>
                            {s.isActive ? "Active" : "Inactive"}
                          </StatusPill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Documents" description="Uploaded verification files (metadata only)">
            {!data.documents.length ? (
              <div className="px-5 py-6 text-sm text-slate-500">No documents uploaded.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"
                  >
                    <span className="font-medium text-slate-900">{doc.type}</span>
                    <span className="text-slate-500">
                      Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                      {doc.verifiedAt
                        ? ` · Verified ${new Date(doc.verifiedAt).toLocaleDateString()}`
                        : " · Not verified"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Bookings"
            description={`${data.bookingCounts.total} total · ${data.bookingCounts.completed} completed · ${data.bookingCounts.pending} pending`}
          >
            {!data.bookings.length ? (
              <div className="px-5 py-6 text-sm text-slate-500">
                No bookings yet for this provider.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-5 py-3 font-medium">When</th>
                      <th className="px-5 py-3 font-medium">Customer</th>
                      <th className="px-5 py-3 font-medium">Service</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Amount</th>
                      <th className="px-5 py-3 font-medium">Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.bookings.map((b) => (
                      <tr key={b.id} className="text-slate-900">
                        <td className="px-5 py-3 whitespace-nowrap text-slate-600">
                          {new Date(b.scheduledAt).toLocaleString()}
                        </td>
                        <td className="px-5 py-3">
                          <Link
                            href={`/dashboard/users/${b.customerId}`}
                            className="font-medium text-brand-blue-dark hover:underline"
                          >
                            {b.customerName}
                          </Link>
                        </td>
                        <td className="px-5 py-3 font-medium">{b.serviceTitle}</td>
                        <td className="px-5 py-3">
                          <StatusPill tone={bookingStatusTone(b.status)}>
                            {b.status}
                          </StatusPill>
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          {b.totalAmount.toFixed(2)} {b.totalCurrency}
                        </td>
                        <td className="px-5 py-3 max-w-xs truncate text-slate-600">
                          {b.address}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
