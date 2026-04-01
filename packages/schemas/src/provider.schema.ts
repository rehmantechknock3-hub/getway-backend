import { z } from "zod";

export const VerificationStatus = z.enum([
  "PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED",
]);
export type VerificationStatus = z.infer<typeof VerificationStatus>;

export const ProviderProfileSchema = z.object({
  id:                 z.string().uuid(),
  userId:             z.string().uuid(),
  bio:                z.string().max(500).optional(),
  verificationStatus: VerificationStatus.default("PENDING"),
  isOnline:           z.boolean().default(false),
  averageRating:      z.number().min(0).max(5).default(0),
  totalReviews:       z.number().int().default(0),
  totalEarnings:      z.number().default(0),
  latitude:           z.number().optional(),
  longitude:          z.number().optional(),
  createdAt:          z.coerce.date(),
  updatedAt:          z.coerce.date(),
});

export const UpdateProviderProfileSchema = ProviderProfileSchema.pick({
  bio:      true,
  isOnline: true,
  latitude: true,
  longitude: true,
}).partial();

export const ServiceCategorySchema = z.object({
  id:          z.string().uuid(),
  name:        z.string().min(1),
  icon:        z.string(),
  description: z.string().optional(),
});

export const ServiceSchema = z.object({
  id:          z.string().uuid(),
  providerId:  z.string().uuid(),
  categoryId:  z.string().uuid(),
  title:       z.string().min(1),
  description: z.string().optional(),
  price:       z.number().positive(),
  duration:    z.number().int().positive(), // minutes
  isActive:    z.boolean().default(true),
  createdAt:   z.coerce.date(),
  updatedAt:   z.coerce.date(),
});

export const CreateServiceSchema = ServiceSchema.pick({
  categoryId:  true,
  title:       true,
  description: true,
  price:       true,
  duration:    true,
});

export type ProviderProfile            = z.infer<typeof ProviderProfileSchema>;
export type UpdateProviderProfileInput = z.infer<typeof UpdateProviderProfileSchema>;
export type ServiceCategory            = z.infer<typeof ServiceCategorySchema>;
export type Service                    = z.infer<typeof ServiceSchema>;
export type CreateServiceInput         = z.infer<typeof CreateServiceSchema>;
