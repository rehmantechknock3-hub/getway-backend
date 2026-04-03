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

  it("marks onboarding complete for provider flow", async () => {
    const prisma = {
      user: {
        update: vi.fn().mockResolvedValue({ id: "u1" }),
      },
    };
    const service = new UsersService(prisma as never);

    await service.updateProviderOnboarding("clerk_3", {
      serviceCategory: "Car Wash",
      experienceYears: 4,
      serviceArea: "Lahore",
      hasTools: true,
      serviceDescription: "Complete car detailing service.",
      profilePhotoUrl: "https://example.com/photo.png",
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { clerkId: "clerk_3" },
      data: {
        onboardingCompleted: true,
        avatarUrl: "https://example.com/photo.png",
        providerOnboarding: {
          serviceCategory: "Car Wash",
          experienceYears: 4,
          serviceArea: "Lahore",
          hasTools: true,
          serviceDescription: "Complete car detailing service.",
          profilePhotoUrl: "https://example.com/photo.png",
        },
      },
    });
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
});
