import { z } from "zod";
export declare const PaymentStatus: z.ZodEnum<["PENDING", "PROCESSING", "SUCCEEDED", "FAILED", "REFUNDED"]>;
export type PaymentStatus = z.infer<typeof PaymentStatus>;
export declare const PaymentSchema: z.ZodObject<{
    id: z.ZodString;
    bookingId: z.ZodString;
    customerId: z.ZodString;
    providerId: z.ZodString;
    amount: z.ZodNumber;
    platformCommissionAmount: z.ZodNumber;
    providerAmount: z.ZodNumber;
    currency: z.ZodDefault<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<["PENDING", "PROCESSING", "SUCCEEDED", "FAILED", "REFUNDED"]>>;
    stripePaymentIntentId: z.ZodOptional<z.ZodString>;
    stripeTransferId: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    bookingId: string;
    status: "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "REFUNDED";
    providerId: string;
    customerId: string;
    amount: number;
    platformCommissionAmount: number;
    providerAmount: number;
    currency: string;
    stripePaymentIntentId?: string | undefined;
    stripeTransferId?: string | undefined;
}, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    bookingId: string;
    providerId: string;
    customerId: string;
    amount: number;
    platformCommissionAmount: number;
    providerAmount: number;
    status?: "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "REFUNDED" | undefined;
    currency?: string | undefined;
    stripePaymentIntentId?: string | undefined;
    stripeTransferId?: string | undefined;
}>;
export declare const CreatePaymentIntentSchema: z.ZodObject<{
    bookingId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    bookingId: string;
}, {
    bookingId: string;
}>;
export type Payment = z.infer<typeof PaymentSchema>;
export type CreatePaymentIntentInput = z.infer<typeof CreatePaymentIntentSchema>;
