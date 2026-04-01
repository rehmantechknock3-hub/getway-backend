"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePaymentIntentSchema = exports.PaymentSchema = exports.PaymentStatus = void 0;
const zod_1 = require("zod");
exports.PaymentStatus = zod_1.z.enum([
    "PENDING", "PROCESSING", "SUCCEEDED", "FAILED", "REFUNDED",
]);
exports.PaymentSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    bookingId: zod_1.z.string().uuid(),
    customerId: zod_1.z.string().uuid(),
    providerId: zod_1.z.string().uuid(),
    amount: zod_1.z.number().positive(),
    platformCommissionAmount: zod_1.z.number().nonnegative(),
    providerAmount: zod_1.z.number().positive(),
    currency: zod_1.z.string().length(3).default("USD"),
    status: exports.PaymentStatus.default("PENDING"),
    stripePaymentIntentId: zod_1.z.string().optional(),
    stripeTransferId: zod_1.z.string().optional(),
    createdAt: zod_1.z.coerce.date(),
    updatedAt: zod_1.z.coerce.date(),
});
exports.CreatePaymentIntentSchema = zod_1.z.object({
    bookingId: zod_1.z.string().uuid(),
});
//# sourceMappingURL=payment.schema.js.map