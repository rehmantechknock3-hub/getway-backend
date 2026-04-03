import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { WebhookController } from "./webhook.controller";

const verifyMock = vi.fn();

vi.mock("svix", () => ({
  Webhook: class {
    verify = verifyMock;
  },
}));

describe("WebhookController", () => {
  const originalSecret = process.env["CLERK_WEBHOOK_SECRET"];

  beforeEach(() => {
    process.env["CLERK_WEBHOOK_SECRET"] = "whsec_test";
    verifyMock.mockReset();
  });

  afterEach(() => {
    process.env["CLERK_WEBHOOK_SECRET"] = originalSecret;
  });

  it("calls deleteByClerkId on user.deleted", async () => {
    verifyMock.mockReturnValue({
      type: "user.deleted",
      data: { id: "user_clerk_deleted" },
    });
    const usersService = {
      upsertFromClerk: vi.fn(),
      deleteByClerkId: vi.fn().mockResolvedValue({ deleted: true }),
    };
    const controller = new WebhookController(usersService as never);

    await controller.handleClerkWebhook(
      "msg_id",
      "ts",
      "sig",
      { rawBody: Buffer.from("{}") } as never
    );

    expect(usersService.deleteByClerkId).toHaveBeenCalledWith("user_clerk_deleted");
    expect(usersService.upsertFromClerk).not.toHaveBeenCalled();
  });

  it("rejects when webhook secret is missing", async () => {
    delete process.env["CLERK_WEBHOOK_SECRET"];
    const controller = new WebhookController({} as never);

    await expect(
      controller.handleClerkWebhook("i", "t", "s", { rawBody: Buffer.from("{}") } as never)
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
