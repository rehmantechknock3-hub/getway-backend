"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateReviewSchema = exports.ReviewSchema = exports.BookingListResponseSchema = exports.UpdateBookingStatusSchema = exports.CreateBookingSchema = exports.BookingSchema = exports.BookingStatus = void 0;
const zod_1 = require("zod");
exports.BookingStatus = zod_1.z.enum([
    "PENDING",
    "ACCEPTED",
    "REJECTED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
]);
exports.BookingSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    customerId: zod_1.z.string().uuid(),
    providerId: zod_1.z.string().uuid(),
    serviceId: zod_1.z.string().uuid(),
    status: exports.BookingStatus.default("PENDING"),
    scheduledAt: zod_1.z.coerce.date(),
    address: zod_1.z.string().min(1),
    latitude: zod_1.z.number(),
    longitude: zod_1.z.number(),
    notes: zod_1.z.string().max(500).optional(),
    totalAmount: zod_1.z.number().positive(),
    createdAt: zod_1.z.coerce.date(),
    updatedAt: zod_1.z.coerce.date(),
});
exports.CreateBookingSchema = exports.BookingSchema.pick({
    serviceId: true,
    scheduledAt: true,
    address: true,
    latitude: true,
    longitude: true,
    notes: true,
});
exports.UpdateBookingStatusSchema = zod_1.z.object({
    status: exports.BookingStatus,
});
exports.BookingListResponseSchema = zod_1.z.object({
    data: zod_1.z.array(exports.BookingSchema),
    total: zod_1.z.number().int(),
    page: zod_1.z.number().int(),
    limit: zod_1.z.number().int(),
});
exports.ReviewSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    bookingId: zod_1.z.string().uuid(),
    rating: zod_1.z.number().int().min(1).max(5),
    comment: zod_1.z.string().max(1000).optional(),
    createdAt: zod_1.z.coerce.date(),
});
exports.CreateReviewSchema = exports.ReviewSchema.pick({
    bookingId: true,
    rating: true,
    comment: true,
});
//# sourceMappingURL=booking.schema.js.map