import { describe, expect, it, vi } from "vitest";

import { StripeConnectController } from "./stripe-connect.controller";

describe("StripeConnectController", () => {
  it("createOnboardingLink delegates to the service", async () => {
    const paymentsService = {
      createConnectOnboardingLink: vi.fn().mockResolvedValue({ url: "https://connect.stripe.com/setup/1" }),
    };
    const controller = new StripeConnectController(paymentsService as never);

    const req = { auth: { sub: "clerk_prov" }, requestId: "rid-1" } as never;
    const result = await controller.createOnboardingLink(req);

    expect(paymentsService.createConnectOnboardingLink).toHaveBeenCalledWith("clerk_prov", "rid-1");
    expect(result.url).toBe("https://connect.stripe.com/setup/1");
  });

  it("getStatus delegates to the service", async () => {
    const paymentsService = {
      getConnectStatus: vi.fn().mockResolvedValue({
        chargesEnabled: true,
        payoutsEnabled: false,
        detailsSubmitted: true,
      }),
    };
    const controller = new StripeConnectController(paymentsService as never);

    const req = { auth: { sub: "clerk_prov" }, requestId: "rid-1" } as never;
    const result = await controller.getStatus(req);

    expect(paymentsService.getConnectStatus).toHaveBeenCalledWith("clerk_prov");
    expect(result.payoutsEnabled).toBe(false);
  });

  it("rejects when there's no authenticated user", async () => {
    const paymentsService = { createConnectOnboardingLink: vi.fn(), getConnectStatus: vi.fn() };
    const controller = new StripeConnectController(paymentsService as never);

    const req = { auth: undefined, requestId: "rid-1" } as never;

    await expect(controller.createOnboardingLink(req)).rejects.toThrow("No authenticated user");
    await expect(controller.getStatus(req)).rejects.toThrow("No authenticated user");
  });
});
