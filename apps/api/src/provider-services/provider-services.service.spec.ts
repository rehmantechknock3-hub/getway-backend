import { describe, expect, it, vi, beforeEach } from "vitest";

import { ProviderServicesService } from "./provider-services.service";

const providerUser = {
  id: "u-1",
  role: "PROVIDER" as const,
  providerOnboarding: {
    serviceCategories: ["Car Detailing", "Oil Change"],
    serviceArea: "Lahore",
    shopAddress: "Lake City",
    shopLocations: [{ address: "Lake City" }],
    hasTools: true,
    serviceDescription: "desc",
    experienceYears: 4,
  },
  providerProfile: {
    id: "pp-1",
    dismissedServiceCategoryIds: [] as string[],
  },
};

describe("ProviderServicesService", () => {
  const cache = {
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(true),
  };

  const prisma = {
    user: { findUnique: vi.fn(), update: vi.fn() },
    providerProfile: { update: vi.fn() },
    service: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    serviceCategory: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  };

  let service: ProviderServicesService;

  beforeEach(() => {
    vi.clearAllMocks();
    cache.get.mockResolvedValue(undefined);
    service = new ProviderServicesService(prisma as never, cache as never);
  });

  it("createCategory returns existing own row when name matches case-insensitively", async () => {
    prisma.user.findUnique.mockResolvedValue(providerUser);
    prisma.serviceCategory.findFirst.mockResolvedValueOnce({
      id: "c-1",
      name: "Brakes",
      icon: "x",
      description: null,
      providerId: "pp-1",
    });

    const result = await service.createCategory("clerk-p", { name: "brakes" });

    expect(result.id).toBe("c-1");
    expect(prisma.serviceCategory.create).not.toHaveBeenCalled();
  });

  it("createCategory returns shared catalog row when name matches", async () => {
    prisma.user.findUnique.mockResolvedValue(providerUser);
    prisma.serviceCategory.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "c-shared",
        name: "Car Wash",
        icon: "water",
        description: null,
        providerId: null,
      });

    const result = await service.createCategory("clerk-p", { name: "car wash" });

    expect(result.id).toBe("c-shared");
    expect(prisma.serviceCategory.create).not.toHaveBeenCalled();
  });

  it("createCategory inserts new owned row when no match", async () => {
    prisma.user.findUnique.mockResolvedValue(providerUser);
    prisma.serviceCategory.findFirst.mockResolvedValue(null);
    prisma.serviceCategory.create.mockResolvedValue({
      id: "c-new",
      name: "Custom",
      icon: "pricetag-outline",
      description: null,
      providerId: "pp-1",
    });

    const result = await service.createCategory("clerk-p", { name: "Custom" });

    expect(result.id).toBe("c-new");
    expect(prisma.serviceCategory.create).toHaveBeenCalledWith({
      data: { name: "Custom", icon: "pricetag-outline", providerId: "pp-1" },
    });
  });

  it("listCategories builds OR filter for shared, owned, and used categories", async () => {
    prisma.user.findUnique.mockResolvedValue(providerUser);
    prisma.service.findMany.mockResolvedValue([{ categoryId: "c-used" }]);
    prisma.serviceCategory.findMany.mockResolvedValue([
      { id: "c-a", name: "A", icon: "i", description: null, providerId: null },
    ]);

    const result = await service.listCategories("clerk-p");

    expect(result).toHaveLength(1);
    expect(prisma.serviceCategory.findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ providerId: null }, { providerId: "pp-1" }, { id: { in: ["c-used"] } }],
      },
      orderBy: { name: "asc" },
    });
  });

  it("listMyServices rejects customers", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u-1",
      role: "CUSTOMER",
      providerProfile: null,
    });

    await expect(service.listMyServices("clerk-1")).rejects.toMatchObject({ status: 403 });
  });

  it("listMyServices returns rows", async () => {
    prisma.user.findUnique.mockResolvedValue(providerUser);
    prisma.service.findMany.mockResolvedValue([
      {
        id: "s-1",
        title: "Wash",
        description: "Full",
        price: 40,
        duration: 45,
        categoryId: "c-1",
        isActive: true,
        category: { name: "Car" },
      },
    ]);

    const result = await service.listMyServices("clerk-p");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "s-1",
      title: "Wash",
      categoryName: "Car",
      categoryId: "c-1",
      isActive: true,
    });
  });

  it("create rejects unknown category", async () => {
    prisma.user.findUnique.mockResolvedValue(providerUser);
    prisma.serviceCategory.findFirst.mockResolvedValue(null);

    await expect(
      service.create("clerk-p", {
        categoryId: "00000000-0000-4000-8000-000000000099",
        title: "X",
        price: 10,
        duration: 30,
      })
    ).rejects.toMatchObject({ status: 404 });
  });

  it("create rejects another provider's private category", async () => {
    prisma.user.findUnique.mockResolvedValue(providerUser);
    prisma.serviceCategory.findFirst.mockResolvedValue({
      id: "c-other",
      name: "Oil",
      icon: "i",
      description: null,
      providerId: "pp-other",
    });
    prisma.service.count.mockResolvedValue(0);

    await expect(
      service.create("clerk-p", {
        categoryId: "c-other",
        title: "X",
        price: 10,
        duration: 30,
      })
    ).rejects.toMatchObject({ status: 403 });
  });

  it("create inserts service", async () => {
    prisma.user.findUnique.mockResolvedValue(providerUser);
    prisma.serviceCategory.findFirst.mockResolvedValue({
      id: "c-1",
      name: "Auto",
      icon: "x",
      description: null,
      providerId: null,
    });
    prisma.service.create.mockResolvedValue({
      id: "s-new",
      title: "Oil",
      description: null,
      price: 49,
      duration: 60,
      categoryId: "c-1",
      isActive: true,
      category: { name: "Auto" },
    });

    const result = await service.create("clerk-p", {
      categoryId: "c-1",
      title: "Oil",
      price: 49,
      duration: 60,
    });

    expect(result.id).toBe("s-new");
    expect(prisma.service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          providerId: "pp-1",
          title: "Oil",
          price: 49,
          duration: 60,
        }),
      })
    );
  });

  it("deleteCategory removes provider services and dismisses shared category", async () => {
    prisma.user.findUnique.mockResolvedValue(providerUser);
    prisma.serviceCategory.findUnique.mockResolvedValue({
      id: "c-1",
      name: "Car Detailing",
      icon: "i",
      description: null,
      providerId: null,
    });
    prisma.service.deleteMany.mockResolvedValue({ count: 1 });
    prisma.providerProfile.update.mockResolvedValue({});

    await service.deleteCategory("clerk-p", "c-1");

    expect(prisma.service.deleteMany).toHaveBeenCalledWith({
      where: { providerId: "pp-1", categoryId: "c-1" },
    });
    expect(prisma.providerProfile.update).toHaveBeenCalledWith({
      where: { id: "pp-1" },
      data: { dismissedServiceCategoryIds: ["c-1"] },
    });
    expect(prisma.user.update).toHaveBeenCalled();
    expect(prisma.serviceCategory.delete).not.toHaveBeenCalled();
  });

  it("deleteCategory rejects another provider's category", async () => {
    prisma.user.findUnique.mockResolvedValue(providerUser);
    prisma.serviceCategory.findUnique.mockResolvedValue({
      id: "c-1",
      name: "Theirs",
      icon: "i",
      description: null,
      providerId: "pp-other",
    });

    await expect(service.deleteCategory("clerk-p", "c-1")).rejects.toMatchObject({ status: 403 });

    expect(prisma.serviceCategory.delete).not.toHaveBeenCalled();
  });

  it("deleteCategory removes row when unused", async () => {
    prisma.user.findUnique.mockResolvedValue(providerUser);
    prisma.serviceCategory.findUnique.mockResolvedValue({
      id: "c-orphan",
      name: "Car Detailing",
      icon: "i",
      description: null,
      providerId: "pp-1",
    });
    prisma.service.deleteMany.mockResolvedValue({ count: 0 });
    prisma.serviceCategory.delete.mockResolvedValue({
      id: "c-orphan",
      name: "Typo",
      icon: "i",
      description: null,
      providerId: "pp-1",
    });

    await service.deleteCategory("clerk-p", "c-orphan");

    expect(prisma.serviceCategory.delete).toHaveBeenCalledWith({ where: { id: "c-orphan" } });
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it("update returns unchanged row when payload empty", async () => {
    prisma.user.findUnique.mockResolvedValue(providerUser);
    prisma.service.findFirst
      .mockResolvedValueOnce({ id: "s-1", providerId: "pp-1" })
      .mockResolvedValueOnce({
        id: "s-1",
        title: "T",
        description: null,
        price: 1,
        duration: 10,
        categoryId: "c-1",
        isActive: true,
        category: { name: "Cat" },
      });

    const result = await service.update("clerk-p", "s-1", {});

    expect(result.title).toBe("T");
    expect(prisma.service.update).not.toHaveBeenCalled();
  });

  it("remove deletes service for provider and clears caches", async () => {
    prisma.user.findUnique.mockResolvedValue(providerUser);
    prisma.service.findFirst.mockResolvedValue({ id: "s-1", categoryId: "c-own" });
    prisma.service.delete.mockResolvedValue({ id: "s-1" });
    prisma.service.count.mockResolvedValue(0);
    prisma.serviceCategory.findUnique.mockResolvedValue({
      id: "c-own",
      providerId: "pp-1",
      name: "Car Detailing",
    });
    prisma.serviceCategory.delete.mockResolvedValue({ id: "c-own" });

    await service.remove("clerk-p", "s-1");

    expect(prisma.service.delete).toHaveBeenCalledWith({ where: { id: "s-1" } });
    expect(prisma.serviceCategory.delete).toHaveBeenCalledWith({ where: { id: "c-own" } });
    expect(prisma.user.update).toHaveBeenCalled();
    expect(cache.del).toHaveBeenCalledWith("svc:mine:clerk-p");
    expect(cache.del).toHaveBeenCalledWith("gn:srv-categories:v2:clerk-p");
  });

  it("remove dismisses shared category when deleted service was the last one", async () => {
    prisma.user.findUnique.mockResolvedValue(providerUser);
    prisma.service.findFirst.mockResolvedValue({ id: "s-1", categoryId: "c-shared" });
    prisma.service.delete.mockResolvedValue({ id: "s-1" });
    prisma.service.count.mockResolvedValue(0);
    prisma.serviceCategory.findUnique.mockResolvedValue({
      id: "c-shared",
      providerId: null,
      name: "Oil Change",
    });
    prisma.providerProfile.update.mockResolvedValue({});

    await service.remove("clerk-p", "s-1");

    expect(prisma.providerProfile.update).toHaveBeenCalledWith({
      where: { id: "pp-1" },
      data: { dismissedServiceCategoryIds: ["c-shared"] },
    });
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it("remove rejects when service is not owned by provider", async () => {
    prisma.user.findUnique.mockResolvedValue(providerUser);
    prisma.service.findFirst.mockResolvedValue(null);

    await expect(service.remove("clerk-p", "missing")).rejects.toMatchObject({ status: 404 });
    expect(prisma.service.delete).not.toHaveBeenCalled();
  });
});
