import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type {
  CreateReviewInput,
  ProviderReviewListResponse,
  Review as ReviewDto,
} from "@repo/schemas";

import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService
  ) {}

  private toDto(row: {
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

  async create(
    clerkId: string,
    input: CreateReviewInput,
    requestId?: string
  ): Promise<ReviewDto> {
    const user = await this.prisma.user.findUnique({ where: { clerkId } });
    if (!user) {
      this.logger.warn(`Review create user not found for clerkId=${clerkId} [rid:${requestId}]`);
      throw new NotFoundException("User not found");
    }
    if (user.role !== "CUSTOMER") {
      throw new ForbiddenException("Only customers can submit reviews");
    }

    const booking = await this.prisma.booking.findFirst({
      where: { id: input.bookingId, customerId: user.id },
      include: { review: true, service: { select: { title: true } } },
    });
    if (!booking) throw new NotFoundException("Booking not found");
    if (booking.status !== "COMPLETED") {
      throw new BadRequestException("You can only review completed bookings");
    }
    if (booking.review) {
      throw new ConflictException("A review already exists for this booking");
    }

    const review = await this.prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          bookingId: input.bookingId,
          rating: input.rating,
          comment: input.comment ?? null,
        },
      });

      const agg = await tx.review.aggregate({
        where: { booking: { providerId: booking.providerId } },
        _avg: { rating: true },
        _count: true,
      });

      const avg = agg._avg.rating;
      await tx.providerProfile.update({
        where: { id: booking.providerId },
        data: {
          averageRating: avg != null ? Number(avg) : 0,
          totalReviews: agg._count,
        },
      });

      return created;
    });

    void this.notificationsService
      .notifyProviderNewReview({
        providerProfileId: booking.providerId,
        bookingId: booking.id,
        rating: review.rating,
        serviceTitle: booking.service.title,
      })
      .catch((error: unknown) => {
        this.logger.error("Failed to notify provider of new review", error);
      });

    return this.toDto(review);
  }

  async listForProvider(
    clerkId: string,
    page: number,
    limit: number,
    requestId?: string
  ): Promise<ProviderReviewListResponse> {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { providerProfile: true },
    });
    if (!user) {
      this.logger.warn(`Provider reviews user not found for clerkId=${clerkId} [rid:${requestId}]`);
      throw new NotFoundException("User not found");
    }
    if (user.role !== "PROVIDER") {
      throw new ForbiddenException("Only providers can list reviews");
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    if (!user.providerProfile) {
      return { data: [], total: 0, page: safePage, limit: safeLimit };
    }

    const where = { booking: { providerId: user.providerProfile.id } };

    const [rows, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: safeLimit,
        include: {
          booking: {
            include: {
              customer: { select: { firstName: true, lastName: true } },
              service: { select: { title: true } },
            },
          },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      data: rows.map((r) => ({
        id: r.id,
        bookingId: r.bookingId,
        rating: r.rating,
        comment: r.comment ?? undefined,
        createdAt: r.createdAt,
        customerFirstName: r.booking.customer.firstName,
        customerLastName: r.booking.customer.lastName,
        serviceTitle: r.booking.service.title,
      })),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async listForPublicProvider(
    providerProfileId: string,
    page: number,
    limit: number,
    requestId?: string
  ): Promise<ProviderReviewListResponse> {
    const provider = await this.prisma.providerProfile.findFirst({
      where: { id: providerProfileId },
      select: { id: true },
    });
    if (!provider) {
      this.logger.warn(`Public provider reviews not found profileId=${providerProfileId} [rid:${requestId}]`);
      throw new NotFoundException("Provider not found");
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const where = { booking: { providerId: providerProfileId } };
    const [rows, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: safeLimit,
        include: {
          booking: {
            include: {
              customer: { select: { firstName: true, lastName: true } },
              service: { select: { title: true } },
            },
          },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      data: rows.map((r) => ({
        id: r.id,
        bookingId: r.bookingId,
        rating: r.rating,
        comment: r.comment ?? undefined,
        createdAt: r.createdAt,
        customerFirstName: r.booking.customer.firstName,
        customerLastName: r.booking.customer.lastName,
        serviceTitle: r.booking.service.title,
      })),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }
}
