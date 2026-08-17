import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminService } from "./admin.service";

describe("AdminService", () => {
  const prisma = {
    user: {
      groupBy: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    providerProfile: {
      groupBy: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    booking: {
      groupBy: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    service: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    payment: {
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
  };

  let service: AdminService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminService(prisma as never);
  });

  it("aggregates platform stats", async () => {
    prisma.user.groupBy.mockResolvedValue([
      { role: "CUSTOMER", _count: { _all: 4 } },
      { role: "PROVIDER", _count: { _all: 3 } },
      { role: "ADMIN", _count: { _all: 1 } },
    ]);
    prisma.providerProfile.groupBy.mockResolvedValue([
      { verificationStatus: "PENDING", _count: { _all: 1 } },
      { verificationStatus: "APPROVED", _count: { _all: 2 } },
    ]);
    prisma.providerProfile.count.mockResolvedValue(1);
    prisma.booking.groupBy.mockResolvedValue([
      { status: "PENDING", _count: { _all: 2 } },
      { status: "COMPLETED", _count: { _all: 5 } },
    ]);
    prisma.service.count.mockResolvedValue(6);
    prisma.payment.groupBy.mockResolvedValue([
      { status: "SUCCEEDED", _count: { _all: 3 } },
    ]);
    prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 120.5 } });

    await expect(service.getStats()).resolves.toEqual({
      users: { total: 8, customers: 4, providers: 3, admins: 1 },
      providers: {
        total: 3,
        pending: 1,
        approved: 2,
        rejected: 0,
        underReview: 0,
        online: 1,
      },
      bookings: {
        total: 7,
        pending: 2,
        accepted: 0,
        inProgress: 0,
        completed: 5,
        cancelled: 0,
        rejected: 0,
      },
      services: { total: 6 },
      payments: { total: 3, succeeded: 3, volumeCentsApprox: 12050 },
    });
  });

  it("lists users with provider verification", async () => {
    prisma.user.count.mockResolvedValue(1);
    prisma.user.findMany.mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-111111111111",
        email: "a@example.com",
        firstName: "Ada",
        lastName: "Admin",
        role: "ADMIN",
        phone: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        onboardingCompleted: true,
        totalSpent: 0,
        providerProfile: null,
      },
    ]);

    const result = await service.listUsers(1, 20);
    expect(result.total).toBe(1);
    expect(result.data[0]?.email).toBe("a@example.com");
    expect(result.data[0]?.providerVerificationStatus).toBeNull();
  });

  it("lists services and searches by title only", async () => {
    prisma.service.count.mockResolvedValue(1);
    prisma.service.findMany.mockResolvedValue([
      {
        id: "svc-1",
        title: "Exterior Wash",
        description: "Hand wash",
        price: 45,
        priceCurrency: "USD",
        duration: 60,
        isActive: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        category: { name: "Wash" },
        provider: {
          id: "pp-1",
          verificationStatus: "APPROVED",
          user: {
            id: "u-1",
            email: "p@example.com",
            firstName: "Pat",
            lastName: "Pro",
          },
        },
      },
    ]);

    const result = await service.listServices(1, 20, "Pat");
    expect(result.data[0]?.providerFirstName).toBe("Pat");
    expect(result.data[0]?.title).toBe("Exterior Wash");
    expect(result.data[0]?.createdAt).toBeInstanceOf(Date);
    expect(prisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          title: { contains: "Pat", mode: "insensitive" },
        }),
      }),
    );
  });

  it("updates service active flag", async () => {
    prisma.service.findUnique.mockResolvedValue({ id: "svc-1" });
    prisma.service.update.mockResolvedValue({
      id: "svc-1",
      title: "Exterior Wash",
      description: "Hand wash",
      price: 45,
      priceCurrency: "USD",
      duration: 60,
      isActive: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      category: { name: "Wash" },
      provider: {
        id: "pp-1",
        verificationStatus: "APPROVED",
        user: {
          id: "u-1",
          email: "p@example.com",
          firstName: "Pat",
          lastName: "Pro",
        },
      },
    });

    const result = await service.updateServiceActive("svc-1", { isActive: false });
    expect(result.isActive).toBe(false);
    expect(prisma.service.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { isActive: false },
      }),
    );
  });

  it("updates provider verification and forces offline when not approved", async () => {
    prisma.providerProfile.findUnique.mockResolvedValue({ id: "pp-1" });
    prisma.providerProfile.update.mockResolvedValue({
      id: "pp-1",
      userId: "u-1",
      verificationStatus: "REJECTED",
      isOnline: false,
      averageRating: 4.5,
      totalReviews: 2,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      user: {
        id: "u-1",
        email: "p@example.com",
        firstName: "Pat",
        lastName: "Pro",
        phone: "+15551212",
        providerOnboarding: { serviceArea: "Downtown" },
      },
    });

    const result = await service.updateProviderVerification("pp-1", {
      verificationStatus: "REJECTED",
    });

    expect(prisma.providerProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          verificationStatus: "REJECTED",
          isOnline: false,
        }),
      }),
    );
    expect(result.verificationStatus).toBe("REJECTED");
    expect(result.isOnline).toBe(false);
  });

  it("returns provider detail with onboarding and services", async () => {
    prisma.providerProfile.findUnique.mockResolvedValue({
      id: "pp-1",
      userId: "u-1",
      bio: "Mobile detailer",
      verificationStatus: "PENDING",
      isOnline: false,
      averageRating: 0,
      totalReviews: 0,
      totalEarnings: 0,
      latitude: 40.7,
      longitude: -74,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      user: {
        id: "u-1",
        email: "p@example.com",
        firstName: "Pat",
        lastName: "Pro",
        phone: "+15551212",
        avatarUrl: null,
        onboardingCompleted: true,
        providerOnboarding: {
          experienceYears: 5,
          serviceArea: "Brooklyn",
          shopAddress: "123 Wash St",
          shopLocations: [{ address: "123 Wash St" }],
          hasTools: true,
          serviceDescription: "Full interior and exterior cleans",
          serviceCategories: ["Exterior Wash"],
        },
      },
      services: [
        {
          id: "svc-1",
          title: "Exterior Wash",
          description: "Hand wash",
          price: 45,
          priceCurrency: "USD",
          duration: 60,
          isActive: true,
          category: { name: "Wash" },
        },
      ],
      documents: [
        {
          id: "doc-1",
          type: "LICENSE",
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
          verifiedAt: null,
        },
      ],
    });
    prisma.booking.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    prisma.booking.findMany.mockResolvedValueOnce([
      {
        id: "b-1",
        status: "COMPLETED",
        address: "9 Park Ave",
        scheduledAt: new Date("2026-02-01T10:00:00.000Z"),
        totalAmount: 45,
        totalCurrency: "USD",
        createdAt: new Date("2026-01-20T00:00:00.000Z"),
        service: { title: "Exterior Wash" },
        customer: { id: "c-1", firstName: "Casey", lastName: "Customer" },
      },
    ]);

    const result = await service.getProviderDetail("pp-1");
    expect(result.serviceDescription).toBe("Full interior and exterior cleans");
    expect(result.serviceArea).toBe("Brooklyn");
    expect(result.services).toHaveLength(1);
    expect(result.documents[0]?.type).toBe("LICENSE");
    expect(result.bookingCounts).toEqual({ total: 3, completed: 1, pending: 2 });
    expect(result.bookings).toHaveLength(1);
    expect(result.bookings[0]?.customerName).toBe("Casey Customer");
    expect(result.bookings[0]?.customerId).toBe("c-1");
  });

  it("returns user detail with customer onboarding", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u-2",
      clerkId: "clerk_customer",
      email: "c@example.com",
      firstName: "Casey",
      lastName: "Customer",
      role: "CUSTOMER",
      phone: null,
      avatarUrl: null,
      onboardingCompleted: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      totalSpent: 120.5,
      customerOnboarding: {
        primaryLocation: "Manhattan",
        carCompany: "Toyota",
        carModel: "2020",
        notes: "SUV",
      },
      providerOnboarding: null,
      providerProfile: null,
    });
    prisma.booking.count.mockResolvedValueOnce(4);
    prisma.booking.findMany.mockResolvedValueOnce([
      {
        id: "b-1",
        status: "COMPLETED",
        address: "1 Main St",
        scheduledAt: new Date("2026-02-01T10:00:00.000Z"),
        totalAmount: 40,
        totalCurrency: "USD",
        createdAt: new Date("2026-01-20T00:00:00.000Z"),
        service: { title: "Exterior Wash" },
        customer: { firstName: "Casey", lastName: "Customer" },
        provider: { user: { firstName: "Pat", lastName: "Pro" } },
      },
    ]);

    const result = await service.getUserDetail("u-2", "clerk_admin");
    expect(result.customerOnboarding?.carCompany).toBe("Toyota");
    expect(result.totalSpent).toBe(120.5);
    expect(result.bookingCounts.asCustomer).toBe(4);
    expect(result.providerProfileId).toBeNull();
    expect(result.bookings).toHaveLength(1);
    expect(result.bookings[0]?.asRole).toBe("CUSTOMER");
    expect(result.bookings[0]?.counterpartyName).toBe("Pat Pro");
  });

  it("rejects viewing own admin profile", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u-admin",
      clerkId: "clerk_admin",
      email: "admin@example.com",
      firstName: "Ada",
      lastName: "Admin",
      role: "ADMIN",
      phone: null,
      avatarUrl: null,
      onboardingCompleted: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      customerOnboarding: null,
      providerOnboarding: null,
      providerProfile: null,
    });

    await expect(service.getUserDetail("u-admin", "clerk_admin")).rejects.toMatchObject({
      status: 403,
    });
  });
});
