import { useEffect, useState } from "react";

export type Coordinates = {
  latitude:  number;
  longitude: number;
  accuracy?: number;
};

export type LocationState = {
  coordinates: Coordinates | null;
  error:       string | null;
  isLoading:   boolean;
};

/**
 * Platform-agnostic location hook interface.
 * Use this type to ensure your platform-specific implementation
 * (expo-location on mobile, navigator.geolocation on web)
 * conforms to the shared contract.
 */
export type UseLocationReturn = LocationState & {
  refresh: () => void;
};
