import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthController } from "./auth.controller";

const getUser = vi.fn();
const updateUserMetadata = vi.fn();
const executeRaw = vi.fn();

vi.mock("@clerk/backend", () => ({
  createClerkClient: () => ({
    users: {
      getUser,
      updateUserMetadata,
    },
  }),
}));

describe("AuthController", () => {
  const configService = {
    get: vi.fn().mockReturnValue("sk_test"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    configService.get.mockReturnValue("sk_test");
    executeRaw.mockResolvedValue(1);
  });

  it("rejects invalid role payload", async () => {
    const controller = new AuthController(
      {
        $transaction: vi.fn(),
      } as never,
      { upsertFromClerk: vi.fn() } as never,
      configService as never
    );

    await expect(
      controller.setRole({ role: "ADMIN" }, { auth: { sub: "clerk_1" } } as never)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects when role is already set", async () => {
    getUser.mockResolvedValue({
      id: "clerk_1",
      publicMetadata: { role: "CUSTOMER" },
    });
    const transaction = vi.fn(async (cb: (tx: { $executeRaw: typeof executeRaw }) => unknown) =>
      cb({ $executeRaw: executeRaw })
    );
    const controller = new AuthController(
      { $transaction: transaction } as never,
      { upsertFromClerk: vi.fn() } as never,
      configService as never
    );

    await expect(
      controller.setRole({ role: "PROVIDER" }, { auth: { sub: "clerk_1" } } as never)
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("sets role only on first assignment", async () => {
    getUser.mockResolvedValue({
      id: "clerk_1",
      publicMetadata: {},
      primaryEmailAddressId: "em_1",
      emailAddresses: [{ id: "em_1", emailAddress: "user@example.com" }],
      firstName: "A",
      lastName: "B",
      imageUrl: "https://example.com/a.png",
    });
    const usersService = { upsertFromClerk: vi.fn().mockResolvedValue({ id: "u1" }) };
    const transaction = vi.fn(async (cb: (tx: { $executeRaw: typeof executeRaw }) => unknown) =>
      cb({ $executeRaw: executeRaw })
    );
    const controller = new AuthController(
      { $transaction: transaction } as never,
      usersService as never,
      configService as never
    );

    const out = await controller.setRole(
      { role: "PROVIDER" },
      { auth: { sub: "clerk_1" } } as never
    );

    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(updateUserMetadata).toHaveBeenCalledWith("clerk_1", {
      publicMetadata: { role: "PROVIDER" },
    });
    expect(usersService.upsertFromClerk).toHaveBeenCalled();
    expect(out).toEqual({ id: "u1" });
  });
});
