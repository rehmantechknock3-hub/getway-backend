import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { hasRequiredPhone, resolveClerkPrimaryEmail, UsersService } from "./users.service";

describe("hasRequiredPhone", () => {
  it("requires at least 6 digits", () => {
    expect(hasRequiredPhone("+123456")).toBe(true);
    expect(hasRequiredPhone("12345")).toBe(false);
    expect(hasRequiredPhone(null)).toBe(false);
  });
});

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
    const service = new UsersService(prisma as never, { get: vi.fn() } as never);

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
    const service = new UsersService(prisma as never, { get: vi.fn() } as never);

    await expect(service.findById("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("updates customer profile fields", async () => {
    const prisma = {
      user: {
        update: vi.fn().mockResolvedValue({ id: "u1" }),
      },
    };
    const service = new UsersService(prisma as never, { get: vi.fn() } as never);
    const refreshed = { id: "u1", firstName: "Saad", lastName: "Nadeem", phone: "123456789" };
    vi.spyOn(service, "findByClerkId").mockResolvedValue(refreshed as never);

    const out = await service.updateProfile("clerk_1", {
      firstName: "Saad",
      lastName: "Nadeem",
      phone: "123456789",
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { clerkId: "clerk_1" },
      data: {
        firstName: "Saad",
        lastName: "Nadeem",
        phone: "123456789",
      },
    });
    expect(out).toEqual(refreshed);
  });

  it("updateProfile persists required phone", async () => {
    const prisma = {
      user: {
        update: vi.fn().mockResolvedValue({ id: "u1" }),
      },
    };
    const service = new UsersService(prisma as never, { get: vi.fn() } as never);
    vi.spyOn(service, "findByClerkId").mockResolvedValue({ id: "u1" } as never);

    await service.updateProfile("clerk_1", {
      firstName: "Saad",
      lastName: "Nadeem",
      phone: "123456789",
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { clerkId: "clerk_1" },
      data: {
        firstName: "Saad",
        lastName: "Nadeem",
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
    const service = new UsersService(prisma as never, { get: vi.fn() } as never);

    await expect(
      service.updateProfile("clerk_missing", {
        firstName: "Saad",
        lastName: "Nadeem",
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
    const service = new UsersService(prisma as never, { get: vi.fn() } as never);
    const savedLocations = [{ label: "Home", address: "Downtown St" }];
    vi.spyOn(service, "findByClerkId").mockResolvedValue({ id: "u1", savedLocations } as never);

    await service.updateSavedLocations("clerk_2", savedLocations);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { clerkId: "clerk_2" },
      data: { savedLocations },
    });
  });

  describe("updateCustomerOnboarding", () => {
    it("persists geocoded primaryLatitude and primaryLongitude when Google returns OK", async () => {
      const findUnique = vi.fn().mockResolvedValue({
        customerOnboarding: null,
        phone: "1234567890",
        onboardingCompleted: false,
      });
      const update = vi.fn().mockResolvedValue({ id: "u1" });
      const prisma = { user: { findUnique, update } };
      const googleMaps = {
        geocodeAddress: vi.fn().mockResolvedValue({ latitude: 31.52, longitude: 74.35 }),
      };

      const service = new UsersService(prisma as never, googleMaps as never);
      vi.spyOn(service, "findByClerkId").mockResolvedValue({ id: "u1" } as never);
      await service.updateCustomerOnboarding(
        "clerk_cust",
        { primaryLocation: "Lahore", carCompany: "Toyota", carModel: "2020" },
        "rid-geo"
      );

      expect(update).toHaveBeenCalledWith({
        where: { clerkId: "clerk_cust" },
        data: {
          onboardingCompleted: true,
          customerOnboarding: {
            primaryLocation: "Lahore",
            carCompany: "Toyota",
            carModel: "2020",
            primaryLatitude: 31.52,
            primaryLongitude: 74.35,
          },
        },
      });
    });

    it("keeps previous coordinates when address unchanged and geocode fails", async () => {
      const findUnique = vi.fn().mockResolvedValue({
        customerOnboarding: {
          primaryLocation: "Same Town",
          carCompany: "Honda",
          carModel: "2019",
          primaryLatitude: 10.1,
          primaryLongitude: 20.2,
        },
        phone: "1234567890",
        onboardingCompleted: true,
      });
      const update = vi.fn().mockResolvedValue({ id: "u1" });
      const prisma = { user: { findUnique, update } };
      const googleMaps = { geocodeAddress: vi.fn().mockResolvedValue(null) };

      const service = new UsersService(prisma as never, googleMaps as never);
      vi.spyOn(service, "findByClerkId").mockResolvedValue({ id: "u1" } as never);
      await service.updateCustomerOnboarding(
        "clerk_cust",
        { primaryLocation: "Same Town", carCompany: "Honda", carModel: "2019" },
        "rid-fail"
      );

      expect(update).toHaveBeenCalledWith({
        where: { clerkId: "clerk_cust" },
        data: {
          onboardingCompleted: true,
          customerOnboarding: {
            primaryLocation: "Same Town",
            carCompany: "Honda",
            carModel: "2019",
            primaryLatitude: 10.1,
            primaryLongitude: 20.2,
          },
        },
      });
    });

    it("rejects first-time onboarding when phone is missing", async () => {
      const findUnique = vi.fn().mockResolvedValue({
        customerOnboarding: null,
        phone: null,
        onboardingCompleted: false,
      });
      const prisma = { user: { findUnique, update: vi.fn() } };
      const service = new UsersService(prisma as never, { get: vi.fn() } as never);

      await expect(
        service.updateCustomerOnboarding("clerk_cust", {
          primaryLocation: "Lahore",
          carCompany: "Toyota",
          carModel: "2020",
        })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
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
      user: {
        findUnique: vi.fn().mockResolvedValue({ phone: "1234567890", onboardingCompleted: false }),
      },
      $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
    };
    const googleMaps = { geocodeAddress: vi.fn().mockResolvedValue(undefined) };
    const service = new UsersService(prisma as never, googleMaps as never);
    vi.spyOn(service, "findByClerkId").mockResolvedValue({ id: "u1" } as never);

    await service.updateProviderOnboarding("clerk_3", {
      serviceCategories: ["Car Wash"],
      starterListingPrice: 55,
      starterListingDurationMinutes: 45,
      experienceYears: 4,
      serviceArea: "Lahore",
      shopAddress: "21 Main Boulevard, Lahore",
      shopPlaceId: "place_1234567890",
      shopLocations: [
        { address: "21 Main Boulevard, Lahore", placeId: "place_1234567890" },
      ],
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
          shopAddress: "21 Main Boulevard, Lahore",
          shopPlaceId: "place_1234567890",
          shopLocations: [
            {
              address: "21 Main Boulevard, Lahore",
              placeId: "place_1234567890",
            },
          ],
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

  it("preserves client shop coordinates without calling Google", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetch must not run"));

    const mockTx = {
      user: {
        update: vi.fn().mockResolvedValue({ id: "u1" }),
      },
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: "pp-1" }),
        update: vi.fn().mockResolvedValue({ id: "pp-1" }),
      },
      service: {
        count: vi.fn().mockResolvedValue(1),
      },
    };
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ phone: "1234567890", onboardingCompleted: false }),
      },
      $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
    };
    const service = new UsersService(prisma as never, { get: vi.fn() } as never);

    await service.updateProviderOnboarding("clerk_client_coords", {
      serviceCategories: ["Taxi"],
      experienceYears: 1,
      serviceArea: "Central",
      shopAddress: "1 Main St",
      shopPlaceId: "ChIJclientplaceid12",
      shopLocations: [
        {
          address: "1 Main St",
          placeId: "ChIJclientplaceid12",
          latitude: 51.5,
          longitude: -0.12,
        },
      ],
      hasTools: true,
      serviceDescription: "Rides",
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();

    expect(mockTx.providerProfile.update).toHaveBeenCalledWith({
      where: { id: "pp-1" },
      data: { latitude: 51.5, longitude: -0.12 },
    });
    expect(mockTx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          providerOnboarding: expect.objectContaining({
            shopLocations: [
              expect.objectContaining({
                latitude: 51.5,
                longitude: -0.12,
              }),
            ],
          }),
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
      user: {
        findUnique: vi.fn().mockResolvedValue({ phone: "1234567890", onboardingCompleted: false }),
      },
      $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
    };
    const googleMaps = { geocodeAddress: vi.fn().mockResolvedValue(undefined) };
    const service = new UsersService(prisma as never, googleMaps as never);
    vi.spyOn(service, "findByClerkId").mockResolvedValue({ id: "u1" } as never);

    await service.updateProviderOnboarding("clerk_draft", {
      serviceCategories: ["Paint"],
      experienceYears: 1,
      serviceArea: "North",
      shopAddress: "North Block Market",
      shopLocations: [{ address: "North Block Market" }],
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
            shopAddress: "Downtown Plaza 5",
            shopLocations: [{ address: "Downtown Plaza 5" }],
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
    const service = new UsersService(prisma as never, { get: vi.fn() } as never);

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
        findUnique: vi.fn().mockResolvedValue({
          id: "u1",
          clerkId: "clerk_4",
          role: "PROVIDER",
          email: "p@example.com",
          firstName: "Pat",
          lastName: "Lee",
          phone: null,
          avatarUrl: "https://example.com/a.jpg",
          savedLocations: [],
          onboardingCompleted: true,
          customerOnboarding: null,
          providerOnboarding: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          providerProfile: null,
        }),
      },
    };
    const service = new UsersService(prisma as never, { get: vi.fn() } as never);

    const result = await service.updateAvatar("clerk_4", "https://example.com/a.jpg");

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { clerkId: "clerk_4" },
      data: { avatarUrl: "https://example.com/a.jpg" },
    });
    expect(result.avatarUrl).toBe("https://example.com/a.jpg");
  });

  it("deleteByClerkId returns false when user is absent", async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn(),
    };
    const service = new UsersService(prisma as never, { get: vi.fn() } as never);

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
    const service = new UsersService(prisma as never, { get: vi.fn() } as never);

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

  it("updateProviderPresence updates provider profile online flag", async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "u-p",
          role: "PROVIDER",
          providerProfile: { id: "pp-1", verificationStatus: "APPROVED" },
        }),
      },
      providerProfile: {
        update: vi.fn().mockResolvedValue({ id: "pp-1", isOnline: true }),
      },
    };
    const service = new UsersService(prisma as never, { get: vi.fn() } as never);
    const findByClerkIdSpy = vi
      .spyOn(service, "findByClerkId")
      .mockResolvedValue({ id: "u-p", providerMetrics: { isOnline: true } } as never);

    await service.updateProviderPresence("clerk_provider", true);

    expect(prisma.providerProfile.update).toHaveBeenCalledWith({
      where: { id: "pp-1" },
      data: { isOnline: true },
    });
    expect(findByClerkIdSpy).toHaveBeenCalledWith("clerk_provider");
  });

  it("updateProviderPresence blocks going online when not approved", async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "u-p",
          role: "PROVIDER",
          providerProfile: { id: "pp-1", verificationStatus: "PENDING" },
        }),
      },
      providerProfile: {
        update: vi.fn(),
      },
    };
    const service = new UsersService(prisma as never, { get: vi.fn() } as never);

    await expect(service.updateProviderPresence("clerk_provider", true)).rejects.toMatchObject({
      status: 403,
    });
    expect(prisma.providerProfile.update).not.toHaveBeenCalled();
  });

  it("updateProviderPresence rejects non-provider users", async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "u-c",
          role: "CUSTOMER",
          providerProfile: null,
        }),
      },
    };
    const service = new UsersService(prisma as never, { get: vi.fn() } as never);

    await expect(service.updateProviderPresence("clerk_customer", true)).rejects.toThrow();
  });

  it("updateProviderAvailability saves the rolling calendar", async () => {
    const days = [{ date: "2026-08-20", enabled: true, startHour: 9, endHour: 18 }];
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "u-p",
          role: "PROVIDER",
          providerProfile: { id: "pp-1", availabilityDays: [] },
        }),
      },
      providerProfile: {
        update: vi.fn().mockResolvedValue({ id: "pp-1" }),
      },
    };
    const service = new UsersService(prisma as never, { get: vi.fn() } as never);
    const findByClerkIdSpy = vi.spyOn(service, "findByClerkId").mockResolvedValue({ id: "u-p" } as never);

    await service.updateProviderAvailability("clerk_provider", days);

    expect(prisma.providerProfile.update).toHaveBeenCalledWith({
      where: { id: "pp-1" },
      data: { availabilityDays: days },
    });
    expect(findByClerkIdSpy).toHaveBeenCalledWith("clerk_provider");
  });

  it("updateProviderAvailability keeps already scheduled days locked", async () => {
    const stored = [{ date: "2026-08-20", enabled: true, startHour: 9, endHour: 18 }];
    const incoming = [
      { date: "2026-08-20", enabled: false, startHour: 10, endHour: 16 },
      { date: "2026-08-21", enabled: true, startHour: 8, endHour: 17 },
    ];
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "u-p",
          role: "PROVIDER",
          providerProfile: { id: "pp-1", availabilityDays: stored },
        }),
      },
      providerProfile: {
        update: vi.fn().mockResolvedValue({ id: "pp-1" }),
      },
    };
    const service = new UsersService(prisma as never, { get: vi.fn() } as never);
    vi.spyOn(service, "findByClerkId").mockResolvedValue({ id: "u-p" } as never);

    await service.updateProviderAvailability("clerk_provider", incoming);

    expect(prisma.providerProfile.update).toHaveBeenCalledWith({
      where: { id: "pp-1" },
      data: {
        availabilityDays: [
          stored[0],
          { date: "2026-08-21", enabled: true, startHour: 8, endHour: 17 },
        ],
      },
    });
  });

  it("updateProviderAvailability rejects non-provider users", async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "u-c",
          role: "CUSTOMER",
          providerProfile: null,
        }),
      },
    };
    const service = new UsersService(prisma as never, { get: vi.fn() } as never);

    await expect(service.updateProviderAvailability("clerk_customer", [])).rejects.toThrow();
  });
});
