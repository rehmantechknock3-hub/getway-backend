import { describe, expect, it, vi } from "vitest";
import { UsersService } from "./users.service";

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
