import { describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";

import { AdminMessagesController } from "./admin-messages.controller";

const mockMessage = {
  id: "msg-1",
  conversationId: "conv-admin",
  senderId: "user-admin",
  type: "TEXT" as const,
  content: "Payout sent",
  createdAt: new Date("2024-01-01"),
};

describe("AdminMessagesController", () => {
  it("listThreads throws 400 when no auth", async () => {
    const service = { listAdminThreads: vi.fn() };
    const chatGateway = { emitMessage: vi.fn() };
    const controller = new AdminMessagesController(service as never, chatGateway as never);

    await expect(
      controller.listThreads({ auth: undefined } as never, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("listThreads delegates with pagination", async () => {
    const service = {
      listAdminThreads: vi.fn().mockResolvedValue({ data: [], total: 0, page: 2, limit: 10 }),
    };
    const chatGateway = { emitMessage: vi.fn() };
    const controller = new AdminMessagesController(service as never, chatGateway as never);

    await controller.listThreads(
      { auth: { sub: "clerk-admin" }, requestId: "rid-1" } as never,
      { page: "2", limit: "10" },
    );

    expect(service.listAdminThreads).toHaveBeenCalledWith("clerk-admin", 2, 10, "rid-1");
  });

  it("sendMessage persists then fans out", async () => {
    const service = { sendMessage: vi.fn().mockResolvedValue(mockMessage) };
    const chatGateway = { emitMessage: vi.fn() };
    const controller = new AdminMessagesController(service as never, chatGateway as never);

    const result = await controller.sendMessage(
      { auth: { sub: "clerk-admin" }, requestId: "rid-1" } as never,
      "conv-admin",
      { content: "Payout sent", type: "TEXT" },
    );

    expect(result).toEqual(mockMessage);
    expect(chatGateway.emitMessage).toHaveBeenCalledWith("conv-admin", mockMessage);
  });

  it("openThread delegates to service", async () => {
    const service = {
      getOrCreateAdminThreadForProvider: vi.fn().mockResolvedValue({ id: "conv-admin" }),
    };
    const chatGateway = { emitMessage: vi.fn() };
    const controller = new AdminMessagesController(service as never, chatGateway as never);

    await controller.openThread(
      { auth: { sub: "clerk-admin" }, requestId: "rid-1" } as never,
      { providerUserId: "11111111-1111-1111-1111-111111111111" },
    );

    expect(service.getOrCreateAdminThreadForProvider).toHaveBeenCalledWith(
      "clerk-admin",
      "11111111-1111-1111-1111-111111111111",
      "rid-1",
    );
  });

  it("openThread rejects invalid body", async () => {
    const service = { getOrCreateAdminThreadForProvider: vi.fn() };
    const chatGateway = { emitMessage: vi.fn() };
    const controller = new AdminMessagesController(service as never, chatGateway as never);

    await expect(
      controller.openThread(
        { auth: { sub: "clerk-admin" }, requestId: "rid-1" } as never,
        { providerUserId: "not-a-uuid" },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.getOrCreateAdminThreadForProvider).not.toHaveBeenCalled();
  });

  it("sendMessage rejects empty content", async () => {
    const service = { sendMessage: vi.fn() };
    const chatGateway = { emitMessage: vi.fn() };
    const controller = new AdminMessagesController(service as never, chatGateway as never);

    await expect(
      controller.sendMessage(
        { auth: { sub: "clerk-admin" }, requestId: "rid-1" } as never,
        "conv-admin",
        { content: "" },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.sendMessage).not.toHaveBeenCalled();
  });
});
