"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@clerk/nextjs";

import {
  setAuthToken,
  useAdminBookings,
  useAdminCreateBooking,
} from "@repo/api-client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function defaultScheduledLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 60);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function BookingsPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [tokenReady, setTokenReady] = useState(false);
  const [page, setPage] = useState(1);
  const [customerId, setCustomerId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [scheduledLocal, setScheduledLocal] = useState(defaultScheduledLocal);
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setTokenReady(true);
      return;
    }
    void getToken().then((token) => {
      setAuthToken(token);
      setTokenReady(true);
    });
  }, [isLoaded, isSignedIn, getToken]);

  const listEnabled = isLoaded && isSignedIn && tokenReady;
  const { data: listPayload, isLoading, isError, error, refetch } = useAdminBookings(page, {
    enabled: listEnabled,
  });
  const createBooking = useAdminCreateBooking();

  const submit = useCallback(async () => {
    setFormError(null);
    setFormSuccess(null);
    const c = customerId.trim();
    const s = serviceId.trim();
    if (!UUID_RE.test(c)) {
      setFormError("Customer ID must be a valid UUID (internal user id from the database).");
      return;
    }
    if (!UUID_RE.test(s)) {
      setFormError("Service ID must be a valid UUID.");
      return;
    }
    const lat = Number.parseFloat(latitude);
    const lon = Number.parseFloat(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setFormError("Latitude and longitude must be numbers.");
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
      const row = await createBooking.mutateAsync({
        customerId: c,
        serviceId: s,
        scheduledAt,
        address: addr,
        latitude: lat,
        longitude: lon,
        notes: notes.trim() ? notes.trim() : undefined,
      });
      setFormSuccess(`Booking created: ${row.id}`);
      void refetch();
    } catch {
      setFormError(
        "Could not create booking. Ensure your Clerk user has role ADMIN, the API is running, and the customer/service IDs exist."
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
  ]);

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
      <p className="mt-2 text-gray-600 max-w-2xl">
        List all service bookings and create one on behalf of a customer. Customer and service IDs are internal
        PostgreSQL UUIDs (copy from your Users / Services data).
      </p>

      <section className="mt-10 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Create booking</h2>
        <p className="mt-1 text-sm text-gray-500">
          Calls <span className="font-mono text-xs">POST /api/v1/admin/bookings</span> (admin only).
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Customer user ID (UUID)</span>
            <input
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 font-mono"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
              autoComplete="off"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Service ID (UUID)</span>
            <input
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 font-mono"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              placeholder="Service row id"
              autoComplete="off"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-gray-700">Scheduled time</span>
            <input
              type="datetime-local"
              className="mt-1 w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
              value={scheduledLocal}
              onChange={(e) => setScheduledLocal(e.target.value)}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-gray-700">Service address</span>
            <input
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, city"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Latitude</span>
            <input
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="40.7128"
              inputMode="decimal"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Longitude</span>
            <input
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="-74.0060"
              inputMode="decimal"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-gray-700">Notes (optional)</span>
            <textarea
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 min-h-[80px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
            />
          </label>
        </div>

        {formError ? <p className="mt-4 text-sm text-red-600">{formError}</p> : null}
        {formSuccess ? <p className="mt-4 text-sm text-green-700">{formSuccess}</p> : null}

        <button
          type="button"
          className="mt-6 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          onClick={() => void submit()}
          disabled={createBooking.isPending}
        >
          {createBooking.isPending ? "Creating…" : "Create booking"}
        </button>
      </section>

      <section className="mt-10 rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">All bookings</h2>
          <button
            type="button"
            className="text-sm font-medium text-primary-600 hover:text-primary-700"
            onClick={() => void refetch()}
          >
            Refresh
          </button>
        </div>
        {!listEnabled || isLoading ? (
          <p className="p-6 text-gray-500">Loading…</p>
        ) : isError ? (
          <p className="p-6 text-red-600">
            Could not load bookings. Use an ADMIN account and set{" "}
            <span className="font-mono text-xs">NEXT_PUBLIC_API_URL</span>.{" "}
            {error instanceof Error ? error.message : ""}
          </p>
        ) : !listPayload?.data.length ? (
          <p className="p-6 text-gray-600">No bookings yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Scheduled</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Provider</th>
                    <th className="px-4 py-3 font-medium">Service</th>
                    <th className="px-4 py-3 font-medium">Booking ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {listPayload.data.map((b) => (
                    <tr key={b.id} className="text-gray-900">
                      <td className="px-4 py-3 font-medium">{b.status}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {new Date(b.scheduledAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">${b.totalAmount.toFixed(2)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{b.customerId}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{b.providerId}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{b.serviceId}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{b.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-600">
              <span>
                Page {listPayload.page} · {listPayload.total} total
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded border border-gray-300 px-3 py-1 font-medium hover:bg-gray-50 disabled:opacity-40"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="rounded border border-gray-300 px-3 py-1 font-medium hover:bg-gray-50 disabled:opacity-40"
                  disabled={page * listPayload.limit >= listPayload.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
