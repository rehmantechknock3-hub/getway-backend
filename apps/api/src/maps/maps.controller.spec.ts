import { describe, expect, it, vi } from "vitest";

import { MapsController } from "./maps.controller";

describe("MapsController", () => {
  it("parses query and returns driving leg", async () => {
    const googleMaps = {
      resolveDrivingLeg: vi.fn().mockResolvedValue({
        distanceMeters: 1000,
        distanceKm: 1,
        durationSeconds: 120,
        kind: "DRIVING",
      }),
    };

    const controller = new MapsController(googleMaps as never);
    const req = { auth: { sub: "clerk_test" }, requestId: "rid-1" } as never;

    const result = await controller.drivingLeg(req, {
      originLatitude: "1",
      originLongitude: "2",
      destLatitude: "1.01",
      destLongitude: "2.01",
    });

    expect(googleMaps.resolveDrivingLeg).toHaveBeenCalledWith(1, 2, 1.01, 2.01, "rid-1");
    expect(result).toEqual({
      distanceMeters: 1000,
      distanceKm: 1,
      durationSeconds: 120,
      kind: "DRIVING",
    });
  });

  it("parses query and returns driving route", async () => {
    const googleMaps = {
      resolveDrivingRoute: vi.fn().mockResolvedValue({
        distanceMeters: 1200,
        distanceKm: 1.2,
        durationSeconds: 180,
        kind: "DRIVING",
        path: [
          { latitude: 1, longitude: 2 },
          { latitude: 1.01, longitude: 2.01 },
        ],
      }),
    };

    const controller = new MapsController(googleMaps as never);
    const req = { auth: { sub: "clerk_test" }, requestId: "rid-2" } as never;

    const result = await controller.drivingRoute(req, {
      originLatitude: "1",
      originLongitude: "2",
      destLatitude: "1.01",
      destLongitude: "2.01",
    });

    expect(googleMaps.resolveDrivingRoute).toHaveBeenCalledWith(1, 2, 1.01, 2.01, "rid-2");
    expect(result).toEqual({
      distanceMeters: 1200,
      distanceKm: 1.2,
      durationSeconds: 180,
      kind: "DRIVING",
      path: [
        { latitude: 1, longitude: 2 },
        { latitude: 1.01, longitude: 2.01 },
      ],
    });
  });
});
