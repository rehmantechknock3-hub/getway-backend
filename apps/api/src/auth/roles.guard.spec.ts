import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { RolesGuard } from "./roles.guard";

describe("RolesGuard", () => {
  const reflector = {
    getAllAndOverride: vi.fn(),
  };
  const usersService = {
    findByClerkId: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function buildContext(auth: { sub?: string; public_metadata?: { role?: string } }) {
    const request = { auth } as never;
    return {
      context: {
        getHandler: vi.fn(),
        getClass: vi.fn(),
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext,
      request,
    };
  }

  it("allows when no roles are required", async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const guard = new RolesGuard(reflector as never, usersService as never);
    const { context } = buildContext({ sub: "clerk_1" });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("allows admin route for admin user", async () => {
    reflector.getAllAndOverride.mockReturnValue(["ADMIN"]);
    usersService.findByClerkId.mockResolvedValue({ role: "ADMIN" });
    const guard = new RolesGuard(reflector as never, usersService as never);
    const { context } = buildContext({ sub: "clerk_1" });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("rejects when required role is missing", async () => {
    reflector.getAllAndOverride.mockReturnValue(["ADMIN"]);
    usersService.findByClerkId.mockResolvedValue({ role: "CUSTOMER" });
    const guard = new RolesGuard(reflector as never, usersService as never);
    const { context } = buildContext({ sub: "clerk_1" });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
