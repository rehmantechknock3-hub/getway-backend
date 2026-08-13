import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminController } from "./admin.controller";

describe("AdminController", () => {
  const adminService = {
    getStats: vi.fn(),
    listUsers: vi.fn(),
    getUserDetail: vi.fn(),
    listServices: vi.fn(),
    updateServiceActive: vi.fn(),
    listProviders: vi.fn(),
    getProviderDetail: vi.fn(),
    updateProviderVerification: vi.fn(),
  };

  let controller: AdminController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AdminController(adminService as never);
  });

  const authedReq = { auth: { sub: "clerk_admin" } } as never;

  it("returns stats", async () => {
    adminService.getStats.mockResolvedValue({ users: { total: 1 } });
    await expect(controller.getStats()).resolves.toEqual({ users: { total: 1 } });
  });

  it("lists users with query defaults and excludes self", async () => {
    adminService.listUsers.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    await controller.listUsers(authedReq, {});
    expect(adminService.listUsers).toHaveBeenCalledWith(
      1,
      20,
      undefined,
      undefined,
      "clerk_admin",
    );
  });

  it("lists users with search", async () => {
    adminService.listUsers.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    await controller.listUsers(authedReq, { role: "CUSTOMER", q: "Ada" });
    expect(adminService.listUsers).toHaveBeenCalledWith(
      1,
      20,
      "CUSTOMER",
      "Ada",
      "clerk_admin",
    );
  });

  it("rejects list users without auth", () => {
    expect(() => controller.listUsers({} as never, {})).toThrow(BadRequestException);
  });

  it("lists services with search", async () => {
    adminService.listServices.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    await controller.listServices({ q: "wash" });
    expect(adminService.listServices).toHaveBeenCalledWith(1, 20, "wash", undefined);
  });

  it("lists services with active filter", async () => {
    adminService.listServices.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    await controller.listServices({ active: "false" });
    expect(adminService.listServices).toHaveBeenCalledWith(1, 20, undefined, false);
  });

  it("updates service active flag", async () => {
    adminService.updateServiceActive.mockResolvedValue({ id: "svc-1", isActive: false });
    await controller.updateServiceActive("svc-1", { isActive: false });
    expect(adminService.updateServiceActive).toHaveBeenCalledWith("svc-1", {
      isActive: false,
    });
  });

  it("lists providers with status filter", async () => {
    adminService.listProviders.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    await controller.listProviders({ status: "PENDING" });
    expect(adminService.listProviders).toHaveBeenCalledWith(1, 20, "PENDING");
  });

  it("gets provider detail", async () => {
    adminService.getProviderDetail.mockResolvedValue({ id: "pp-1" });
    await expect(controller.getProvider("pp-1")).resolves.toEqual({ id: "pp-1" });
    expect(adminService.getProviderDetail).toHaveBeenCalledWith("pp-1");
  });

  it("gets user detail for other users", async () => {
    adminService.getUserDetail.mockResolvedValue({ id: "u-1" });
    await expect(controller.getUser(authedReq, "u-1")).resolves.toEqual({ id: "u-1" });
    expect(adminService.getUserDetail).toHaveBeenCalledWith("u-1", "clerk_admin");
  });

  it("updates provider verification", async () => {
    adminService.updateProviderVerification.mockResolvedValue({ id: "pp-1" });
    await controller.updateProviderVerification("pp-1", {
      verificationStatus: "APPROVED",
    });
    expect(adminService.updateProviderVerification).toHaveBeenCalledWith("pp-1", {
      verificationStatus: "APPROVED",
    });
  });
});
