import { describe, expect, it, vi, beforeEach } from "vitest";

import { ReviewsService } from "./reviews.service";

describe("ReviewsService", () => {
  const prisma = {
    user: { findUnique: vi.fn() },
    providerProfile: { findFirst: vi.fn() },
    booking: { findFirst: vi.fn() },
    review: { findMany: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(),
  };
  const notificationsService = {
    notifyProviderNewReview: vi.fn().mockResolvedValue(undefined),
  };

  let service: ReviewsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReviewsService(prisma as never, notificationsService as never);
  });

  it("create rejects non-customers", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u-1", role: "PROVIDER" });

    await expect(
      service.create("clerk-1", { bookingId: "00000000-0000-4000-8000-000000000001", rating: 5 })
    ).rejects.toMatchObject({ status: 403 });
  });

  it("create rejects when booking is not completed", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u-1", role: "CUSTOMER" });
    prisma.booking.findFirst.mockResolvedValue({
      id: "b-1",
      customerId: "u-1",
      providerId: "pp-1",
      status: "ACCEPTED",
      review: null,
      service: { title: "Oil Change" },
    });

    await expect(service.create("clerk-1", { bookingId: "b-1", rating: 5 })).rejects.toMatchObject({
      status: 400,
    });
  });

  it("create rejects when review already exists", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u-1", role: "CUSTOMER" });
    prisma.booking.findFirst.mockResolvedValue({
      id: "b-1",
      customerId: "u-1",
      providerId: "pp-1",
      status: "COMPLETED",
      review: { id: "r-0" },
      service: { title: "Oil Change" },
    });

    await expect(service.create("clerk-1", { bookingId: "b-1", rating: 5 })).rejects.toMatchObject({
      status: 409,
    });
  });

  it("create inserts review and updates provider aggregates", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u-1", role: "CUSTOMER" });
    prisma.booking.findFirst.mockResolvedValue({
      id: "b-1",
      customerId: "u-1",
      providerId: "pp-1",
      status: "COMPLETED",
      review: null,
      service: { title: "Oil Change" },
    });

    const createdAt = new Date();
    prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        review: {
          create: vi.fn().mockResolvedValue({
            id: "r-1",
            bookingId: "b-1",
            rating: 5,
            comment: "Great job",
            createdAt,
          }),
          aggregate: vi.fn().mockResolvedValue({ _avg: { rating: 4.5 }, _count: 2 }),
        },
        providerProfile: {
          update: vi.fn().mockResolvedValue({}),
        },
      };
      return callback(tx);
    });

    const result = await service.create("clerk-1", { bookingId: "b-1", rating: 5, comment: "Great job" });

    expect(result.id).toBe("r-1");
    expect(result.rating).toBe(5);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(notificationsService.notifyProviderNewReview).toHaveBeenCalledWith({
      providerProfileId: "pp-1",
      bookingId: "b-1",
      rating: 5,
      serviceTitle: "Oil Change",
    });
  });

  it("listForProvider rejects customers", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u-1",
      role: "CUSTOMER",
      providerProfile: null,
    });

    await expect(service.listForProvider("clerk-1", 1, 20)).rejects.toMatchObject({ status: 403 });
  });

  it("listForProvider returns empty when provider has no profile", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u-1",
      role: "PROVIDER",
      providerProfile: null,
    });

    const result = await service.listForProvider("clerk-1", 1, 20);

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(prisma.review.findMany).not.toHaveBeenCalled();
  });

  it("listForProvider returns reviews for provider bookings", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u-1",
      role: "PROVIDER",
      providerProfile: { id: "pp-1" },
    });
    const createdAt = new Date();
    prisma.review.findMany.mockResolvedValue([
      {
        id: "r-1",
        bookingId: "b-1",
        rating: 5,
        comment: "Excellent",
        createdAt,
        booking: {
          customer: { firstName: "C", lastName: "D" },
          service: { title: "Lawn care" },
        },
      },
    ]);
    prisma.review.count.mockResolvedValue(1);

    const result = await service.listForProvider("clerk-p", 1, 20);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: "r-1",
      bookingId: "b-1",
      rating: 5,
      comment: "Excellent",
      customerFirstName: "C",
      customerLastName: "D",
      serviceTitle: "Lawn care",
    });
    expect(result.total).toBe(1);
  });

  it("listForPublicProvider rejects unknown provider", async () => {
    prisma.providerProfile.findFirst.mockResolvedValue(null);

    await expect(service.listForPublicProvider("bad-provider", 1, 20)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("listForPublicProvider returns paginated rows", async () => {
    prisma.providerProfile.findFirst.mockResolvedValue({ id: "pp-1" });
    const createdAt = new Date();
    prisma.review.findMany.mockResolvedValue([
      {
        id: "r-1",
        bookingId: "b-1",
        rating: 4,
        comment: "Good work",
        createdAt,
        booking: {
          customer: { firstName: "A", lastName: "B" },
          service: { title: "Oil change" },
        },
      },
    ]);
    prisma.review.count.mockResolvedValue(1);

    const result = await service.listForPublicProvider("pp-1", 1, 10);

    expect(result.total).toBe(1);
    expect(result.data[0]).toMatchObject({
      id: "r-1",
      rating: 4,
      customerFirstName: "A",
      customerLastName: "B",
      serviceTitle: "Oil change",
    });
  });
});
