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

/** Public card row for customer discovery (list). Phone is intentionally omitted. */
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
  startingPriceCurrency: ServiceCurrencySchema.default("USD").optional(),
  primaryServiceTitle: z.string().optional(),
  /** Cheapest active service id (same ordering as startingPrice / primaryServiceTitle). */
  primaryServiceId: z.string().uuid().optional(),
  /** Number of active services currently bookable for this provider. */
  activeServiceCount: z.number().int().nonnegative(),
  /** Lowercase blob of all active service titles, descriptions, and category names (for client search/filter). */
  serviceSearchText: z.string().optional(),
});

/** Rolling booking window from the provider's current day. */
export const PROVIDER_AVAILABILITY_WINDOW_DAYS = 30;

export const ProviderAvailabilityDaySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    enabled: z.boolean(),
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(0).max(23),
  })
  .refine((day) => day.endHour >= day.startHour, {
    message: "End hour must be at or after start hour",
  });

export const UpdateProviderAvailabilitySchema = z.object({
  days: z
    .array(ProviderAvailabilityDaySchema)
    .min(1)
    .max(PROVIDER_AVAILABILITY_WINDOW_DAYS + 1)
    .refine((days) => new Set(days.map((day) => day.date)).size === days.length, {
      message: "Availability days must be unique",
    }),
});

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function civilDateKeyFromLocal(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function civilDateKeyFromUtc(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

export function parseCivilDateKey(dateKey: string): { year: number; month: number; day: number } {
  return {
    year: Number(dateKey.slice(0, 4)),
    month: Number(dateKey.slice(5, 7)),
    day: Number(dateKey.slice(8, 10)),
  };
}

export function addCivilDays(dateKey: string, days: number): string {
  const { year, month, day } = parseCivilDateKey(dateKey);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return civilDateKeyFromUtc(next);
}

export function rollingCivilDateKeys(
  todayKey: string,
  count = PROVIDER_AVAILABILITY_WINDOW_DAYS
): string[] {
  return Array.from({ length: count }, (_, index) => addCivilDays(todayKey, index));
}

export function defaultAvailabilityDay(dateKey: string): ProviderAvailabilityDay {
  return { date: dateKey, enabled: false, startHour: 9, endHour: 18 };
}

export function lockedAvailabilityDates(stored: unknown): Set<string> {
  return new Set(
    parseAvailabilityDays(stored)
      .filter((day) => day.enabled)
      .map((day) => day.date)
  );
}

/** Saved open days stay as stored; the provider can only add new open days. */
export function reconcileProviderAvailability(
  stored: unknown,
  incoming: ProviderAvailabilityDay[]
): ProviderAvailabilityDay[] {
  const storedByDate = new Map(parseAvailabilityDays(stored).map((day) => [day.date, day]));
  return incoming.map((day) => {
    const prev = storedByDate.get(day.date);
    if (prev?.enabled) return prev;
    return day;
  });
}

export const ProviderBookedSlotSchema = z.object({
  scheduledAt: z.coerce.date(),
  durationMinutes: z.number().int().positive(),
});

export function bookingsOverlap(
  aStart: Date,
  aMinutes: number,
  bStart: Date,
  bMinutes: number
): boolean {
  const aEnd = aStart.getTime() + Math.max(1, aMinutes) * 60_000;
  const bEnd = bStart.getTime() + Math.max(1, bMinutes) * 60_000;
  return aStart.getTime() < bEnd && bStart.getTime() < aEnd;
}

export function hourOverlapsBookedSlot(
  dateKey: string,
  hour: number,
  slot: { scheduledAt: Date | string; durationMinutes: number },
  slotMinutes = 60
): boolean {
  const { year, month, day } = parseCivilDateKey(dateKey);
  const hourStart = new Date(year, month - 1, day, hour, 0, 0, 0);
  return bookingsOverlap(hourStart, slotMinutes, new Date(slot.scheduledAt), slot.durationMinutes);
}

export function parseAvailabilityDays(raw: unknown): ProviderAvailabilityDay[] {
  const parsed = z.array(ProviderAvailabilityDaySchema).safeParse(raw);
  return parsed.success ? parsed.data : [];
}

export function mergeRollingAvailability(
  todayKey: string,
  stored: unknown
): ProviderAvailabilityDay[] {
  const byDate = new Map(parseAvailabilityDays(stored).map((day) => [day.date, day]));
  return rollingCivilDateKeys(todayKey).map((dateKey) => byDate.get(dateKey) ?? defaultAvailabilityDay(dateKey));
}

export function instantFitsAvailabilityDay(
  scheduledAt: Date,
  day: ProviderAvailabilityDay
): boolean {
  if (!day.enabled) return false;
  for (let offset = -12; offset <= 14; offset++) {
    const shifted = new Date(scheduledAt.getTime() + offset * 3_600_000);
    if (civilDateKeyFromUtc(shifted) !== day.date) continue;
    const hour = shifted.getUTCHours();
    if (hour >= day.startHour && hour <= day.endHour) return true;
  }
  return false;
}

export function scheduledAtAllowed(
  scheduledAt: Date,
  storedAvailability: unknown,
  now = new Date()
): string | null {
  if (Number.isNaN(scheduledAt.getTime())) return "Invalid booking time";
  if (scheduledAt.getTime() < now.getTime() - 60_000) {
    return "Choose a future date and time";
  }
  const maxMs = now.getTime() + PROVIDER_AVAILABILITY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  if (scheduledAt.getTime() > maxMs) {
    return "Bookings can be scheduled up to 30 days ahead";
  }
  const days = mergeRollingAvailability(civilDateKeyFromUtc(now), storedAvailability);
  if (!days.some((day) => instantFitsAvailabilityDay(scheduledAt, day))) {
    return "That time is outside the provider's calendar";
  }
  return null;
}

/** Full public provider profile for customer detail view. */
export const ProviderPublicDetailSchema = ProviderPublicSummarySchema.extend({
  bio: z.string().optional(),
  experienceYears: z.number().int().min(0).max(60).optional(),
  hasTools: z.boolean().optional(),
  /** Stored rolling-month days; clients merge with local today. */
  availabilityDays: z.array(ProviderAvailabilityDaySchema).optional(),
  /** Occupied times for this provider. No customer identity. */
  bookedSlots: z.array(ProviderBookedSlotSchema).optional(),
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
export type ProviderAvailabilityDay    = z.infer<typeof ProviderAvailabilityDaySchema>;
export type ProviderBookedSlot         = z.infer<typeof ProviderBookedSlotSchema>;
export type UpdateProviderAvailabilityInput = z.infer<typeof UpdateProviderAvailabilitySchema>;
