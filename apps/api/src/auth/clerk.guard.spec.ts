import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { ClerkAuthGuard } from "./clerk.guard";

const { verifyTokenMock } = vi.hoisted(() => ({
  verifyTokenMock: vi.fn(),
}));

vi.mock("@clerk/backend", () => ({
  verifyToken: verifyTokenMock,
}));

describe("ClerkAuthGuard", () => {
  const reflector = {
    getAllAndOverride: vi.fn(),
  };
  const configService = {
    get: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    reflector.getAllAndOverride.mockReturnValue(false);
    configService.get.mockReturnValue("sk_test");
  });

  it("allows public routes", async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const guard = new ClerkAuthGuard(reflector as never, configService as never);
    const request = { headers: {} } as never;
    const context = {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verifyTokenMock).not.toHaveBeenCalled();
  });

  it("rejects missing bearer token", async () => {
    const guard = new ClerkAuthGuard(reflector as never, configService as never);
    const request = { headers: {} } as never;
    const context = {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("attaches payload to request when token is valid", async () => {
    verifyTokenMock.mockResolvedValue({ sub: "clerk_123" });
    const guard = new ClerkAuthGuard(reflector as never, configService as never);
    const request = { headers: { authorization: "Bearer token_abc" } } as never;
    const context = {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.auth).toMatchObject({ sub: "clerk_123" });
  });
});
