import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { UsersController } from "./users.controller";

describe("UsersController", () => {
  it("rejects profile update without a phone number", async () => {
    const service = {
      updateProfile: vi.fn(),
    };
    const controller = new UsersController(service as never);

    await expect(
      controller.updateProfile({ auth: { sub: "clerk_1" } } as never, {
        firstName: "A",
        lastName: "B",
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.updateProfile).not.toHaveBeenCalled();
  });

  it("rejects profile updates without authenticated user", async () => {
    const service = {
      updateProfile: vi.fn(),
    };
    const controller = new UsersController(service as never);

    await expect(
      controller.updateProfile({ auth: undefined } as never, {
        firstName: "A",
        lastName: "B",
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
      { auth: { sub: "clerk_1" }, requestId: "rid-cust" } as never,
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

    expect(service.updateCustomerOnboarding).toHaveBeenCalledWith(
      "clerk_1",
      {
        primaryLocation: "Johar Town",
        carCompany: "Toyota",
        carModel: "2020",
        notes: "Underground parking",
      },
      "rid-cust"
    );
    expect(service.updateProviderOnboarding).not.toHaveBeenCalled();
  });

  it("routes provider onboarding payload to provider handler", async () => {
    const service = {
      updateCustomerOnboarding: vi.fn(),
      updateProviderOnboarding: vi.fn().mockResolvedValue({ ok: true }),
    };
    const controller = new UsersController(service as never);

    await controller.updateOnboarding(
      { auth: { sub: "clerk_2" }, requestId: "rid-prov" } as never,
      {
        role: "PROVIDER",
        data: {
          serviceCategories: ["Car Wash", "Car Detailing"],
          starterListingPrice: 40,
          starterListingDurationMinutes: 90,
          experienceYears: 3,
          serviceArea: "DHA",
          shopAddress: "DHA Main Market",
          shopPlaceId: "place_abc1234567",
          shopLocations: [{ address: "DHA Main Market", placeId: "place_abc1234567" }],
          hasTools: true,
          serviceDescription: "Interior and exterior detailing.",
          profilePhotoUrl: "https://example.com/photo.jpg",
        },
      }
    );

    expect(service.updateProviderOnboarding).toHaveBeenCalledWith(
      "clerk_2",
      {
        serviceCategories: ["Car Wash", "Car Detailing"],
        starterListingPrice: 40,
        starterListingDurationMinutes: 90,
        experienceYears: 3,
        serviceArea: "DHA",
        shopAddress: "DHA Main Market",
        shopPlaceId: "place_abc1234567",
        shopLocations: [{ address: "DHA Main Market", placeId: "place_abc1234567" }],
        hasTools: true,
        serviceDescription: "Interior and exterior detailing.",
        profilePhotoUrl: "https://example.com/photo.jpg",
      },
      "rid-prov"
    );
  });

  it("ensureProviderListing delegates to service", async () => {
    const service = {
      syncRoleFromClerkSession: vi.fn().mockResolvedValue(undefined),
      ensureProviderStarterListing: vi.fn().mockResolvedValue({ created: true }),
    };
    const controller = new UsersController(service as never);

    const result = await controller.ensureProviderListing({ auth: { sub: "clerk_p" } } as never);

    expect(service.syncRoleFromClerkSession).toHaveBeenCalledWith("clerk_p", { sub: "clerk_p" });
    expect(service.ensureProviderStarterListing).toHaveBeenCalledWith("clerk_p");
    expect(result).toEqual({ created: true });
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

  it("updates provider presence for authenticated provider", async () => {
    const service = {
      updateProviderPresence: vi.fn().mockResolvedValue({ ok: true }),
    };
    const controller = new UsersController(service as never);

    await controller.updateProviderPresence(
      { auth: { sub: "clerk_provider" } } as never,
      { isOnline: true }
    );

    expect(service.updateProviderPresence).toHaveBeenCalledWith("clerk_provider", true);
  });

  it("updates provider availability calendar for authenticated provider", async () => {
    const service = {
      updateProviderAvailability: vi.fn().mockResolvedValue({ ok: true }),
    };
    const controller = new UsersController(service as never);
    const days = [{ date: "2026-08-20", enabled: true, startHour: 9, endHour: 18 }];

    await controller.updateProviderAvailability(
      { auth: { sub: "clerk_provider" } } as never,
      { days }
    );

    expect(service.updateProviderAvailability).toHaveBeenCalledWith("clerk_provider", days);
  });

  it("findOne hides phone from non-admin callers", async () => {
    const service = {
      findByClerkId: vi.fn().mockResolvedValue({ id: "me", role: "CUSTOMER" }),
      findById: vi.fn().mockResolvedValue({ id: "me", firstName: "Ada", phone: "+15551212" }),
    };
    const controller = new UsersController(service as never);

    const out = await controller.findOne("me", {
      auth: { sub: "clerk_me", public_metadata: { role: "CUSTOMER" } },
    } as never);

    expect(out).toEqual({ id: "me", firstName: "Ada" });
    expect(out).not.toHaveProperty("phone");
  });

  it("findOne includes phone for admin", async () => {
    const service = {
      findByClerkId: vi.fn().mockResolvedValue({ id: "admin_user", role: "ADMIN" }),
      findById: vi.fn().mockResolvedValue({ id: "user_x", phone: "+15551212" }),
    };
    const controller = new UsersController(service as never);

    const out = await controller.findOne("user_x", {
      auth: { sub: "clerk_admin", public_metadata: { role: "ADMIN" } },
    } as never);

    expect(out).toEqual({ id: "user_x", phone: "+15551212" });
  });

  it("findOne blocks non-admin from accessing another user", async () => {
    const service = {
      findByClerkId: vi.fn().mockResolvedValue({ id: "me" }),
      findById: vi.fn(),
    };
    const controller = new UsersController(service as never);

    await expect(
      controller.findOne("other", {
        auth: { sub: "clerk_me", public_metadata: { role: "CUSTOMER" } },
      } as never)
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("findOne allows non-admin to access own profile", async () => {
    const service = {
      findByClerkId: vi.fn().mockResolvedValue({ id: "me" }),
      findById: vi.fn().mockResolvedValue({ id: "me" }),
    };
    const controller = new UsersController(service as never);

    const out = await controller.findOne("me", {
      auth: { sub: "clerk_me", public_metadata: { role: "CUSTOMER" } },
    } as never);

    expect(out).toEqual({ id: "me" });
    expect(service.findByClerkId).toHaveBeenCalledWith("clerk_me");
    expect(service.findById).toHaveBeenCalledWith("me");
  });
});
