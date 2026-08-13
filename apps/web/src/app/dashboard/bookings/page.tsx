"use client";

import { useCallback, useMemo, useState } from "react";

import Link from "next/link";

import {
  useAdminBookings,
  useAdminCreateBooking,
  useAdminServices,
  useAdminUsers,
} from "@repo/api-client";
import type { BookingStatus } from "@repo/schemas";

import { AdminLocationPicker } from "../../../components/admin/admin-location-picker";
import { AdminSearchSelect } from "../../../components/admin/search-select";
import {
  EmptyState,
  PageHeader,
  Panel,
  StatusPill,
} from "../../../components/admin/ui";
import { useAdminApiReady } from "../../../lib/use-admin-api-ready";
import { useDebouncedValue } from "../../../lib/use-debounced-value";

const STATUS_FILTERS: Array<{ label: string; value?: BookingStatus }> = [
  { label: "All" },
  { label: "Pending", value: "PENDING" },
  { label: "Accepted", value: "ACCEPTED" },
  { label: "In progress", value: "IN_PROGRESS" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
  { label: "Rejected", value: "REJECTED" },
];

function defaultScheduledLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 60);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusTone(status: string): "neutral" | "success" | "warning" | "danger" | "info" {
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

export default function BookingsPage() {
  const { ready } = useAdminApiReady();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<BookingStatus | undefined>(undefined);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [customerLabel, setCustomerLabel] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const debouncedCustomerSearch = useDebouncedValue(customerSearch, 350);

  const [serviceId, setServiceId] = useState("");
  const [serviceLabel, setServiceLabel] = useState<string | null>(null);
  const [serviceSearch, setServiceSearch] = useState("");
  const debouncedServiceSearch = useDebouncedValue(serviceSearch, 350);

  const [scheduledLocal, setScheduledLocal] = useState(defaultScheduledLocal);
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const { data: listPayload, isLoading, isError, error, refetch } = useAdminBookings(page, {
    enabled: ready,
    status,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
  });
  const createBooking = useAdminCreateBooking();

  const customersQuery = useAdminUsers(1, "CUSTOMER", {
    enabled: ready && showCreateForm && !customerId,
    search: debouncedCustomerSearch,
    limit: 20,
  });
  const servicesQuery = useAdminServices(1, {
    enabled: ready && showCreateForm && !serviceId,
    search: debouncedServiceSearch,
    limit: 20,
  });

  const customerOptions = useMemo(
    () =>
      (customersQuery.data?.data ?? []).map((u) => ({
        id: u.id,
        label: `${u.firstName} ${u.lastName}`.trim() || u.email,
        description: u.email,
      })),
    [customersQuery.data],
  );

  const serviceOptions = useMemo(
    () =>
      (servicesQuery.data?.data ?? []).map((s) => {
        const providerName =
          `${s.providerFirstName} ${s.providerLastName}`.trim() || s.providerEmail;
        return {
          id: s.id,
          label: `${s.title} · ${providerName}`,
          description: `${s.price.toFixed(2)} ${s.priceCurrency} · ${s.duration} min${
            s.categoryName ? ` · ${s.categoryName}` : ""
          }${s.isActive ? "" : " · inactive"}`,
        };
      }),
    [servicesQuery.data],
  );

  const resetCreateFields = useCallback(() => {
    setCustomerId("");
    setCustomerLabel(null);
    setCustomerSearch("");
    setServiceId("");
    setServiceLabel(null);
    setServiceSearch("");
    setScheduledLocal(defaultScheduledLocal());
    setAddress("");
    setLatitude(null);
    setLongitude(null);
    setNotes("");
    setFormError(null);
  }, []);

  const submit = useCallback(async () => {
    setFormError(null);
    if (!customerId) {
      setFormError("Select a customer from the search results.");
      return;
    }
    if (!serviceId) {
      setFormError("Select a service from the search results.");
      return;
    }
    if (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setFormError("Pick a location on the map or from search.");
      return;
    }
    const addr = address.trim();
    if (!addr) {
      setFormError("Address is required.");
      return;
    }
    const scheduledAt = new Date(scheduledLocal);
    if (Number.isNaN(scheduledAt.getTime())) {
      setFormError("Pick a valid date and time.");
      return;
    }
    try {
      await createBooking.mutateAsync({
        customerId,
        serviceId,
        scheduledAt,
        address: addr,
        latitude,
        longitude,
        notes: notes.trim() ? notes.trim() : undefined,
      });
      resetCreateFields();
      setShowCreateForm(false);
      setPage(1);
      await refetch();
    } catch {
      setFormError(
        "Could not create booking. Ensure ADMIN role, API is running, and selections are valid.",
      );
    }
  }, [
    customerId,
    serviceId,
    scheduledLocal,
    address,
    latitude,
    longitude,
    notes,
    createBooking,
    refetch,
    resetCreateFields,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        description="Monitor every job and create bookings on behalf of customers when needed."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => void refetch()}
            >
              Refresh
            </button>
            <button
              type="button"
              className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                showCreateForm
                  ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  : "bg-primary-600 text-white hover:bg-primary-700"
              }`}
              onClick={() => {
                setShowCreateForm((open) => {
                  if (open) resetCreateFields();
                  return !open;
                });
                setFormError(null);
              }}
            >
              {showCreateForm ? "Close form" : "Create booking"}
            </button>
          </div>
        }
      />

      {showCreateForm ? (
        <Panel
          title="Create booking"
          description="Search customers and services, then set the job location on the map."
        >
          <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
            <AdminSearchSelect
              label="Customer"
              placeholder="Search customer name or email…"
              valueLabel={customerLabel}
              options={customerOptions}
              isLoading={customersQuery.isFetching}
              search={customerSearch}
              onSearchChange={setCustomerSearch}
              onSelect={(id) => {
                const row = customersQuery.data?.data.find((u) => u.id === id);
                if (!row) return;
                setCustomerId(row.id);
                setCustomerLabel(
                  `${`${row.firstName} ${row.lastName}`.trim() || row.email} · ${row.email}`,
                );
              }}
              onClear={() => {
                setCustomerId("");
                setCustomerLabel(null);
              }}
              emptyText="No customers match that search."
              hint="Type a name or email, then pick from the list."
            />

            <AdminSearchSelect
              label="Service / provider"
              placeholder="Search service or provider name…"
              valueLabel={serviceLabel}
              options={serviceOptions}
              isLoading={servicesQuery.isFetching}
              search={serviceSearch}
              onSearchChange={setServiceSearch}
              onSelect={(id) => {
                const row = servicesQuery.data?.data.find((s) => s.id === id);
                if (!row) return;
                const providerName =
                  `${row.providerFirstName} ${row.providerLastName}`.trim() ||
                  row.providerEmail;
                setServiceId(row.id);
                setServiceLabel(
                  `${row.title} · ${providerName} · ${row.price.toFixed(2)} ${row.priceCurrency}`,
                );
              }}
              onClear={() => {
                setServiceId("");
                setServiceLabel(null);
              }}
              emptyText="No services match that search."
              hint="Search by service title or provider name."
            />

            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Scheduled time</span>
              <input
                type="datetime-local"
                className="mt-1 w-full max-w-md rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                value={scheduledLocal}
                onChange={(e) => setScheduledLocal(e.target.value)}
              />
            </label>

            <AdminLocationPicker
              address={address}
              latitude={latitude}
              longitude={longitude}
              onAddressChange={setAddress}
              onLocationChange={(next) => {
                setAddress(next.address);
                setLatitude(next.latitude);
                setLongitude(next.longitude);
              }}
            />

            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Notes</span>
              <textarea
                className="mt-1 min-h-[80px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
              />
            </label>
          </div>
          {formError ? <p className="px-5 pb-2 text-sm text-rose-600">{formError}</p> : null}
          <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-4">
            <button
              type="button"
              className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              onClick={() => void submit()}
              disabled={createBooking.isPending}
            >
              {createBooking.isPending ? "Creating…" : "Submit booking"}
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setShowCreateForm(false);
                resetCreateFields();
              }}
            >
              Cancel
            </button>
          </div>
        </Panel>
      ) : null}

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => {
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

        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              From
            </span>
            <input
              type="date"
              className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => {
                setPage(1);
                setFromDate(e.target.value);
              }}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              To
            </span>
            <input
              type="date"
              className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => {
                setPage(1);
                setToDate(e.target.value);
              }}
            />
          </label>
          {fromDate || toDate ? (
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setPage(1);
                setFromDate("");
                setToDate("");
              }}
            >
              Clear dates
            </button>
          ) : null}
          <p className="pb-2 text-xs text-slate-500">
            Filters by scheduled date. Use one date or a range.
          </p>
        </div>
      </div>

      <Panel title="All bookings" description="Paginated list across the marketplace.">
        {!ready || isLoading ? (
          <EmptyState title="Loading bookings…" description="Fetching admin booking list." />
        ) : isError ? (
          <EmptyState
            title="Could not load bookings"
            description={error instanceof Error ? error.message : "Check API + ADMIN role."}
          />
        ) : !listPayload?.data.length ? (
          <EmptyState
            title="No bookings yet"
            description={
              status || fromDate || toDate
                ? "No bookings match the current filters."
                : "Use Create booking, or wait for customers to book from the mobile app."
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Scheduled</th>
                    <th className="px-5 py-3 font-medium">Service</th>
                    <th className="px-5 py-3 font-medium">Total</th>
                    <th className="px-5 py-3 font-medium">Customer</th>
                    <th className="px-5 py-3 font-medium">Provider</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {listPayload.data.map((b) => (
                    <tr key={b.id} className="text-slate-900">
                      <td className="px-5 py-3">
                        <StatusPill tone={statusTone(b.status)}>{b.status}</StatusPill>
                      </td>
                      <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
                        {new Date(b.scheduledAt).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-slate-700">
                        {b.serviceTitle ?? "—"}
                      </td>
                      <td className="px-5 py-3 font-medium">${b.totalAmount.toFixed(2)}</td>
                      <td className="px-5 py-3">
                        <Link
                          href={`/dashboard/users/${b.customerId}`}
                          className="font-medium text-brand-blue-dark hover:underline"
                        >
                          {`${b.customerFirstName} ${b.customerLastName}`.trim() || "Customer"}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <Link
                          href={`/dashboard/providers/${b.providerId}`}
                          className="font-medium text-brand-blue-dark hover:underline"
                        >
                          {`${b.providerFirstName} ${b.providerLastName}`.trim() || "Provider"}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-600">
              <span>
                Page {listPayload.page} · {listPayload.total} total
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
                  disabled={page * listPayload.limit >= listPayload.total}
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
