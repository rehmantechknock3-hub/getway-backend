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

/** Admin creates a booking on behalf of a customer (customer internal UUID). */
export const AdminCreateBookingSchema = CreateBookingSchema.extend({
  customerId: z.string().uuid(),
});

export const UpdateBookingStatusSchema = z.object({
  status: BookingStatus,
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

/** Customer booking payload including an existing review, if any. */
export const BookingWithReviewSchema = BookingSchema.extend({
  review: ReviewSchema.nullable().optional(),
});

export const BookingListResponseSchema = z.object({
  data:  z.array(BookingWithReviewSchema),
  total: z.number().int(),
  page:  z.number().int(),
  limit: z.number().int(),
});

/** Booking row for provider app (customer + service labels for UI). */
export const ProviderBookingViewSchema = BookingSchema.extend({
  customerFirstName: z.string(),
  customerLastName:  z.string(),
  serviceTitle:      z.string(),
});

/** All-time counts for provider job queue (not limited to current page). */
export const ProviderJobQueueStatsSchema = z.object({
  pending:   z.number().int(),
  active:    z.number().int(),
  completed: z.number().int(),
});

export const ProviderBookingListResponseSchema = z.object({
  data:  z.array(ProviderBookingViewSchema),
  total: z.number().int(),
  page:  z.number().int(),
  limit: z.number().int(),
  stats: ProviderJobQueueStatsSchema,
});

/** Single customer review visible to the provider. */
export const ProviderReviewListItemSchema = z.object({
  id:                z.string().uuid(),
  bookingId:         z.string().uuid(),
  rating:            z.number().int().min(1).max(5),
  comment:           z.string().max(1000).optional(),
  createdAt:         z.coerce.date(),
  customerFirstName: z.string(),
  customerLastName:  z.string(),
  serviceTitle:      z.string(),
});

export const ProviderReviewListResponseSchema = z.object({
  data:  z.array(ProviderReviewListItemSchema),
  total: z.number().int(),
  page:  z.number().int(),
  limit: z.number().int(),
});

export type Booking                  = z.infer<typeof BookingSchema>;
export type BookingWithReview        = z.infer<typeof BookingWithReviewSchema>;
export type CreateBookingInput       = z.infer<typeof CreateBookingSchema>;
export type AdminCreateBookingInput  = z.infer<typeof AdminCreateBookingSchema>;
export type UpdateBookingStatusInput = z.infer<typeof UpdateBookingStatusSchema>;
export type BookingListResponse      = z.infer<typeof BookingListResponseSchema>;
export type ProviderBookingView      = z.infer<typeof ProviderBookingViewSchema>;
export type ProviderBookingListResponse = z.infer<typeof ProviderBookingListResponseSchema>;
export type ProviderJobQueueStats = z.infer<typeof ProviderJobQueueStatsSchema>;
export type ProviderReviewListItem = z.infer<typeof ProviderReviewListItemSchema>;
export type ProviderReviewListResponse = z.infer<typeof ProviderReviewListResponseSchema>;
export type Review                   = z.infer<typeof ReviewSchema>;
export type CreateReviewInput        = z.infer<typeof CreateReviewSchema>;
