import { Injectable, ForbiddenException, NotFoundException } from "@nestjs/common";

import type {
  AdminProviderDetail,
  AdminProviderListResponse,
  AdminServiceListResponse,
  AdminServiceRow,
  AdminStats,
  AdminUpdateProviderVerificationInput,
  AdminUserDetail,
  AdminUserListResponse,
  UserRole,
  VerificationStatus,
} from "@repo/schemas";
import {
  CustomerOnboardingSchema,
  safeParseProviderOnboardingJson,
} from "@repo/schemas";

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<AdminStats> {
    const [
      userGroups,
      providerGroups,
      providersOnline,
      bookingGroups,
      servicesTotal,
      paymentGroups,
      paymentAgg,
    ] = await Promise.all([
      this.prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
      this.prisma.providerProfile.groupBy({
        by: ["verificationStatus"],
        _count: { _all: true },
      }),
      this.prisma.providerProfile.count({ where: { isOnline: true } }),
      this.prisma.booking.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.service.count(),
      this.prisma.payment.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.payment.aggregate({
        where: { status: "SUCCEEDED" },
        _sum: { amount: true },
      }),
    ]);

    const countBy = <T extends string>(
      rows: Array<{ [K in T]: string } & { _count: { _all: number } }>,
      key: T,
      value: string,
    ) => rows.find((r) => r[key] === value)?._count._all ?? 0;

    const customers = countBy(userGroups, "role", "CUSTOMER");
    const providers = countBy(userGroups, "role", "PROVIDER");
    const admins = countBy(userGroups, "role", "ADMIN");

    return {
      users: {
        total: customers + providers + admins,
        customers,
        providers,
        admins,
      },
      providers: {
        total: providerGroups.reduce((sum, r) => sum + r._count._all, 0),
        pending: countBy(providerGroups, "verificationStatus", "PENDING"),
        approved: countBy(providerGroups, "verificationStatus", "APPROVED"),
        rejected: countBy(providerGroups, "verificationStatus", "REJECTED"),
        underReview: countBy(providerGroups, "verificationStatus", "UNDER_REVIEW"),
        online: providersOnline,
      },
      bookings: {
        total: bookingGroups.reduce((sum, r) => sum + r._count._all, 0),
        pending: countBy(bookingGroups, "status", "PENDING"),
        accepted: countBy(bookingGroups, "status", "ACCEPTED"),
        inProgress: countBy(bookingGroups, "status", "IN_PROGRESS"),
        completed: countBy(bookingGroups, "status", "COMPLETED"),
        cancelled: countBy(bookingGroups, "status", "CANCELLED"),
        rejected: countBy(bookingGroups, "status", "REJECTED"),
      },
      services: { total: servicesTotal },
      payments: {
        total: paymentGroups.reduce((sum, r) => sum + r._count._all, 0),
        succeeded: countBy(paymentGroups, "status", "SUCCEEDED"),
        volumeCentsApprox: Math.round((paymentAgg._sum.amount ?? 0) * 100),
      },
    };
  }

  async listUsers(
    page: number,
    limit: number,
    role?: UserRole,
    search?: string,
    excludeClerkId?: string,
  ): Promise<AdminUserListResponse> {
    const q = search?.trim();
    const where = {
      ...(excludeClerkId ? { clerkId: { not: excludeClerkId } } : {}),
      ...(role ? { role } : {}),
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" as const } },
              { lastName: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          providerProfile: { select: { verificationStatus: true } },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      data: rows.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        phone: u.phone,
        createdAt: u.createdAt,
        onboardingCompleted: u.onboardingCompleted,
        totalSpent: u.totalSpent ?? 0,
        providerVerificationStatus: u.providerProfile?.verificationStatus ?? null,
      })),
    };
  }

  async listServices(
    page: number,
    limit: number,
    search?: string,
    active?: boolean,
  ): Promise<AdminServiceListResponse> {
    const q = search?.trim();
    const where = {
      ...(active === undefined ? {} : { isActive: active }),
      ...(q
        ? {
            title: { contains: q, mode: "insensitive" as const },
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.service.count({ where }),
      this.prisma.service.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          category: { select: { name: true } },
          provider: {
            select: {
              id: true,
              verificationStatus: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      data: rows.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        price: s.price,
        priceCurrency: s.priceCurrency,
        duration: s.duration,
        isActive: s.isActive,
        categoryName: s.category?.name ?? null,
        providerProfileId: s.provider.id,
        providerUserId: s.provider.user.id,
        providerFirstName: s.provider.user.firstName,
        providerLastName: s.provider.user.lastName,
        providerEmail: s.provider.user.email,
        providerVerificationStatus: s.provider.verificationStatus,
        createdAt: s.createdAt,
      })),
    };
  }

  async updateServiceActive(
    serviceId: string,
    input: { isActive: boolean },
  ): Promise<AdminServiceRow> {
    const existing = await this.prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("Service not found");

    const updated = await this.prisma.service.update({
      where: { id: serviceId },
      data: { isActive: input.isActive },
      include: {
        category: { select: { name: true } },
        provider: {
          select: {
            id: true,
            verificationStatus: true,
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      price: updated.price,
      priceCurrency: updated.priceCurrency,
      duration: updated.duration,
      isActive: updated.isActive,
      categoryName: updated.category?.name ?? null,
      providerProfileId: updated.provider.id,
      providerUserId: updated.provider.user.id,
      providerFirstName: updated.provider.user.firstName,
      providerLastName: updated.provider.user.lastName,
      providerEmail: updated.provider.user.email,
      providerVerificationStatus: updated.provider.verificationStatus,
      createdAt: updated.createdAt,
    };
  }

  async listProviders(
    page: number,
    limit: number,
    status?: VerificationStatus,
  ): Promise<AdminProviderListResponse> {
    const where = status ? { verificationStatus: status } : {};
    const [total, rows] = await Promise.all([
      this.prisma.providerProfile.count({ where }),
      this.prisma.providerProfile.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              providerOnboarding: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      data: rows.map((p) => {
        const onboarding = safeParseProviderOnboardingJson(p.user.providerOnboarding);
        return {
          id: p.id,
          userId: p.userId,
          email: p.user.email,
          firstName: p.user.firstName,
          lastName: p.user.lastName,
          verificationStatus: p.verificationStatus,
          isOnline: p.isOnline,
          averageRating: p.averageRating,
          totalReviews: p.totalReviews,
          serviceArea: onboarding.success ? onboarding.data.serviceArea : null,
          createdAt: p.createdAt,
        };
      }),
    };
  }

  async updateProviderVerification(
    providerProfileId: string,
    input: AdminUpdateProviderVerificationInput,
  ) {
    const existing = await this.prisma.providerProfile.findUnique({
      where: { id: providerProfileId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("Provider not found");

    const forceOffline = input.verificationStatus !== "APPROVED";
    const updated = await this.prisma.providerProfile.update({
      where: { id: providerProfileId },
      data: {
        verificationStatus: input.verificationStatus,
        ...(forceOffline ? { isOnline: false } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            providerOnboarding: true,
          },
        },
      },
    });

    const onboarding = safeParseProviderOnboardingJson(updated.user.providerOnboarding);
    return {
      id: updated.id,
      userId: updated.userId,
      email: updated.user.email,
      firstName: updated.user.firstName,
      lastName: updated.user.lastName,
      verificationStatus: updated.verificationStatus,
      isOnline: updated.isOnline,
      averageRating: updated.averageRating,
      totalReviews: updated.totalReviews,
      serviceArea: onboarding.success ? onboarding.data.serviceArea : null,
      createdAt: updated.createdAt,
    };
  }

  async getProviderDetail(providerProfileId: string): Promise<AdminProviderDetail> {
    const row = await this.prisma.providerProfile.findUnique({
      where: { id: providerProfileId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            avatarUrl: true,
            onboardingCompleted: true,
            providerOnboarding: true,
          },
        },
        services: {
          include: { category: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        },
        documents: {
          select: { id: true, type: true, createdAt: true, verifiedAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!row) throw new NotFoundException("Provider not found");

    const onboarding = safeParseProviderOnboardingJson(row.user.providerOnboarding);
    const onboardingData = onboarding.success ? onboarding.data : null;

    const [bookingTotal, bookingCompleted, bookingPending, bookingRows] =
      await Promise.all([
        this.prisma.booking.count({ where: { providerId: row.id } }),
        this.prisma.booking.count({
          where: { providerId: row.id, status: "COMPLETED" },
        }),
        this.prisma.booking.count({
          where: { providerId: row.id, status: "PENDING" },
        }),
        this.prisma.booking.findMany({
          where: { providerId: row.id },
          include: {
            service: { select: { title: true } },
            customer: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { scheduledAt: "desc" },
          take: 50,
        }),
      ]);

    return {
      id: row.id,
      userId: row.userId,
      email: row.user.email,
      firstName: row.user.firstName,
      lastName: row.user.lastName,
      phone: row.user.phone,
      avatarUrl: row.user.avatarUrl,
      bio: row.bio,
      verificationStatus: row.verificationStatus,
      isOnline: row.isOnline,
      averageRating: row.averageRating,
      totalReviews: row.totalReviews,
      totalEarnings: row.totalEarnings,
      latitude: row.latitude,
      longitude: row.longitude,
      onboardingCompleted: row.user.onboardingCompleted,
      createdAt: row.createdAt,
      experienceYears: onboardingData?.experienceYears ?? null,
      serviceArea: onboardingData?.serviceArea ?? null,
      serviceDescription: onboardingData?.serviceDescription ?? null,
      hasTools: onboardingData?.hasTools ?? null,
      serviceCategories: onboardingData?.serviceCategories ?? [],
      shopAddress: onboardingData?.shopAddress ?? null,
      shopLocations: (onboardingData?.shopLocations ?? []).map((loc) => ({
        address: loc.address,
        latitude: loc.latitude,
        longitude: loc.longitude,
      })),
      profilePhotoUrl: onboardingData?.profilePhotoUrl ?? row.user.avatarUrl ?? null,
      services: row.services.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        price: s.price,
        priceCurrency: s.priceCurrency,
        duration: s.duration,
        isActive: s.isActive,
        categoryName: s.category?.name ?? null,
      })),
      documents: row.documents.map((d) => ({
        id: d.id,
        type: d.type,
        createdAt: d.createdAt,
        verifiedAt: d.verifiedAt,
      })),
      bookingCounts: {
        total: bookingTotal,
        completed: bookingCompleted,
        pending: bookingPending,
      },
      bookings: bookingRows.map((b) => ({
        id: b.id,
        status: b.status,
        serviceTitle: b.service.title,
        customerId: b.customer.id,
        customerName: `${b.customer.firstName} ${b.customer.lastName}`.trim() || "—",
        address: b.address,
        scheduledAt: b.scheduledAt,
        totalAmount: b.totalAmount,
        totalCurrency: b.totalCurrency,
        createdAt: b.createdAt,
      })),
    };
  }

  async getUserDetail(
    userId: string,
    viewerClerkId?: string,
  ): Promise<AdminUserDetail> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        providerProfile: {
          select: {
            id: true,
            verificationStatus: true,
            isOnline: true,
            averageRating: true,
            totalReviews: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException("User not found");
    if (viewerClerkId && user.clerkId === viewerClerkId) {
      throw new ForbiddenException("You cannot view your own profile in admin");
    }

    const customerParsed = CustomerOnboardingSchema.safeParse(user.customerOnboarding);
    const providerOnboarding = safeParseProviderOnboardingJson(user.providerOnboarding);
    const providerData = providerOnboarding.success ? providerOnboarding.data : null;

    const bookingInclude = {
      service: { select: { title: true } },
      customer: { select: { firstName: true, lastName: true } },
      provider: {
        select: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
    } as const;

    const [asCustomer, asProvider, asCustomerRows, asProviderRows] = await Promise.all([
      this.prisma.booking.count({ where: { customerId: user.id } }),
      user.providerProfile
        ? this.prisma.booking.count({ where: { providerId: user.providerProfile.id } })
        : Promise.resolve(0),
      this.prisma.booking.findMany({
        where: { customerId: user.id },
        include: bookingInclude,
        orderBy: { scheduledAt: "desc" },
        take: 50,
      }),
      user.providerProfile
        ? this.prisma.booking.findMany({
            where: { providerId: user.providerProfile.id },
            include: bookingInclude,
            orderBy: { scheduledAt: "desc" },
            take: 50,
          })
        : Promise.resolve([]),
    ]);

    const displayName = (first: string, last: string) =>
      `${first} ${last}`.trim() || "—";

    const bookings = [
      ...asCustomerRows.map((b) => ({
        id: b.id,
        asRole: "CUSTOMER" as const,
        status: b.status,
        serviceTitle: b.service.title,
        counterpartyName: displayName(b.provider.user.firstName, b.provider.user.lastName),
        address: b.address,
        scheduledAt: b.scheduledAt,
        totalAmount: b.totalAmount,
        totalCurrency: b.totalCurrency,
        createdAt: b.createdAt,
      })),
      ...asProviderRows.map((b) => ({
        id: b.id,
        asRole: "PROVIDER" as const,
        status: b.status,
        serviceTitle: b.service.title,
        counterpartyName: displayName(b.customer.firstName, b.customer.lastName),
        address: b.address,
        scheduledAt: b.scheduledAt,
        totalAmount: b.totalAmount,
        totalCurrency: b.totalCurrency,
        createdAt: b.createdAt,
      })),
    ].sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime());

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      onboardingCompleted: user.onboardingCompleted,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      customerOnboarding: customerParsed.success
        ? {
            primaryLocation: customerParsed.data.primaryLocation,
            carCompany: customerParsed.data.carCompany,
            carModel: customerParsed.data.carModel,
            notes: customerParsed.data.notes,
          }
        : null,
      providerProfileId: user.providerProfile?.id ?? null,
      providerVerificationStatus: user.providerProfile?.verificationStatus ?? null,
      providerSummary: user.providerProfile
        ? {
            serviceArea: providerData?.serviceArea ?? null,
            serviceDescription: providerData?.serviceDescription ?? null,
            experienceYears: providerData?.experienceYears ?? null,
            isOnline: user.providerProfile.isOnline,
            averageRating: user.providerProfile.averageRating,
            totalReviews: user.providerProfile.totalReviews,
          }
        : null,
      totalSpent: user.totalSpent ?? 0,
      bookingCounts: {
        asCustomer,
        asProvider,
      },
      bookings,
    };
  }
}
