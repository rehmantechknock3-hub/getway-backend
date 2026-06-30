import { describe, expect, it, vi, beforeEach } from "vitest";

import { FavoritesService } from "./favorites.service";

describe("FavoritesService", () => {
  const prisma = {
    user: {
      findUnique: vi.fn(),
    },
    favoriteProvider: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    providerProfile: {
      findFirst: vi.fn(),
    },
  };

  const providersService = {
    findPublicSummariesByIds: vi.fn(),
    findPublicSummariesByIdsWithDrivingDistances: vi.fn(),
  };

  let service: FavoritesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FavoritesService(prisma as never, providersService as never);
  });

  it("list returns ordered summaries", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u-1", role: "CUSTOMER" });
    prisma.favoriteProvider.findMany.mockResolvedValue([
      { providerId: "pp-2" },
      { providerId: "pp-1" },
    ]);
    providersService.findPublicSummariesByIds.mockResolvedValue([
      { id: "pp-2", firstName: "B", lastName: "Two" },
      { id: "pp-1", firstName: "A", lastName: "One" },
    ]);

    const result = await service.list("clerk-1");

    expect(providersService.findPublicSummariesByIds).toHaveBeenCalledWith(["pp-2", "pp-1"]);
    expect(providersService.findPublicSummariesByIdsWithDrivingDistances).not.toHaveBeenCalled();
    expect(result.data).toHaveLength(2);
  });

  it("list passes lat/lon through to driving-distance enrichment", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u-1", role: "CUSTOMER" });
    prisma.favoriteProvider.findMany.mockResolvedValue([{ providerId: "pp-1" }]);
    providersService.findPublicSummariesByIdsWithDrivingDistances.mockResolvedValue([
      { id: "pp-1", firstName: "A", lastName: "One", distanceMeters: 1200 },
    ]);

    const result = await service.list("clerk-1", 31.5, 74.3, "rid-1");

    expect(providersService.findPublicSummariesByIdsWithDrivingDistances).toHaveBeenCalledWith(
      ["pp-1"],
      31.5,
      74.3,
      "rid-1"
    );
    expect(providersService.findPublicSummariesByIds).not.toHaveBeenCalled();
    expect(result.data[0]?.distanceMeters).toBe(1200);
  });

  it("add upserts favorite", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u-1", role: "CUSTOMER" });
    prisma.providerProfile.findFirst.mockResolvedValue({ id: "pp-1" });

    await service.add("clerk-1", "pp-1");

    expect(prisma.favoriteProvider.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          customerId_providerId: { customerId: "u-1", providerId: "pp-1" },
        },
      })
    );
  });
});
