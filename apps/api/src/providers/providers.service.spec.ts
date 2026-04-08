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
  };

  let service: ProvidersService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProvidersService(prisma as never);
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

    const result = await service.listPublicSummaries(40.7128, -74.006, 50);

    expect(result.map((r) => r.id)).toEqual(["near"]);
  });

  it("findPublicDetail throws when missing", async () => {
    prisma.providerProfile.findFirst.mockResolvedValue(null);
    await expect(service.findPublicDetail("missing")).rejects.toThrow("not found");
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
