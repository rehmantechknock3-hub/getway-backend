"use client";

import { useState } from "react";

import Link from "next/link";

import { useAdminServices } from "@repo/api-client";

import {
  EmptyState,
  PageHeader,
  Panel,
  StatusPill,
} from "../../../components/admin/ui";
import { useAdminApiReady } from "../../../lib/use-admin-api-ready";
import { useDebouncedValue } from "../../../lib/use-debounced-value";

export default function ServicesPage() {
  const { ready } = useAdminApiReady();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);

  const { data, isLoading, isError, error, refetch } = useAdminServices(page, {
    enabled: ready,
    search: debouncedSearch,
    limit: 20,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Services"
        description="Browse provider service listings across the marketplace."
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

      <label className="block max-w-xl">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Search
        </span>
        <input
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          placeholder="Search by service name…"
          autoComplete="off"
        />
      </label>

      <Panel title="All services" description="Paginated catalog of provider listings">
        {!ready || isLoading ? (
          <EmptyState title="Loading services…" description="Fetching marketplace listings." />
        ) : isError ? (
          <EmptyState
            title="Could not load services"
            description={error instanceof Error ? error.message : "Check API + ADMIN role."}
          />
        ) : !data?.data.length ? (
          <EmptyState
            title="No services found"
            description={
              debouncedSearch
                ? "No services match that name."
                : "Providers will appear here after they create services."
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-5 py-3 font-medium">Service</th>
                    <th className="px-5 py-3 font-medium">Provider</th>
                    <th className="px-5 py-3 font-medium">Category</th>
                    <th className="px-5 py-3 font-medium">Price</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.data.map((s) => {
                    const providerName =
                      `${s.providerFirstName} ${s.providerLastName}`.trim() ||
                      s.providerEmail;
                    return (
                      <tr key={s.id} className="text-slate-900">
                        <td className="px-5 py-3">
                          <p className="font-medium">{s.title}</p>
                          {s.description ? (
                            <p className="mt-1 max-w-xs truncate text-xs text-slate-500">
                              {s.description}
                            </p>
                          ) : null}
                          <p className="mt-1 text-xs text-slate-400">{s.duration} min</p>
                        </td>
                        <td className="px-5 py-3">
                          <Link
                            href={`/dashboard/providers/${s.providerProfileId}`}
                            className="font-medium text-brand-blue-dark hover:underline"
                          >
                            {providerName}
                          </Link>
                          <p className="text-xs text-slate-500">{s.providerEmail}</p>
                        </td>
                        <td className="px-5 py-3 text-slate-600">
                          {s.categoryName ?? "—"}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap font-medium">
                          {s.price.toFixed(2)} {s.priceCurrency}
                        </td>
                        <td className="px-5 py-3">
                          <StatusPill tone={s.isActive ? "success" : "neutral"}>
                            {s.isActive ? "Active" : "Inactive"}
                          </StatusPill>
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap text-slate-500">
                          {new Date(s.createdAt).toLocaleDateString()}
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
