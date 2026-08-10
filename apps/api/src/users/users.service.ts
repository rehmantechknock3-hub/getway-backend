import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
  CustomerOnboarding,
  ProviderOnboarding,
  SavedLocation,
  UserRole,
  UpdateUserProfileInput,
} from "@repo/schemas";
import { safeParseProviderOnboardingJson } from "@repo/schemas";

import type { ClerkUserPayload } from "../auth/webhook.controller";
import { GoogleMapsService } from "../maps/google-maps.service";
import { PrismaService } from "../prisma/prisma.service";

/** Clerk lists multiple emails; sync must use the user's primary, not `email_addresses[0]`. */
export function resolveClerkPrimaryEmail(clerkUser: ClerkUserPayload): string {
  const primaryId = clerkUser.primary_email_address_id;
  const addresses = clerkUser.email_addresses ?? [];
  if (primaryId) {
    const match = addresses.find((e) => e.id === primaryId);
    if (match?.email_address) return match.email_address;
  }
  return addresses[0]?.email_address ?? "";
}

type ListingDb = Pick<PrismaService, "service" | "serviceCategory">;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleMaps: GoogleMapsService
  ) {}

  private async geocodeProviderLocations(
    locations: Array<{
      address: string;
      placeId?: string;
      latitude?: number;
      longitude?: number;
    }>,
    requestId?: string
  ): Promise<Array<{ address: string; placeId?: string; latitude?: number; longitude?: number }>> {
    const output: Array<{ address: string; placeId?: string; latitude?: number; longitude?: number }> = [];
    for (const location of locations) {
      const hasClientCoords =
        typeof location.latitude === "number" &&
        typeof location.longitude === "number" &&
        Number.isFinite(location.latitude) &&
        Number.isFinite(location.longitude);
      if (hasClientCoords) {
        output.push({
          address: location.address,
          placeId: location.placeId,
          latitude: location.latitude,
          longitude: location.longitude,
        });
        continue;
      }

      const coords = await this.googleMaps.geocodeAddress({
        shopAddress: location.address,
        shopPlaceId: location.placeId,
        requestId,
      });
      output.push({
        address: location.address,
        placeId: location.placeId,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      });
    }
    return output;
  }

  /**
   * Creates one Service per onboarding category when the profile has none.
   * If starter price/duration are omitted, rows are drafts (price/duration 0, inactive) until edited under My services.
   */
  private async seedStarterListing(
    profileId: string,
    data: ProviderOnboarding,
    db: ListingDb
  ): Promise<void> {
    const seen = new Set<string>();
    for (const rawName of data.serviceCategories) {
      const categoryName = rawName.trim();
      if (!categoryName || seen.has(categoryName.toLowerCase())) continue;
      seen.add(categoryName.toLowerCase());

      let category = await db.serviceCategory.findFirst({
        where: {
          name: { equals: categoryName, mode: "insensitive" },
          OR: [{ providerId: null }, { providerId: profileId }],
        },
      });
      if (!category) {
        category = await db.serviceCategory.create({
          data: {
            name: categoryName,
            icon: "construct-outline",
            providerId: profileId,
          },
        });
      }
      const price =
        typeof data.starterListingPrice === "number" && data.starterListingPrice > 0
          ? data.starterListingPrice
          : 0;
      const duration =
        typeof data.starterListingDurationMinutes === "number" && data.starterListingDurationMinutes > 0
          ? data.starterListingDurationMinutes
          : 0;
      const listingComplete = price > 0 && duration > 0;

      await db.service.create({
        data: {
          providerId: profileId,
          categoryId: category.id,
          title: categoryName,
          description: data.serviceDescription,
          price,
          duration,
          isActive: listingComplete,
        },
      });
    }
  }

  async upsertFromClerk(clerkUser: ClerkUserPayload) {
    const email     = resolveClerkPrimaryEmail(clerkUser);
    const role      = (clerkUser.public_metadata?.role ?? "CUSTOMER") as UserRole;
    const firstName = clerkUser.first_name ?? "";
    const lastName  = clerkUser.last_name  ?? "";
    const avatarUrl = clerkUser.image_url  ?? null;

    const user = await this.prisma.user.upsert({
      where:  { clerkId: clerkUser.id },
      update: { email, role, firstName, lastName, avatarUrl },
      create: { clerkId: clerkUser.id, email, role, firstName, lastName, avatarUrl },
    });

    if (role === "PROVIDER") {
      await this.prisma.providerProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id },
        update: {},
      });
    }

    return user;
  }

  /**
   * Removes the local user and dependent rows. Used when Clerk sends `user.deleted`, or for admin cleanup.
   * Bookings reference customers and provider profiles without DB-level cascade, so those are deleted explicitly.
   */
  async deleteByClerkId(clerkId: string): Promise<{ deleted: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      select: {
        id: true,
        providerProfile: { select: { id: true } },
      },
    });
    if (!user) return { deleted: false };

    await this.prisma.$transaction(async (tx) => {
      await tx.message.deleteMany({ where: { senderId: user.id } });

      const providerProfileId = user.providerProfile?.id;
      const bookingFilter =
        providerProfileId !== undefined
          ? { OR: [{ customerId: user.id }, { providerId: providerProfileId }] }
          : { customerId: user.id };

      const bookings = await tx.booking.findMany({
        where: bookingFilter,
        select: { id: true },
      });
      const bookingIds = bookings.map((b) => b.id);

      if (bookingIds.length > 0) {
        await tx.payment.deleteMany({ where: { bookingId: { in: bookingIds } } });
        await tx.review.deleteMany({ where: { bookingId: { in: bookingIds } } });
        await tx.conversation.deleteMany({ where: { bookingId: { in: bookingIds } } });
        await tx.booking.deleteMany({ where: { id: { in: bookingIds } } });
      }

      const favoriteWhere =
        providerProfileId !== undefined
          ? { OR: [{ customerId: user.id }, { providerId: providerProfileId }] }
          : { customerId: user.id };

      await tx.favoriteProvider.deleteMany({ where: favoriteWhere });

      await tx.user.delete({ where: { id: user.id } });
    });

    return { deleted: true };
  }

  /**
   * Clerk `publicMetadata.role` can be PROVIDER before Postgres is updated (webhook / set-role race).
   * Align DB role + provider profile so `/users/me` matches the session used for routing.
   */
  async syncRoleFromClerkSession(
    clerkId: string,
    auth: { public_metadata?: { role?: string }; metadata?: { role?: string } } | undefined
  ): Promise<void> {
    const jwtRole = auth?.public_metadata?.role ?? auth?.metadata?.role;
    if (jwtRole !== "PROVIDER") return;

    const user = await this.prisma.user.findUnique({ where: { clerkId } });
    if (!user || user.role === "PROVIDER") return;

    await this.prisma.user.update({
      where: { clerkId },
      data: { role: "PROVIDER" },
    });
    await this.prisma.providerProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });
  }

  async findByClerkId(clerkId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: {
        providerProfile: {
          select: {
            id: true,
            averageRating: true,
            totalReviews: true,
            isOnline: true,
          },
        },
      },
    });

    if (!user) return null;

    const { providerProfile, ...rest } = user;

    return {
      ...rest,
      providerProfileId: providerProfile?.id,
      providerMetrics: providerProfile
        ? {
            averageRating: providerProfile.averageRating,
            totalReviews: providerProfile.totalReviews,
            isOnline: providerProfile.isOnline,
          }
        : undefined,
    };
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        clerkId: true,
        role: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
        savedLocations: true,
        onboardingCompleted: true,
        customerOnboarding: true,
        providerOnboarding: true,
        createdAt: true,
        updatedAt: true,
        providerProfile: {
          select: {
            id: true,
            averageRating: true,
            totalReviews: true,
            isOnline: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException("User not found");

    const { providerProfile, ...rest } = user;
    return {
      ...rest,
      providerProfileId: providerProfile?.id,
      providerMetrics: providerProfile
        ? {
            averageRating: providerProfile.averageRating,
            totalReviews: providerProfile.totalReviews,
            isOnline: providerProfile.isOnline,
          }
        : undefined,
    };
  }

  async updateProviderPresence(clerkId: string, isOnline: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, role: true, providerProfile: { select: { id: true } } },
    });
    if (!user) throw new NotFoundException("User not found");
    if (user.role !== "PROVIDER" || !user.providerProfile) {
      throw new ForbiddenException("Only providers can update availability");
    }

    await this.prisma.providerProfile.update({
      where: { id: user.providerProfile.id },
      data: { isOnline },
    });

    return this.findByClerkId(clerkId);
  }

  async updateProfile(clerkId: string, input: UpdateUserProfileInput) {
    const phone = input.phone?.trim();
    await this.prisma.user.update({
      where: { clerkId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: phone && phone.length > 0 ? phone : null,
      },
    });
    const user = await this.findByClerkId(clerkId);
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async updateSavedLocations(clerkId: string, savedLocations: SavedLocation[]) {
    await this.prisma.user.update({
      where: { clerkId },
      data: {
        savedLocations: savedLocations as Prisma.InputJsonValue,
      },
    });
    const user = await this.findByClerkId(clerkId);
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async updateAvatar(clerkId: string, avatarUrl: string) {
    await this.prisma.user.update({
      where: { clerkId },
      data: { avatarUrl },
    });
    const user = await this.findByClerkId(clerkId);
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async updateCustomerOnboarding(clerkId: string, data: CustomerOnboarding, requestId?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { clerkId },
      select: { customerOnboarding: true },
    });
    const prev = existing?.customerOnboarding as Record<string, unknown> | null;
    const prevLocation =
      typeof prev?.primaryLocation === "string" ? prev.primaryLocation.trim() : "";
    const locationUnchanged = prevLocation === data.primaryLocation.trim();
    const prevLat = typeof prev?.primaryLatitude === "number" ? prev.primaryLatitude : undefined;
    const prevLng = typeof prev?.primaryLongitude === "number" ? prev.primaryLongitude : undefined;

    const coords = await this.googleMaps.geocodeAddress({
      shopAddress: data.primaryLocation.trim(),
      requestId,
    });

    let primaryLatitude: number | undefined;
    let primaryLongitude: number | undefined;
    if (coords) {
      primaryLatitude = coords.latitude;
      primaryLongitude = coords.longitude;
    } else if (locationUnchanged && prevLat != null && prevLng != null) {
      primaryLatitude = prevLat;
      primaryLongitude = prevLng;
    }

    const customerOnboarding: CustomerOnboarding = {
      primaryLocation: data.primaryLocation,
      carCompany: data.carCompany,
      carModel: data.carModel,
      notes: data.notes,
      ...(primaryLatitude != null && primaryLongitude != null
        ? { primaryLatitude, primaryLongitude }
        : {}),
    };

    await this.prisma.user.update({
      where: { clerkId },
      data: {
        onboardingCompleted: true,
        customerOnboarding: customerOnboarding as Prisma.InputJsonValue,
      },
    });
    const user = await this.findByClerkId(clerkId);
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async updateProviderOnboarding(clerkId: string, data: ProviderOnboarding, requestId?: string) {
    const geocodedLocations = await this.geocodeProviderLocations(
      data.shopLocations.map((location) => ({
        address: location.address,
        placeId: location.placeId,
        latitude: location.latitude,
        longitude: location.longitude,
      })),
      requestId
    );
    const primaryLocation = geocodedLocations[0];
    const onboardingPayload: ProviderOnboarding = {
      ...data,
      shopAddress: primaryLocation?.address ?? data.shopAddress,
      shopPlaceId: primaryLocation?.placeId ?? data.shopPlaceId,
      shopLocations: geocodedLocations,
    };

    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { clerkId },
        data: {
          onboardingCompleted: true,
          providerOnboarding: onboardingPayload as Prisma.InputJsonValue,
          avatarUrl: onboardingPayload.profilePhotoUrl ?? undefined,
        },
      });
      const profile = await tx.providerProfile.findUnique({
        where: { userId: user.id },
      });
      if (!profile) return;

      if (
        typeof primaryLocation?.latitude === "number" &&
        typeof primaryLocation?.longitude === "number"
      ) {
        await tx.providerProfile.update({
          where: { id: profile.id },
          data: {
            latitude: primaryLocation.latitude,
            longitude: primaryLocation.longitude,
          },
        });
      }

      const existing = await tx.service.count({ where: { providerId: profile.id } });
      if (existing === 0) {
        await this.seedStarterListing(profile.id, data, tx);
      }
    });
    const user = await this.findByClerkId(clerkId);
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  /** Backfill for providers who onboarded before starter listings existed. */
  async ensureProviderStarterListing(clerkId: string): Promise<{ created: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { providerProfile: true },
    });
    if (!user) throw new NotFoundException("User not found");
    if (user.role !== "PROVIDER") {
      throw new ForbiddenException("Only providers can publish a listing");
    }
    if (!user.providerProfile) {
      throw new NotFoundException("Provider profile not found");
    }
    const parsed = safeParseProviderOnboardingJson(user.providerOnboarding);
    if (!parsed.success) {
      throw new BadRequestException("Complete provider onboarding before adding a listing");
    }
    const count = await this.prisma.service.count({
      where: { providerId: user.providerProfile.id },
    });
    if (count > 0) return { created: false };
    await this.seedStarterListing(user.providerProfile.id, parsed.data, this.prisma);
    return { created: true };
  }

  async setRole(clerkId: string, role: UserRole) {
    return this.prisma.user.update({
      where:  { clerkId },
      data:   { role },
    });
  }
}
