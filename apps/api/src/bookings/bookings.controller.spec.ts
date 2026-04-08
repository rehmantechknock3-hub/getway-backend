import { describe, expect, it, vi } from "vitest";

import { BookingsController } from "./bookings.controller";
import { BookingsService } from "./bookings.service";

describe("BookingsController", () => {
  it("create parses body and delegates to service", async () => {
    const bookingsService = {
      create: vi.fn().mockResolvedValue({ id: "b-1" }),
    };
    const controller = new BookingsController(bookingsService as never);

    const req = {
      auth: { sub: "clerk_test" },
    } as never;

    const scheduled = new Date("2026-06-15T14:00:00.000Z");
    const result = await controller.create(req, {
      serviceId: "123e4567-e89b-12d3-a456-426614174000",
      scheduledAt: scheduled.toISOString(),
      address: "10 Oak Ave",
      latitude: 41,
      longitude: -71,
    });

    expect(bookingsService.create).toHaveBeenCalledWith("clerk_test", {
      serviceId: "123e4567-e89b-12d3-a456-426614174000",
      scheduledAt: scheduled,
      address: "10 Oak Ave",
      latitude: 41,
      longitude: -71,
    });
    expect(result).toEqual({ id: "b-1" });
  });
});
