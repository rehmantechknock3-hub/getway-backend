"use client";

import { useState } from "react";

import Link from "next/link";

import { useAdminUsers } from "@repo/api-client";

import {
  EmptyState,
  PageHeader,
  Panel,
} from "../../../components/admin/ui";
import { useAdminApiReady } from "../../../lib/use-admin-api-ready";

export default function UsersPage() {
  const { ready } = useAdminApiReady();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useAdminUsers(page, "CUSTOMER", {
    enabled: ready,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Customer accounts only. Providers are managed under the Providers tab."
        actions={
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        }
      />

      <Panel title="Customers" description="Paginated customer list with lifetime spend">
        {!ready || isLoading ? (
          <EmptyState title="Loading users…" description="Fetching customer accounts from the API." />
        ) : isError ? (
          <EmptyState
            title="Could not load users"
            description={error instanceof Error ? error.message : "Check API + ADMIN role."}
          />
        ) : !data?.data.length ? (
          <EmptyState
            title="No customers found"
            description="Create customer accounts from the mobile app."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Email</th>
                    <th className="px-5 py-3 font-medium">Total spent</th>
                    <th className="px-5 py-3 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.data.map((u) => (
                    <tr key={u.id} className="text-slate-900 hover:bg-slate-50/80">
                      <td className="px-5 py-3">
                        <Link
                          href={`/dashboard/users/${u.id}`}
                          className="group block"
                        >
                          <p className="font-medium text-brand-blue-dark group-hover:underline">
                            {u.firstName} {u.lastName}
                          </p>
                          <p className="mt-1 text-xs font-medium text-slate-400 group-hover:text-brand-blue-dark">
                            View full profile →
                          </p>
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{u.email}</td>
                      <td className="px-5 py-3 font-medium text-slate-900">
                        ${(u.totalSpent ?? 0).toFixed(2)}
                      </td>
                      <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
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
