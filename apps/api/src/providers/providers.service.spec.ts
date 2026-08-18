import { describe, expect, it, vi, beforeEach } from "vitest";

import { ProvidersService } from "./providers.service";

describe("ProvidersService", () => {
  const prisma = {
    providerProfile: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    service: {
      findMany: vi.fn(),
    },
    booking: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };

  const googleMaps = {
    backfillProviderCoordinatesIfNeeded: vi.fn((row: unknown) => Promise.resolve(row)),
    resolveDrivingDistances: vi.fn(
      async (
        _customerLat: number,
        _customerLon: number,
        entries: Array<{ providerId: string; destLat: number; destLon: number; fallbackKm: number }>
      ) => {
        const m = new Map<string, { km: number; meters: number; kind: "DRIVING" }>();
        for (const e of entries) {
          const meters = Math.round(e.fallbackKm * 1000);
          m.set(e.providerId, { km: meters / 1000, meters, kind: "DRIVING" });
        }
        return m;
      }
    ),
  };

  let service: ProvidersService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProvidersService(prisma as never, googleMaps as never);
  });

  it("listPublicSummaries maps rows with onboarding and first service", async () => {
    prisma.providerProfile.findMany.mockResolvedValue([
      {
        id: "pp-1",
        userId: "u-1",
        bio: "Hello",
        verificationStatus: "APPROVED",
        isOnline: true,
        averageRating: 4.5,
        totalReviews: 10,
        totalEarnings: 0,
        latitude: 31.5,
        longitude: 74.3,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: "u-1",
          firstName: "Ada",
          lastName: "Lovelace",
          avatarUrl: null,
          providerOnboarding: {
            serviceCategory: "Car Wash",
            experienceYears: 3,
            serviceArea: "Downtown",
            shopAddress: "Downtown Service Hub",
            hasTools: true,
            serviceDescription: "Full detail",
          },
        },
        services: [
          {
            id: "s-1",
            providerId: "pp-1",
            categoryId: "c-1",
            title: "Basic wash",
            description: null,
            price: 45,
            duration: 60,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            category: { name: "Cleaning" },
          },
        ],
      },
    ]);

    const result = await service.listPublicSummaries();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "pp-1",
      userId: "u-1",
      firstName: "Ada",
      lastName: "Lovelace",
      serviceCategory: "Car Wash",
      serviceArea: "Downtown",
      averageRating: 4.5,
      totalReviews: 10,
      startingPrice: 45,
      primaryServiceTitle: "Basic wash",
      primaryServiceId: "s-1",
      serviceSearchText: "basic wash cleaning",
    });
  });

  it("listPublicSummaries aggregates serviceSearchText from all active services", async () => {
    prisma.providerProfile.findMany.mockResolvedValue([
      {
        id: "pp-1",
        userId: "u-1",
        bio: null,
        verificationStatus: "APPROVED",
        isOnline: true,
        averageRating: 5,
        totalReviews: 1,
        totalEarnings: 0,
        latitude: null,
        longitude: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: "u-1",
          firstName: "X",
          lastName: "Y",
          avatarUrl: null,
          providerOnboarding: null,
        },
        services: [
          {
            id: "s-1",
            title: "Oil change",
            description: "Synthetic blend",
            price: 40,
            duration: 30,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            category: { name: "Automotive" },
          },
          {
            id: "s-2",
            title: "Brake inspection",
            description: null,
            price: 55,
            duration: 45,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            category: { name: "Automotive" },
          },
        ],
      },
    ]);

    const result = await service.listPublicSummaries();

    expect(result[0]?.serviceSearchText).toBe(
      "oil change synthetic blend automotive brake inspection automotive"
    );
    expect(result[0]?.startingPrice).toBe(40);
    expect(result[0]?.primaryServiceTitle).toBe("Oil change");
  });

  it("listPublicSummaries filters by radius when lat and lon provided", async () => {
    prisma.providerProfile.findMany.mockResolvedValue([
      {
        id: "near",
        userId: "u-1",
        verificationStatus: "APPROVED",
        isOnline: false,
        averageRating: 5,
        totalReviews: 1,
        totalEarnings: 0,
        latitude: 40.7128,
        longitude: -74.006,
        bio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: "u-1",
          firstName: "A",
          lastName: "B",
          avatarUrl: null,
          providerOnboarding: null,
        },
        services: [],
      },
      {
        id: "far",
        userId: "u-2",
        verificationStatus: "APPROVED",
        isOnline: false,
        averageRating: 4,
        totalReviews: 2,
        totalEarnings: 0,
        latitude: 34.05,
        longitude: -118.25,
        bio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: "u-2",
          firstName: "C",
          lastName: "D",
          avatarUrl: null,
          providerOnboarding: null,
        },
        services: [],
      },
    ]);

    const result = await service.listPublicSummaries(40.7128, -74.006, 50, "rid-1");

    expect(result.map((r) => r.id)).toEqual(["near"]);
    expect(result[0]?.distanceKm).toBe(0);
    expect(result[0]?.distanceMeters).toBe(0);
    expect(result[0]?.nearestLocationLatitude).toBe(40.7128);
    expect(result[0]?.nearestLocationLongitude).toBe(-74.006);
    expect(result[0]?.distanceKind).toBe("DRIVING");
    expect(googleMaps.resolveDrivingDistances).toHaveBeenCalledWith(
      40.7128,
      -74.006,
      expect.arrayContaining([
        expect.objectContaining({ providerId: "near", fallbackKm: expect.any(Number) as number }),
      ]),
      "rid-1"
    );
  });

  it("listPublicSummaries drops providers when driving distance exceeds radius even if Haversine is inside", async () => {
    prisma.providerProfile.findMany.mockResolvedValue([
      {
        id: "road-longer",
        userId: "u-1",
        verificationStatus: "APPROVED",
        isOnline: true,
        averageRating: 4,
        totalReviews: 1,
        totalEarnings: 0,
        latitude: 40.7848,
        longitude: -74.006,
        bio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: "u-1",
          firstName: "Zac",
          lastName: "Far",
          avatarUrl: null,
          providerOnboarding: null,
        },
        services: [],
      },
    ]);
    googleMaps.resolveDrivingDistances.mockImplementationOnce(
      async (
        _customerLat: number,
        _customerLon: number,
        entries: Array<{ providerId: string }>
      ) => {
        const m = new Map<string, { km: number; meters: number; kind: "DRIVING" }>();
        for (const e of entries) {
          m.set(e.providerId, { km: 11.3, meters: 11_300, kind: "DRIVING" });
        }
        return m;
      }
    );

    const result = await service.listPublicSummaries(40.7128, -74.006, 10, "rid-long");

    expect(result).toHaveLength(0);
  });

  it("listPublicSummaries uses nearest provider shop location from onboarding", async () => {
    prisma.providerProfile.findMany.mockResolvedValue([
      {
        id: "multi",
        userId: "u-1",
        verificationStatus: "APPROVED",
        isOnline: true,
        averageRating: 4.9,
        totalReviews: 14,
        totalEarnings: 0,
        latitude: 34.05,
        longitude: -118.25,
        bio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: "u-1",
          firstName: "M",
          lastName: "L",
          avatarUrl: null,
          providerOnboarding: {
            serviceCategories: ["Cleaning"],
            serviceArea: "Downtown",
            shopAddress: "Primary far location",
            shopLocations: [
              { address: "Primary far location", latitude: 34.05, longitude: -118.25 },
              { address: "Branch near customer", latitude: 40.713, longitude: -74.006 },
            ],
            experienceYears: 4,
            hasTools: true,
            serviceDescription: "Test",
          },
        },
        services: [],
      },
    ]);

    const result = await service.listPublicSummaries(40.7128, -74.006, 5);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("multi");
    expect((result[0]?.distanceKm ?? 999) < 1).toBe(true);
    expect(result[0]?.nearestLocationLatitude).toBe(40.713);
    expect(result[0]?.nearestLocationLongitude).toBe(-74.006);
  });

  it("listPublicSummaries omits providers with no coordinates when lat and lon are provided", async () => {
    prisma.providerProfile.findMany.mockResolvedValue([
      {
        id: "near",
        userId: "u-1",
        verificationStatus: "APPROVED",
        isOnline: false,
        averageRating: 3,
        totalReviews: 1,
        totalEarnings: 0,
        latitude: 40.7128,
        longitude: -74.006,
        bio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: "u-1",
          firstName: "N",
          lastName: "ear",
          avatarUrl: null,
          providerOnboarding: null,
        },
        services: [],
      },
      {
        id: "no_pin",
        userId: "u-2",
        verificationStatus: "APPROVED",
        isOnline: false,
        averageRating: 5,
        totalReviews: 2,
        totalEarnings: 0,
        latitude: null,
        longitude: null,
        bio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: "u-2",
          firstName: "No",
          lastName: "Coords",
          avatarUrl: null,
          providerOnboarding: {
            serviceCategories: ["Paint"],
            serviceArea: "Somewhere",
            shopAddress: "123 Main Street",
            shopLocations: [{ address: "123 Main Street", placeId: "ChIJnolanglng00" }],
            experienceYears: 1,
            hasTools: true,
            serviceDescription: "Interior paint",
          },
        },
        services: [],
      },
    ]);

    const result = await service.listPublicSummaries(40.7128, -74.006, 50);

    expect(result.map((r) => r.id)).toEqual(["near"]);
  });

  it("findPublicSummariesByIdsWithDrivingDistances preserves id order and calls Matrix", async () => {
    prisma.providerProfile.findMany.mockResolvedValue([
      {
        id: "pp-a",
        userId: "u-1",
        bio: null,
        verificationStatus: "APPROVED",
        isOnline: true,
        averageRating: 4,
        totalReviews: 1,
        totalEarnings: 0,
        latitude: 31.52,
        longitude: 74.35,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: "u-1",
          firstName: "John",
          lastName: "Cena",
          avatarUrl: null,
          providerOnboarding: {
            serviceCategories: ["Detail"],
            serviceArea: "Lahore",
            shopAddress: "Lake City",
            experienceYears: 2,
            hasTools: true,
            serviceDescription: "Detailing",
          },
        },
        services: [
          {
            id: "s-1",
            providerId: "pp-a",
            categoryId: "c-1",
            title: "Car Detailing",
            description: null,
            price: 100,
            duration: 28,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            category: { name: "Auto" },
          },
        ],
      },
    ]);

    const result = await service.findPublicSummariesByIdsWithDrivingDistances(
      ["pp-a"],
      31.5,
      74.3,
      "rid-fav"
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("pp-a");
    expect(result[0]?.distanceMeters).toBeDefined();
    expect(googleMaps.resolveDrivingDistances).toHaveBeenCalled();
  });

  it("findPublicDetail throws when missing", async () => {
    prisma.providerProfile.findFirst.mockResolvedValue(null);
    await expect(service.findPublicDetail("missing")).rejects.toThrow("not found");
  });

  it("findPublicDetail includes booked slots without customer identity", async () => {
    const scheduledAt = new Date("2026-08-20T10:00:00.000Z");
    prisma.providerProfile.findFirst.mockResolvedValue({
      id: "pp-1",
      userId: "u-1",
      bio: null,
      verificationStatus: "APPROVED",
      isOnline: true,
      averageRating: 5,
      totalReviews: 1,
      latitude: null,
      longitude: null,
      availabilityDays: [{ date: "2026-08-20", enabled: true, startHour: 9, endHour: 18 }],
      user: {
        id: "u-1",
        firstName: "Ada",
        lastName: "Lovelace",
        avatarUrl: null,
        providerOnboarding: null,
      },
      services: [],
    });
    prisma.booking.findMany.mockResolvedValue([
      { scheduledAt, service: { duration: 60 } },
    ]);

    const result = await service.findPublicDetail("pp-1");

    expect(result.bookedSlots).toEqual([{ scheduledAt, durationMinutes: 60 }]);
    expect(result).not.toHaveProperty("customerId");
  });

  it("listActiveServices returns mapped offers", async () => {
    prisma.providerProfile.findFirst.mockResolvedValue({ id: "pp-1" });
    prisma.service.findMany.mockResolvedValue([
      {
        id: "s-1",
        title: "Wash",
        description: "Quick",
        price: 30,
        duration: 45,
        isActive: true,
        category: { name: "Auto" },
      },
    ]);

    const result = await service.listActiveServices("pp-1");

    expect(result).toEqual([
      {
        id: "s-1",
        title: "Wash",
        description: "Quick",
        price: 30,
        duration: 45,
        categoryName: "Auto",
        isActive: true,
      },
    ]);
  });
});
