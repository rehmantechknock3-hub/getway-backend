import { z } from "zod";

import { isValidStoredPhone } from "./phone";
import { ProviderAvailabilityDaySchema } from "./provider.schema";

export const UserRole = z.enum(["CUSTOMER", "PROVIDER", "ADMIN"]);
export type UserRole = z.infer<typeof UserRole>;

export const SavedLocationSchema = z.object({
  label: z.string().min(1),
  address: z.string().min(1),
  placeId: z.string().min(1).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const CustomerOnboardingSchema = z.object({
  primaryLocation: z.string().min(1),
  carCompany: z.string().min(1),
  carModel: z.string().regex(/^\d+$/),
  notes: z.string().max(300).optional(),
  /** Filled by the API after geocoding `primaryLocation`; used for provider discovery. */
  primaryLatitude: z.number().min(-90).max(90).optional(),
  primaryLongitude: z.number().min(-180).max(180).optional(),
});

const providerOnboardingFields = {
  experienceYears: z.number().int().min(0).max(60),
  serviceArea: z.string().min(1),
  shopAddress: z.string().min(3).max(240),
  shopPlaceId: z.string().min(10).max(255).optional(),
  shopLocations: z
    .array(
      z.object({
        address: z.string().min(3).max(240),
        placeId: z.string().min(10).max(255).optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
      })
    )
    .min(1)
    .max(10),
  hasTools: z.boolean(),
  serviceDescription: z.string().max(500),
  profilePhotoUrl: z.string().url().optional(),
};

/**
 * Provider onboarding payload. Uses `serviceCategories` (1–12). Legacy rows with only
 * `serviceCategory` (string) are normalized during parse.
 */
export const ProviderOnboardingSchema = z.preprocess((raw: unknown) => {
  if (!raw || typeof raw !== "object" || raw === null) return raw;
  const o = { ...(raw as Record<string, unknown>) };
  const legacy = o["serviceCategory"];
  const next = o["serviceCategories"];
  if (typeof legacy === "string" && legacy.trim().length > 0 && !Array.isArray(next)) {
    o["serviceCategories"] = [legacy.trim()];
  }
  if (typeof o["starterListingPrice"] === "number" && Number.isNaN(o["starterListingPrice"] as number)) {
    delete o["starterListingPrice"];
  }
  if (
    typeof o["starterListingDurationMinutes"] === "number" &&
    Number.isNaN(o["starterListingDurationMinutes"] as number)
  ) {
    delete o["starterListingDurationMinutes"];
  }
  const existingLocations = o["shopLocations"];
  if (!Array.isArray(existingLocations)) {
    const fallbackAddress =
      typeof o["shopAddress"] === "string" && o["shopAddress"].trim().length > 0
        ? o["shopAddress"].trim()
        : undefined;
    if (fallbackAddress) {
      o["shopLocations"] = [
        {
          address: fallbackAddress,
          placeId:
            typeof o["shopPlaceId"] === "string" && o["shopPlaceId"].trim().length > 0
              ? o["shopPlaceId"].trim()
              : undefined,
        },
      ];
    }
  }
  return o;
}, z.object({
  serviceCategories: z.array(z.string().min(1).max(80)).min(1).max(12),
  /**
   * When set, used for auto-created starter services (one per category).
   * Omit to create draft rows (price/duration 0, inactive) until the provider completes them under My services.
   */
  starterListingPrice: z.number().positive().optional(),
  starterListingDurationMinutes: z.number().int().positive().optional(),
  ...providerOnboardingFields,
}));

/** Safe parse for JSON stored on User.providerOnboarding (API read paths). */
export function safeParseProviderOnboardingJson(raw: unknown) {
  return ProviderOnboardingSchema.safeParse(raw);
}

/** Required phone for profile updates / first onboarding. Own profile + admin only. E.164. */
export const PhoneNumberSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required")
  .max(20)
  .refine((value) => isValidStoredPhone(value), {
    message: "Enter a valid international phone number",
  });

export const UserSchema = z.object({
  id:          z.string().uuid(),
  clerkId:     z.string(),
  role:        UserRole,
  email:       z.string().email(),
  firstName:   z.string().min(1),
  lastName:    z.string().min(1),
  /** Present on `/users/me` and admin APIs only — never on public provider/booking payloads. */
  phone:       z.string().nullable().optional(),
  avatarUrl:   z.string().url().optional(),
  savedLocations: z.array(SavedLocationSchema).default([]),
  onboardingCompleted: z.boolean().default(false),
  customerOnboarding: CustomerOnboardingSchema.optional(),
  providerOnboarding: ProviderOnboardingSchema.optional(),
  /** Set when the user has a provider profile row (same id as in provider APIs). */
  providerProfileId: z.string().uuid().optional(),
  providerMetrics: z.object({
    averageRating: z.number().min(0).max(5),
    totalReviews: z.number().int().min(0),
    isOnline: z.boolean(),
    verificationStatus: z.enum(["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"]),
    availabilityDays: z.array(ProviderAvailabilityDaySchema).optional(),
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
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  phone: PhoneNumberSchema,
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

export const SetRoleSchema = z.object({
  role: z.enum(["CUSTOMER", "PROVIDER"]),
});

export type User             = z.infer<typeof UserSchema>;
export type CreateUserInput  = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput  = z.infer<typeof UpdateUserSchema>;
export type SavedLocation = z.infer<typeof SavedLocationSchema>;
export type CustomerOnboarding = z.infer<typeof CustomerOnboardingSchema>;
export type ProviderOnboarding = z.infer<typeof ProviderOnboardingSchema>;
export type UpdateUserProfileInput = z.infer<typeof UpdateUserProfileSchema>;
export type UpdateSavedLocationsInput = z.infer<typeof UpdateSavedLocationsSchema>;
export type UpdateOnboardingInput = z.infer<typeof UpdateOnboardingSchema>;
export type SetRoleInput = z.infer<typeof SetRoleSchema>;
