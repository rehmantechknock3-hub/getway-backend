import { useEffect, useRef, useState } from "react";
import type { BookingStatus } from "@repo/schemas";

export type LocationUpdate = {
  latitude:  number;
  longitude: number;
  heading?:  number;
  speed?:    number;
};

export type BookingTrackingState = {
  status:           BookingStatus | null;
  providerLocation: LocationUpdate | null;
  isConnected:      boolean;
};

/**
 * Subscribes to real-time booking status and provider location
 * via Socket.io. Apps inject the socket instance via the socketRef param.
 */
export function useBookingTracking(
  bookingId: string | null,
  socket: { on: Function; off: Function } | null
): BookingTrackingState {
  const [state, setState] = useState<BookingTrackingState>({
    status:           null,
    providerLocation: null,
    isConnected:      false,
  });

  useEffect(() => {
    if (!socket || !bookingId) return;

    setState((s) => ({ ...s, isConnected: true }));

    const onStatusChange = (data: { status: BookingStatus }) => {
      setState((s) => ({ ...s, status: data.status }));
    };

    const onLocationUpdate = (data: LocationUpdate) => {
      setState((s) => ({ ...s, providerLocation: data }));
    };

    socket.on("booking:status_changed", onStatusChange);
    socket.on("location:updated", onLocationUpdate);

    return () => {
      socket.off("booking:status_changed", onStatusChange);
      socket.off("location:updated", onLocationUpdate);
      setState((s) => ({ ...s, isConnected: false }));
    };
  }, [bookingId, socket]);

  return state;
}
