import { describe, expect, it, vi } from "vitest";

import { NotificationsController } from "./notifications.controller";

describe("NotificationsController", () => {
  it("list delegates to listForUser", async () => {
    const notificationsService = {
      listForUser: vi.fn().mockResolvedValue({
        data: [],
        total: 0,
        unreadCount: 0,
        page: 1,
        limit: 20,
      }),
    };
    const controller = new NotificationsController(notificationsService as never);

    const req = { auth: { sub: "clerk_1" } } as never;
    const result = await controller.list(req, {});

    expect(notificationsService.listForUser).toHaveBeenCalledWith("clerk_1", 1, 20);
    expect(result.unreadCount).toBe(0);
  });

  it("markRead delegates to service", async () => {
    const notificationsService = {
      markRead: vi.fn().mockResolvedValue({ id: "n-1" }),
    };
    const controller = new NotificationsController(notificationsService as never);

    const req = { auth: { sub: "clerk_1" } } as never;
    const result = await controller.markRead(req, "n-1");

    expect(notificationsService.markRead).toHaveBeenCalledWith("clerk_1", "n-1");
    expect(result).toEqual({ id: "n-1" });
  });
});
