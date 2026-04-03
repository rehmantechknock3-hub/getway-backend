import { describe, expect, it, vi, beforeEach } from "vitest";

import { ProvidersController } from "./providers.controller";
import { ProvidersService } from "./providers.service";

describe("ProvidersController", () => {
  let controller: ProvidersController;
  const providersService = {
    listPublicSummaries: vi.fn(),
    findPublicDetail: vi.fn(),
    listActiveServices: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new ProvidersController(providersService as unknown as ProvidersService);
  });

  it("list passes parsed query to service", async () => {
    providersService.listPublicSummaries.mockResolvedValue([]);
    await controller.list({ lat: "1", lon: "2", radius: "10" });
    expect(providersService.listPublicSummaries).toHaveBeenCalledWith(1, 2, 10);
  });

  it("getOne returns provider detail", async () => {
    providersService.findPublicDetail.mockResolvedValue({ id: "p1" });
    const result = await controller.getOne("p1");
    expect(result).toEqual({ id: "p1" });
    expect(providersService.findPublicDetail).toHaveBeenCalledWith("p1");
  });

  it("listServices returns services", async () => {
    providersService.listActiveServices.mockResolvedValue([]);
    await controller.listServices("p1");
    expect(providersService.listActiveServices).toHaveBeenCalledWith("p1");
  });
});
