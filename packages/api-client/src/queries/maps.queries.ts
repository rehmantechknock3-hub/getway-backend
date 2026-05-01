import { useQuery } from "@tanstack/react-query";

import { DrivingLegResponseSchema, type DrivingLegResponse } from "@repo/schemas";

import { apiClient } from "../client";

export const mapsKeys = {
  all: () => ["maps"] as const,
  drivingLeg: (args: {
    originLatitude: number;
    originLongitude: number;
    destLatitude: number;
    destLongitude: number;
  }) =>
    [
      "maps",
      "driving-leg",
      args.originLatitude,
      args.originLongitude,
      args.destLatitude,
      args.destLongitude,
    ] as const,
  drivingRoute: (args: {
    originLatitude: number;
    originLongitude: number;
    destLatitude: number;
    destLongitude: number;
  }) =>
    [
      "maps",
      "driving-route",
      args.originLatitude,
      args.originLongitude,
      args.destLatitude,
      args.destLongitude,
    ] as const,
};

export function useDrivingLeg(
  args: {
    originLatitude: number;
    originLongitude: number;
    destLatitude: number;
    destLongitude: number;
  },
  options?: { enabled?: boolean }
) {
  const enabled =
    (options?.enabled ?? true) &&
    Number.isFinite(args.originLatitude) &&
    Number.isFinite(args.originLongitude) &&
    Number.isFinite(args.destLatitude) &&
    Number.isFinite(args.destLongitude);

  return useQuery({
    queryKey: mapsKeys.drivingLeg(args),
    queryFn: async (): Promise<DrivingLegResponse> => {
      const { data } = await apiClient.get<unknown>("/api/v1/maps/driving-leg", { params: args });
      return DrivingLegResponseSchema.parse(data);
    },
    enabled,
    staleTime: 30_000,
  });
}
