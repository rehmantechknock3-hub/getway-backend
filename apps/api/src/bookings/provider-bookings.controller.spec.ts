import { describe, expect, it, vi } from "vitest";

import { ProviderBookingsController } from "./provider-bookings.controller";

describe("ProviderBookingsController", () => {
  it("list delegates to listForProvider", async () => {
    const bookingsService = {
      listForProvider: vi
        .fn()
        .mockResolvedValue({
          data: [],
          total: 0,
          page: 1,
          limit: 20,
          stats: { pending: 0, active: 0, completed: 0, totalEarnings: 0 },
        }),
    };
    const controller = new ProviderBookingsController(bookingsService as never);

    const req = { auth: { sub: "clerk_prov" } } as never;
    const result = await controller.list(req, {});

    expect(bookingsService.listForProvider).toHaveBeenCalledWith("clerk_prov", 1, 20, "queue");
    expect(result).toEqual({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      stats: { pending: 0, active: 0, completed: 0, totalEarnings: 0 },
    });
  });

  it("list passes scope from query string", async () => {
    const bookingsService = {
      listForProvider: vi.fn().mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        stats: { pending: 0, active: 0, completed: 0, totalEarnings: 0 },
      }),
    };
    const controller = new ProviderBookingsController(bookingsService as never);

    const req = { auth: { sub: "clerk_prov" } } as never;
    await controller.list(req, { scope: "history" });

    expect(bookingsService.listForProvider).toHaveBeenCalledWith("clerk_prov", 1, 20, "history");
  });

  it("patchStatus parses body and delegates", async () => {
    const bookingsService = {
      updateStatusForProvider: vi.fn().mockResolvedValue({ id: "b-1" }),
    };
    const controller = new ProviderBookingsController(bookingsService as never);

    const req = { auth: { sub: "clerk_prov" } } as never;
    const result = await controller.patchStatus(req, "booking-uuid", { status: "ACCEPTED" });

    expect(bookingsService.updateStatusForProvider).toHaveBeenCalledWith("clerk_prov", "booking-uuid", {
      status: "ACCEPTED",
    });
    expect(result).toEqual({ id: "b-1" });
  });
});
