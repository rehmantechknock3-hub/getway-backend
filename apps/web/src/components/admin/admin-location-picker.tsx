"use client";

import { useCallback, useState } from "react";

import dynamic from "next/dynamic";

import { toast } from "sonner";

import {
  fetchPlaceDetails,
  fetchReverseGeocode,
  usePlacesAutocomplete,
} from "@repo/api-client";
import { reportError } from "@repo/utils";

import { useDebouncedValue } from "../../lib/use-debounced-value";

const AdminBookingMap = dynamic(
  () => import("./admin-booking-map").then((mod) => mod.AdminBookingMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-72 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-500">
        Loading map…
      </div>
    ),
  },
);

const DEFAULT_CENTER = { lat: 31.5204, lng: 74.3587 };

type AdminLocationPickerProps = {
  address: string;
  latitude: number | null;
  longitude: number | null;
  onAddressChange: (address: string) => void;
  onLocationChange: (next: {
    address: string;
    latitude: number;
    longitude: number;
  }) => void;
};

export function AdminLocationPicker({
  address,
  latitude,
  longitude,
  onAddressChange,
  onLocationChange,
}: AdminLocationPickerProps) {
  const [search, setSearch] = useState("");
  const [resolving, setResolving] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 350);

  const placesQuery = usePlacesAutocomplete(debouncedSearch, {
    enabled: debouncedSearch.trim().length >= 2,
  });

  const applyCoords = useCallback(
    async (coords: { latitude: number; longitude: number }) => {
      setResolving(true);
      try {
        const result = await fetchReverseGeocode(coords.latitude, coords.longitude);
        onLocationChange({
          address: result.address,
          latitude: result.latitude,
          longitude: result.longitude,
        });
        setSearch("");
      } catch (error) {
        reportError(error, { action: "admin-booking-map-click" });
        onLocationChange({
          address: `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`,
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        toast.error("Could not resolve address; coordinates were still set.");
      } finally {
        setResolving(false);
      }
    },
    [onLocationChange],
  );

  const selectPrediction = useCallback(
    async (placeId: string) => {
      setResolving(true);
      try {
        const details = await fetchPlaceDetails(placeId);
        onLocationChange({
          address: details.address,
          latitude: details.latitude,
          longitude: details.longitude,
        });
        setSearch("");
      } catch (error) {
        reportError(error, { action: "admin-booking-place-select" });
        toast.error("Could not load that place. Try another search result.");
      } finally {
        setResolving(false);
      }
    },
    [onLocationChange],
  );

  return (
    <div className="space-y-3 sm:col-span-2">
      <div>
        <span className="text-sm font-medium text-slate-700">Service location</span>
        <p className="mt-0.5 text-xs text-slate-500">
          Search a place by name, or click the map to drop a pin.
        </p>
      </div>

      <div className="relative">
        <input
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search place name or address…"
          autoComplete="off"
          disabled={resolving}
        />
        {debouncedSearch.trim().length >= 2 ? (
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
            {placesQuery.isFetching ? (
              <p className="px-3 py-2 text-sm text-slate-500">Searching…</p>
            ) : placesQuery.isError ? (
              <p className="px-3 py-2 text-sm text-rose-600">
                Search failed. Check API + Google Maps key.
              </p>
            ) : (placesQuery.data?.predictions.length ?? 0) === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-500">No places found.</p>
            ) : (
              <ul>
                {placesQuery.data?.predictions.map((prediction) => (
                  <li key={prediction.placeId}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                      disabled={resolving}
                      onClick={() => void selectPrediction(prediction.placeId)}
                    >
                      {prediction.description}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Address
        </span>
        <input
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          value={address}
          onChange={(event) => onAddressChange(event.target.value)}
          placeholder="Filled from search or map pin"
        />
      </label>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="h-72 w-full">
          <AdminBookingMap
            latitude={latitude}
            longitude={longitude}
            defaultCenter={DEFAULT_CENTER}
            onPick={(coords) => {
              void applyCoords(coords);
            }}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span>
            {resolving
              ? "Resolving address…"
              : latitude != null && longitude != null
                ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
                : "No pin yet — click the map"}
          </span>
          <span>Click map to set location</span>
        </div>
      </div>
    </div>
  );
}
