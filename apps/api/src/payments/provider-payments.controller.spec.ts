import { describe, expect, it, vi } from "vitest";

import { ProviderPaymentsController } from "./provider-payments.controller";

describe("ProviderPaymentsController", () => {
  it("payoutSummary delegates with default range", async () => {
    const paymentsService = {
      getProviderPayoutSummary: vi.fn().mockResolvedValue({
        range: "all",
        currency: "USD",
        paidCount: 2,
        paidAmount: 120,
        pendingCount: 1,
        pendingAmount: 35,
      }),
    };
    const controller = new ProviderPaymentsController(paymentsService as never);

    const req = { auth: { sub: "clerk_prov" }, requestId: "rid-1" } as never;
    const result = await controller.payoutSummary(req, {});

    expect(paymentsService.getProviderPayoutSummary).toHaveBeenCalledWith("clerk_prov", "all", "rid-1");
    expect(result.paidAmount).toBe(120);
  });

  it("payoutSummary passes explicit range", async () => {
    const paymentsService = {
      getProviderPayoutSummary: vi.fn().mockResolvedValue({
        range: "week",
        currency: "USD",
        paidCount: 1,
        paidAmount: 50,
        pendingCount: 0,
        pendingAmount: 0,
      }),
    };
    const controller = new ProviderPaymentsController(paymentsService as never);

    const req = { auth: { sub: "clerk_prov" }, requestId: "rid-2" } as never;
    await controller.payoutSummary(req, { range: "week" });

    expect(paymentsService.getProviderPayoutSummary).toHaveBeenCalledWith("clerk_prov", "week", "rid-2");
  });
});
