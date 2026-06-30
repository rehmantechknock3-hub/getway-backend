import { describe, expect, it, vi } from "vitest";

import { ProviderServicesController } from "./provider-services.controller";

describe("ProviderServicesController", () => {
  it("createCategory parses body and delegates", async () => {
    const providerServicesService = {
      createCategory: vi.fn().mockResolvedValue({ id: "c-1", name: "Brakes" }),
    };
    const controller = new ProviderServicesController(providerServicesService as never);

    const req = { auth: { sub: "clerk_prov" } } as never;
    const result = await controller.createCategory(req, { name: "Brakes" });

    expect(providerServicesService.createCategory).toHaveBeenCalledWith("clerk_prov", { name: "Brakes" });
    expect(result).toEqual({ id: "c-1", name: "Brakes" });
  });

  it("categories requires auth and delegates listCategories", async () => {
    const providerServicesService = {
      listCategories: vi.fn().mockResolvedValue([]),
    };
    const controller = new ProviderServicesController(providerServicesService as never);

    const req = { auth: { sub: "clerk_prov" } } as never;
    const result = await controller.categories(req);

    expect(providerServicesService.listCategories).toHaveBeenCalledWith("clerk_prov");
    expect(result).toEqual([]);
  });

  it("list delegates to listMyServices", async () => {
    const providerServicesService = {
      listMyServices: vi.fn().mockResolvedValue([]),
    };
    const controller = new ProviderServicesController(providerServicesService as never);

    const req = { auth: { sub: "clerk_prov" } } as never;
    const result = await controller.list(req);

    expect(providerServicesService.listMyServices).toHaveBeenCalledWith("clerk_prov");
    expect(result).toEqual([]);
  });

  it("create parses body and delegates", async () => {
    const providerServicesService = {
      create: vi.fn().mockResolvedValue({ id: "s-1" }),
    };
    const controller = new ProviderServicesController(providerServicesService as never);

    const req = { auth: { sub: "clerk_prov" } } as never;
    const body = {
      categoryId: "123e4567-e89b-12d3-a456-426614174000",
      title: "Wash",
      price: 25,
      duration: 30,
    };
    const result = await controller.create(req, body);

    expect(providerServicesService.create).toHaveBeenCalledWith("clerk_prov", body);
    expect(result).toEqual({ id: "s-1" });
  });

  it("deleteCategory delegates with uuid param", async () => {
    const providerServicesService = {
      deleteCategory: vi.fn().mockResolvedValue(undefined),
    };
    const controller = new ProviderServicesController(providerServicesService as never);

    const req = { auth: { sub: "clerk_prov" } } as never;
    const catId = "a0000000-0000-4000-8000-000000000001";
    await controller.deleteCategory(req, catId);

    expect(providerServicesService.deleteCategory).toHaveBeenCalledWith("clerk_prov", catId);
  });

  it("update parses body and delegates", async () => {
    const providerServicesService = {
      update: vi.fn().mockResolvedValue({ id: "s-1", title: "Updated" }),
    };
    const controller = new ProviderServicesController(providerServicesService as never);

    const req = { auth: { sub: "clerk_prov" } } as never;
    const result = await controller.update(req, "s-1", { title: "Updated" });

    expect(providerServicesService.update).toHaveBeenCalledWith("clerk_prov", "s-1", {
      title: "Updated",
    });
    expect(result).toEqual({ id: "s-1", title: "Updated" });
  });

  it("remove delegates with uuid param", async () => {
    const providerServicesService = {
      remove: vi.fn().mockResolvedValue(undefined),
    };
    const controller = new ProviderServicesController(providerServicesService as never);

    const req = { auth: { sub: "clerk_prov" } } as never;
    const serviceId = "b0000000-0000-4000-8000-000000000001";
    await controller.remove(req, serviceId);

    expect(providerServicesService.remove).toHaveBeenCalledWith("clerk_prov", serviceId);
  });
});
