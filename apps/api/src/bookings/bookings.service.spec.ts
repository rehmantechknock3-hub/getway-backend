import { describe, expect, it, vi, beforeEach } from "vitest";

import { BookingsService } from "./bookings.service";

describe("BookingsService", () => {
  const cache = {
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(true),
  };

  const prisma = {
    user: {
      findUnique: vi.fn(),
    },
    service: {
      findFirst: vi.fn(),
    },
    booking: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };

  const notificationsService = {
    notifyProviderNewBooking: vi.fn().mockResolvedValue(undefined),
    notifyCustomerBookingStatus: vi.fn().mockResolvedValue(undefined),
  };
  const bookingGateway = {
    emitStatusChange: vi.fn(),
  };

  let service: BookingsService;

  beforeEach(() => {
    vi.clearAllMocks();
    cache.get.mockResolvedValue(undefined);
    service = new BookingsService(
      prisma as never,
      notificationsService as never,
      cache as never,
      bookingGateway as never
    );
  });

  it("create rejects non-customers", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u-1",
      role: "PROVIDER",
    });

    await expect(
      service.create("clerk-1", {
        serviceId: "00000000-0000-4000-8000-000000000001",
        scheduledAt: new Date(),
        address: "1 Main St",
        latitude: 1,
        longitude: 2,
      })
    ).rejects.toMatchObject({ status: 403 });
  });

  it("create inserts booking with service price", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u-1",
      role: "CUSTOMER",
      savedLocations: [],
      customerOnboarding: null,
    });
    prisma.service.findFirst.mockResolvedValue({
      id: "svc-1",
      providerId: "pp-1",
      price: 99.5,
      title: "Test service",
      provider: { isOnline: true },
    });
    const createdAt = new Date();
    prisma.booking.create.mockResolvedValue({
      id: "b-1",
      customerId: "u-1",
      providerId: "pp-1",
      serviceId: "svc-1",
      status: "PENDING",
      scheduledAt: new Date("2026-05-01T10:00:00Z"),
      address: "1 Main St",
      latitude: 40.7,
      longitude: -74,
      notes: null,
      totalAmount: 99.5,
      createdAt,
      updatedAt: createdAt,
    });

    const result = await service.create("clerk-1", {
      serviceId: "svc-1",
      scheduledAt: new Date("2026-05-01T10:00:00Z"),
      address: "1 Main St",
      latitude: 40.7,
      longitude: -74,
    });

    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: "u-1",
          providerId: "pp-1",
          serviceId: "svc-1",
          totalAmount: 99.5,
        }),
      })
    );
    expect(result.id).toBe("b-1");
    expect(result.totalAmount).toBe(99.5);
    expect(result.status).toBe("PENDING");
  });

  it("create prefers customer profile location over request payload", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u-1",
      role: "CUSTOMER",
      savedLocations: [
        {
          address: "Profile Home Address",
          latitude: 25.2,
          longitude: 55.3,
        },
      ],
      customerOnboarding: null,
    });
    prisma.service.findFirst.mockResolvedValue({
      id: "svc-1",
      providerId: "pp-1",
      price: 99.5,
      title: "Test service",
      provider: { isOnline: true },
    });
    const createdAt = new Date();
    prisma.booking.create.mockResolvedValue({
      id: "b-1",
      customerId: "u-1",
      providerId: "pp-1",
      serviceId: "svc-1",
      status: "PENDING",
      scheduledAt: new Date("2026-05-01T10:00:00Z"),
      address: "Profile Home Address",
      latitude: 25.2,
      longitude: 55.3,
      notes: null,
      totalAmount: 99.5,
      createdAt,
      updatedAt: createdAt,
    });

    await service.create("clerk-1", {
      serviceId: "svc-1",
      scheduledAt: new Date("2026-05-01T10:00:00Z"),
      address: "Typed Address",
      latitude: 1,
      longitude: 2,
    });

    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          address: "Profile Home Address",
          latitude: 25.2,
          longitude: 55.3,
        }),
      })
    );
  });

  it("createForCustomer rejects non-customer user", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u-prov",
      role: "PROVIDER",
    });

    await expect(
      service.createForCustomer("u-prov", {
        serviceId: "00000000-0000-4000-8000-000000000001",
        scheduledAt: new Date(),
        address: "1 Main St",
        latitude: 1,
        longitude: 2,
      })
    ).rejects.toMatchObject({ status: 403 });
  });

  it("createForCustomer inserts booking for given customer id", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "cust-1",
      role: "CUSTOMER",
      savedLocations: [],
      customerOnboarding: null,
    });
    prisma.service.findFirst.mockResolvedValue({
      id: "svc-2",
      providerId: "pp-2",
      price: 50,
      title: "Other service",
      provider: { isOnline: true },
    });
    const createdAt = new Date();
    prisma.booking.create.mockResolvedValue({
      id: "b-2",
      customerId: "cust-1",
      providerId: "pp-2",
      serviceId: "svc-2",
      status: "PENDING",
      scheduledAt: new Date("2026-05-02T11:00:00Z"),
      address: "2 Oak",
      latitude: 41,
      longitude: -72,
      notes: null,
      totalAmount: 50,
      createdAt,
      updatedAt: createdAt,
    });

    const result = await service.createForCustomer("cust-1", {
      serviceId: "svc-2",
      scheduledAt: new Date("2026-05-02T11:00:00Z"),
      address: "2 Oak",
      latitude: 41,
      longitude: -72,
    });

    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: "cust-1",
          providerId: "pp-2",
          serviceId: "svc-2",
          totalAmount: 50,
        }),
      })
    );
    expect(result.customerId).toBe("cust-1");
  });

  it("create rejects booking when provider is offline", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u-1",
      role: "CUSTOMER",
    });
    prisma.service.findFirst.mockResolvedValue({
      id: "svc-1",
      providerId: "pp-1",
      price: 90,
      title: "Test service",
      provider: { isOnline: false },
    });

    await expect(
      service.create("clerk-1", {
        serviceId: "svc-1",
        scheduledAt: new Date("2026-05-01T10:00:00Z"),
        address: "1 Main St",
        latitude: 40.7,
        longitude: -74,
      })
    ).rejects.toMatchObject({ status: 403 });
    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it("listAll returns paginated bookings", async () => {
    const createdAt = new Date();
    prisma.booking.findMany.mockResolvedValue([
      {
        id: "b-x",
        customerId: "c1",
        providerId: "p1",
        serviceId: "s1",
        status: "PENDING",
        scheduledAt: new Date(),
        address: "A",
        latitude: 0,
        longitude: 0,
        notes: null,
        totalAmount: 10,
        createdAt,
        updatedAt: createdAt,
      },
    ]);
    prisma.booking.count.mockResolvedValue(1);

    const result = await service.listAll(1, 20);

    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe("b-x");
    expect(result.data[0]?.review).toBeNull();
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 })
    );
  });

  it("listForProvider rejects customers", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u-1",
      role: "CUSTOMER",
      providerProfile: null,
    });

    await expect(service.listForProvider("clerk-1", 1, 20)).rejects.toMatchObject({ status: 403 });
  });

  it("listForProvider returns empty when provider has no profile yet", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u-1",
      role: "PROVIDER",
      providerProfile: null,
    });

    const result = await service.listForProvider("clerk-1", 1, 20);

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.stats).toEqual({ pending: 0, active: 0, completed: 0, totalEarnings: 0 });
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });

  it("listForProvider returns enriched rows", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u-1",
      role: "PROVIDER",
      providerProfile: { id: "pp-1" },
    });
    const createdAt = new Date();
    prisma.booking.findMany.mockResolvedValue([
      {
        id: "b-1",
        customerId: "cust-1",
        providerId: "pp-1",
        serviceId: "s-1",
        status: "PENDING",
        scheduledAt: new Date("2026-06-01T12:00:00Z"),
        address: "1 St",
        latitude: 1,
        longitude: 2,
        notes: null,
        totalAmount: 100,
        createdAt,
        updatedAt: createdAt,
        customer: { firstName: "Ann", lastName: "Bee" },
        service: { title: "Deep clean" },
      },
    ]);
    prisma.booking.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    prisma.booking.aggregate.mockResolvedValue({ _sum: { totalAmount: 235 } });

    const result = await service.listForProvider("clerk-p", 1, 20, "queue");

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: "b-1",
      customerFirstName: "Ann",
      customerLastName: "Bee",
      serviceTitle: "Deep clean",
    });
    expect(result.stats).toEqual({ pending: 1, active: 0, completed: 0, totalEarnings: 235 });
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          providerId: "pp-1",
          status: { in: ["PENDING", "ACCEPTED", "IN_PROGRESS"] },
        },
        orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
      })
    );
  });

  it("listForProvider history scope filters terminal statuses and sorts newest first", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u-1",
      role: "PROVIDER",
      providerProfile: { id: "pp-1" },
    });
    prisma.booking.findMany.mockResolvedValue([]);
    prisma.booking.count.mockResolvedValue(0);
    prisma.booking.aggregate.mockResolvedValue({ _sum: { totalAmount: 0 } });

    await service.listForProvider("clerk-p", 1, 20, "history");

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          providerId: "pp-1",
          status: { in: ["COMPLETED", "REJECTED", "CANCELLED"] },
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      })
    );
  });

  it("updateStatusForProvider rejects invalid transition", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u-1",
      role: "PROVIDER",
      providerProfile: { id: "pp-1" },
    });
    const t = new Date();
    prisma.booking.findFirst.mockResolvedValue({
      id: "b-1",
      customerId: "c",
      providerId: "pp-1",
      serviceId: "s",
      status: "COMPLETED",
      scheduledAt: t,
      address: "a",
      latitude: 0,
      longitude: 0,
      notes: null,
      totalAmount: 10,
      createdAt: t,
      updatedAt: t,
      customer: { firstName: "A", lastName: "B" },
      service: { title: "X" },
    });

    await expect(
      service.updateStatusForProvider("clerk-p", "b-1", { status: "ACCEPTED" })
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
  });

  it("updateStatusForProvider allows ACCEPTED to CANCELLED", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u-1",
      role: "PROVIDER",
      providerProfile: { id: "pp-1" },
    });
    const t = new Date();
    prisma.booking.findFirst
      .mockResolvedValueOnce({
        id: "b-1",
        customerId: "c",
        providerId: "pp-1",
        serviceId: "s",
        status: "ACCEPTED",
        scheduledAt: t,
        address: "a",
        latitude: 0,
        longitude: 0,
        notes: null,
        totalAmount: 10,
        createdAt: t,
        updatedAt: t,
        customer: { firstName: "A", lastName: "B" },
        service: { title: "X" },
      })
      .mockResolvedValueOnce({
        id: "b-1",
        customerId: "c",
        providerId: "pp-1",
        serviceId: "s",
        status: "CANCELLED",
        scheduledAt: t,
        address: "a",
        latitude: 0,
        longitude: 0,
        notes: null,
        totalAmount: 10,
        createdAt: t,
        updatedAt: t,
        customer: { firstName: "A", lastName: "B" },
        service: { title: "X" },
      });
    prisma.booking.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.updateStatusForProvider("clerk-p", "b-1", {
      status: "CANCELLED",
    });

    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { id: "b-1", status: "ACCEPTED" },
      data: { status: "CANCELLED" },
    });
    expect(result.status).toBe("CANCELLED");
  });

  it("updateStatusForProvider rejects stale updates (double-accept race)", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u-1",
      role: "PROVIDER",
      providerProfile: { id: "pp-1" },
    });
    const t = new Date();
    prisma.booking.findFirst.mockResolvedValue({
      id: "b-1",
      customerId: "c",
      providerId: "pp-1",
      serviceId: "s",
      status: "PENDING",
      scheduledAt: t,
      address: "a",
      latitude: 0,
      longitude: 0,
      notes: null,
      totalAmount: 10,
      createdAt: t,
      updatedAt: t,
      customer: { firstName: "A", lastName: "B" },
      service: { title: "X" },
    });
    prisma.booking.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.updateStatusForProvider("clerk-p", "b-1", { status: "ACCEPTED" })
    ).rejects.toMatchObject({ status: 409 });
  });
});
