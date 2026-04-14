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

/** Provider creates a category for their account, or reuses a shared catalog / own row by case-insensitive name. */
export const CreateServiceCategorySchema = z.object({
  name: z.string().min(1).max(80),
});

export const ServiceCurrencySchema = z.enum(["USD", "EUR", "GBP", "AED", "SAR", "PKR"]);
export type ServiceCurrency = z.infer<typeof ServiceCurrencySchema>;

export const ServiceSchema = z.object({
  id:          z.string().uuid(),
  providerId:  z.string().uuid(),
  categoryId:  z.string().uuid(),
  title:       z.string().min(1),
  description: z.string().optional(),
  price:       z.number().positive(),
  priceCurrency: ServiceCurrencySchema.default("USD"),
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
  priceCurrency: true,
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
  /**
   * Driving distance in km (Google Distance Matrix, cached) from the customer to the nearest listed
   * service location when the list request includes lat/lon. Falls back to straight-line km when routing
   * is unavailable. Prefer `distanceMeters` for display (integer from Google; avoids rounding error).
   */
  distanceKm: z.number().nonnegative().optional(),
  /** Integer metres along the road when `distanceKind === "DRIVING"`; rounded Haversine when straight-line. */
  distanceMeters: z.number().int().nonnegative().optional(),
  /** Nearest shop / pin used for routing; geo list `radius` uses the same resolved distance as the UI (driving when available). */
  nearestLocationLatitude: z.number().optional(),
  nearestLocationLongitude: z.number().optional(),
  /** DRIVING = `distanceKm` from Distance Matrix. STRAIGHT_LINE = Haversine fallback. */
  distanceKind: z.enum(["DRIVING", "STRAIGHT_LINE"]).optional(),
  startingPrice: z.number().optional(),
  primaryServiceTitle: z.string().optional(),
  /** Cheapest active service id (same ordering as startingPrice / primaryServiceTitle). */
  primaryServiceId: z.string().uuid().optional(),
  /** Lowercase blob of all active service titles, descriptions, and category names (for client search/filter). */
  serviceSearchText: z.string().optional(),
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
  priceCurrency: ServiceCurrencySchema.default("USD"),
  duration: z.number().int().positive(),
  categoryName: z.string(),
  isActive: z.boolean(),
});

/** Provider-owned row for manage UI (includes inactive + category id). */
export const ProviderMyServiceSchema = ProviderServiceOfferSchema.extend({
  categoryId: z.string().uuid(),
});

export const UpdateServiceSchema = CreateServiceSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type ProviderProfile            = z.infer<typeof ProviderProfileSchema>;
export type UpdateProviderProfileInput = z.infer<typeof UpdateProviderProfileSchema>;
export type ServiceCategory            = z.infer<typeof ServiceCategorySchema>;
export type CreateServiceCategoryInput = z.infer<typeof CreateServiceCategorySchema>;
export type Service                    = z.infer<typeof ServiceSchema>;
export type CreateServiceInput         = z.infer<typeof CreateServiceSchema>;
export type ProviderMyService          = z.infer<typeof ProviderMyServiceSchema>;
export type UpdateServiceInput       = z.infer<typeof UpdateServiceSchema>;
export type ProviderPublicSummary      = z.infer<typeof ProviderPublicSummarySchema>;
export type ProviderPublicDetail       = z.infer<typeof ProviderPublicDetailSchema>;
export type ProviderServiceOffer       = z.infer<typeof ProviderServiceOfferSchema>;
