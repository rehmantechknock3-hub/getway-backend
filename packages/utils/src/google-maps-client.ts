/**
 * Client-side Google Maps REST helpers (React Native / browser).
 * Used so shop coordinates are stored even when the API server cannot call Google
 * (missing key or HTTP-referrer / app-restricted keys).
 */

export type LatLng = { latitude: number; longitude: number };

function isValidLatLng(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/** Place Details (legacy) — geometry/location for a place_id. */
export async function fetchGooglePlaceDetailsLocation(
  placeId: string,
  apiKey: string
): Promise<LatLng | null> {
  const trimmedId = placeId.trim();
  const trimmedKey = apiKey.trim();
  if (!trimmedId || !trimmedKey) return null;

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    url.searchParams.set("place_id", trimmedId);
    url.searchParams.set("fields", "geometry/location");
    url.searchParams.set("key", trimmedKey);

    const res = await fetch(url.toString());
    const json = (await res.json()) as {
      status?: string;
      result?: { geometry?: { location?: { lat?: number; lng?: number } } };
    };
    const loc = json.result?.geometry?.location;
    if (
      json.status === "OK" &&
      typeof loc?.lat === "number" &&
      typeof loc?.lng === "number" &&
      isValidLatLng(loc.lat, loc.lng)
    ) {
      return { latitude: loc.lat, longitude: loc.lng };
    }
    return null;
  } catch {
    return null;
  }
}

/** Geocoding API — free-form address string. */
export async function fetchGoogleGeocodeLocation(
  address: string,
  apiKey: string
): Promise<LatLng | null> {
  const trimmedAddr = address.trim();
  const trimmedKey = apiKey.trim();
  if (trimmedAddr.length < 3 || !trimmedKey) return null;

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", trimmedAddr);
    url.searchParams.set("key", trimmedKey);

    const res = await fetch(url.toString());
    const json = (await res.json()) as {
      status?: string;
      results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }>;
    };
    const loc = json.results?.[0]?.geometry?.location;
    if (
      json.status === "OK" &&
      typeof loc?.lat === "number" &&
      typeof loc?.lng === "number" &&
      isValidLatLng(loc.lat, loc.lng)
    ) {
      return { latitude: loc.lat, longitude: loc.lng };
    }
    return null;
  } catch {
    return null;
  }
}

export type ShopLocationDraft = {
  address: string;
  placeId?: string;
  latitude?: number;
  longitude?: number;
};

/**
 * Fills missing latitude/longitude using Place Details (if placeId) then Geocoding.
 * Runs sequentially to reduce burst rate-limit risk.
 */
export async function enrichShopLocationsWithCoordinates(
  locations: ShopLocationDraft[],
  apiKey: string | undefined
): Promise<ShopLocationDraft[]> {
  const key = apiKey?.trim();
  if (!key) return locations;

  const out: ShopLocationDraft[] = [];
  for (const loc of locations) {
    if (
      typeof loc.latitude === "number" &&
      typeof loc.longitude === "number" &&
      isValidLatLng(loc.latitude, loc.longitude)
    ) {
      out.push(loc);
      continue;
    }

    let coords: LatLng | null = null;
    if (loc.placeId) {
      coords = await fetchGooglePlaceDetailsLocation(loc.placeId, key);
    }
    if (!coords) {
      coords = await fetchGoogleGeocodeLocation(loc.address, key);
    }

    out.push(
      coords
        ? { ...loc, latitude: coords.latitude, longitude: coords.longitude }
        : loc
    );
  }
  return out;
}
