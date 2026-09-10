import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { StripeWebhookController } from "./stripe-webhook.controller";

describe("StripeWebhookController", () => {
  it("verifies the signature and dispatches the decoded event", async () => {
    const event = { type: "payment_intent.succeeded", data: { object: {} } };
    const paymentsService = {
      constructWebhookEvent: vi.fn().mockReturnValue(event),
      handleStripeEvent: vi.fn().mockResolvedValue(undefined),
    };
    const controller = new StripeWebhookController(paymentsService as never);

    const req = { rawBody: Buffer.from("{}"), requestId: "rid-1" } as never;
    const result = await controller.handleStripeWebhook("sig_valid", req);

    expect(paymentsService.constructWebhookEvent).toHaveBeenCalledWith(Buffer.from("{}"), "sig_valid");
    expect(paymentsService.handleStripeEvent).toHaveBeenCalledWith(event, "rid-1");
    expect(result).toEqual({ received: true });
  });

  it("rejects when the signature is invalid", async () => {
    const paymentsService = {
      constructWebhookEvent: vi.fn(() => {
        throw new Error("signature mismatch");
      }),
      handleStripeEvent: vi.fn(),
    };
    const controller = new StripeWebhookController(paymentsService as never);

    const req = { rawBody: Buffer.from("{}"), requestId: "rid-1" } as never;

    await expect(controller.handleStripeWebhook("bad_sig", req)).rejects.toBeInstanceOf(BadRequestException);
    expect(paymentsService.handleStripeEvent).not.toHaveBeenCalled();
  });

  it("rejects when the raw body is missing", async () => {
    const paymentsService = { constructWebhookEvent: vi.fn(), handleStripeEvent: vi.fn() };
    const controller = new StripeWebhookController(paymentsService as never);

    const req = { rawBody: undefined, requestId: "rid-1" } as never;

    await expect(controller.handleStripeWebhook("sig", req)).rejects.toBeInstanceOf(BadRequestException);
  });
});
