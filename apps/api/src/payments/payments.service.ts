import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import type {
  CreatePaymentIntentResponse,
  PaymentStatus,
  ProviderPayoutRange,
  ProviderPayoutSummary,
  StripeConnectOnboardingLink,
  StripeConnectStatus,
} from "@repo/schemas";

import { PrismaService } from "../prisma/prisma.service";
import { STRIPE_API_VERSION, STRIPE_CLIENT } from "./stripe-client.provider";

const PAID_STATUSES: PaymentStatus[] = ["SUCCEEDED"];
const PENDING_STATUSES: PaymentStatus[] = ["PENDING", "PROCESSING"];
/** Customer can authorize payment once the provider has accepted, up until the job wraps up. */
const PAYABLE_BOOKING_STATUSES = ["ACCEPTED", "IN_PROGRESS"];
const DEFAULT_COMMISSION_PERCENT = 15;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly commissionPercent: number;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly configService: ConfigService
  ) {
    const rawPercent = this.configService.get<string>("STRIPE_COMMISSION_PERCENT");
    const parsedPercent = rawPercent ? Number(rawPercent) : NaN;
    this.commissionPercent = Number.isFinite(parsedPercent) ? parsedPercent : DEFAULT_COMMISSION_PERCENT;
  }

  private toCents(amount: number): number {
    return Math.round(amount * 100);
  }

  // ── Provider payout summary (existing) ──────────────────────────────────────

  async getProviderPayoutSummary(
    clerkId: string,
    range: ProviderPayoutRange,
    requestId?: string
  ): Promise<ProviderPayoutSummary> {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { providerProfile: true },
    });
    if (!user) {
      this.logger.warn(`Provider payout user not found for clerkId=${clerkId} [rid:${requestId}]`);
      throw new NotFoundException("User not found");
    }
    if (user.role !== "PROVIDER") {
      throw new ForbiddenException("Only providers can access payout summary");
    }
    if (!user.providerProfile) {
      return {
        range,
        currency: "USD",
        paidCount: 0,
        paidAmount: 0,
        pendingCount: 0,
        pendingAmount: 0,
      };
    }

    const now = new Date();
    const fromDate = this.resolveRangeStart(range, now);
    const baseWhere = {
      providerId: user.providerProfile.id,
      ...(fromDate ? { createdAt: { gte: fromDate } } : {}),
    };

    const [paidCount, paidAmountAgg, pendingCount, pendingAmountAgg, latestPayment] = await Promise.all([
      this.prisma.payment.count({
        where: { ...baseWhere, status: { in: PAID_STATUSES } },
      }),
      this.prisma.payment.aggregate({
        where: { ...baseWhere, status: { in: PAID_STATUSES } },
        _sum: { providerAmount: true },
      }),
      this.prisma.payment.count({
        where: { ...baseWhere, status: { in: PENDING_STATUSES } },
      }),
      this.prisma.payment.aggregate({
        where: { ...baseWhere, status: { in: PENDING_STATUSES } },
        _sum: { providerAmount: true },
      }),
      this.prisma.payment.findFirst({
        where: baseWhere,
        select: { currency: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      range,
      currency: latestPayment?.currency ?? "USD",
      paidCount,
      paidAmount: paidAmountAgg._sum.providerAmount ?? 0,
      pendingCount,
      pendingAmount: pendingAmountAgg._sum.providerAmount ?? 0,
    };
  }

  private resolveRangeStart(range: ProviderPayoutRange, now: Date): Date | null {
    if (range === "all") return null;
    const start = new Date(now);
    if (range === "week") {
      start.setDate(now.getDate() - 7);
      return start;
    }
    start.setMonth(now.getMonth() - 1);
    return start;
  }

  // ── Customer payment (destination charge, manual capture) ──────────────────

  async createPaymentIntentForBooking(
    clerkId: string,
    bookingId: string,
    requestId?: string
  ): Promise<CreatePaymentIntentResponse> {
    const user = await this.prisma.user.findUnique({ where: { clerkId } });
    if (!user) throw new NotFoundException("User not found");
    if (user.role !== "CUSTOMER") {
      throw new ForbiddenException("Only customers can pay for bookings");
    }

    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, customerId: user.id },
      include: {
        provider: { select: { stripeAccountId: true, stripeChargesEnabled: true } },
      },
    });
    if (!booking) throw new NotFoundException("Booking not found");
    if (!PAYABLE_BOOKING_STATUSES.includes(booking.status)) {
      throw new BadRequestException("Booking is not ready for payment yet");
    }
    if (!booking.provider.stripeAccountId || !booking.provider.stripeChargesEnabled) {
      throw new BadRequestException("This provider hasn't finished payout setup yet");
    }

    const existingPayment = await this.prisma.payment.findUnique({ where: { bookingId } });
    if (existingPayment && !PENDING_STATUSES.includes(existingPayment.status as PaymentStatus)) {
      throw new BadRequestException("This booking has already been paid");
    }

    const stripeCustomerId = await this.resolveStripeCustomerId(user, requestId);

    // Re-opening the pay sheet without completing it — reuse the intent instead of creating a duplicate.
    if (existingPayment?.stripePaymentIntentId) {
      try {
        const [intent, ephemeralKey] = await Promise.all([
          this.stripe.paymentIntents.retrieve(existingPayment.stripePaymentIntentId),
          this.stripe.ephemeralKeys.create(
            { customer: stripeCustomerId },
            { apiVersion: STRIPE_API_VERSION }
          ),
        ]);
        if (intent.client_secret && ephemeralKey.secret) {
          return {
            clientSecret: intent.client_secret,
            ephemeralKey: ephemeralKey.secret,
            customerId: stripeCustomerId,
            paymentIntentId: intent.id,
          };
        }
      } catch (error) {
        this.logger.warn(
          `[rid:${requestId}] Could not reuse PaymentIntent for booking ${bookingId}, creating a new one: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    const amountCents = this.toCents(booking.totalAmount);
    const commissionCents = Math.round((amountCents * this.commissionPercent) / 100);

    let intent: Stripe.PaymentIntent;
    try {
      intent = await this.stripe.paymentIntents.create({
        amount: amountCents,
        currency: booking.totalCurrency.toLowerCase(),
        customer: stripeCustomerId,
        capture_method: "manual",
        application_fee_amount: commissionCents,
        transfer_data: { destination: booking.provider.stripeAccountId },
        metadata: { bookingId: booking.id },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`[rid:${requestId}] Failed to create PaymentIntent for booking ${bookingId}: ${reason}`);
      throw new BadRequestException("Could not start payment. Try again.");
    }

    let ephemeralKey: Stripe.EphemeralKey;
    try {
      ephemeralKey = await this.stripe.ephemeralKeys.create(
        { customer: stripeCustomerId },
        { apiVersion: STRIPE_API_VERSION }
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`[rid:${requestId}] Failed to create ephemeral key for customer ${stripeCustomerId}: ${reason}`);
      throw new BadRequestException("Could not start payment. Try again.");
    }

    await this.prisma.payment.upsert({
      where: { bookingId: booking.id },
      create: {
        bookingId: booking.id,
        customerId: user.id,
        providerId: booking.providerId,
        amount: booking.totalAmount,
        platformCommissionAmount: commissionCents / 100,
        providerAmount: booking.totalAmount - commissionCents / 100,
        currency: booking.totalCurrency,
        status: "PENDING",
        stripePaymentIntentId: intent.id,
      },
      update: {
        stripePaymentIntentId: intent.id,
        status: "PENDING",
        failureReason: null,
      },
    });

    if (!intent.client_secret || !ephemeralKey.secret) {
      // Should not happen for a freshly created intent/key, but keep the contract honest.
      throw new BadRequestException("Could not start payment. Try again.");
    }

    return {
      clientSecret: intent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customerId: stripeCustomerId,
      paymentIntentId: intent.id,
    };
  }

  private async resolveStripeCustomerId(
    user: { id: string; email: string; firstName: string; lastName: string; stripeCustomerId: string | null },
    requestId?: string
  ): Promise<string> {
    if (user.stripeCustomerId) return user.stripeCustomerId;

    try {
      const customer = await this.stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: { userId: user.id },
      });
      await this.prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customer.id } });
      return customer.id;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`[rid:${requestId}] Failed to create Stripe customer for user ${user.id}: ${reason}`);
      throw new BadRequestException("Could not start payment. Try again.");
    }
  }

  /**
   * Best-effort capture, called after a booking's status transaction commits (see
   * BookingsService.updateStatusForProvider). Never throws — a Stripe failure must not
   * un-complete a booking; the job was already done.
   */
  async captureBookingPayment(bookingId: string, requestId?: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({ where: { bookingId } });
    if (!payment?.stripePaymentIntentId) {
      this.logger.warn(
        `[rid:${requestId}] No authorized payment to capture for booking ${bookingId} (customer never paid)`
      );
      return;
    }
    if (payment.status === "SUCCEEDED") return; // already captured — idempotent

    try {
      await this.stripe.paymentIntents.capture(payment.stripePaymentIntentId);
      // Status/capturedAt/transfer id are written from the `payment_intent.succeeded` webhook,
      // which is the source of truth (see handleStripeEvent).
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`[rid:${requestId}] Failed to capture payment for booking ${bookingId}: ${reason}`);
      await this.prisma.payment
        .update({ where: { bookingId }, data: { status: "FAILED", failureReason: reason } })
        .catch(() => undefined);
    }
  }

  // ── Stripe Connect onboarding (providers) ───────────────────────────────────

  async createConnectOnboardingLink(
    clerkId: string,
    requestId?: string
  ): Promise<StripeConnectOnboardingLink> {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { providerProfile: true },
    });
    if (!user?.providerProfile) throw new NotFoundException("Provider profile not found");
    if (user.role !== "PROVIDER") throw new ForbiddenException("Only providers can set up payouts");

    let accountId = user.providerProfile.stripeAccountId;
    if (!accountId) {
      try {
        const account = await this.stripe.accounts.create({
          type: "express",
          email: user.email,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          metadata: { providerProfileId: user.providerProfile.id },
        });
        accountId = account.id;
        await this.prisma.providerProfile.update({
          where: { id: user.providerProfile.id },
          data: { stripeAccountId: accountId },
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `[rid:${requestId}] Failed to create Connect account for provider ${user.providerProfile.id}: ${reason}`
        );
        throw new BadRequestException("Could not start payout setup. Try again.");
      }
    }

    const refreshUrl =
      this.configService.get<string>("STRIPE_CONNECT_REFRESH_URL") ?? "waynow://provider/stripe-connect-refresh";
    const returnUrl =
      this.configService.get<string>("STRIPE_CONNECT_RETURN_URL") ?? "waynow://provider/stripe-connect-return";

    try {
      const link = await this.stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: "account_onboarding",
      });
      return { url: link.url };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[rid:${requestId}] Failed to create account link for provider ${user.providerProfile.id}: ${reason}`
      );
      throw new BadRequestException("Could not start payout setup. Try again.");
    }
  }

  async getConnectStatus(clerkId: string): Promise<StripeConnectStatus> {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { providerProfile: true },
    });
    if (!user?.providerProfile) throw new NotFoundException("Provider profile not found");

    return {
      chargesEnabled: user.providerProfile.stripeChargesEnabled,
      payoutsEnabled: user.providerProfile.stripePayoutsEnabled,
      detailsSubmitted: user.providerProfile.stripeDetailsSubmitted,
    };
  }

  // ── Webhook ──────────────────────────────────────────────────────────────────

  /** Verifies the Stripe-Signature header and decodes the raw body into a typed event. */
  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    const secret = this.configService.get<string>("STRIPE_WEBHOOK_SECRET");
    if (!secret) throw new BadRequestException("Webhook secret not configured");
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }

  async handleStripeEvent(event: Stripe.Event, requestId?: string): Promise<void> {
    switch (event.type) {
      case "payment_intent.amount_capturable_updated": {
        const intent = event.data.object as Stripe.PaymentIntent;
        await this.updatePaymentByIntentId(intent.id, { status: "PROCESSING" }, requestId);
        break;
      }
      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const transferId = await this.resolveTransferId(intent, requestId);
        await this.updatePaymentByIntentId(
          intent.id,
          {
            status: "SUCCEEDED",
            capturedAt: new Date(),
            failureReason: null,
            ...(transferId ? { stripeTransferId: transferId } : {}),
          },
          requestId
        );
        break;
      }
      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        await this.updatePaymentByIntentId(
          intent.id,
          { status: "FAILED", failureReason: intent.last_payment_error?.message ?? "Payment failed" },
          requestId
        );
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const intentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        if (intentId) {
          await this.updatePaymentByIntentId(intentId, { status: "REFUNDED" }, requestId);
        }
        break;
      }
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await this.prisma.providerProfile.updateMany({
          where: { stripeAccountId: account.id },
          data: {
            stripeChargesEnabled: Boolean(account.charges_enabled),
            stripePayoutsEnabled: Boolean(account.payouts_enabled),
            stripeDetailsSubmitted: Boolean(account.details_submitted),
          },
        });
        break;
      }
      default:
        break; // Ignore event types we don't act on.
    }
  }

  private async resolveTransferId(intent: Stripe.PaymentIntent, requestId?: string): Promise<string | undefined> {
    const chargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id;
    if (!chargeId) return undefined;
    try {
      const charge = await this.stripe.charges.retrieve(chargeId);
      return typeof charge.transfer === "string" ? charge.transfer : charge.transfer?.id;
    } catch (error) {
      this.logger.warn(
        `[rid:${requestId}] Could not resolve transfer id for charge ${chargeId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return undefined;
    }
  }

  private async updatePaymentByIntentId(
    intentId: string,
    data: Prisma.PaymentUpdateInput,
    requestId?: string
  ): Promise<void> {
    try {
      await this.prisma.payment.update({ where: { stripePaymentIntentId: intentId }, data });
    } catch (error) {
      this.logger.warn(
        `[rid:${requestId}] No payment row found for PaymentIntent ${intentId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
