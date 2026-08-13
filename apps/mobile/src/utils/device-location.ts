import * as Location from "expo-location";

import { reportError } from "@repo/utils";

export type DeviceLocationCoords = {
  latitude: number;
  longitude: number;
};

export type DeviceLocationResult = {
  coords: DeviceLocationCoords;
  /** Full address suitable for forms / booking. */
  addressLabel: string;
  /** Short label for headers (e.g. "Lahore, Pakistan"). */
  shortLabel: string;
};

export type DeviceLocationFailure = {
  ok: false;
  reason: "denied" | "unavailable";
};

export type DeviceLocationSuccess = {
  ok: true;
  data: DeviceLocationResult;
};

export type DeviceLocationResponse = DeviceLocationSuccess | DeviceLocationFailure;

function dedupeParts(parts: string[]): string[] {
  const out: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const prev = out[out.length - 1];
    if (prev && prev.toLowerCase() === trimmed.toLowerCase()) continue;
    out.push(trimmed);
  }
  return out;
}

export function formatGeocodedAddress(place: Location.LocationGeocodedAddress): string {
  const street = [place.streetNumber, place.street].filter(Boolean).join(" ").trim();
  const parts = dedupeParts([
    street || place.name || "",
    place.district || "",
    place.city || place.subregion || "",
    place.region || "",
    place.postalCode || "",
    place.country || "",
  ]);
  return parts.join(", ") || "Current location";
}

export function formatGeocodedShortLabel(place: Location.LocationGeocodedAddress): string {
  const city = place.city ?? place.subregion ?? place.region;
  const country = place.country;
  if (city && country) return `${city}, ${country}`;
  if (city) return city;
  return "Near you";
}

async function reverseGeocodeLabels(
  coords: DeviceLocationCoords
): Promise<{ addressLabel: string; shortLabel: string }> {
  try {
    const places = await Location.reverseGeocodeAsync({
      latitude: coords.latitude,
      longitude: coords.longitude,
    });
    const place = places[0];
    if (!place) {
      return { addressLabel: "Current location", shortLabel: "Near you" };
    }
    return {
      addressLabel: formatGeocodedAddress(place),
      shortLabel: formatGeocodedShortLabel(place),
    };
  } catch (error: unknown) {
    reportError(error, { action: "reverseGeocodeLabels" });
    return { addressLabel: "Current location", shortLabel: "Near you" };
  }
}

/**
 * Asks for foreground location permission, reads GPS, and reverse-geocodes a label.
 * Callers should keep a manual address field as fallback when `reason === "denied"`.
 */
export async function requestDeviceLocation(options?: {
  accuracy?: Location.Accuracy;
  context?: { screen?: string; action?: string };
}): Promise<DeviceLocationResponse> {
  const context = options?.context ?? { action: "requestDeviceLocation" };

  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== Location.PermissionStatus.GRANTED) {
      return { ok: false, reason: "denied" };
    }

    let position: Location.LocationObject;
    try {
      position = await Location.getCurrentPositionAsync({
        accuracy: options?.accuracy ?? Location.Accuracy.Balanced,
      });
    } catch {
      position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Lowest,
      });
    }

    const coords: DeviceLocationCoords = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
    const labels = await reverseGeocodeLabels(coords);

    return {
      ok: true,
      data: {
        coords,
        addressLabel: labels.addressLabel,
        shortLabel: labels.shortLabel,
      },
    };
  } catch (error: unknown) {
    reportError(error, context);
    return { ok: false, reason: "unavailable" };
  }
}
