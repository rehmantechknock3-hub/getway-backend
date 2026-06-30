import { describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";

import { MessagesController } from "./messages.controller";

const mockConversation = {
  id:            "conv-1",
  bookingId:     "booking-1",
  customerId:    "user-customer",
  providerId:    "profile-provider",
  lastMessageAt: undefined,
  createdAt:     new Date("2024-01-01"),
};

describe("MessagesController", () => {
  it("listConversations throws 400 when no auth", async () => {
    const service = { listConversations: vi.fn() };
    const controller = new MessagesController(service as never);

    await expect(
      controller.listConversations({ auth: undefined } as never)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("listConversations delegates to service", async () => {
    const service = { listConversations: vi.fn().mockResolvedValue([]) };
    const controller = new MessagesController(service as never);

    const result = await controller.listConversations({ auth: { sub: "clerk-1" }, requestId: "rid-1" } as never);

    expect(result).toEqual([]);
    expect(service.listConversations).toHaveBeenCalledWith("clerk-1");
  });

  it("getOrCreate delegates to service with bookingId and requestId", async () => {
    const service = { getOrCreateConversation: vi.fn().mockResolvedValue(mockConversation) };
    const controller = new MessagesController(service as never);

    const result = await controller.getOrCreate(
      { auth: { sub: "clerk-1" }, requestId: "rid-1" } as never,
      "booking-1"
    );

    expect(result.id).toBe("conv-1");
    expect(service.getOrCreateConversation).toHaveBeenCalledWith("clerk-1", "booking-1", "rid-1");
  });

  it("listMessages delegates to service with default pagination", async () => {
    const service = {
      listMessages: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 30 }),
    };
    const controller = new MessagesController(service as never);

    const result = await controller.listMessages(
      { auth: { sub: "clerk-1" }, requestId: "rid-1" } as never,
      "conv-1",
      {}
    );

    expect(result.page).toBe(1);
    expect(service.listMessages).toHaveBeenCalledWith("clerk-1", "conv-1", 1, 30, "rid-1");
  });

  it("listMessages respects page and limit query params", async () => {
    const service = {
      listMessages: vi.fn().mockResolvedValue({ data: [], total: 0, page: 2, limit: 10 }),
    };
    const controller = new MessagesController(service as never);

    await controller.listMessages(
      { auth: { sub: "clerk-1" }, requestId: "rid-1" } as never,
      "conv-1",
      { page: "2", limit: "10" }
    );

    expect(service.listMessages).toHaveBeenCalledWith("clerk-1", "conv-1", 2, 10, "rid-1");
  });
});
