import { z } from "zod";

export const UserRole = z.enum(["CUSTOMER", "PROVIDER", "ADMIN"]);
export type UserRole = z.infer<typeof UserRole>;

export const SavedLocationSchema = z.object({
  label: z.string().min(1),
  address: z.string().min(1),
});

export const CustomerOnboardingSchema = z.object({
  primaryLocation: z.string().min(1),
  carCompany: z.string().min(1),
  carModel: z.string().regex(/^\d+$/),
  notes: z.string().max(300).optional(),
});

export const ProviderOnboardingSchema = z.object({
  serviceCategory: z.string().min(1),
  experienceYears: z.number().int().min(0).max(60),
  serviceArea: z.string().min(1),
  hasTools: z.boolean(),
  serviceDescription: z.string().min(1).max(500),
  profilePhotoUrl: z.string().url().optional(),
});

export const UserSchema = z.object({
  id:          z.string().uuid(),
  clerkId:     z.string(),
  role:        UserRole,
  email:       z.string().email(),
  firstName:   z.string().min(1),
  lastName:    z.string().min(1),
  phone:       z.string().optional(),
  avatarUrl:   z.string().url().optional(),
  savedLocations: z.array(SavedLocationSchema).default([]),
  onboardingCompleted: z.boolean().default(false),
  customerOnboarding: CustomerOnboardingSchema.optional(),
  providerOnboarding: ProviderOnboardingSchema.optional(),
  providerMetrics: z.object({
    averageRating: z.number().min(0).max(5),
    totalReviews: z.number().int().min(0),
  }).optional(),
  createdAt:   z.coerce.date(),
  updatedAt:   z.coerce.date(),
});

export const CreateUserSchema = UserSchema.pick({
  clerkId: true,
  role:    true,
  email:   true,
  firstName: true,
  lastName:  true,
});

export const UpdateUserSchema = UserSchema.pick({
  firstName:  true,
  lastName:   true,
  phone:      true,
  avatarUrl:  true,
}).partial();

export const UpdateUserProfileSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(6).max(20),
});

export const UpdateSavedLocationsSchema = z.object({
  savedLocations: z.array(SavedLocationSchema).max(10),
});

export const CustomerOnboardingInputSchema = z.object({
  role: z.literal("CUSTOMER"),
  data: CustomerOnboardingSchema,
});

export const ProviderOnboardingInputSchema = z.object({
  role: z.literal("PROVIDER"),
  data: ProviderOnboardingSchema,
});

export const UpdateOnboardingSchema = z.union([
  CustomerOnboardingInputSchema,
  ProviderOnboardingInputSchema,
]);

export type User             = z.infer<typeof UserSchema>;
export type CreateUserInput  = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput  = z.infer<typeof UpdateUserSchema>;
export type SavedLocation = z.infer<typeof SavedLocationSchema>;
export type CustomerOnboarding = z.infer<typeof CustomerOnboardingSchema>;
export type ProviderOnboarding = z.infer<typeof ProviderOnboardingSchema>;
export type UpdateUserProfileInput = z.infer<typeof UpdateUserProfileSchema>;
export type UpdateSavedLocationsInput = z.infer<typeof UpdateSavedLocationsSchema>;
export type UpdateOnboardingInput = z.infer<typeof UpdateOnboardingSchema>;
