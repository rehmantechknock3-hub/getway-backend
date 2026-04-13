import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import type { Cache } from "cache-manager";
import type { BookingStatus } from "@prisma/client";
import type {
  Booking as BookingDto,
  BookingWithReview,
  CreateBookingInput,
  ProviderBookingView,
  ProviderJobQueueStats,
  Review as ReviewDto,
  UpdateBookingStatusInput,
} from "@repo/schemas";

import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";

const TTL_PROVIDER_BOOKING_LIST_MS = 15_000;

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
  private readonly providerBookingListEpochByProfileId = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache
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
    review: {
      id: string;
      bookingId: string;
      rating: number;
      comment: string | null;
      createdAt: Date;
    } | null;
  }): BookingWithReview {
    return {
      ...this.toDto(row),
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
        title: true,
        provider: { select: { isOnline: true } },
      },
    });
    if (!service) {
      throw new NotFoundException("Service not found or inactive");
    }
    if (!service.provider.isOnline) {
      throw new ForbiddenException("Provider is offline");
    }

    const scheduledAt =
      input.scheduledAt instanceof Date
        ? input.scheduledAt
        : new Date(input.scheduledAt);

    const row = await this.prisma.booking.create({
      data: {
        customerId: user.id,
        providerId: service.providerId,
        serviceId: service.id,
        scheduledAt,
        address: input.address,
        latitude: input.latitude,
        longitude: input.longitude,
        notes: input.notes ?? null,
        totalAmount: service.price,
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
      .catch(() => undefined);

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
        provider: { select: { isOnline: true } },
      },
    });
    if (!service) {
      throw new NotFoundException("Service not found or inactive");
    }
    if (!service.provider.isOnline) {
      throw new ForbiddenException("Provider is offline");
    }

    const scheduledAt =
      input.scheduledAt instanceof Date
        ? input.scheduledAt
        : new Date(input.scheduledAt);

    const row = await this.prisma.booking.create({
      data: {
        customerId: user.id,
        providerId: service.providerId,
        serviceId: service.id,
        scheduledAt,
        address: input.address,
        latitude: input.latitude,
        longitude: input.longitude,
        notes: input.notes ?? null,
        totalAmount: service.price,
      },
    });

    this.bumpProviderBookingListCache(service.providerId);

    return this.toDto(row);
  }

  async listAll(
    page: number,
    limit: number
  ): Promise<{ data: BookingWithReview[]; total: number; page: number; limit: number }> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [rows, total] = await Promise.all([
      this.prisma.booking.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: safeLimit,
      }),
      this.prisma.booking.count(),
    ]);

    return {
      data: rows.map((r) => ({ ...this.toDto(r), review: null })),
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
        include: { review: true },
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
      include: { review: true },
    });
    if (!row) throw new NotFoundException("Booking not found");

    return this.toCustomerBookingDto(row);
  }

  private emptyProviderJobStats(): ProviderJobQueueStats {
    return { pending: 0, active: 0, completed: 0 };
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

    const queueStatuses: BookingStatus[] = ["PENDING", "ACCEPTED", "IN_PROGRESS"];
    const historyStatuses: BookingStatus[] = ["COMPLETED", "REJECTED", "CANCELLED"];
    const activeStatuses: BookingStatus[] = ["ACCEPTED", "IN_PROGRESS"];

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

    const [rows, total, pending, active, completed] = await Promise.all([
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

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: next },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        service: { select: { title: true } },
      },
    });

    this.bumpProviderBookingListCache(user.providerProfile.id);

    void this.notificationsService
      .notifyCustomerBookingStatus({
        customerUserId: updated.customerId,
        bookingId: updated.id,
        status: next,
        serviceTitle: updated.service.title,
      })
      .catch(() => undefined);

    return this.toProviderViewDto(updated);
  }
}
