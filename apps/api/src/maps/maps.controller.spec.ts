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

  it("returns place autocomplete predictions", async () => {
    const googleMaps = {
      autocompletePlaces: vi.fn().mockResolvedValue([
        { description: "Lahore Fort", placeId: "abc" },
      ]),
    };
    const controller = new MapsController(googleMaps as never);
    const req = { auth: { sub: "clerk_test" }, requestId: "rid-3" } as never;

    const result = await controller.placesAutocomplete(req, { q: "Lahore" });

    expect(googleMaps.autocompletePlaces).toHaveBeenCalledWith({
      query: "Lahore",
      requestId: "rid-3",
    });
    expect(result).toEqual({
      predictions: [{ description: "Lahore Fort", placeId: "abc" }],
    });
  });

  it("returns place details", async () => {
    const googleMaps = {
      resolvePlaceDetails: vi.fn().mockResolvedValue({
        address: "Lahore Fort, Lahore",
        latitude: 31.588,
        longitude: 74.315,
        placeId: "abc",
      }),
    };
    const controller = new MapsController(googleMaps as never);
    const req = { auth: { sub: "clerk_test" }, requestId: "rid-4" } as never;

    const result = await controller.placeDetails(req, { placeId: "abc" });

    expect(result.placeId).toBe("abc");
    expect(result.latitude).toBe(31.588);
  });

  it("returns reverse geocode result", async () => {
    const googleMaps = {
      reverseGeocode: vi.fn().mockResolvedValue({
        address: "Pinned location",
        latitude: 31.52,
        longitude: 74.35,
      }),
    };
    const controller = new MapsController(googleMaps as never);
    const req = { auth: { sub: "clerk_test" }, requestId: "rid-5" } as never;

    const result = await controller.reverseGeocode(req, {
      latitude: "31.52",
      longitude: "74.35",
    });

    expect(googleMaps.reverseGeocode).toHaveBeenCalledWith({
      latitude: 31.52,
      longitude: 74.35,
      requestId: "rid-5",
    });
    expect(result.address).toBe("Pinned location");
  });
});
