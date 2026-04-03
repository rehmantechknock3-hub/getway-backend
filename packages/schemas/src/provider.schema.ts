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

/** Public card row for customer discovery (list). */
export const ProviderPublicSummarySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  avatarUrl: z.string().optional(),
  serviceCategory: z.string().optional(),
  serviceDescription: z.string().optional(),
  serviceArea: z.string().optional(),
  averageRating: z.number(),
  totalReviews: z.number(),
  isOnline: z.boolean(),
  verificationStatus: VerificationStatus,
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  startingPrice: z.number().optional(),
  primaryServiceTitle: z.string().optional(),
});

/** Full public provider profile for customer detail view. */
export const ProviderPublicDetailSchema = ProviderPublicSummarySchema.extend({
  bio: z.string().optional(),
  experienceYears: z.number().int().min(0).max(60).optional(),
  hasTools: z.boolean().optional(),
});

/** Service row returned with category label for customers. */
export const ProviderServiceOfferSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().optional(),
  price: z.number(),
  duration: z.number().int().positive(),
  categoryName: z.string(),
  isActive: z.boolean(),
});

export type ProviderProfile            = z.infer<typeof ProviderProfileSchema>;
export type UpdateProviderProfileInput = z.infer<typeof UpdateProviderProfileSchema>;
export type ServiceCategory            = z.infer<typeof ServiceCategorySchema>;
export type Service                    = z.infer<typeof ServiceSchema>;
export type CreateServiceInput         = z.infer<typeof CreateServiceSchema>;
export type ProviderPublicSummary      = z.infer<typeof ProviderPublicSummarySchema>;
export type ProviderPublicDetail       = z.infer<typeof ProviderPublicDetailSchema>;
export type ProviderServiceOffer       = z.infer<typeof ProviderServiceOfferSchema>;
