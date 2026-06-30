import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { BookingStatus, type BookingStatus as BookingStatusType } from "@repo/schemas";

export type LocationUpdate = {
  latitude:  number;
  longitude: number;
  heading?:  number;
  speed?:    number;
};

export type BookingTrackingState = {
  status:           BookingStatusType | null;
  providerLocation: LocationUpdate | null;
  isConnected:      boolean;
};

/**
 * Subscribes to real-time booking status and provider location
 * via Socket.io. Apps inject the socket instance via the socketRef param.
 */
export function useBookingTracking(
  bookingId: string | null,
  socket: {
    on: (event: string, callback: (...args: unknown[]) => void) => void;
    off: (event: string, callback: (...args: unknown[]) => void) => void;
    connected?: boolean;
  } | null
): BookingTrackingState {
  const [state, setState] = useState<BookingTrackingState>({
    status:           null,
    providerLocation: null,
    isConnected:      false,
  });

  useEffect(() => {
    if (!socket || !bookingId) {
      setState((prev) => {
        if (prev.status === null && prev.providerLocation === null && prev.isConnected === false) {
          return prev;
        }
        return { status: null, providerLocation: null, isConnected: false };
      });
      return;
    }

    setState((prev) => {
      const nextConnected = Boolean(socket.connected);
      if (prev.isConnected === nextConnected) return prev;
      return { ...prev, isConnected: nextConnected };
    });

    const LocationSocketPayloadSchema = z.object({
      latitude:  z.number().finite(),
      longitude: z.number().finite(),
      heading:   z.number().finite().optional(),
      speed:     z.number().finite().optional(),
    });

    const onStatusChange = (...args: unknown[]) => {
      const raw = args[0];
      const parsed = z
        .object({ status: BookingStatus })
        .safeParse(raw);
      if (!parsed.success) return;
      setState((prev) => {
        if (prev.status === parsed.data.status) return prev;
        return { ...prev, status: parsed.data.status };
      });
    };

    const onLocationUpdate = (...args: unknown[]) => {
      const raw = args[0];
      const parsed = LocationSocketPayloadSchema.safeParse(raw);
      if (!parsed.success) return;
      const next: LocationUpdate = {
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        heading: parsed.data.heading,
        speed: parsed.data.speed,
      };
      setState((prev) => {
        const prevLoc = prev.providerLocation;
        if (
          prevLoc != null &&
          prevLoc.latitude === next.latitude &&
          prevLoc.longitude === next.longitude &&
          prevLoc.heading === next.heading &&
          prevLoc.speed === next.speed
        ) {
          return prev;
        }
        return { ...prev, providerLocation: next };
      });
    };

    const onConnect = () => {
      setState((prev) => (prev.isConnected ? prev : { ...prev, isConnected: true }));
    };

    const onDisconnect = () => {
      setState((prev) => (prev.isConnected ? { ...prev, isConnected: false } : prev));
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("booking:status_changed", onStatusChange);
    socket.on("location:updated", onLocationUpdate);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("booking:status_changed", onStatusChange);
      socket.off("location:updated", onLocationUpdate);
    };
  }, [bookingId, socket]);

  return state;
}
