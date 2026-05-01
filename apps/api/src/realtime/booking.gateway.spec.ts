import { describe, expect, it, vi } from "vitest";

import { Logger } from "@nestjs/common";

import { BookingGateway } from "./booking.gateway";

describe("BookingGateway", () => {
  it("rejects socket connection without auth token", async () => {
    const configService = {
      get: vi.fn(),
    };
    const gateway = new BookingGateway(configService as never);

    const disconnect = vi.fn();
    const join = vi.fn();
    const client = {
      id: "sock-1",
      handshake: { auth: {}, query: {} },
      disconnect,
      join,
      rooms: new Set<string>(),
      data: {},
    };

    const loggerWarnSpy = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

    await gateway.handleConnection(client as never);

    expect(disconnect).toHaveBeenCalled();
    expect(join).not.toHaveBeenCalled();
    loggerWarnSpy.mockRestore();
  });
});
