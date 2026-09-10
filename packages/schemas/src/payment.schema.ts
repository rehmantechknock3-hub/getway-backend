import { z } from "zod";

export const PaymentStatus = z.enum([
  "PENDING", "PROCESSING", "SUCCEEDED", "FAILED", "REFUNDED",
]);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const PaymentSchema = z.object({
  id:                       z.string().uuid(),
  bookingId:                z.string().uuid(),
  customerId:               z.string().uuid(),
  providerId:               z.string().uuid(),
  amount:                   z.number().positive(),           // total charged
  platformCommissionAmount: z.number().nonnegative(),        // platform cut
  providerAmount:           z.number().positive(),           // provider payout
  currency:                 z.string().length(3).default("USD"),
  status:                   PaymentStatus.default("PENDING"),
  stripePaymentIntentId:    z.string().optional(),
  stripeTransferId:         z.string().optional(),
  capturedAt:               z.coerce.date().optional(),
  failureReason:            z.string().optional(),
  createdAt:                z.coerce.date(),
  updatedAt:                z.coerce.date(),
});

export const CreatePaymentIntentSchema = z.object({
  bookingId: z.string().uuid(),
});

/** Returned to the mobile app so it can drive Stripe's PaymentSheet. Publishable key is app-level env, not per-request. */
export const CreatePaymentIntentResponseSchema = z.object({
  clientSecret:    z.string(),
  ephemeralKey:    z.string(),
  customerId:      z.string(),
  paymentIntentId: z.string(),
});

export const ProviderPayoutRangeSchema = z.enum(["week", "month", "all"]);
export type ProviderPayoutRange = z.infer<typeof ProviderPayoutRangeSchema>;

export const ProviderPayoutSummarySchema = z.object({
  range: ProviderPayoutRangeSchema,
  currency: z.string().length(3).default("USD"),
  paidCount: z.number().int().nonnegative(),
  paidAmount: z.number().nonnegative(),
  pendingCount: z.number().int().nonnegative(),
  pendingAmount: z.number().nonnegative(),
});

export type Payment                       = z.infer<typeof PaymentSchema>;
export type CreatePaymentIntentInput      = z.infer<typeof CreatePaymentIntentSchema>;
export type CreatePaymentIntentResponse   = z.infer<typeof CreatePaymentIntentResponseSchema>;
export type ProviderPayoutSummary = z.infer<typeof ProviderPayoutSummarySchema>;
