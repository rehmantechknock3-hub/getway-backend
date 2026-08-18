import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import type { Cache } from "cache-manager";
import { z } from "zod";
import type {
  AdminBookingListResponse,
  Booking as BookingDto,
  BookingStatus,
  BookingWithReview,
  CreateBookingInput,
  ProviderBookingView,
  ProviderJobQueueStats,
  Review as ReviewDto,
  UpdateBookingStatusInput,
} from "@repo/schemas";
import { CustomerOnboardingSchema, bookingsOverlap, scheduledAtAllowed } from "@repo/schemas";

import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { BookingGateway } from "../realtime/booking.gateway";

const TTL_PROVIDER_BOOKING_LIST_MS = 15_000;
const SavedLocationWithCoordinatesSchema = z.object({
  address: z.string().min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

type CachedProviderBookingList = {
  data: ProviderBookingView[];
  total: number;
  page: number;
  limit: number;
  stats: ProviderJobQueueStats;
};

function providerBookingListCacheKey(
  profileId: string,
  epoch: number,
  scope: string,
  page: number,
  limit: number
): string {
  return `pb:${profileId}:${epoch}:${scope}:${page}:${limit}`;
}

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);
  private readonly providerBookingListEpochByProfileId = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly bookingGateway: BookingGateway
  ) {}

  private bumpProviderBookingListCache(providerProfileId: string): void {
    this.providerBookingListEpochByProfileId.set(
      providerProfileId,
      (this.providerBookingListEpochByProfileId.get(providerProfileId) ?? 0) + 1
    );
  }

  private toProviderViewDto(row: {
    id: string;
    customerId: string;
    providerId: string;
    serviceId: string;
    status: string;
    scheduledAt: Date;
    address: string;
    latitude: number;
    longitude: number;
    notes: string | null;
    totalAmount: number;
    createdAt: Date;
    updatedAt: Date;
    customer: { firstName: string; lastName: string };
    service: { title: string };
  }): ProviderBookingView {
    return {
      ...this.toDto(row),
      customerFirstName: row.customer.firstName,
      customerLastName: row.customer.lastName,
      serviceTitle: row.service.title,
    };
  }

  private resolveCustomerBookingLocation(
    user: {
      savedLocations?: unknown;
      customerOnboarding?: unknown;
    },
    fallback: Pick<CreateBookingInput, "address" | "latitude" | "longitude">
  ): { address: string; latitude: number; longitude: number } {
    const onboarding = CustomerOnboardingSchema.safeParse(user.customerOnboarding);
    if (
      onboarding.success &&
      typeof onboarding.data.primaryLatitude === "number" &&
      typeof onboarding.data.primaryLongitude === "number"
    ) {
      return {
        address: onboarding.data.primaryLocation,
        latitude: onboarding.data.primaryLatitude,
        longitude: onboarding.data.primaryLongitude,
      };
    }

    const parsedLocations = z.array(SavedLocationWithCoordinatesSchema).safeParse(user.savedLocations);
    const locationWithCoordinates =
      parsedLocations.success
        ? parsedLocations.data.find(
            (location) =>
              typeof location.latitude === "number" &&
              typeof location.longitude === "number" &&
              Number.isFinite(location.latitude) &&
              Number.isFinite(location.longitude)
          )
        : undefined;

    if (locationWithCoordinates) {
      return {
        address: locationWithCoordinates.address,
        latitude: locationWithCoordinates.latitude as number,
        longitude: locationWithCoordinates.longitude as number,
      };
    }

    return fallback;
  }

  private async assertNoBookingOverlap(
    providerId: string,
    scheduledAt: Date,
    durationMinutes: number
  ): Promise<void> {
    const windowMs = Math.max(durationMinutes, 24 * 60) * 60_000;
    const nearby = await this.prisma.booking.findMany({
      where: {
        providerId,
        status: { in: ["PENDING", "ACCEPTED", "IN_PROGRESS"] },
        scheduledAt: {
          gte: new Date(scheduledAt.getTime() - windowMs),
          lte: new Date(scheduledAt.getTime() + windowMs),
        },
      },
      select: { scheduledAt: true, service: { select: { duration: true } } },
    });
    const taken = nearby.some((row) =>
      bookingsOverlap(scheduledAt, durationMinutes, row.scheduledAt, row.service.duration)
    );
    if (taken) {
      throw new ConflictException("That time is already booked");
    }
  }

  private allowedProviderNextStatuses(
    current: BookingDto["status"]
  ): BookingDto["status"][] {
    switch (current) {
      case "PENDING":
        return ["ACCEPTED", "REJECTED"];
      case "ACCEPTED":
        return ["IN_PROGRESS", "CANCELLED"];
      case "IN_PROGRESS":
        return ["COMPLETED"];
      default:
        return [];
    }
  }

  private toDto(row: {
    id: string;
    customerId: string;
    providerId: string;
    serviceId: string;
    status: string;
    scheduledAt: Date;
    address: string;
    latitude: number;
    longitude: number;
    notes: string | null;
    totalAmount: number;
    totalCurrency?: string | null;
    providerLatitude?: number | null;
    providerLongitude?: number | null;
    createdAt: Date;
    updatedAt: Date;
  }): BookingDto {
    return {
      id: row.id,
      customerId: row.customerId,
      providerId: row.providerId,
      serviceId: row.serviceId,
      status: row.status as BookingDto["status"],
      scheduledAt: row.scheduledAt,
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
      notes: row.notes ?? undefined,
      totalAmount: row.totalAmount,
      totalCurrency: row.totalCurrency ?? "USD",
      providerLatitude: row.providerLatitude ?? undefined,
      providerLongitude: row.providerLongitude ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private reviewToDto(row: {
    id: string;
    bookingId: string;
    rating: number;
    comment: string | null;
    createdAt: Date;
  }): ReviewDto {
    return {
      id: row.id,
      bookingId: row.bookingId,
      rating: row.rating,
      comment: row.comment ?? undefined,
      createdAt: row.createdAt,
    };
  }

  private toCustomerBookingDto(row: {
    id: string;
    customerId: string;
    providerId: string;
    serviceId: string;
    status: string;
    scheduledAt: Date;
    address: string;
    latitude: number;
    longitude: number;
    notes: string | null;
    totalAmount: number;
    createdAt: Date;
    updatedAt: Date;
    provider: {
      latitude: number | null;
      longitude: number | null;
    };
    service: { title: string };
    review: {
      id: string;
      bookingId: string;
      rating: number;
      comment: string | null;
      createdAt: Date;
    } | null;
  }): BookingWithReview {
    return {
      ...this.toDto({
        ...row,
        providerLatitude: row.provider.latitude,
        providerLongitude: row.provider.longitude,
      }),
      serviceTitle: row.service.title,
      review: row.review ? this.reviewToDto(row.review) : null,
    };
  }

  async create(clerkId: string, input: CreateBookingInput): Promise<BookingDto> {
    const user = await this.prisma.user.findUnique({ where: { clerkId } });
    if (!user) throw new NotFoundException("User not found");
    if (user.role !== "CUSTOMER") {
      throw new ForbiddenException("Only customers can create bookings");
    }

    const service = await this.prisma.service.findFirst({
      where: { id: input.serviceId, isActive: true },
      select: {
        id: true,
        providerId: true,
        price: true,
        priceCurrency: true,
        title: true,
        duration: true,
        provider: { select: { isOnline: true, verificationStatus: true, availabilityDays: true } },
      },
    });
    if (!service) {
      throw new NotFoundException("Service not found or inactive");
    }
    if (service.provider.verificationStatus !== "APPROVED") {
      throw new ForbiddenException("Provider is not approved");
    }
    if (!service.provider.isOnline) {
      throw new ForbiddenException("Provider is offline");
    }

    const scheduledAt =
      input.scheduledAt instanceof Date
        ? input.scheduledAt
        : new Date(input.scheduledAt);
    const availabilityError = scheduledAtAllowed(scheduledAt, service.provider.availabilityDays);
    if (availabilityError) {
      throw new BadRequestException(availabilityError);
    }
    await this.assertNoBookingOverlap(service.providerId, scheduledAt, service.duration);
    const serviceLocation = this.resolveCustomerBookingLocation(user, {
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
    });

    const row = await this.prisma.booking.create({
      data: {
        customerId: user.id,
        providerId: service.providerId,
        serviceId: service.id,
        scheduledAt,
        address: serviceLocation.address,
        latitude: serviceLocation.latitude,
        longitude: serviceLocation.longitude,
        notes: input.notes ?? null,
        totalAmount: service.price,
        totalCurrency: service.priceCurrency,
      },
    });

    this.bumpProviderBookingListCache(service.providerId);

    void this.notificationsService
      .notifyProviderNewBooking({
        providerProfileId: service.providerId,
        bookingId: row.id,
        customerFirstName: user.firstName,
        customerLastName: user.lastName,
        serviceTitle: service.title,
        scheduledAt,
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `Failed to notify provider for new booking ${row.id}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      });

    return this.toDto(row);
  }

  async createForCustomer(
    customerId: string,
    input: CreateBookingInput
  ): Promise<BookingDto> {
    const user = await this.prisma.user.findUnique({ where: { id: customerId } });
    if (!user) throw new NotFoundException("Customer not found");
    if (user.role !== "CUSTOMER") {
      throw new ForbiddenException("Target user must be a customer");
    }

    const service = await this.prisma.service.findFirst({
      where: { id: input.serviceId, isActive: true },
      select: {
        id: true,
        providerId: true,
        price: true,
        priceCurrency: true,
        duration: true,
        provider: { select: { isOnline: true, verificationStatus: true } },
      },
    });
    if (!service) {
      throw new NotFoundException("Service not found or inactive");
    }
    if (service.provider.verificationStatus !== "APPROVED") {
      throw new ForbiddenException("Provider is not approved");
    }
    if (!service.provider.isOnline) {
      throw new ForbiddenException("Provider is offline");
    }

    const scheduledAt =
      input.scheduledAt instanceof Date
        ? input.scheduledAt
        : new Date(input.scheduledAt);
    await this.assertNoBookingOverlap(service.providerId, scheduledAt, service.duration);
    const serviceLocation = this.resolveCustomerBookingLocation(user, {
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
    });

    const row = await this.prisma.booking.create({
      data: {
        customerId: user.id,
        providerId: service.providerId,
        serviceId: service.id,
        scheduledAt,
        address: serviceLocation.address,
        latitude: serviceLocation.latitude,
        longitude: serviceLocation.longitude,
        notes: input.notes ?? null,
        totalAmount: service.price,
        totalCurrency: service.priceCurrency,
      },
    });

    this.bumpProviderBookingListCache(service.providerId);

    return this.toDto(row);
  }

  async listAll(
    page: number,
    limit: number,
    status?: BookingStatus,
    fromDate?: string,
    toDate?: string,
  ): Promise<AdminBookingListResponse> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const scheduledAt: { gte?: Date; lte?: Date } = {};
    if (fromDate) {
      scheduledAt.gte = new Date(`${fromDate}T00:00:00.000Z`);
    }
    if (toDate) {
      scheduledAt.lte = new Date(`${toDate}T23:59:59.999Z`);
    }

    const where = {
      ...(status ? { status } : {}),
      ...(Object.keys(scheduledAt).length > 0 ? { scheduledAt } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: safeLimit,
        include: {
          customer: { select: { firstName: true, lastName: true } },
          provider: {
            select: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
          service: { select: { title: true } },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      data: rows.map((r) => ({
        ...this.toDto(r),
        review: null,
        customerFirstName: r.customer.firstName,
        customerLastName: r.customer.lastName,
        providerFirstName: r.provider.user.firstName,
        providerLastName: r.provider.user.lastName,
        serviceTitle: r.service.title,
      })),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async listForCustomer(
    clerkId: string,
    page: number,
    limit: number
  ): Promise<{ data: BookingWithReview[]; total: number; page: number; limit: number }> {
    const user = await this.prisma.user.findUnique({ where: { clerkId } });
    if (!user) throw new NotFoundException("User not found");
    if (user.role !== "CUSTOMER") {
      throw new ForbiddenException("Only customers can list these bookings");
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [rows, total] = await Promise.all([
      this.prisma.booking.findMany({
        where: { customerId: user.id },
        orderBy: { createdAt: "desc" },
        skip,
        take: safeLimit,
        include: {
          review: true,
          provider: { select: { latitude: true, longitude: true } },
          service: { select: { title: true } },
        },
      }),
      this.prisma.booking.count({ where: { customerId: user.id } }),
    ]);

    return {
      data: rows.map((r) => this.toCustomerBookingDto(r)),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async findOneForCustomer(clerkId: string, id: string): Promise<BookingWithReview> {
    const user = await this.prisma.user.findUnique({ where: { clerkId } });
    if (!user) throw new NotFoundException("User not found");
    if (user.role !== "CUSTOMER") {
      throw new ForbiddenException("Only customers can view this booking");
    }

    const row = await this.prisma.booking.findFirst({
      where: { id, customerId: user.id },
      include: {
        review: true,
        provider: { select: { latitude: true, longitude: true } },
        service: { select: { title: true } },
      },
    });
    if (!row) throw new NotFoundException("Booking not found");

    return this.toCustomerBookingDto(row);
  }

  private emptyProviderJobStats(): ProviderJobQueueStats {
    return { pending: 0, active: 0, completed: 0, totalEarnings: 0 };
  }

  async listForProvider(
    clerkId: string,
    page: number,
    limit: number,
    scope: "queue" | "history" | "all" = "queue"
  ): Promise<{
    data: ProviderBookingView[];
    total: number;
    page: number;
    limit: number;
    stats: ProviderJobQueueStats;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { providerProfile: true },
    });
    if (!user) throw new NotFoundException("User not found");
    if (user.role !== "PROVIDER") {
      throw new ForbiddenException("Only providers can list these bookings");
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    if (!user.providerProfile) {
      return {
        data: [],
        total: 0,
        page: safePage,
        limit: safeLimit,
        stats: this.emptyProviderJobStats(),
      };
    }

    const profileId = user.providerProfile.id;
    const epoch = this.providerBookingListEpochByProfileId.get(profileId) ?? 0;
    const cacheKey = providerBookingListCacheKey(profileId, epoch, scope, safePage, safeLimit);
    const cached = await this.cache.get<CachedProviderBookingList>(cacheKey);
    if (cached) return cached;

    const baseWhere = { providerId: profileId };

    const queueStatuses: BookingDto["status"][] = ["PENDING", "ACCEPTED", "IN_PROGRESS"];
    const historyStatuses: BookingDto["status"][] = ["COMPLETED", "REJECTED", "CANCELLED"];
    const activeStatuses: BookingDto["status"][] = ["ACCEPTED", "IN_PROGRESS"];

    const listWhere =
      scope === "queue"
        ? { ...baseWhere, status: { in: queueStatuses } }
        : scope === "history"
          ? { ...baseWhere, status: { in: historyStatuses } }
          : baseWhere;

    const orderBy =
      scope === "history"
        ? [{ updatedAt: "desc" as const }, { createdAt: "desc" as const }]
        : [{ scheduledAt: "asc" as const }, { createdAt: "desc" as const }];

    const [rows, total, pending, active, completed, completedEarnings] = await Promise.all([
      this.prisma.booking.findMany({
        where: listWhere,
        orderBy,
        skip,
        take: safeLimit,
        include: {
          customer: { select: { firstName: true, lastName: true } },
          service: { select: { title: true } },
        },
      }),
      this.prisma.booking.count({ where: listWhere }),
      this.prisma.booking.count({ where: { ...baseWhere, status: "PENDING" } }),
      this.prisma.booking.count({
        where: { ...baseWhere, status: { in: activeStatuses } },
      }),
      this.prisma.booking.count({ where: { ...baseWhere, status: "COMPLETED" } }),
      this.prisma.booking.aggregate({
        where: { ...baseWhere, status: "COMPLETED" },
        _sum: { totalAmount: true },
      }),
    ]);

    const payload: CachedProviderBookingList = {
      data: rows.map((r) => this.toProviderViewDto(r)),
      total,
      page: safePage,
      limit: safeLimit,
      stats: {
        pending,
        active,
        completed,
        totalEarnings: completedEarnings._sum.totalAmount ?? 0,
      },
    };

    await this.cache.set(cacheKey, payload, TTL_PROVIDER_BOOKING_LIST_MS);
    return payload;
  }

  async findOneForProvider(clerkId: string, id: string): Promise<ProviderBookingView> {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { providerProfile: true },
    });
    if (!user?.providerProfile) {
      throw new NotFoundException("Provider profile not found");
    }
    if (user.role !== "PROVIDER") {
      throw new ForbiddenException("Only providers can view this booking");
    }

    const row = await this.prisma.booking.findFirst({
      where: { id, providerId: user.providerProfile.id },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        service: { select: { title: true } },
      },
    });
    if (!row) throw new NotFoundException("Booking not found");

    return this.toProviderViewDto(row);
  }

  async updateStatusForProvider(
    clerkId: string,
    bookingId: string,
    input: UpdateBookingStatusInput
  ): Promise<ProviderBookingView> {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { providerProfile: true },
    });
    if (!user?.providerProfile) {
      throw new NotFoundException("Provider profile not found");
    }
    if (user.role !== "PROVIDER") {
      throw new ForbiddenException("Only providers can update booking status");
    }

    const row = await this.prisma.booking.findFirst({
      where: { id: bookingId, providerId: user.providerProfile.id },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        service: { select: { title: true } },
      },
    });
    if (!row) throw new NotFoundException("Booking not found");

    const next = input.status;
    const allowed = this.allowedProviderNextStatuses(row.status as BookingDto["status"]);
    if (!allowed.includes(next)) {
      throw new BadRequestException(
        `Invalid status transition from ${row.status} to ${next}`
      );
    }

    const { count } = await this.prisma.$transaction(async (tx) => {
      const result = await tx.booking.updateMany({
        where: { id: bookingId, status: row.status },
        data: { status: next },
      });
      if (result.count === 0) {
        return result;
      }
      if (next === "COMPLETED") {
        await tx.user.update({
          where: { id: row.customerId },
          data: { totalSpent: { increment: row.totalAmount } },
        });
      }
      return result;
    });
    if (count === 0) {
      throw new ConflictException("Booking status was updated by another request");
    }

    const updated = await this.prisma.booking.findFirst({
      where: { id: bookingId, providerId: user.providerProfile.id },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        service: { select: { title: true } },
      },
    });
    if (!updated) throw new NotFoundException("Booking not found");

    this.bumpProviderBookingListCache(user.providerProfile.id);
    this.bookingGateway.emitStatusChange(updated.id, next);

    void this.notificationsService
      .notifyCustomerBookingStatus({
        customerUserId: updated.customerId,
        bookingId: updated.id,
        status: next,
        serviceTitle: updated.service.title,
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `Failed to notify customer for booking status update ${updated.id}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      });

    return this.toProviderViewDto(updated);
  }
}
