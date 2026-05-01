import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { Notification as NotificationDto, NotificationType } from "@repo/schemas";

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private toDto(row: {
    id: string;
    userId: string;
    type: string;
    title: string;
    body: string;
    readAt: Date | null;
    bookingId: string | null;
    createdAt: Date;
  }): NotificationDto {
    return {
      id: row.id,
      userId: row.userId,
      type: row.type,
      title: row.title,
      body: row.body,
      readAt: row.readAt,
      bookingId: row.bookingId,
      createdAt: row.createdAt,
    };
  }

  async createForUser(
    userId: string,
    input: {
      type: NotificationType;
      title: string;
      body: string;
      bookingId?: string | null;
    }
  ): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        bookingId: input.bookingId ?? null,
      },
    });
  }

  async notifyProviderNewBooking(params: {
    providerProfileId: string;
    bookingId: string;
    customerFirstName: string;
    customerLastName: string;
    serviceTitle: string;
    scheduledAt: Date;
  }): Promise<void> {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { id: params.providerProfileId },
      select: { userId: true },
    });
    if (!profile) return;

    const when = params.scheduledAt.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    const name = `${params.customerFirstName} ${params.customerLastName}`.trim();

    await this.createForUser(profile.userId, {
      type: "BOOKING_NEW_REQUEST",
      title: "New booking request",
      body: `${name || "A customer"} requested "${params.serviceTitle}" for ${when}.`,
      bookingId: params.bookingId,
    });
  }

  async notifyCustomerBookingStatus(params: {
    customerUserId: string;
    bookingId: string;
    status: string;
    serviceTitle: string;
  }): Promise<void> {
    const { status, serviceTitle, bookingId, customerUserId } = params;

    const map: Record<
      string,
      { type: NotificationType; title: string; body: string }
    > = {
      ACCEPTED: {
        type: "BOOKING_ACCEPTED",
        title: "Booking accepted",
        body: `Your "${serviceTitle}" booking was confirmed by the provider.`,
      },
      REJECTED: {
        type: "BOOKING_REJECTED",
        title: "Booking declined",
        body: `The provider could not accept your "${serviceTitle}" booking.`,
      },
      IN_PROGRESS: {
        type: "BOOKING_IN_PROGRESS",
        title: "Service in progress",
        body: `Your provider has started "${serviceTitle}".`,
      },
      COMPLETED: {
        type: "BOOKING_COMPLETED",
        title: "Service completed",
        body: `Your "${serviceTitle}" booking is marked complete.`,
      },
      CANCELLED: {
        type: "BOOKING_CANCELLED",
        title: "Booking cancelled",
        body: `Your "${serviceTitle}" booking was cancelled.`,
      },
    };

    const cfg = map[status];
    if (!cfg) {
      this.logger.warn(`Unknown booking status for notification: ${status}`);
      return;
    }

    await this.createForUser(customerUserId, {
      type: cfg.type,
      title: cfg.title,
      body: cfg.body,
      bookingId,
    });
  }

  async notifyProviderNewReview(params: {
    providerProfileId: string;
    bookingId: string;
    rating: number;
    serviceTitle: string;
  }): Promise<void> {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { id: params.providerProfileId },
      select: { userId: true },
    });
    if (!profile) return;

    await this.createForUser(profile.userId, {
      type: "PROVIDER_NEW_REVIEW",
      title: "New customer review",
      body: `You received a ${params.rating.toFixed(1)}-star review for "${params.serviceTitle}".`,
      bookingId: params.bookingId,
    });
  }

  async listForUser(
    clerkId: string,
    page: number,
    limit: number,
    requestId?: string
  ): Promise<{
    data: NotificationDto[];
    total: number;
    unreadCount: number;
    page: number;
    limit: number;
  }> {
    const user = await this.prisma.user.findUnique({ where: { clerkId } });
    if (!user) {
      this.logger.warn(`Notifications list user not found for clerkId=${clerkId} [rid:${requestId}]`);
      throw new NotFoundException("User not found");
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const where = { userId: user.id };

    const [rows, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: safeLimit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);

    return {
      data: rows.map((r) => this.toDto(r)),
      total,
      unreadCount,
      page: safePage,
      limit: safeLimit,
    };
  }

  async markRead(
    clerkId: string,
    notificationId: string,
    requestId?: string
  ): Promise<NotificationDto> {
    const user = await this.prisma.user.findUnique({ where: { clerkId } });
    if (!user) {
      this.logger.warn(`Notifications markRead user not found for clerkId=${clerkId} [rid:${requestId}]`);
      throw new NotFoundException("User not found");
    }

    const row = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId: user.id },
    });
    if (!row) throw new NotFoundException("Notification not found");

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: row.readAt ?? new Date() },
    });

    return this.toDto(updated);
  }

  async remove(clerkId: string, notificationId: string, requestId?: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { clerkId } });
    if (!user) {
      this.logger.warn(`Notifications remove user not found for clerkId=${clerkId} [rid:${requestId}]`);
      throw new NotFoundException("User not found");
    }

    const row = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId: user.id },
      select: { id: true },
    });
    if (!row) throw new NotFoundException("Notification not found");

    await this.prisma.notification.delete({ where: { id: notificationId } });
  }

  async clearAll(clerkId: string, requestId?: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { clerkId } });
    if (!user) {
      this.logger.warn(`Notifications clearAll user not found for clerkId=${clerkId} [rid:${requestId}]`);
      throw new NotFoundException("User not found");
    }

    await this.prisma.notification.deleteMany({ where: { userId: user.id } });
  }
}
