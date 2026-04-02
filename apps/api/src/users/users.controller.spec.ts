import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { UsersController } from "./users.controller";

describe("UsersController", () => {
  it("rejects profile updates without authenticated user", async () => {
    const service = {
      updateProfile: vi.fn(),
    };
    const controller = new UsersController(service as never);

    await expect(
      controller.updateProfile({ auth: undefined } as never, {
        firstName: "A",
        lastName: "B",
        email: "a@b.com",
        phone: "123456",
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("routes customer onboarding payload to customer handler", async () => {
    const service = {
      updateCustomerOnboarding: vi.fn().mockResolvedValue({ ok: true }),
      updateProviderOnboarding: vi.fn(),
    };
    const controller = new UsersController(service as never);

    await controller.updateOnboarding(
      { auth: { sub: "clerk_1" } } as never,
      {
        role: "CUSTOMER",
        data: {
          primaryLocation: "Johar Town",
          carCompany: "Toyota",
          carModel: "2020",
          notes: "Underground parking",
        },
      }
    );

    expect(service.updateCustomerOnboarding).toHaveBeenCalledWith("clerk_1", {
      primaryLocation: "Johar Town",
      carCompany: "Toyota",
      carModel: "2020",
      notes: "Underground parking",
    });
    expect(service.updateProviderOnboarding).not.toHaveBeenCalled();
  });

  it("routes provider onboarding payload to provider handler", async () => {
    const service = {
      updateCustomerOnboarding: vi.fn(),
      updateProviderOnboarding: vi.fn().mockResolvedValue({ ok: true }),
    };
    const controller = new UsersController(service as never);

    await controller.updateOnboarding(
      { auth: { sub: "clerk_2" } } as never,
      {
        role: "PROVIDER",
        data: {
          serviceCategory: "Car Wash",
          experienceYears: 3,
          serviceArea: "DHA",
          hasTools: true,
          serviceDescription: "Interior and exterior detailing.",
          profilePhotoUrl: "https://example.com/photo.jpg",
        },
      }
    );

    expect(service.updateProviderOnboarding).toHaveBeenCalledWith("clerk_2", {
      serviceCategory: "Car Wash",
      experienceYears: 3,
      serviceArea: "DHA",
      hasTools: true,
      serviceDescription: "Interior and exterior detailing.",
      profilePhotoUrl: "https://example.com/photo.jpg",
    });
  });

  it("updates avatar for authenticated user", async () => {
    const service = {
      updateAvatar: vi.fn().mockResolvedValue({ ok: true }),
    };
    const controller = new UsersController(service as never);

    await controller.updateAvatar(
      { auth: { sub: "clerk_avatar" } } as never,
      { avatarUrl: "data:image/jpeg;base64,abc123" }
    );

    expect(service.updateAvatar).toHaveBeenCalledWith("clerk_avatar", "data:image/jpeg;base64,abc123");
  });
});
