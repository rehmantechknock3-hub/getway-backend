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
  createdAt:                z.coerce.date(),
  updatedAt:                z.coerce.date(),
});

export const CreatePaymentIntentSchema = z.object({
  bookingId: z.string().uuid(),
});

export type Payment                   = z.infer<typeof PaymentSchema>;
export type CreatePaymentIntentInput  = z.infer<typeof CreatePaymentIntentSchema>;
