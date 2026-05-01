import { z } from "zod";

export const ReviewSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
  createdAt: z.coerce.date(),
});

export const CreateReviewSchema = ReviewSchema.pick({
  bookingId: true,
  rating: true,
  comment: true,
});

export type Review = z.infer<typeof ReviewSchema>;
export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;
