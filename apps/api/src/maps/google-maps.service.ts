import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { safeParseProviderOnboardingJson, type ProviderOnboarding } from "@repo/schemas";

import { PrismaService } from "../prisma/prisma.service";

/** Rounded customer location for cache keys; 5 dp ≈ 1.1 m so short trips are not lumped into wrong buckets. */
const ORIGIN_KEY_DECIMALS = 5;
const DEST_KEY_DECIMALS = 5;
/** Google Distance Matrix allows at most 25 elements per request (one origin × many destinations). */
const DISTANCE_MATRIX_DESTINATION_LIMIT = 25;

function normalizeAddress(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export type ProviderRowForGeocode = {
  id: string;
  userId: string;
  latitude: number | null;
  longitude: number | null;
  user: {
    id: string;
    providerOnboarding: Prisma.JsonValue | null;
  };
};

export type DrivingDistanceResult = {
  /** Kilometres (meters / 1000); keep `meters` as source of truth for display. */
  km: number;
  /** Integer metres (exact from Distance Matrix when driving). */
  meters: number;
  kind: "DRIVING" | "STRAIGHT_LINE";
};

@Injectable()
export class GoogleMapsService {
  private readonly logger = new Logger(GoogleMapsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  private getApiKey(): string | undefined {
    return (
      this.configService.get<string>("GOOGLE_MAPS_API_KEY") ??
      this.configService.get<string>("EXPO_PUBLIC_GOOGLE_MAPS_API_KEY")
    );
  }

  private getCacheTtlMs(): number {
    const hours = Number.parseFloat(
      this.configService.get<string>("DRIVING_DISTANCE_CACHE_TTL_HOURS") ?? "24"
    );
    const safe = Number.isFinite(hours) && hours > 0 ? hours : 24;
    return Math.round(safe * 3_600_000);
  }

  coordKey(value: number, decimals: number): string {
    return value.toFixed(decimals);
  }

  private async geocodeAddress(input: {
    shopAddress: string;
    shopPlaceId?: string;
    requestId?: string;
  }): Promise<{ latitude: number; longitude: number } | null> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      this.logger.warn(`Google Maps API key missing, skipping geocode [rid:${input.requestId}]`);
      return null;
    }

    try {
      if (input.shopPlaceId) {
        const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
        detailsUrl.searchParams.set("place_id", input.shopPlaceId);
        detailsUrl.searchParams.set("fields", "geometry/location");
        detailsUrl.searchParams.set("key", apiKey);

        const detailsResponse = await fetch(detailsUrl.toString());
        const detailsJson = (await detailsResponse.json()) as {
          status?: string;
          result?: { geometry?: { location?: { lat?: number; lng?: number } } };
        };
        const placeLocation = detailsJson.result?.geometry?.location;
        if (
          detailsJson.status === "OK" &&
          typeof placeLocation?.lat === "number" &&
          typeof placeLocation?.lng === "number"
        ) {
          return { latitude: placeLocation.lat, longitude: placeLocation.lng };
        }
      }

      const geocodeUrl = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      geocodeUrl.searchParams.set("address", input.shopAddress);
      geocodeUrl.searchParams.set("key", apiKey);

      const geocodeResponse = await fetch(geocodeUrl.toString());
      const geocodeJson = (await geocodeResponse.json()) as {
        status?: string;
        results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }>;
      };
      const location = geocodeJson.results?.[0]?.geometry?.location;
      if (
        geocodeJson.status === "OK" &&
        typeof location?.lat === "number" &&
        typeof location?.lng === "number"
      ) {
        return { latitude: location.lat, longitude: location.lng };
      }

      this.logger.warn(
        `Google geocode failed for provider address: ${input.shopAddress} [rid:${input.requestId}]`
      );
      return null;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to geocode provider address [rid:${input.requestId}]`,
        error instanceof Error ? error.stack : undefined
      );
      return null;
    }
  }

  /**
   * If the provider has no usable coordinates in DB/onboarding, geocode the first shop address once
   * and persist lat/lng on `provider_profiles` and enriched `shopLocations` on the user JSON.
   */
  async backfillProviderCoordinatesIfNeeded<T extends ProviderRowForGeocode>(
    row: T,
    requestId?: string
  ): Promise<T> {
    const hasProfileCoords =
      row.latitude != null &&
      row.longitude != null &&
      Number.isFinite(row.latitude) &&
      Number.isFinite(row.longitude);
    const parsed = safeParseProviderOnboardingJson(row.user.providerOnboarding);
    const onboarding = parsed.success ? parsed.data : undefined;
    const fromShops = onboarding?.shopLocations ?? [];
    const firstAddress =
      onboarding?.shopAddress?.trim() ??
      fromShops[0]?.address?.trim() ??
      undefined;
    const placeId = onboarding?.shopPlaceId ?? fromShops[0]?.placeId;
    const normalizedFirstAddress = firstAddress ? normalizeAddress(firstAddress) : undefined;
    const matchingShopWithCoords = fromShops.find((loc) => {
      if (typeof loc.latitude !== "number" || typeof loc.longitude !== "number") {
        return false;
      }
      if (placeId && loc.placeId && placeId === loc.placeId) {
        return true;
      }
      if (!normalizedFirstAddress) {
        return false;
      }
      return normalizeAddress(loc.address) === normalizedFirstAddress;
    });

    if (matchingShopWithCoords) {
      const profileNeedsUpdate = !hasProfileCoords;
      if (profileNeedsUpdate) {
        await this.prisma.providerProfile.update({
          where: { id: row.id },
          data: {
            latitude: matchingShopWithCoords.latitude,
            longitude: matchingShopWithCoords.longitude,
          },
        });
      }
      return {
        ...row,
        latitude: profileNeedsUpdate ? matchingShopWithCoords.latitude : row.latitude,
        longitude: profileNeedsUpdate ? matchingShopWithCoords.longitude : row.longitude,
      } as T;
    }

    if (hasProfileCoords && (!firstAddress || firstAddress.length < 3)) {
      return row;
    }

    if (!firstAddress || firstAddress.length < 3) {
      return row;
    }

    const coords = await this.geocodeAddress({
      shopAddress: firstAddress,
      shopPlaceId: placeId,
      requestId,
    });
    if (!coords) {
      return row;
    }

    const mergedOnboarding: ProviderOnboarding | undefined = onboarding
      ? {
          ...onboarding,
          shopLocations:
            fromShops.length > 0
              ? fromShops.map((loc, index) =>
                  index === 0
                    ? { ...loc, latitude: coords.latitude, longitude: coords.longitude }
                    : loc
                )
              : [
                  {
                    address: firstAddress,
                    placeId,
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                  },
                ],
          shopAddress: onboarding.shopAddress?.trim() ? onboarding.shopAddress : firstAddress,
          shopPlaceId: placeId ?? onboarding.shopPlaceId,
        }
      : undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.providerProfile.update({
        where: { id: row.id },
        data: { latitude: coords.latitude, longitude: coords.longitude },
      });
      if (mergedOnboarding) {
        await tx.user.update({
          where: { id: row.userId },
          data: { providerOnboarding: mergedOnboarding as Prisma.InputJsonValue },
        });
      }
    });

    return {
      ...row,
      latitude: coords.latitude,
      longitude: coords.longitude,
      user: {
        ...row.user,
        providerOnboarding: (mergedOnboarding ?? row.user.providerOnboarding) as Prisma.JsonValue,
      },
    } as T;
  }

  /**
   * Driving distances via Distance Matrix API, read-through DB cache (TTL).
   * Falls back to `fallbackKm` / STRAIGHT_LINE when the API is unavailable or returns no route.
   */
  async resolveDrivingDistances(
    customerLat: number,
    customerLon: number,
    entries: Array<{ providerId: string; destLat: number; destLon: number; fallbackKm: number }>,
    requestId?: string
  ): Promise<Map<string, DrivingDistanceResult>> {
    const out = new Map<string, DrivingDistanceResult>();
    if (entries.length === 0) {
      return out;
    }

    const apiKey = this.getApiKey();
    const originLatKey = this.coordKey(customerLat, ORIGIN_KEY_DECIMALS);
    const originLngKey = this.coordKey(customerLon, ORIGIN_KEY_DECIMALS);
    const ttlMs = this.getCacheTtlMs();
    const staleBefore = new Date(Date.now() - ttlMs);

    for (const e of entries) {
      const meters = Math.max(0, Math.round(e.fallbackKm * 1000));
      out.set(e.providerId, { km: meters / 1000, meters, kind: "STRAIGHT_LINE" });
    }

    if (!apiKey) {
      this.logger.warn(`Google Maps API key missing, using straight-line distance [rid:${requestId}]`);
      return out;
    }

    const destKey = (lat: number, lon: number) => ({
      destLatKey: this.coordKey(lat, DEST_KEY_DECIMALS),
      destLngKey: this.coordKey(lon, DEST_KEY_DECIMALS),
    });

    let cached: Awaited<ReturnType<typeof this.prisma.providerDrivingDistanceCache.findMany>> = [];
    try {
      cached = await this.prisma.providerDrivingDistanceCache.findMany({
        where: {
          originLatKey,
          originLngKey,
          updatedAt: { gte: staleBefore },
          OR: entries.map((e) => {
            const d = destKey(e.destLat, e.destLon);
            return {
              providerProfileId: e.providerId,
              destLatKey: d.destLatKey,
              destLngKey: d.destLngKey,
            };
          }),
        },
      });
    } catch (error: unknown) {
      const isMissingTable =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021";
      if (isMissingTable) {
        this.logger.warn(
          `provider_driving_distance_caches table missing; apply schema (pnpm --filter @repo/api db:push). Using live Distance Matrix + straight-line fallback [rid:${requestId}]`
        );
      } else {
        this.logger.error(
          `Driving distance cache read failed [rid:${requestId}]`,
          error instanceof Error ? error.stack : undefined
        );
      }
    }

    for (const c of cached) {
      const meters = c.drivingDistanceMeters;
      out.set(c.providerProfileId, {
        km: meters / 1000,
        meters,
        kind: "DRIVING",
      });
    }

    const pending = entries.filter((e) => out.get(e.providerId)?.kind !== "DRIVING");
    if (pending.length === 0) {
      return out;
    }

    for (let i = 0; i < pending.length; i += DISTANCE_MATRIX_DESTINATION_LIMIT) {
      const chunk = pending.slice(i, i + DISTANCE_MATRIX_DESTINATION_LIMIT);
      const destParam = chunk.map((e) => `${e.destLat},${e.destLon}`).join("|");
      const matrixUrl = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
      matrixUrl.searchParams.set("origins", `${customerLat},${customerLon}`);
      matrixUrl.searchParams.set("destinations", destParam);
      matrixUrl.searchParams.set("mode", "driving");
      matrixUrl.searchParams.set("units", "metric");
      matrixUrl.searchParams.set("key", apiKey);

      try {
        const res = await fetch(matrixUrl.toString());
        const json = (await res.json()) as {
          status?: string;
          error_message?: string;
          rows?: Array<{
            elements?: Array<{
              status?: string;
              distance?: { value?: number };
              duration?: { value?: number };
            }>;
          }>;
        };

        if (json.status !== "OK" || !json.rows?.[0]?.elements) {
          this.logger.warn(
            `Distance Matrix non-OK: ${json.status ?? "?"} ${json.error_message ?? ""} [rid:${requestId}]`
          );
          continue;
        }

        const elements = json.rows[0].elements ?? [];
        for (let j = 0; j < chunk.length; j++) {
          const entry = chunk[j];
          const el = elements[j];
          const meters =
            el?.status === "OK" && typeof el.distance?.value === "number" ? el.distance.value : null;
          const durationSec =
            el?.status === "OK" && typeof el.duration?.value === "number" ? el.duration.value : null;

          const d = destKey(entry.destLat, entry.destLon);

          if (meters != null && meters >= 0) {
            const metersInt = Math.round(meters);
            const km = metersInt / 1000;
            try {
              await this.prisma.providerDrivingDistanceCache.upsert({
                where: {
                  originLatKey_originLngKey_providerProfileId_destLatKey_destLngKey: {
                    originLatKey,
                    originLngKey,
                    providerProfileId: entry.providerId,
                    destLatKey: d.destLatKey,
                    destLngKey: d.destLngKey,
                  },
                },
                create: {
                  originLatKey,
                  originLngKey,
                  providerProfileId: entry.providerId,
                  destLatKey: d.destLatKey,
                  destLngKey: d.destLngKey,
                  drivingDistanceMeters: metersInt,
                  drivingDurationSeconds: durationSec != null ? Math.round(durationSec) : null,
                },
                update: {
                  drivingDistanceMeters: metersInt,
                  drivingDurationSeconds: durationSec != null ? Math.round(durationSec) : null,
                },
              });
            } catch (persistError: unknown) {
              const isMissingTable =
                persistError instanceof Prisma.PrismaClientKnownRequestError &&
                persistError.code === "P2021";
              if (isMissingTable) {
                this.logger.warn(
                  `provider_driving_distance_caches table missing; skipping cache write [rid:${requestId}]`
                );
              } else {
                this.logger.error(
                  `Driving distance cache write failed [rid:${requestId}]`,
                  persistError instanceof Error ? persistError.stack : undefined
                );
              }
            }

            out.set(entry.providerId, {
              km,
              meters: metersInt,
              kind: "DRIVING",
            });
          }
        }
      } catch (error: unknown) {
        this.logger.error(
          `Distance Matrix request failed [rid:${requestId}]`,
          error instanceof Error ? error.stack : undefined
        );
      }
    }

    return out;
  }
}
