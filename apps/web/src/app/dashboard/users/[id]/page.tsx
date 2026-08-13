"use client";

import type { ReactNode } from "react";

import Link from "next/link";
import { useParams } from "next/navigation";

import { useAdminUser } from "@repo/api-client";
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

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const userId = params.id ?? "";
  const { ready } = useAdminApiReady();

  const { data, isLoading, isError, error, refetch } = useAdminUser(userId, {
    enabled: ready && Boolean(userId),
  });

  const name = data ? `${data.firstName} ${data.lastName}`.trim() : "User";

  return (
    <div className="space-y-6">
      <PageHeader
        title={isLoading || !data ? "User details" : name}
        description="Full account profile so admins can review onboarding and activity."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/users"
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
        <EmptyState title="Loading user…" description="Fetching full profile." />
      ) : isError ? (
        <EmptyState
          title="Could not load user"
          description={
            error instanceof Error && /own profile/i.test(error.message)
              ? "You can’t view your own admin account here."
              : error instanceof Error
                ? error.message
                : "Check API + ADMIN role."
          }
        />
      ) : !data ? (
        <EmptyState title="User not found" description="This account may have been removed." />
      ) : (
        <>
          <Panel title="Account">
            <dl className="px-5">
              <DetailRow label="Email" value={data.email} />
              <DetailRow label="Phone" value={data.phone} />
              <DetailRow
                label="Role"
                value={
                  <StatusPill
                    tone={
                      data.role === "ADMIN"
                        ? "info"
                        : data.role === "PROVIDER"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {data.role}
                  </StatusPill>
                }
              />
              <DetailRow
                label="Onboarding"
                value={data.onboardingCompleted ? "Completed" : "Incomplete"}
              />
              <DetailRow
                label="Joined"
                value={new Date(data.createdAt).toLocaleString()}
              />
              <DetailRow
                label="Updated"
                value={new Date(data.updatedAt).toLocaleString()}
              />
              <DetailRow
                label="Total spent"
                value={`$${(data.totalSpent ?? 0).toFixed(2)}`}
              />
              <DetailRow
                label="Bookings as customer"
                value={String(data.bookingCounts.asCustomer)}
              />
              <DetailRow
                label="Bookings as provider"
                value={String(data.bookingCounts.asProvider)}
              />
              {data.avatarUrl ? (
                <DetailRow
                  label="Avatar"
                  value={
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={data.avatarUrl}
                      alt={`${name} avatar`}
                      className="h-20 w-20 rounded-xl object-cover ring-1 ring-slate-200"
                    />
                  }
                />
              ) : null}
            </dl>
          </Panel>

          {data.customerOnboarding ? (
            <Panel title="Customer onboarding">
              <dl className="px-5">
                <DetailRow
                  label="Primary location"
                  value={data.customerOnboarding.primaryLocation}
                />
                <DetailRow label="Car company" value={data.customerOnboarding.carCompany} />
                <DetailRow label="Car model / year" value={data.customerOnboarding.carModel} />
                <DetailRow label="Notes" value={data.customerOnboarding.notes} />
              </dl>
            </Panel>
          ) : null}

          {data.providerProfileId ? (
            <Panel
              title="Provider summary"
              description="Open the full provider profile for services, documents, and approval actions."
              actions={
                <Link
                  href={`/dashboard/providers/${data.providerProfileId}`}
                  className="rounded-lg border border-brand-blue/30 bg-white px-3 py-1.5 text-xs font-semibold text-brand-blue-dark hover:bg-brand-mist"
                >
                  Open provider detail
                </Link>
              }
            >
              <dl className="px-5">
                <DetailRow
                  label="Verification"
                  value={
                    data.providerVerificationStatus ? (
                      <StatusPill tone={statusTone(data.providerVerificationStatus)}>
                        {data.providerVerificationStatus}
                      </StatusPill>
                    ) : null
                  }
                />
                <DetailRow
                  label="Service area"
                  value={data.providerSummary?.serviceArea}
                />
                <DetailRow
                  label="Experience"
                  value={
                    data.providerSummary?.experienceYears != null
                      ? `${data.providerSummary.experienceYears} years`
                      : null
                  }
                />
                <DetailRow
                  label="Description"
                  value={
                    data.providerSummary?.serviceDescription ? (
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {data.providerSummary.serviceDescription}
                      </p>
                    ) : null
                  }
                />
                <DetailRow
                  label="Online"
                  value={data.providerSummary?.isOnline ? "Online" : "Offline"}
                />
                <DetailRow
                  label="Rating"
                  value={
                    data.providerSummary
                      ? `${data.providerSummary.averageRating.toFixed(1)} (${data.providerSummary.totalReviews} reviews)`
                      : null
                  }
                />
              </dl>
            </Panel>
          ) : null}

          <Panel
            title="Bookings"
            description={`${data.bookingCounts.asCustomer} as customer · ${data.bookingCounts.asProvider} as provider`}
          >
            {!data.bookings.length ? (
              <div className="px-5 py-6 text-sm text-slate-500">
                No bookings yet for this account.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-5 py-3 font-medium">When</th>
                      <th className="px-5 py-3 font-medium">Role</th>
                      <th className="px-5 py-3 font-medium">Service</th>
                      <th className="px-5 py-3 font-medium">Other party</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Amount</th>
                      <th className="px-5 py-3 font-medium">Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.bookings.map((b) => (
                      <tr key={`${b.asRole}-${b.id}`} className="text-slate-900">
                        <td className="px-5 py-3 whitespace-nowrap text-slate-600">
                          {new Date(b.scheduledAt).toLocaleString()}
                        </td>
                        <td className="px-5 py-3">
                          <StatusPill
                            tone={b.asRole === "PROVIDER" ? "warning" : "neutral"}
                          >
                            {b.asRole === "PROVIDER" ? "Provider" : "Customer"}
                          </StatusPill>
                        </td>
                        <td className="px-5 py-3 font-medium">{b.serviceTitle}</td>
                        <td className="px-5 py-3 text-slate-600">{b.counterpartyName}</td>
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
