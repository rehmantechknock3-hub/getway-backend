import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { resolveClerkPrimaryEmail, UsersService } from "./users.service";

describe("resolveClerkPrimaryEmail", () => {
  it("uses primary_email_address_id when present", () => {
    expect(
      resolveClerkPrimaryEmail({
        id: "u1",
        primary_email_address_id: "idn_b",
        email_addresses: [
          { id: "idn_a", email_address: "old@example.com" },
          { id: "idn_b", email_address: "primary@example.com" },
        ],
        first_name: null,
        last_name: null,
        image_url: null,
        public_metadata: {},
      })
    ).toBe("primary@example.com");
  });

  it("falls back to first address when no primary id", () => {
    expect(
      resolveClerkPrimaryEmail({
        id: "u1",
        email_addresses: [{ email_address: "only@example.com" }],
        first_name: null,
        last_name: null,
        image_url: null,
        public_metadata: {},
      })
    ).toBe("only@example.com");
  });
});

describe("UsersService", () => {
  it("findById returns selected user fields", async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "u1",
          clerkId: "clerk_1",
          role: "CUSTOMER",
          email: "u@example.com",
          firstName: "U",
          lastName: "One",
          phone: null,
          avatarUrl: null,
          savedLocations: null,
          onboardingCompleted: false,
          customerOnboarding: null,
          providerOnboarding: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          providerProfile: null,
        }),
      },
    };
    const service = new UsersService(prisma as never);

    const out = await service.findById("u1");

    expect(out).toMatchObject({
      id: "u1",
      clerkId: "clerk_1",
      role: "CUSTOMER",
      email: "u@example.com",
    });
  });

  it("findById throws NotFoundException when user missing", async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const service = new UsersService(prisma as never);

    await expect(service.findById("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("updates customer profile fields", async () => {
    const prisma = {
      user: {
        update: vi.fn().mockResolvedValue({ id: "u1" }),
      },
    };
    const service = new UsersService(prisma as never);

    await service.updateProfile("clerk_1", {
      firstName: "Saad",
      lastName: "Nadeem",
      email: "saad@example.com",
      phone: "123456789",
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { clerkId: "clerk_1" },
      data: {
        firstName: "Saad",
        lastName: "Nadeem",
        email: "saad@example.com",
        phone: "123456789",
      },
    });
  });

  it("updateProfile rejects for invalid/unauthorized user id", async () => {
    const prisma = {
      user: {
        update: vi.fn().mockRejectedValue(new Error("Record to update not found")),
      },
    };
    const service = new UsersService(prisma as never);

    await expect(
      service.updateProfile("clerk_missing", {
        firstName: "Saad",
        lastName: "Nadeem",
        email: "saad@example.com",
        phone: "123456789",
      })
    ).rejects.toThrow();
  });

  it("stores saved locations as JSON payload", async () => {
    const prisma = {
      user: {
        update: vi.fn().mockResolvedValue({ id: "u1" }),
      },
    };
    const service = new UsersService(prisma as never);
    const savedLocations = [{ label: "Home", address: "Downtown St" }];

    await service.updateSavedLocations("clerk_2", savedLocations);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { clerkId: "clerk_2" },
      data: { savedLocations },
    });
  });

  it("marks onboarding complete for provider flow and seeds starter service when none exist", async () => {
    const mockTx = {
      user: {
        update: vi.fn().mockResolvedValue({ id: "u1" }),
      },
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: "pp-1" }),
      },
      service: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "svc-1" }),
      },
      serviceCategory: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "cat-1", name: "Car Wash" }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
    };
    const service = new UsersService(prisma as never);

    await service.updateProviderOnboarding("clerk_3", {
      serviceCategories: ["Car Wash"],
      starterListingPrice: 55,
      starterListingDurationMinutes: 45,
      experienceYears: 4,
      serviceArea: "Lahore",
      hasTools: true,
      serviceDescription: "Complete car detailing service.",
      profilePhotoUrl: "https://example.com/photo.png",
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { clerkId: "clerk_3" },
      data: {
        onboardingCompleted: true,
        avatarUrl: "https://example.com/photo.png",
        providerOnboarding: {
          serviceCategories: ["Car Wash"],
          starterListingPrice: 55,
          starterListingDurationMinutes: 45,
          experienceYears: 4,
          serviceArea: "Lahore",
          hasTools: true,
          serviceDescription: "Complete car detailing service.",
          profilePhotoUrl: "https://example.com/photo.png",
        },
      },
    });
    expect(mockTx.service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          price: 55,
          duration: 45,
          isActive: true,
        }),
      })
    );
  });

  it("seeds draft services when starter price and duration are omitted", async () => {
    const mockTx = {
      user: {
        update: vi.fn().mockResolvedValue({ id: "u1" }),
      },
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: "pp-1" }),
      },
      service: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "svc-draft" }),
      },
      serviceCategory: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "cat-p", name: "Paint" }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
    };
    const service = new UsersService(prisma as never);

    await service.updateProviderOnboarding("clerk_draft", {
      serviceCategories: ["Paint"],
      experienceYears: 1,
      serviceArea: "North",
      hasTools: true,
      serviceDescription: "Interior paint",
    });

    expect(mockTx.service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          price: 0,
          duration: 0,
          isActive: false,
        }),
      })
    );
  });

  it("ensureProviderStarterListing creates service when onboarding valid and none exist", async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "u1",
          role: "PROVIDER",
          providerOnboarding: {
            serviceCategory: "Plumbing",
            experienceYears: 2,
            serviceArea: "Downtown",
            hasTools: true,
            serviceDescription: "Leak fixes",
          },
          providerProfile: { id: "pp-1" },
        }),
      },
      service: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "s-new" }),
      },
      serviceCategory: {
        findFirst: vi.fn().mockResolvedValue({ id: "c-existing", name: "Plumbing" }),
      },
    };
    const service = new UsersService(prisma as never);

    const out = await service.ensureProviderStarterListing("clerk_x");

    expect(out).toEqual({ created: true });
    expect(prisma.service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          price: 0,
          duration: 0,
          isActive: false,
        }),
      })
    );
  });

  it("updates avatar url for user profile", async () => {
    const prisma = {
      user: {
        update: vi.fn().mockResolvedValue({ id: "u1" }),
      },
    };
    const service = new UsersService(prisma as never);

    await service.updateAvatar("clerk_4", "data:image/jpeg;base64,abc123");

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { clerkId: "clerk_4" },
      data: { avatarUrl: "data:image/jpeg;base64,abc123" },
    });
  });

  it("deleteByClerkId returns false when user is absent", async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn(),
    };
    const service = new UsersService(prisma as never);

    const out = await service.deleteByClerkId("missing_clerk");

    expect(out).toEqual({ deleted: false });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("deleteByClerkId clears bookings and favorites then deletes user", async () => {
    const mockTx = {
      message: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      booking: {
        findMany: vi.fn().mockResolvedValue([{ id: "book-1" }]),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      payment: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      review: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      conversation: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      favoriteProvider: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      user: { delete: vi.fn().mockResolvedValue({ id: "u-del" }) },
    };
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "u-del",
          providerProfile: { id: "pp-del" },
        }),
      },
      $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
    };
    const service = new UsersService(prisma as never);

    const out = await service.deleteByClerkId("clerk_wipe");

    expect(out).toEqual({ deleted: true });
    expect(mockTx.payment.deleteMany).toHaveBeenCalledWith({
      where: { bookingId: { in: ["book-1"] } },
    });
    expect(mockTx.review.deleteMany).toHaveBeenCalledWith({
      where: { bookingId: { in: ["book-1"] } },
    });
    expect(mockTx.conversation.deleteMany).toHaveBeenCalledWith({
      where: { bookingId: { in: ["book-1"] } },
    });
    expect(mockTx.booking.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["book-1"] } },
    });
    expect(mockTx.favoriteProvider.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ customerId: "u-del" }, { providerId: "pp-del" }] },
    });
    expect(mockTx.user.delete).toHaveBeenCalledWith({ where: { id: "u-del" } });
  });
});
