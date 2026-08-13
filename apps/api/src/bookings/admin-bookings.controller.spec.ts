import { describe, expect, it, vi } from "vitest";

import { AdminBookingsController } from "./admin-bookings.controller";

describe("AdminBookingsController", () => {
  it("create parses body and delegates with customerId split out", async () => {
    const bookingsService = {
      createForCustomer: vi.fn().mockResolvedValue({ id: "b-admin-1" }),
    };
    const controller = new AdminBookingsController(bookingsService as never);

    const req = { auth: { sub: "clerk_admin" } } as never;
    const customerId = "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee";
    const serviceId = "123e4567-e89b-12d3-a456-426614174000";
    const scheduled = new Date("2026-06-15T14:00:00.000Z");

    const result = await controller.create(req, {
      customerId,
      serviceId,
      scheduledAt: scheduled.toISOString(),
      address: "99 Admin Way",
      latitude: 40.7,
      longitude: -74,
      notes: "Created by admin",
    });

    expect(bookingsService.createForCustomer).toHaveBeenCalledTimes(1);
    const [, payload] = bookingsService.createForCustomer.mock.calls[0] ?? [];
    expect(payload).toMatchObject({
      serviceId,
      address: "99 Admin Way",
      latitude: 40.7,
      longitude: -74,
      notes: "Created by admin",
    });
    expect(payload?.scheduledAt).toBeInstanceOf(Date);
    expect((payload?.scheduledAt as Date).getTime()).toBe(scheduled.getTime());
    expect(result).toEqual({ id: "b-admin-1" });
  });

  it("list delegates to service", async () => {
    const bookingsService = {
      listAll: vi.fn().mockResolvedValue({ data: [], total: 0, page: 2, limit: 10 }),
    };
    const controller = new AdminBookingsController(bookingsService as never);

    const out = await controller.list({ page: "2", limit: "10" });

    expect(bookingsService.listAll).toHaveBeenCalledWith(2, 10, undefined, undefined, undefined);
    expect(out).toEqual({ data: [], total: 0, page: 2, limit: 10 });
  });

  it("list passes status filter", async () => {
    const bookingsService = {
      listAll: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    };
    const controller = new AdminBookingsController(bookingsService as never);

    await controller.list({ status: "COMPLETED" });

    expect(bookingsService.listAll).toHaveBeenCalledWith(
      1,
      20,
      "COMPLETED",
      undefined,
      undefined,
    );
  });

  it("list passes date range", async () => {
    const bookingsService = {
      listAll: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    };
    const controller = new AdminBookingsController(bookingsService as never);

    await controller.list({ from: "2026-08-01", to: "2026-08-12" });

    expect(bookingsService.listAll).toHaveBeenCalledWith(
      1,
      20,
      undefined,
      "2026-08-01",
      "2026-08-12",
    );
  });
});
