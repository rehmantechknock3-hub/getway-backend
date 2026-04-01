import { z } from "zod";

export const BookingStatus = z.enum([
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);
export type BookingStatus = z.infer<typeof BookingStatus>;

export const BookingSchema = z.object({
  id:           z.string().uuid(),
  customerId:   z.string().uuid(),
  providerId:   z.string().uuid(),
  serviceId:    z.string().uuid(),
  status:       BookingStatus.default("PENDING"),
  scheduledAt:  z.coerce.date(),
  address:      z.string().min(1),
  latitude:     z.number(),
  longitude:    z.number(),
  notes:        z.string().max(500).optional(),
  totalAmount:  z.number().positive(),
  createdAt:    z.coerce.date(),
  updatedAt:    z.coerce.date(),
});

export const CreateBookingSchema = BookingSchema.pick({
  serviceId:   true,
  scheduledAt: true,
  address:     true,
  latitude:    true,
  longitude:   true,
  notes:       true,
});

export const UpdateBookingStatusSchema = z.object({
  status: BookingStatus,
});

export const BookingListResponseSchema = z.object({
  data:  z.array(BookingSchema),
  total: z.number().int(),
  page:  z.number().int(),
  limit: z.number().int(),
});

export const ReviewSchema = z.object({
  id:        z.string().uuid(),
  bookingId: z.string().uuid(),
  rating:    z.number().int().min(1).max(5),
  comment:   z.string().max(1000).optional(),
  createdAt: z.coerce.date(),
});

export const CreateReviewSchema = ReviewSchema.pick({
  bookingId: true,
  rating:    true,
  comment:   true,
});

export type Booking                  = z.infer<typeof BookingSchema>;
export type CreateBookingInput       = z.infer<typeof CreateBookingSchema>;
export type UpdateBookingStatusInput = z.infer<typeof UpdateBookingStatusSchema>;
export type BookingListResponse      = z.infer<typeof BookingListResponseSchema>;
export type Review                   = z.infer<typeof ReviewSchema>;
export type CreateReviewInput        = z.infer<typeof CreateReviewSchema>;
