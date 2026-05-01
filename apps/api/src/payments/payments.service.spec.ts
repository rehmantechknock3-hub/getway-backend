import { describe, expect, it, vi, beforeEach } from "vitest";

import { PaymentsService } from "./payments.service";

describe("PaymentsService", () => {
  const prisma = {
    user: { findUnique: vi.fn() },
    payment: {
      count: vi.fn(),
      aggregate: vi.fn(),
      findFirst: vi.fn(),
    },
  };

  let service: PaymentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PaymentsService(prisma as never);
  });

  it("returns zero summary for provider without profile", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u-1",
      role: "PROVIDER",
      providerProfile: null,
    });

    const result = await service.getProviderPayoutSummary("clerk-1", "all");

    expect(result).toEqual({
      range: "all",
      currency: "USD",
      paidCount: 0,
      paidAmount: 0,
      pendingCount: 0,
      pendingAmount: 0,
    });
    expect(prisma.payment.count).not.toHaveBeenCalled();
  });

  it("aggregates paid and pending payout data", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u-1",
      role: "PROVIDER",
      providerProfile: { id: "pp-1" },
    });
    prisma.payment.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2);
    prisma.payment.aggregate
      .mockResolvedValueOnce({ _sum: { providerAmount: 420 } })
      .mockResolvedValueOnce({ _sum: { providerAmount: 75 } });
    prisma.payment.findFirst.mockResolvedValue({ currency: "USD" });

    const result = await service.getProviderPayoutSummary("clerk-1", "week");

    expect(result.paidCount).toBe(4);
    expect(result.paidAmount).toBe(420);
    expect(result.pendingCount).toBe(2);
    expect(result.pendingAmount).toBe(75);
    expect(prisma.payment.findFirst).toHaveBeenCalledTimes(1);
  });
});
