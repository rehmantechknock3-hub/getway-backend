import { describe, expect, it, vi, beforeEach } from "vitest";
import { NotFoundException } from "@nestjs/common";

import { NotificationsService } from "./notifications.service";

describe("NotificationsService", () => {
  const prisma = {
    user: { findUnique: vi.fn() },
    notification: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    providerProfile: { findUnique: vi.fn() },
  };

  let service: NotificationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationsService(prisma as never);
  });

  it("listForUser returns paginated notifications and unread count", async () => {
    const created = new Date();
    prisma.user.findUnique.mockResolvedValue({ id: "u-1" });
    prisma.notification.findMany.mockResolvedValue([
      {
        id: "n-1",
        userId: "u-1",
        type: "BOOKING_NEW_REQUEST",
        title: "T",
        body: "B",
        readAt: null,
        bookingId: null,
        createdAt: created,
      },
    ]);
    prisma.notification.count.mockImplementation(
      (args: { where?: { readAt?: null } }) => {
        if (args?.where && Object.prototype.hasOwnProperty.call(args.where, "readAt")) {
          return Promise.resolve(2);
        }
        return Promise.resolve(5);
      }
    );

    const result = await service.listForUser("clerk-1", 1, 20);

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(5);
    expect(result.unreadCount).toBe(2);
    expect(result.data[0]?.readAt).toBeNull();
  });

  it("markRead sets readAt when unread", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u-1" });
    prisma.notification.findFirst.mockResolvedValue({
      id: "n-1",
      userId: "u-1",
      type: "X",
      title: "T",
      body: "B",
      readAt: null,
      bookingId: null,
      createdAt: new Date(),
    });
    prisma.notification.update.mockResolvedValue({
      id: "n-1",
      userId: "u-1",
      type: "X",
      title: "T",
      body: "B",
      readAt: new Date(),
      bookingId: null,
      createdAt: new Date(),
    });

    const result = await service.markRead("clerk-1", "n-1");

    expect(result.id).toBe("n-1");
    expect(prisma.notification.update).toHaveBeenCalled();
  });

  it("remove deletes notification for current user", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u-1" });
    prisma.notification.findFirst.mockResolvedValue({ id: "n-1" });
    prisma.notification.delete.mockResolvedValue({ id: "n-1" });

    await service.remove("clerk-1", "n-1");

    expect(prisma.notification.delete).toHaveBeenCalledWith({ where: { id: "n-1" } });
  });

  it("remove throws NotFoundException when notification belongs to another user", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u-1" });
    prisma.notification.findFirst.mockResolvedValue(null);

    await expect(service.remove("clerk-1", "n-other")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.notification.delete).not.toHaveBeenCalled();
  });

  it("clearAll deletes all notifications for current user", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u-1" });
    prisma.notification.deleteMany.mockResolvedValue({ count: 3 });

    await service.clearAll("clerk-1");

    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({ where: { userId: "u-1" } });
  });

  it("notifyProviderNewReview creates notification for provider owner", async () => {
    prisma.providerProfile.findUnique.mockResolvedValue({ userId: "provider-user-1" });
    prisma.notification.create.mockResolvedValue({ id: "n-2" });

    await service.notifyProviderNewReview({
      providerProfileId: "pp-1",
      bookingId: "b-1",
      rating: 5,
      serviceTitle: "Oil Change",
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "provider-user-1",
        type: "PROVIDER_NEW_REVIEW",
        title: "New customer review",
        body: 'You received a 5.0-star review for "Oil Change".',
        bookingId: "b-1",
      },
    });
  });
});
