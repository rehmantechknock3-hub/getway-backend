import { z } from "zod";

import { BookingStatus } from "./booking.schema";
import { UserRole } from "./user.schema";

export const AdminStatsSchema = z.object({
  users: z.object({
    total: z.number().int().nonnegative(),
    customers: z.number().int().nonnegative(),
    providers: z.number().int().nonnegative(),
    admins: z.number().int().nonnegative(),
  }),
  providers: z.object({
    total: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    approved: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
    underReview: z.number().int().nonnegative(),
    online: z.number().int().nonnegative(),
  }),
  bookings: z.object({
    total: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    accepted: z.number().int().nonnegative(),
    inProgress: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    cancelled: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
  }),
  services: z.object({
    total: z.number().int().nonnegative(),
  }),
  payments: z.object({
    total: z.number().int().nonnegative(),
    succeeded: z.number().int().nonnegative(),
    volumeCentsApprox: z.number().nonnegative(),
  }),
});
export type AdminStats = z.infer<typeof AdminStatsSchema>;

export const AdminUserRowSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  role: UserRole,
  phone: z.string().nullable(),
  createdAt: z.coerce.date(),
  onboardingCompleted: z.boolean(),
  /** Lifetime spend from completed bookings. */
  totalSpent: z.number().nonnegative().optional().default(0),
  providerVerificationStatus: z
    .enum(["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"])
    .nullable(),
});
export type AdminUserRow = z.infer<typeof AdminUserRowSchema>;

export const AdminUserListResponseSchema = z.object({
  data: z.array(AdminUserRowSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});
export type AdminUserListResponse = z.infer<typeof AdminUserListResponseSchema>;

export const AdminServiceRowSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  priceCurrency: z.string(),
  duration: z.number().int(),
  isActive: z.boolean(),
  categoryName: z.string().nullable(),
  providerProfileId: z.string().uuid(),
  providerUserId: z.string().uuid(),
  providerFirstName: z.string(),
  providerLastName: z.string(),
  providerEmail: z.string().email(),
  providerVerificationStatus: z.enum([
    "PENDING",
    "UNDER_REVIEW",
    "APPROVED",
    "REJECTED",
  ]),
  createdAt: z.coerce.date(),
});
export type AdminServiceRow = z.infer<typeof AdminServiceRowSchema>;

export const AdminServiceListResponseSchema = z.object({
  data: z.array(AdminServiceRowSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});
export type AdminServiceListResponse = z.infer<typeof AdminServiceListResponseSchema>;

export const AdminUpdateServiceActiveSchema = z.object({
  isActive: z.boolean(),
});
export type AdminUpdateServiceActiveInput = z.infer<
  typeof AdminUpdateServiceActiveSchema
>;

export const AdminProviderRowSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  verificationStatus: z.enum(["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"]),
  isOnline: z.boolean(),
  averageRating: z.number(),
  totalReviews: z.number().int(),
  serviceArea: z.string().nullable(),
  createdAt: z.coerce.date(),
});
export type AdminProviderRow = z.infer<typeof AdminProviderRowSchema>;

export const AdminProviderListResponseSchema = z.object({
  data: z.array(AdminProviderRowSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});
export type AdminProviderListResponse = z.infer<typeof AdminProviderListResponseSchema>;

export const AdminUpdateProviderVerificationSchema = z.object({
  verificationStatus: z.enum(["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"]),
});
export type AdminUpdateProviderVerificationInput = z.infer<
  typeof AdminUpdateProviderVerificationSchema
>;

export const AdminProviderServiceSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  priceCurrency: z.string(),
  duration: z.number().int(),
  isActive: z.boolean(),
  categoryName: z.string().nullable(),
});

export const AdminProviderDocumentSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  createdAt: z.coerce.date(),
  verifiedAt: z.coerce.date().nullable(),
});

export const AdminProviderBookingRowSchema = z.object({
  id: z.string().uuid(),
  status: BookingStatus,
  serviceTitle: z.string(),
  customerId: z.string().uuid(),
  customerName: z.string(),
  address: z.string(),
  scheduledAt: z.coerce.date(),
  totalAmount: z.number(),
  totalCurrency: z.string(),
  createdAt: z.coerce.date(),
});
export type AdminProviderBookingRow = z.infer<typeof AdminProviderBookingRowSchema>;

export const AdminProviderDetailSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  verificationStatus: z.enum(["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"]),
  isOnline: z.boolean(),
  averageRating: z.number(),
  totalReviews: z.number().int(),
  totalEarnings: z.number(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  onboardingCompleted: z.boolean(),
  createdAt: z.coerce.date(),
  experienceYears: z.number().int().nullable(),
  serviceArea: z.string().nullable(),
  serviceDescription: z.string().nullable(),
  hasTools: z.boolean().nullable(),
  serviceCategories: z.array(z.string()),
  shopAddress: z.string().nullable(),
  shopLocations: z.array(
    z.object({
      address: z.string(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
    }),
  ),
  profilePhotoUrl: z.string().nullable(),
  services: z.array(AdminProviderServiceSchema),
  documents: z.array(AdminProviderDocumentSchema),
  bookingCounts: z.object({
    total: z.number().int(),
    completed: z.number().int(),
    pending: z.number().int(),
  }),
  /** Recent jobs for this provider, newest first. */
  bookings: z.array(AdminProviderBookingRowSchema),
});
export type AdminProviderDetail = z.infer<typeof AdminProviderDetailSchema>;

export const AdminUserBookingRowSchema = z.object({
  id: z.string().uuid(),
  asRole: z.enum(["CUSTOMER", "PROVIDER"]),
  status: BookingStatus,
  serviceTitle: z.string(),
  counterpartyName: z.string(),
  address: z.string(),
  scheduledAt: z.coerce.date(),
  totalAmount: z.number(),
  totalCurrency: z.string(),
  createdAt: z.coerce.date(),
});
export type AdminUserBookingRow = z.infer<typeof AdminUserBookingRowSchema>;

export const AdminUserDetailSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  role: UserRole,
  phone: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  onboardingCompleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  customerOnboarding: z
    .object({
      primaryLocation: z.string(),
      carCompany: z.string(),
      carModel: z.string(),
      notes: z.string().optional(),
    })
    .nullable(),
  providerProfileId: z.string().uuid().nullable(),
  providerVerificationStatus: z
    .enum(["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"])
    .nullable(),
  providerSummary: z
    .object({
      serviceArea: z.string().nullable(),
      serviceDescription: z.string().nullable(),
      experienceYears: z.number().int().nullable(),
      isOnline: z.boolean(),
      averageRating: z.number(),
      totalReviews: z.number().int(),
    })
    .nullable(),
  totalSpent: z.number().nonnegative().optional().default(0),
  bookingCounts: z.object({
    asCustomer: z.number().int(),
    asProvider: z.number().int(),
  }),
  /** Recent bookings for this user (as customer and/or provider), newest first. */
  bookings: z.array(AdminUserBookingRowSchema),
});
export type AdminUserDetail = z.infer<typeof AdminUserDetailSchema>;
