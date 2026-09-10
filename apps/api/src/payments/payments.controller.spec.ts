import { describe, expect, it, vi } from "vitest";

import { PaymentsController } from "./payments.controller";

describe("PaymentsController", () => {
  it("createIntent delegates to the service and returns the parsed response", async () => {
    const paymentsService = {
      createPaymentIntentForBooking: vi.fn().mockResolvedValue({
        clientSecret: "secret_1",
        ephemeralKey: "ek_1",
        customerId: "cus_1",
        paymentIntentId: "pi_1",
      }),
    };
    const controller = new PaymentsController(paymentsService as never);

    const req = { auth: { sub: "clerk_cust" }, requestId: "rid-1" } as never;
    const result = await controller.createIntent(req, "b-1");

    expect(paymentsService.createPaymentIntentForBooking).toHaveBeenCalledWith("clerk_cust", "b-1", "rid-1");
    expect(result.paymentIntentId).toBe("pi_1");
  });

  it("rejects when there's no authenticated user", async () => {
    const paymentsService = { createPaymentIntentForBooking: vi.fn() };
    const controller = new PaymentsController(paymentsService as never);

    const req = { auth: undefined, requestId: "rid-1" } as never;

    await expect(controller.createIntent(req, "b-1")).rejects.toThrow("No authenticated user");
    expect(paymentsService.createPaymentIntentForBooking).not.toHaveBeenCalled();
  });
});
