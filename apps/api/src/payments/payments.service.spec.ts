import { describe, expect, it, vi, beforeEach } from "vitest";

import { PaymentsService } from "./payments.service";

describe("PaymentsService", () => {
  const prisma = {
    user: { findUnique: vi.fn(), update: vi.fn() },
    booking: { findFirst: vi.fn() },
    payment: {
      count: vi.fn(),
      aggregate: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    providerProfile: { update: vi.fn(), updateMany: vi.fn() },
  };

  const stripe = {
    customers: { create: vi.fn() },
    ephemeralKeys: { create: vi.fn() },
    paymentIntents: { create: vi.fn(), retrieve: vi.fn(), capture: vi.fn() },
    charges: { retrieve: vi.fn() },
    accounts: { create: vi.fn() },
    accountLinks: { create: vi.fn() },
    webhooks: { constructEvent: vi.fn() },
  };

  const configService = {
    get: vi.fn((key: string) => {
      if (key === "STRIPE_COMMISSION_PERCENT") return "15";
      if (key === "STRIPE_WEBHOOK_SECRET") return "whsec_test";
      return undefined;
    }),
  };

  let service: PaymentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    configService.get.mockImplementation((key: string) => {
      if (key === "STRIPE_COMMISSION_PERCENT") return "15";
      if (key === "STRIPE_WEBHOOK_SECRET") return "whsec_test";
      return undefined;
    });
    prisma.payment.update.mockResolvedValue({});
    service = new PaymentsService(prisma as never, stripe as never, configService as never);
  });

  describe("getProviderPayoutSummary", () => {
    it("returns zero summary for provider without profile", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u-1", role: "PROVIDER", providerProfile: null });

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
      prisma.user.findUnique.mockResolvedValue({ id: "u-1", role: "PROVIDER", providerProfile: { id: "pp-1" } });
      prisma.payment.count.mockResolvedValueOnce(4).mockResolvedValueOnce(2);
      prisma.payment.aggregate
        .mockResolvedValueOnce({ _sum: { providerAmount: 420 } })
        .mockResolvedValueOnce({ _sum: { providerAmount: 75 } });
      prisma.payment.findFirst.mockResolvedValue({ currency: "USD" });

      const result = await service.getProviderPayoutSummary("clerk-1", "week");

      expect(result.paidCount).toBe(4);
      expect(result.paidAmount).toBe(420);
      expect(result.pendingCount).toBe(2);
      expect(result.pendingAmount).toBe(75);
    });
  });

  describe("createPaymentIntentForBooking", () => {
    const customer = {
      id: "u-1",
      role: "CUSTOMER",
      email: "c@x.com",
      firstName: "A",
      lastName: "B",
      stripeCustomerId: null,
    };
    const booking = {
      id: "b-1",
      customerId: "u-1",
      providerId: "pp-1",
      status: "IN_PROGRESS",
      totalAmount: 50,
      totalCurrency: "USD",
      provider: { stripeAccountId: "acct_1", stripeChargesEnabled: true },
    };

    it("rejects when booking is not in a payable status", async () => {
      prisma.user.findUnique.mockResolvedValue(customer);
      prisma.booking.findFirst.mockResolvedValue({ ...booking, status: "PENDING" });

      await expect(service.createPaymentIntentForBooking("clerk-1", "b-1")).rejects.toThrow(
        "Booking is not ready for payment yet"
      );
    });

    it("rejects when the provider hasn't finished Connect onboarding", async () => {
      prisma.user.findUnique.mockResolvedValue(customer);
      prisma.booking.findFirst.mockResolvedValue({
        ...booking,
        provider: { stripeAccountId: null, stripeChargesEnabled: false },
      });

      await expect(service.createPaymentIntentForBooking("clerk-1", "b-1")).rejects.toThrow(
        "hasn't finished payout setup"
      );
    });

    it("creates a Stripe customer, PaymentIntent, ephemeral key, and upserts the Payment row", async () => {
      prisma.user.findUnique.mockResolvedValue(customer);
      prisma.booking.findFirst.mockResolvedValue(booking);
      prisma.payment.findUnique.mockResolvedValue(null);
      stripe.customers.create.mockResolvedValue({ id: "cus_1" });
      stripe.paymentIntents.create.mockResolvedValue({ id: "pi_1", client_secret: "secret_1" });
      stripe.ephemeralKeys.create.mockResolvedValue({ secret: "ek_1" });

      const result = await service.createPaymentIntentForBooking("clerk-1", "b-1", "rid-1");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "u-1" },
        data: { stripeCustomerId: "cus_1" },
      });
      expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 5000,
          currency: "usd",
          customer: "cus_1",
          capture_method: "manual",
          application_fee_amount: 750,
          transfer_data: { destination: "acct_1" },
        })
      );
      expect(prisma.payment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { bookingId: "b-1" },
          create: expect.objectContaining({
            platformCommissionAmount: 7.5,
            providerAmount: 42.5,
            stripePaymentIntentId: "pi_1",
            status: "PENDING",
          }),
        })
      );
      expect(result).toEqual({
        clientSecret: "secret_1",
        ephemeralKey: "ek_1",
        customerId: "cus_1",
        paymentIntentId: "pi_1",
      });
    });

    it("rejects re-paying a booking that's already succeeded", async () => {
      prisma.user.findUnique.mockResolvedValue(customer);
      prisma.booking.findFirst.mockResolvedValue(booking);
      prisma.payment.findUnique.mockResolvedValue({ status: "SUCCEEDED", stripePaymentIntentId: "pi_old" });

      await expect(service.createPaymentIntentForBooking("clerk-1", "b-1")).rejects.toThrow(
        "already been paid"
      );
    });
  });

  describe("captureBookingPayment", () => {
    it("logs and no-ops when the customer never authorized a payment", async () => {
      prisma.payment.findUnique.mockResolvedValue(null);

      await service.captureBookingPayment("b-1", "rid-1");

      expect(stripe.paymentIntents.capture).not.toHaveBeenCalled();
    });

    it("captures the PaymentIntent for an authorized payment", async () => {
      prisma.payment.findUnique.mockResolvedValue({ status: "PROCESSING", stripePaymentIntentId: "pi_1" });
      stripe.paymentIntents.capture.mockResolvedValue({});

      await service.captureBookingPayment("b-1", "rid-1");

      expect(stripe.paymentIntents.capture).toHaveBeenCalledWith("pi_1");
      expect(prisma.payment.update).not.toHaveBeenCalled(); // status is written by the webhook, not here
    });

    it("marks the payment FAILED when Stripe rejects the capture", async () => {
      prisma.payment.findUnique.mockResolvedValue({ status: "PROCESSING", stripePaymentIntentId: "pi_1" });
      stripe.paymentIntents.capture.mockRejectedValue(new Error("charge expired"));

      await service.captureBookingPayment("b-1", "rid-1");

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { bookingId: "b-1" },
        data: { status: "FAILED", failureReason: "charge expired" },
      });
    });
  });

  describe("handleStripeEvent", () => {
    it("marks a payment SUCCEEDED and resolves the transfer id on payment_intent.succeeded", async () => {
      stripe.charges.retrieve.mockResolvedValue({ transfer: "tr_1" });

      await service.handleStripeEvent(
        {
          type: "payment_intent.succeeded",
          data: { object: { id: "pi_1", latest_charge: "ch_1" } },
        } as never,
        "rid-1"
      );

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { stripePaymentIntentId: "pi_1" },
        data: expect.objectContaining({ status: "SUCCEEDED", stripeTransferId: "tr_1" }),
      });
    });

    it("syncs ProviderProfile Connect flags on account.updated", async () => {
      await service.handleStripeEvent(
        {
          type: "account.updated",
          data: {
            object: { id: "acct_1", charges_enabled: true, payouts_enabled: false, details_submitted: true },
          },
        } as never,
        "rid-1"
      );

      expect(prisma.providerProfile.updateMany).toHaveBeenCalledWith({
        where: { stripeAccountId: "acct_1" },
        data: { stripeChargesEnabled: true, stripePayoutsEnabled: false, stripeDetailsSubmitted: true },
      });
    });
  });

  describe("createConnectOnboardingLink", () => {
    it("creates an Express account on first call and returns the onboarding link", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "u-1",
        role: "PROVIDER",
        email: "p@x.com",
        providerProfile: { id: "pp-1", stripeAccountId: null },
      });
      stripe.accounts.create.mockResolvedValue({ id: "acct_1" });
      stripe.accountLinks.create.mockResolvedValue({ url: "https://connect.stripe.com/setup/1" });

      const result = await service.createConnectOnboardingLink("clerk-1", "rid-1");

      expect(prisma.providerProfile.update).toHaveBeenCalledWith({
        where: { id: "pp-1" },
        data: { stripeAccountId: "acct_1" },
      });
      expect(result).toEqual({ url: "https://connect.stripe.com/setup/1" });
    });

    it("reuses an existing Connect account", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "u-1",
        role: "PROVIDER",
        email: "p@x.com",
        providerProfile: { id: "pp-1", stripeAccountId: "acct_existing" },
      });
      stripe.accountLinks.create.mockResolvedValue({ url: "https://connect.stripe.com/setup/2" });

      await service.createConnectOnboardingLink("clerk-1", "rid-1");

      expect(stripe.accounts.create).not.toHaveBeenCalled();
      expect(stripe.accountLinks.create).toHaveBeenCalledWith(
        expect.objectContaining({ account: "acct_existing" })
      );
    });
  });

  describe("getConnectStatus", () => {
    it("returns the provider's Connect flags", async () => {
      prisma.user.findUnique.mockResolvedValue({
        providerProfile: {
          stripeChargesEnabled: true,
          stripePayoutsEnabled: false,
          stripeDetailsSubmitted: true,
        },
      });

      const result = await service.getConnectStatus("clerk-1");

      expect(result).toEqual({ chargesEnabled: true, payoutsEnabled: false, detailsSubmitted: true });
    });
  });
});
