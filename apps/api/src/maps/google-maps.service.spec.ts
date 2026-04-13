import { Prisma } from "@prisma/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { GoogleMapsService } from "./google-maps.service";

describe("GoogleMapsService", () => {
  const findMany = vi.fn();
  const upsert = vi.fn();
  const txUpdateProfile = vi.fn();
  const txUpdateUser = vi.fn();
  const prisma = {
    providerDrivingDistanceCache: { findMany, upsert },
    providerProfile: { update: vi.fn() },
    user: { update: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        providerProfile: { update: txUpdateProfile },
        user: { update: txUpdateUser },
      };
      return fn(tx as never);
    }),
  };

  const configGet = vi.fn();
  const configService = { get: configGet };

  let service: GoogleMapsService;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    configGet.mockImplementation((key: string) => {
      if (key === "GOOGLE_MAPS_API_KEY") return "test-key";
      if (key === "DRIVING_DISTANCE_CACHE_TTL_HOURS") return "24";
      return undefined;
    });
    findMany.mockResolvedValue([]);
    upsert.mockResolvedValue({});
    service = new GoogleMapsService(prisma as never, configService as never);
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("resolveDrivingDistances returns empty map for no entries", async () => {
    const out = await service.resolveDrivingDistances(1, 2, [], "rid-0");
    expect(out.size).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("resolveDrivingDistances uses straight-line when API key missing", async () => {
    configGet.mockImplementation(() => undefined);
    const svc = new GoogleMapsService(prisma as never, configService as never);
    const out = await svc.resolveDrivingDistances(10, 20, [
      { providerId: "p1", destLat: 10.1, destLon: 20.1, fallbackKm: 3.3 },
    ]);
    expect(out.get("p1")).toEqual({ km: 3.3, meters: 3300, kind: "STRAIGHT_LINE" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("resolveDrivingDistances skips fetch when fresh cache covers entry", async () => {
    findMany.mockResolvedValue([
      {
        providerProfileId: "p1",
        drivingDistanceMeters: 12_500,
        destLatKey: service.coordKey(40.7129, 5),
        destLngKey: service.coordKey(-74.0061, 5),
      },
    ]);

    const out = await service.resolveDrivingDistances(40.7128, -74.006, [
      { providerId: "p1", destLat: 40.7129, destLon: -74.0061, fallbackKm: 0.5 },
    ]);

    expect(out.get("p1")).toEqual({ km: 12.5, meters: 12_500, kind: "DRIVING" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("resolveDrivingDistances survives missing cache table (P2021) and still returns driving km", async () => {
    findMany.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("table missing", {
        code: "P2021",
        clientVersion: "test",
      })
    );
    fetchSpy.mockResolvedValue({
      json: async () => ({
        status: "OK",
        rows: [
          {
            elements: [{ status: "OK", distance: { value: 1000 }, duration: { value: 120 } }],
          },
        ],
      }),
    } as Response);
    upsert.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("table missing", {
        code: "P2021",
        clientVersion: "test",
      })
    );

    const out = await service.resolveDrivingDistances(1, 2, [
      { providerId: "p1", destLat: 1.01, destLon: 2.01, fallbackKm: 0.9 },
    ]);

    expect(out.get("p1")).toEqual({ km: 1, meters: 1000, kind: "DRIVING" });
  });

  it("resolveDrivingDistances calls Distance Matrix and upserts on cache miss", async () => {
    fetchSpy.mockResolvedValue({
      json: async () => ({
        status: "OK",
        rows: [
          {
            elements: [{ status: "OK", distance: { value: 8800 }, duration: { value: 720 } }],
          },
        ],
      }),
    } as Response);

    const out = await service.resolveDrivingDistances(40.7128, -74.006, [
      { providerId: "p1", destLat: 40.72, destLon: -74.01, fallbackKm: 1.2 },
    ]);

    expect(out.get("p1")).toEqual({ km: 8.8, meters: 8800, kind: "DRIVING" });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0]?.[0]?.create?.drivingDistanceMeters).toBe(8800);
  });

  it("backfillProviderCoordinatesIfNeeded returns row when profile or shop already has coords", async () => {
    const row = {
      id: "pp-1",
      userId: "u-1",
      latitude: 1,
      longitude: 2,
      user: { id: "u-1", providerOnboarding: null },
    };
    const out = await service.backfillProviderCoordinatesIfNeeded(row, "rid-b");
    expect(out).toBe(row);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("backfillProviderCoordinatesIfNeeded uses shop coordinates from DB without geocoding", async () => {
    const row = {
      id: "pp-2",
      userId: "u-2",
      latitude: null,
      longitude: null,
      user: {
        id: "u-2",
        providerOnboarding: {
          serviceCategories: ["Car Wash"],
          serviceArea: "Lahore",
          shopAddress: "Lake City Lahore",
          shopLocations: [
            {
              address: "Lake City Lahore",
              placeId: "place_1234567890",
              latitude: 31.40,
              longitude: 74.20,
            },
          ],
          hasTools: true,
          serviceDescription: "desc",
          experienceYears: 2,
        },
      },
    };

    const out = await service.backfillProviderCoordinatesIfNeeded(row, "rid-db");

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(txUpdateProfile).not.toHaveBeenCalled();
    expect(out.latitude).toBe(31.40);
    expect(out.longitude).toBe(74.20);
  });

  it("backfillProviderCoordinatesIfNeeded geocodes when current address has no DB coordinates", async () => {
    fetchSpy.mockResolvedValue({
      json: async () => ({
        status: "OK",
        results: [{ geometry: { location: { lat: 31.51, lng: 74.31 } } }],
      }),
    } as Response);
    const row = {
      id: "pp-3",
      userId: "u-3",
      latitude: 31.1,
      longitude: 74.1,
      user: {
        id: "u-3",
        providerOnboarding: {
          serviceCategories: ["Car Wash"],
          serviceArea: "Lahore",
          shopAddress: "New Address Lahore",
          shopPlaceId: "new_place_1234567890",
          shopLocations: [
            {
              address: "Old Address Lahore",
              placeId: "old_place_1234567890",
              latitude: 31.1,
              longitude: 74.1,
            },
          ],
          hasTools: true,
          serviceDescription: "desc",
          experienceYears: 2,
        },
      },
    };

    const out = await service.backfillProviderCoordinatesIfNeeded(row, "rid-geocode");

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(txUpdateProfile).toHaveBeenCalledTimes(1);
    expect(out.latitude).toBe(31.51);
    expect(out.longitude).toBe(74.31);
  });
});
